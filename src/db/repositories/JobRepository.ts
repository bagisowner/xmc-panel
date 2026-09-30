import { query } from '../client.js';
import { Job } from '../schema.js';

export class JobRepository {
  private static instance: JobRepository | null = null;

  public static getInstance(): JobRepository {
    if (!JobRepository.instance) {
      JobRepository.instance = new JobRepository();
    }
    return JobRepository.instance;
  }

  public async findAll(): Promise<Job[]> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", type, status, progress, error, logs,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM jobs
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      logs: Array.isArray(r.logs) ? r.logs : JSON.parse(r.logs || '[]')
    }));
  }

  public async findById(id: string): Promise<Job | null> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", type, status, progress, error, logs,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM jobs
      WHERE id = $1
      LIMIT 1
    `, [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      logs: Array.isArray(r.logs) ? r.logs : JSON.parse(r.logs || '[]')
    };
  }

  public async create(job: Job): Promise<Job> {
    const now = new Date().toISOString();
    const res = await query<any>(`
      INSERT INTO jobs (id, server_id, type, status, progress, error, logs, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        error = EXCLUDED.error,
        logs = EXCLUDED.logs,
        updated_at = NOW()
      RETURNING id, server_id as "serverId", type, status, progress, error, logs,
                created_at as "createdAt", updated_at as "updatedAt"
    `, [
      job.id,
      job.serverId,
      job.type,
      job.status || 'pending',
      job.progress || 0,
      job.error || null,
      JSON.stringify(job.logs || []),
      job.createdAt || now,
      job.updatedAt || now
    ]);
    const r = res.rows[0];
    return {
      ...r,
      logs: Array.isArray(r.logs) ? r.logs : JSON.parse(r.logs || '[]')
    };
  }

  public async update(id: string, updates: Partial<Job>): Promise<Job | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push(`progress = $${idx++}`);
      values.push(updates.progress);
    }
    if (updates.error !== undefined) {
      fields.push(`error = $${idx++}`);
      values.push(updates.error);
    }
    if (updates.logs !== undefined) {
      fields.push(`logs = $${idx++}`);
      values.push(JSON.stringify(updates.logs));
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE jobs
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, server_id as "serverId", type, status, progress, error, logs,
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const res = await query<any>(sql, values);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      logs: Array.isArray(r.logs) ? r.logs : JSON.parse(r.logs || '[]')
    };
  }
}
