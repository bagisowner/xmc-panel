import { query } from '../client.js';
import { Backup } from '../schema.js';

export class BackupRepository {
  private static instance: BackupRepository | null = null;

  public static getInstance(): BackupRepository {
    if (!BackupRepository.instance) {
      BackupRepository.instance = new BackupRepository();
    }
    return BackupRepository.instance;
  }

  public async findAll(): Promise<Backup[]> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, size_bytes::bigint as "sizeBytes",
             status, file_path as "filePath", checksum,
             created_at as "createdAt", completed_at as "completedAt"
      FROM backups
      ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
  }

  public async findByServerId(serverId: string): Promise<Backup[]> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, size_bytes::bigint as "sizeBytes",
             status, file_path as "filePath", checksum,
             created_at as "createdAt", completed_at as "completedAt"
      FROM backups
      WHERE server_id = $1
      ORDER BY created_at DESC
    `, [serverId]);
    return res.rows.map(r => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
  }

  public async findById(id: string): Promise<Backup | null> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", name, size_bytes::bigint as "sizeBytes",
             status, file_path as "filePath", checksum,
             created_at as "createdAt", completed_at as "completedAt"
      FROM backups
      WHERE id = $1
      LIMIT 1
    `, [id]);
    if (!res.rows[0]) return null;
    return { ...res.rows[0], sizeBytes: Number(res.rows[0].sizeBytes) };
  }

  public async create(backup: Backup): Promise<Backup> {
    const res = await query<any>(`
      INSERT INTO backups (id, server_id, name, size_bytes, status, file_path, checksum, created_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        size_bytes = EXCLUDED.size_bytes,
        status = EXCLUDED.status,
        completed_at = EXCLUDED.completed_at
      RETURNING id, server_id as "serverId", name, size_bytes::bigint as "sizeBytes",
                status, file_path as "filePath", checksum,
                created_at as "createdAt", completed_at as "completedAt"
    `, [
      backup.id,
      backup.serverId,
      backup.name,
      backup.sizeBytes || 0,
      backup.status || 'Creating',
      backup.filePath,
      backup.checksum || null,
      backup.createdAt || new Date().toISOString(),
      backup.completedAt || null
    ]);
    return { ...res.rows[0], sizeBytes: Number(res.rows[0].sizeBytes) };
  }

  public async update(id: string, updates: Partial<Backup>): Promise<Backup | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.sizeBytes !== undefined) {
      fields.push(`size_bytes = $${idx++}`);
      values.push(updates.sizeBytes);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.filePath !== undefined) {
      fields.push(`file_path = $${idx++}`);
      values.push(updates.filePath);
    }
    if (updates.checksum !== undefined) {
      fields.push(`checksum = $${idx++}`);
      values.push(updates.checksum);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${idx++}`);
      values.push(updates.completedAt);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE backups
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, server_id as "serverId", name, size_bytes::bigint as "sizeBytes",
                status, file_path as "filePath", checksum,
                created_at as "createdAt", completed_at as "completedAt"
    `;

    const res = await query<any>(sql, values);
    if (!res.rows[0]) return null;
    return { ...res.rows[0], sizeBytes: Number(res.rows[0].sizeBytes) };
  }

  public async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM backups WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
}
