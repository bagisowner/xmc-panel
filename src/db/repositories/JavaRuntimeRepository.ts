import { query } from '../client.js';
import { JavaRuntimeRecord } from '../schema.js';

export class JavaRuntimeRepository {
  private static instance: JavaRuntimeRepository | null = null;

  public static getInstance(): JavaRuntimeRepository {
    if (!JavaRuntimeRepository.instance) {
      JavaRuntimeRepository.instance = new JavaRuntimeRepository();
    }
    return JavaRuntimeRepository.instance;
  }

  public async findAll(): Promise<JavaRuntimeRecord[]> {
    const res = await query<any>(`
      SELECT id, name, version, major, vendor, path, directory, status,
             size_bytes::bigint as "sizeBytes", size_formatted as "sizeFormatted",
             verification, installed_at as "installedAt", updated_at as "updatedAt"
      FROM java_runtimes
      ORDER BY major ASC
    `);
    return res.rows.map(r => ({
      ...r,
      sizeBytes: Number(r.sizeBytes)
    }));
  }

  public async findByVersion(version: string): Promise<JavaRuntimeRecord | null> {
    const cleanVer = String(version).replace(/[^0-9]/g, '');
    const res = await query<any>(`
      SELECT id, name, version, major, vendor, path, directory, status,
             size_bytes::bigint as "sizeBytes", size_formatted as "sizeFormatted",
             verification, installed_at as "installedAt", updated_at as "updatedAt"
      FROM java_runtimes
      WHERE version = $1 OR major = $2 OR id = $1
      LIMIT 1
    `, [cleanVer, parseInt(cleanVer, 10) || 0]);
    if (!res.rows[0]) return null;
    return { ...res.rows[0], sizeBytes: Number(res.rows[0].sizeBytes) };
  }

  public async save(runtime: JavaRuntimeRecord): Promise<JavaRuntimeRecord> {
    const res = await query<any>(`
      INSERT INTO java_runtimes (
        id, name, version, major, vendor, path, directory, status, size_bytes, size_formatted, verification, installed_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        major = EXCLUDED.major,
        vendor = EXCLUDED.vendor,
        path = EXCLUDED.path,
        directory = EXCLUDED.directory,
        status = EXCLUDED.status,
        size_bytes = EXCLUDED.size_bytes,
        size_formatted = EXCLUDED.size_formatted,
        verification = EXCLUDED.verification,
        updated_at = NOW()
      RETURNING id, name, version, major, vendor, path, directory, status,
                size_bytes::bigint as "sizeBytes", size_formatted as "sizeFormatted",
                verification, installed_at as "installedAt", updated_at as "updatedAt"
    `, [
      runtime.id,
      runtime.name,
      runtime.version,
      runtime.major,
      runtime.vendor || 'Eclipse Adoptium (Temurin)',
      runtime.path,
      runtime.directory,
      runtime.status || 'Installed',
      runtime.sizeBytes || 0,
      runtime.sizeFormatted || '0 MB',
      JSON.stringify(runtime.verification || {}),
      runtime.installedAt || new Date().toISOString()
    ]);
    const r = res.rows[0];
    return { ...r, sizeBytes: Number(r.sizeBytes) };
  }

  public async delete(versionOrId: string): Promise<boolean> {
    const cleanVer = String(versionOrId).replace(/[^0-9]/g, '');
    const res = await query(`
      DELETE FROM java_runtimes
      WHERE id = $1 OR version = $2 OR major = $3
    `, [versionOrId, cleanVer, parseInt(cleanVer, 10) || 0]);
    return (res.rowCount || 0) > 0;
  }
}
