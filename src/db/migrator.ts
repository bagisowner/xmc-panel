import fs from 'fs';
import path from 'path';
import { query, withTransaction } from './client.js';

export interface MigrationResult {
  version: string;
  applied: boolean;
  error?: string;
}

export class Migrator {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || path.resolve(process.cwd(), 'src/db/migrations');
  }

  public async runMigrations(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    // Ensure schema_migrations table exists
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const appliedRows = await query<{ version: string }>('SELECT version FROM schema_migrations');
    const appliedSet = new Set(appliedRows.rows.map(r => r.version));

    // Get available migration files sorted
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`[Migrator] Migrations directory does not exist at ${this.migrationsDir}`);
      return results;
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const file of files) {
      if (appliedSet.has(file)) {
        results.push({ version: file, applied: false });
        continue;
      }

      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`[Migrator] Applying migration: ${file}...`);
      try {
        await withTransaction(async (client) => {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        });

        console.log(`[Migrator] Successfully applied migration: ${file}`);
        results.push({ version: file, applied: true });
      } catch (err: any) {
        console.error(`[Migrator] Failed to apply migration ${file}:`, err.message);
        results.push({ version: file, applied: false, error: err.message });
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    return results;
  }

  public async getStatus(): Promise<{ applied: string[]; pending: string[] }> {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRows = await query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY applied_at ASC');
    const applied = appliedRows.rows.map(r => r.version);
    const appliedSet = new Set(applied);

    const files = fs.existsSync(this.migrationsDir)
      ? fs.readdirSync(this.migrationsDir).filter(f => f.endsWith('.sql')).sort()
      : [];

    const pending = files.filter(f => !appliedSet.has(f));

    return { applied, pending };
  }
}
