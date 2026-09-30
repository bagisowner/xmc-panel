import pg from 'pg';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const { Pool } = pg;

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

let pool: pg.Pool | null = null;
let supabaseClient: SupabaseClient | null = null;
let isConnectedToPostgres = false;
let lastConnectionError: string | null = null;

// Initialize Supabase admin client if environment variables are provided
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[Supabase] Initialized Supabase client successfully.');
  } catch (err: any) {
    console.warn('[Supabase] Failed to initialize Supabase client:', err.message);
  }
}

export function getSupabase(): SupabaseClient | null {
  return supabaseClient;
}

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.POSTGRES_URL;

    const sslConfig =
      process.env.NODE_ENV === 'production' || connectionString?.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false;

    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl: sslConfig,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });
    } else {
      pool = new Pool({
        host: process.env.PGHOST || '127.0.0.1',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'xorvila',
        ssl: sslConfig,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
      });
    }

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
      lastConnectionError = err.message;
      isConnectedToPostgres = false;
    });
  }

  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  const p = getPool();
  try {
    const start = Date.now();
    const res = await p.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL] ${text.slice(0, 80)}... took ${duration}ms, rows: ${res.rowCount}`);
    }
    isConnectedToPostgres = true;
    lastConnectionError = null;
    return res;
  } catch (err: any) {
    lastConnectionError = err.message;
    throw err;
  }
}

export async function testConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await query('SELECT 1 as ping');
    const latency = Date.now() - start;
    if (res.rows[0]?.ping === 1) {
      isConnectedToPostgres = true;
      return { ok: true, latencyMs: latency };
    }
    return { ok: false, error: 'Invalid response from database ping query.' };
  } catch (err: any) {
    isConnectedToPostgres = false;
    lastConnectionError = err.message;
    return { ok: false, error: err.message };
  }
}

export function isDbConnected(): boolean {
  return isConnectedToPostgres;
}

export function getLastDbError(): string | null {
  return lastConnectionError;
}

export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
