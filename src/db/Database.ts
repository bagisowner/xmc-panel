import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Interfaces for our database records
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'Owner' | 'Administrator' | 'Manager' | 'Developer' | 'Moderator' | 'Support' | 'Viewer';
  permissions: string[];
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  software: 'Vanilla' | 'Paper' | 'Purpur' | 'Spigot' | 'Fabric' | 'Forge' | 'NeoForge' | 'Custom';
  version: string; // e.g. "1.21.1"
  javaVersion: '17' | '21' | '25';
  status: 'Installing' | 'Starting' | 'Running' | 'Stopping' | 'Offline' | 'Crashed' | 'Restarting' | 'Error' | 'Suspended';
  memoryLimitGb: number;
  cpuLimitCores: number;
  diskLimitGb: number;
  primaryPort: number;
  startupCommand: string;
  jvmFlags: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  activeWorld: string;
  autoRestart: 'Never' | 'OnCrash' | 'Always';
  maintenanceMode: boolean;
}

export interface Allocation {
  id: string;
  ipAddress: string;
  port: number;
  serverId: string | null;
  label: string;
  isPrimary: boolean;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  sizeBytes: number;
  status: 'Creating' | 'Completed' | 'Failed' | 'Restoring';
  createdAt: string;
  completedAt?: string;
  filePath: string;
}

export interface Job {
  id: string;
  type: 'install' | 'rebuild' | 'backup' | 'restore' | 'delete' | 'import';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0 to 100
  serverId: string;
  error?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  serverId: string;
  name: string;
  cronExpression: string; // e.g. "0 3 * * *"
  action: 'backup' | 'restart' | 'stop' | 'start';
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  username: string;
  action: string;
  serverId?: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  serverId: string;
  type: 'CPU' | 'RAM' | 'Disk';
  threshold: number; // e.g. 90
  triggerValue: number;
  status: 'Active' | 'Resolved';
  createdAt: string;
}

export interface DbSchema {
  users: User[];
  sessions: Session[];
  servers: Server[];
  allocations: Allocation[];
  backups: Backup[];
  jobs: Job[];
  schedules: Schedule[];
  auditEvents: AuditEvent[];
  alerts: Alert[];
}

const initialDbState: DbSchema = {
  users: [],
  sessions: [],
  servers: [],
  allocations: [],
  backups: [],
  jobs: [],
  schedules: [],
  auditEvents: [],
  alerts: []
};

// Map camelCase to snake_case and back
function camelToSnake(str: string): string {
  if (str === 'auditEvents') return 'audit_events';
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  if (str === 'audit_events') return 'auditEvents';
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRowToObj(row: any): any {
  if (!row) return row;
  const obj: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = snakeToCamel(key);
    obj[camelKey] = row[key];
  }
  return obj;
}

function mapObjToRow(obj: any): any {
  if (!obj) return obj;
  const row: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = camelToSnake(key);
    row[snakeKey] = obj[key];
  }
  return row;
}

export class Database {
  private static instance: Database | null = null;
  private pool!: pg.Pool;
  private data: DbSchema = { ...initialDbState };
  private isInitialized = false;
  private isFallback = false;
  private dbFilePath = '';

  private constructor() {
    this.dbFilePath = path.join(process.cwd(), 'db.json');
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/minecraft';
    try {
      this.pool = new pg.Pool({ connectionString });
    } catch (err) {
      console.warn('[PostgreSQL] Could not create connection pool, will use JSON fallback:', err);
      this.isFallback = true;
    }
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private async initFallback(): Promise<void> {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const fileContent = fs.readFileSync(this.dbFilePath, 'utf8');
        try {
          this.data = JSON.parse(fileContent);
          // Ensure all tables exist in the parsed object
          for (const key of Object.keys(initialDbState) as Array<keyof DbSchema>) {
            if (!this.data[key]) {
              this.data[key] = [];
            }
          }
          console.log('[JSON Database] Loaded existing data successfully.');
        } catch (parseErr) {
          console.error('[JSON Database] Error parsing db.json, starting fresh.', parseErr);
          this.data = JSON.parse(JSON.stringify(initialDbState));
          await this.saveToFile();
        }
      } else {
        console.log('[JSON Database] db.json does not exist, initializing fresh database.');
        this.data = JSON.parse(JSON.stringify(initialDbState));
        await this.saveToFile();
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[JSON Database] CRITICAL: Failed to initialize fallback database!', err);
      throw err;
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[JSON Database] Failed to save database to file:', err);
    }
  }

