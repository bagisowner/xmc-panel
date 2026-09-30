import { query } from '../client.js';
import { Allocation } from '../schema.js';

export class AllocationRepository {
  private static instance: AllocationRepository | null = null;

  public static getInstance(): AllocationRepository {
    if (!AllocationRepository.instance) {
      AllocationRepository.instance = new AllocationRepository();
    }
    return AllocationRepository.instance;
  }

  public async findAll(): Promise<Allocation[]> {
    const res = await query<any>(`
      SELECT id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
             port, label, is_primary as "isPrimary", created_at as "createdAt"
      FROM allocations
      ORDER BY port ASC
    `);
    return res.rows.map(r => ({ ...r, port: Number(r.port) }));
  }

  public async findByServerId(serverId: string): Promise<Allocation[]> {
    const res = await query<any>(`
      SELECT id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
             port, label, is_primary as "isPrimary", created_at as "createdAt"
      FROM allocations
      WHERE server_id = $1
      ORDER BY is_primary DESC, port ASC
    `, [serverId]);
    return res.rows.map(r => ({ ...r, port: Number(r.port) }));
  }

  public async findByPort(port: number, nodeId?: string): Promise<Allocation | null> {
    if (nodeId) {
      const res = await query<any>(`
        SELECT id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
               port, label, is_primary as "isPrimary", created_at as "createdAt"
        FROM allocations
        WHERE port = $1 AND node_id = $2
        LIMIT 1
      `, [port, nodeId]);
      if (!res.rows[0]) return null;
      return { ...res.rows[0], port: Number(res.rows[0].port) };
    }
    const res = await query<any>(`
      SELECT id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
             port, label, is_primary as "isPrimary", created_at as "createdAt"
      FROM allocations
      WHERE port = $1
      LIMIT 1
    `, [port]);
    if (!res.rows[0]) return null;
    return { ...res.rows[0], port: Number(res.rows[0].port) };
  }

  public async create(alloc: Allocation): Promise<Allocation> {
    const res = await query<any>(`
      INSERT INTO allocations (id, node_id, server_id, ip_address, port, label, is_primary, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        server_id = EXCLUDED.server_id,
        label = EXCLUDED.label,
        is_primary = EXCLUDED.is_primary
      RETURNING id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
                port, label, is_primary as "isPrimary", created_at as "createdAt"
    `, [
      alloc.id,
      alloc.nodeId || null,
      alloc.serverId || null,
      alloc.ipAddress || '0.0.0.0',
      alloc.port,
      alloc.label || 'Minecraft Default',
      alloc.isPrimary ?? false
    ]);
    return { ...res.rows[0], port: Number(res.rows[0].port) };
  }

  public async assignPort(port: number, serverId: string, label?: string, isPrimary = false, nodeId?: string): Promise<Allocation> {
    const existing = await this.findByPort(port, nodeId);
    const allocId = existing ? existing.id : `alloc_${port}`;

    const res = await query<any>(`
      INSERT INTO allocations (id, node_id, server_id, ip_address, port, label, is_primary, created_at)
      VALUES ($1, $2, $3, '0.0.0.0', $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        server_id = $3,
        label = COALESCE($5, allocations.label),
        is_primary = $6
      RETURNING id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
                port, label, is_primary as "isPrimary", created_at as "createdAt"
    `, [
      allocId,
      nodeId || null,
      serverId,
      port,
      label || 'Minecraft Port',
      isPrimary
    ]);
    return { ...res.rows[0], port: Number(res.rows[0].port) };
  }

  public async releasePort(port: number): Promise<boolean> {
    const res = await query(`
      UPDATE allocations
      SET server_id = NULL, is_primary = FALSE
      WHERE port = $1
    `, [port]);
    return (res.rowCount || 0) > 0;
  }

  public async releaseServerPorts(serverId: string): Promise<boolean> {
    const res = await query(`
      UPDATE allocations
      SET server_id = NULL, is_primary = FALSE
      WHERE server_id = $1
    `, [serverId]);
    return (res.rowCount || 0) > 0;
  }

  public async delete(idOrPort: string | number): Promise<boolean> {
    if (typeof idOrPort === 'number' || !isNaN(Number(idOrPort))) {
      const res = await query('DELETE FROM allocations WHERE port = $1', [Number(idOrPort)]);
      return (res.rowCount || 0) > 0;
    }
    const res = await query('DELETE FROM allocations WHERE id = $1', [idOrPort]);
    return (res.rowCount || 0) > 0;
  }
}
