import { query } from '../client.js';
import { NodeRecord } from '../schema.js';

export class NodeRepository {
  private static instance: NodeRepository | null = null;

  public static getInstance(): NodeRepository {
    if (!NodeRepository.instance) {
      NodeRepository.instance = new NodeRepository();
    }
    return NodeRepository.instance;
  }

  public async findAll(): Promise<NodeRecord[]> {
    const res = await query<any>(`
      SELECT id, name, description, hostname, ip_address as "ipAddress", port,
             status, location, country,
             max_memory_gb::numeric as "maxMemoryGb",
             allocated_memory_gb::numeric as "allocatedMemoryGb",
             max_cpu_cores as "maxCpuCores",
             allocated_cpu_cores as "allocatedCpuCores",
             max_disk_gb::numeric as "maxDiskGb",
             allocated_disk_gb::numeric as "allocatedDiskGb",
             port_range as "portRange", enabled, daemon_status as "daemonStatus",
             last_heartbeat as "lastHeartbeat",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM nodes
      ORDER BY created_at ASC
    `);
    return res.rows.map(r => ({
      ...r,
      maxMemoryGb: Number(r.maxMemoryGb),
      allocatedMemoryGb: Number(r.allocatedMemoryGb),
      maxCpuCores: Number(r.maxCpuCores),
      allocatedCpuCores: Number(r.allocatedCpuCores),
      maxDiskGb: Number(r.maxDiskGb),
      allocatedDiskGb: Number(r.allocatedDiskGb)
    }));
  }