  /**
   * Run real auto-migration and load the dataset into in-memory cache on startup
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.isFallback) {
      await this.initFallback();
      return;
    }

    try {
      // Test the pool connection with a fast timeout
      const testPromise = this.pool.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 1500)
      );
      await Promise.race([testPromise, timeoutPromise]);

      // Create tables if they do not exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          permissions TEXT[] NOT NULL,
          created_at VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          token TEXT NOT NULL,
          expires_at VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS servers (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          software VARCHAR(50) NOT NULL,
          version VARCHAR(50) NOT NULL,
          java_version VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          memory_limit_gb INTEGER NOT NULL,
          cpu_limit_cores INTEGER NOT NULL,
          disk_limit_gb INTEGER NOT NULL,
          primary_port INTEGER NOT NULL,
          startup_command TEXT NOT NULL,
          jvm_flags TEXT NOT NULL,
          variables JSONB NOT NULL,
          created_at VARCHAR(255) NOT NULL,
          updated_at VARCHAR(255) NOT NULL,
          active_world VARCHAR(255) NOT NULL,
          auto_restart VARCHAR(50) NOT NULL,
          maintenance_mode BOOLEAN NOT NULL
        );

        CREATE TABLE IF NOT EXISTS allocations (
          id VARCHAR(255) PRIMARY KEY,
          ip_address VARCHAR(50) NOT NULL,
          port INTEGER NOT NULL UNIQUE,
          server_id VARCHAR(255) REFERENCES servers(id) ON DELETE SET NULL,
          label VARCHAR(255) NOT NULL,
          is_primary BOOLEAN NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backups (
          id VARCHAR(255) PRIMARY KEY,
          server_id VARCHAR(255) REFERENCES servers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          size_bytes BIGINT NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at VARCHAR(255) NOT NULL,
          completed_at VARCHAR(255),
          file_path TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY,
          server_id VARCHAR(255) REFERENCES servers(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          progress INTEGER NOT NULL,
          logs TEXT[] NOT NULL,
          error TEXT,
          created_at VARCHAR(255) NOT NULL,
          updated_at VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedules (
          id VARCHAR(255) PRIMARY KEY,
          server_id VARCHAR(255) REFERENCES servers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          cron_expression VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL,
          is_active BOOLEAN NOT NULL,
          last_run VARCHAR(255),
          next_run VARCHAR(255),
          created_at VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NOT NULL,
          action VARCHAR(255) NOT NULL,
          server_id VARCHAR(255),
          details TEXT NOT NULL,
          ip_address VARCHAR(50) NOT NULL,
          created_at VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
          id VARCHAR(255) PRIMARY KEY,
          server_id VARCHAR(255) REFERENCES servers(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          threshold INTEGER NOT NULL,
          trigger_value REAL NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at VARCHAR(255) NOT NULL
        );
      `);

      console.log('[PostgreSQL] DB Tables initialized successfully.');

      // Load all data into cache
      await this.refreshCache();
      this.isInitialized = true;
      console.log('[PostgreSQL] Cache loaded successfully.');
    } catch (err) {
      console.warn('[PostgreSQL] Database connection failed or timed out. Falling back to JSON database at ./db.json.', err);
      this.isFallback = true;
      await this.initFallback();
    }
  }

  private async refreshCache(): Promise<void> {
    const usersRes = await this.pool.query('SELECT * FROM users');
    const sessionsRes = await this.pool.query('SELECT * FROM sessions');
    const serversRes = await this.pool.query('SELECT * FROM servers');
    const allocationsRes = await this.pool.query('SELECT * FROM allocations');
    const backupsRes = await this.pool.query('SELECT * FROM backups');
    const jobsRes = await this.pool.query('SELECT * FROM jobs');
    const schedulesRes = await this.pool.query('SELECT * FROM schedules');
    const auditRes = await this.pool.query('SELECT * FROM audit_events');
    const alertsRes = await this.pool.query('SELECT * FROM alerts');

    this.data = {
      users: usersRes.rows.map(mapRowToObj),
      sessions: sessionsRes.rows.map(mapRowToObj),
      servers: serversRes.rows.map(mapRowToObj),
      allocations: allocationsRes.rows.map(mapRowToObj),
      backups: backupsRes.rows.map(mapRowToObj).map(b => ({ ...b, sizeBytes: parseInt(b.sizeBytes, 10) || 0 })),
      jobs: jobsRes.rows.map(mapRowToObj),
      schedules: schedulesRes.rows.map(mapRowToObj),
      auditEvents: auditRes.rows.map(mapRowToObj),
      alerts: alertsRes.rows.map(mapRowToObj)
    };
  }

  // Synchronous table accessor for compatibility
  public getTable<K extends keyof DbSchema>(table: K): DbSchema[K] {
    return this.data[table];
  }

  /**
   * Persist insert to PostgreSQL and immediately push to Cache
   */
  public async insert<K extends keyof DbSchema>(table: K, item: any): Promise<void> {
    if (this.isFallback) {
      this.data[table].push(item);
      await this.saveToFile();
      return;
    }

    try {
      const pgTable = camelToSnake(table);
      const row = mapObjToRow(item);

      const keys = Object.keys(row);
      const columns = keys.join(', ');
      const valuePlaceholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = keys.map(k => row[k]);

      const query = `INSERT INTO ${pgTable} (${columns}) VALUES (${valuePlaceholders})`;
      await this.pool.query(query, values);

      // Push to cache
      this.data[table].push(item);
    } catch (err) {
      console.error(`[PostgreSQL] Failed to insert into ${table}:`, err);
      throw err;
    }
  }