  public async findById(id: string): Promise<NodeRecord | null> {
    const res = await query<any>(`
      SELECT id, name, description, hostname, ip_address as "ipAddress", port,
             status, location, country,
             max_memory_gb::numeric as "maxMemoryGb",
             allocated_memory_gb::numeric as "allocatedMemoryGb",
             max_cpu_cores as "maxCpuCores",
             allocated_cpu_cores as "allocatedCpuCores",
             max_disk_gb::numeric as "maxDiskGb",
             allocated_disk_gb::numeric as "allocatedDiskGb",
             port_range as "portRange", enabled, daemon_status as "daemonStatus",
             last_heartbeat as "lastHeartbeat",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM nodes
      WHERE id = $1
      LIMIT 1
    `, [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      maxMemoryGb: Number(r.maxMemoryGb),
      allocatedMemoryGb: Number(r.allocatedMemoryGb),
      maxCpuCores: Number(r.maxCpuCores),
      allocatedCpuCores: Number(r.allocatedCpuCores),
      maxDiskGb: Number(r.maxDiskGb),
      allocatedDiskGb: Number(r.allocatedDiskGb)
    };
  }

  public async create(node: Partial<NodeRecord> & { id: string; name: string }): Promise<NodeRecord> {
    const now = new Date().toISOString();
    const res = await query<any>(`
      INSERT INTO nodes (
        id, name, description, hostname, ip_address, port, status, location, country,
        max_memory_gb, allocated_memory_gb, max_cpu_cores, allocated_cpu_cores,
        max_disk_gb, allocated_disk_gb, port_range, enabled, daemon_status, last_heartbeat,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        hostname = EXCLUDED.hostname,
        ip_address = EXCLUDED.ip_address,
        port = EXCLUDED.port,
        status = EXCLUDED.status,
        location = EXCLUDED.location,
        country = EXCLUDED.country,
        max_memory_gb = EXCLUDED.max_memory_gb,
        max_cpu_cores = EXCLUDED.max_cpu_cores,
        max_disk_gb = EXCLUDED.max_disk_gb,
        port_range = EXCLUDED.port_range,
        enabled = EXCLUDED.enabled,
        daemon_status = EXCLUDED.daemon_status,
        last_heartbeat = EXCLUDED.last_heartbeat,
        updated_at = NOW()
      RETURNING id, name, description, hostname, ip_address as "ipAddress", port,
                status, location, country,
                max_memory_gb::numeric as "maxMemoryGb",
                allocated_memory_gb::numeric as "allocatedMemoryGb",
                max_cpu_cores as "maxCpuCores",
                allocated_cpu_cores as "allocatedCpuCores",
                max_disk_gb::numeric as "maxDiskGb",
                allocated_disk_gb::numeric as "allocatedDiskGb",
                port_range as "portRange", enabled, daemon_status as "daemonStatus",
                last_heartbeat as "lastHeartbeat",
                created_at as "createdAt", updated_at as "updatedAt"
    `, [
      node.id,
      node.name,
      node.description || '',
      node.hostname || null,
      node.ipAddress || '127.0.0.1',
      node.port || 8080,
      node.status || 'ONLINE',
      node.location || 'India',
      node.country || 'India',
      node.maxMemoryGb || 32,
      node.allocatedMemoryGb || 0,
      node.maxCpuCores || 8,
      node.allocatedCpuCores || 0,
      node.maxDiskGb || 200,
      node.allocatedDiskGb || 0,
      node.portRange || '25565-25600',
      node.enabled ?? true,
      node.daemonStatus || 'Connected',
      node.lastHeartbeat || now,
      node.createdAt || now,
      node.updatedAt || now
    ]);

    const r = res.rows[0];
    return {
      ...r,
      maxMemoryGb: Number(r.maxMemoryGb),
      allocatedMemoryGb: Number(r.allocatedMemoryGb),
      maxCpuCores: Number(r.maxCpuCores),
      allocatedCpuCores: Number(r.allocatedCpuCores),
      maxDiskGb: Number(r.maxDiskGb),
      allocatedDiskGb: Number(r.allocatedDiskGb)
    };
  }

  public async update(id: string, updates: Partial<NodeRecord>): Promise<NodeRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.hostname !== undefined) {
      fields.push(`hostname = $${idx++}`);
      values.push(updates.hostname);
    }
    if (updates.ipAddress !== undefined) {
      fields.push(`ip_address = $${idx++}`);
      values.push(updates.ipAddress);
    }
    if (updates.port !== undefined) {
      fields.push(`port = $${idx++}`);
      values.push(updates.port);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.location !== undefined) {
      fields.push(`location = $${idx++}`);
      values.push(updates.location);
    }
    if (updates.country !== undefined) {
      fields.push(`country = $${idx++}`);
      values.push(updates.country);
    }
    if (updates.maxMemoryGb !== undefined) {
      fields.push(`max_memory_gb = $${idx++}`);
      values.push(updates.maxMemoryGb);
    }
    if (updates.allocatedMemoryGb !== undefined) {
      fields.push(`allocated_memory_gb = $${idx++}`);
      values.push(updates.allocatedMemoryGb);
    }
    if (updates.maxCpuCores !== undefined) {
      fields.push(`max_cpu_cores = $${idx++}`);
      values.push(updates.maxCpuCores);
    }
    if (updates.allocatedCpuCores !== undefined) {
      fields.push(`allocated_cpu_cores = $${idx++}`);
      values.push(updates.allocatedCpuCores);
    }
    if (updates.maxDiskGb !== undefined) {
      fields.push(`max_disk_gb = $${idx++}`);
      values.push(updates.maxDiskGb);
    }
    if (updates.allocatedDiskGb !== undefined) {
      fields.push(`allocated_disk_gb = $${idx++}`);
      values.push(updates.allocatedDiskGb);
    }
    if (updates.portRange !== undefined) {
      fields.push(`port_range = $${idx++}`);
      values.push(updates.portRange);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(updates.enabled);
    }
    if (updates.daemonStatus !== undefined) {
      fields.push(`daemon_status = $${idx++}`);
      values.push(updates.daemonStatus);
    }
    if (updates.lastHeartbeat !== undefined) {
      fields.push(`last_heartbeat = $${idx++}`);
      values.push(updates.lastHeartbeat);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE nodes
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, description, hostname, ip_address as "ipAddress", port,
                status, location, country,
                max_memory_gb::numeric as "maxMemoryGb",
                allocated_memory_gb::numeric as "allocatedMemoryGb",
                max_cpu_cores as "maxCpuCores",
                allocated_cpu_cores as "allocatedCpuCores",
                max_disk_gb::numeric as "maxDiskGb",
                allocated_disk_gb::numeric as "allocatedDiskGb",
                port_range as "portRange", enabled, daemon_status as "daemonStatus",
                last_heartbeat as "lastHeartbeat",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const res = await query<any>(sql, values);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      maxMemoryGb: Number(r.maxMemoryGb),
      allocatedMemoryGb: Number(r.allocatedMemoryGb),
      maxCpuCores: Number(r.maxCpuCores),
      allocatedCpuCores: Number(r.allocatedCpuCores),
      maxDiskGb: Number(r.maxDiskGb),
      allocatedDiskGb: Number(r.allocatedDiskGb)
    };
  }

  public async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM nodes WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }
}