  /**
   * Persist update to PostgreSQL and update Cache
   */
  public async update<K extends keyof DbSchema>(
    table: K,
    predicate: (item: any) => boolean,
    updater: (item: any) => void
  ): Promise<boolean> {
    if (this.isFallback) {
      const items = this.data[table];
      let updated = false;

      for (const item of items) {
        if (predicate(item)) {
          updater(item);
          updated = true;
        }
      }

      if (updated) {
        await this.saveToFile();
      }
      return updated;
    }

    try {
      const pgTable = camelToSnake(table);
      const items = this.data[table];
      let updated = false;

      for (const item of items) {
        if (predicate(item)) {
          // Apply changes locally to item
          updater(item);
          updated = true;

          // Persist update for this item
          const row = mapObjToRow(item);
          const keys = Object.keys(row).filter(k => k !== 'id');
          const setString = keys.map((k, idx) => `${k} = $${idx + 2}`).join(', ');
          const values = [row.id, ...keys.map(k => row[k])];

          const query = `UPDATE ${pgTable} SET ${setString} WHERE id = $1`;
          await this.pool.query(query, values);
        }
      }

      return updated;
    } catch (err) {
      console.error(`[PostgreSQL] Failed to update ${table}:`, err);
      throw err;
    }
  }

  /**
   * Persist delete to PostgreSQL and update Cache
   */
  public async delete<K extends keyof DbSchema>(
    table: K,
    predicate: (item: any) => boolean
  ): Promise<boolean> {
    if (this.isFallback) {
      const initialLen = this.data[table].length;
      this.data[table] = this.data[table].filter(item => !predicate(item)) as any;
      const deleted = this.data[table].length < initialLen;
      if (deleted) {
        await this.saveToFile();
      }
      return deleted;
    }

    try {
      const pgTable = camelToSnake(table);
      const initialLen = this.data[table].length;
      const toDelete = this.data[table].filter(predicate);

      if (toDelete.length > 0) {
        for (const item of toDelete) {
          const query = `DELETE FROM ${pgTable} WHERE id = $1`;
          await this.pool.query(query, [item.id]);
        }
        this.data[table] = this.data[table].filter(item => !predicate(item)) as any;
        return true;
      }

      return false;
    } catch (err) {
      console.error(`[PostgreSQL] Failed to delete from ${table}:`, err);
      throw err;
    }
  }
}
