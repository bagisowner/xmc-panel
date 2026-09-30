import { query } from '../client.js';
import { Server, ServerSettings } from '../schema.js';

export class ServerRepository {
  private static instance: ServerRepository | null = null;

  public static getInstance(): ServerRepository {
    if (!ServerRepository.instance) {
      ServerRepository.instance = new ServerRepository();
    }
    return ServerRepository.instance;
  }

  public async findAll(): Promise<Server[]> {
    const res = await query<any>(`
      SELECT s.id, s.owner_id as "ownerId", s.node_id as "nodeId", s.name, s.description,
             s.software, s.version, s.java_version as "javaVersion", s.status,
             n.name as "nodeName", n.location,
             s.memory_limit_gb::numeric as "memoryLimitGb",
             s.cpu_limit_cores as "cpuLimitCores",
             s.disk_limit_gb::numeric as "diskLimitGb",
             s.primary_port as "primaryPort",
             s.startup_command as "startupCommand",
             s.jvm_flags as "jvmFlags",
             s.variables,
             s.active_world as "activeWorld",
             s.auto_restart as "autoRestart",
             s.maintenance_mode as "maintenanceMode",
             s.container_id as "containerId",
             s.started_at as "startedAt",
             s.ready_at as "readyAt",
             s.stopped_at as "stoppedAt",
             s.last_seen_at as "lastSeenAt",
             s.created_at as "createdAt",
             s.updated_at as "updatedAt"
      FROM servers s
      LEFT JOIN nodes n ON s.node_id = n.id
      ORDER BY s.created_at DESC
    `);
    return res.rows.map(r => ({
      ...r,
      memoryLimitGb: Number(r.memoryLimitGb),
      cpuLimitCores: Number(r.cpuLimitCores),
      diskLimitGb: Number(r.diskLimitGb),
      primaryPort: Number(r.primaryPort)
    }));
  }

  public async findById(id: string): Promise<Server | null> {
    const res = await query<any>(`
      SELECT s.id, s.owner_id as "ownerId", s.node_id as "nodeId", s.name, s.description,
             s.software, s.version, s.java_version as "javaVersion", s.status,
             n.name as "nodeName", n.location,
             s.memory_limit_gb::numeric as "memoryLimitGb",
             s.cpu_limit_cores as "cpuLimitCores",
             s.disk_limit_gb::numeric as "diskLimitGb",
             s.primary_port as "primaryPort",
             s.startup_command as "startupCommand",
             s.jvm_flags as "jvmFlags",
             s.variables,
             s.active_world as "activeWorld",
             s.auto_restart as "autoRestart",
             s.maintenance_mode as "maintenanceMode",
             s.container_id as "containerId",
             s.started_at as "startedAt",
             s.ready_at as "readyAt",
             s.stopped_at as "stoppedAt",
             s.last_seen_at as "lastSeenAt",
             s.created_at as "createdAt",
             s.updated_at as "updatedAt"
      FROM servers s
      LEFT JOIN nodes n ON s.node_id = n.id
      WHERE s.id = $1
      LIMIT 1
    `, [id]);

    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      memoryLimitGb: Number(r.memoryLimitGb),
      cpuLimitCores: Number(r.cpuLimitCores),
      diskLimitGb: Number(r.diskLimitGb),
      primaryPort: Number(r.primaryPort)
    };
  }

  public async create(server: Server): Promise<Server> {
    const now = new Date().toISOString();
    const res = await query<any>(`
      INSERT INTO servers (
        id, owner_id, node_id, name, description, software, version, java_version,
        status, memory_limit_gb, cpu_limit_cores, disk_limit_gb, primary_port,
        startup_command, jvm_flags, variables, active_world, auto_restart,
        maintenance_mode, container_id, started_at, ready_at, stopped_at, last_seen_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        software = EXCLUDED.software,
        version = EXCLUDED.version,
        java_version = EXCLUDED.java_version,
        status = EXCLUDED.status,
        memory_limit_gb = EXCLUDED.memory_limit_gb,
        cpu_limit_cores = EXCLUDED.cpu_limit_cores,
        disk_limit_gb = EXCLUDED.disk_limit_gb,
        primary_port = EXCLUDED.primary_port,
        startup_command = EXCLUDED.startup_command,
        jvm_flags = EXCLUDED.jvm_flags,
        variables = EXCLUDED.variables,
        active_world = EXCLUDED.active_world,
        auto_restart = EXCLUDED.auto_restart,
        maintenance_mode = EXCLUDED.maintenance_mode,
        container_id = EXCLUDED.container_id,
        started_at = EXCLUDED.started_at,
        ready_at = EXCLUDED.ready_at,
        stopped_at = EXCLUDED.stopped_at,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW()
      RETURNING id, owner_id as "ownerId", node_id as "nodeId", name, description,
                software, version, java_version as "javaVersion", status,
                memory_limit_gb::numeric as "memoryLimitGb",
                cpu_limit_cores as "cpuLimitCores",
                disk_limit_gb::numeric as "diskLimitGb",
                primary_port as "primaryPort",
                startup_command as "startupCommand",
                jvm_flags as "jvmFlags",
                variables,
                active_world as "activeWorld",
                auto_restart as "autoRestart",
                maintenance_mode as "maintenanceMode",
                container_id as "containerId",
                started_at as "startedAt",
                ready_at as "readyAt",
                stopped_at as "stoppedAt",
                last_seen_at as "lastSeenAt",
                created_at as "createdAt",
                updated_at as "updatedAt"
    `, [
      server.id,
      server.ownerId || null,
      server.nodeId || null,
      server.name,
      server.description || '',
      server.software || 'Paper',
      server.version || '1.21.1',
      server.javaVersion || '21',
      server.status || 'Offline',
      server.memoryLimitGb || 4,
      server.cpuLimitCores || 2,
      server.diskLimitGb || 15,
      server.primaryPort || 25565,
      server.startupCommand || null,
      server.jvmFlags || null,
      JSON.stringify(server.variables || {}),
      server.activeWorld || 'world',
      server.autoRestart || 'OnCrash',
      server.maintenanceMode ?? false,
      server.containerId || null,
      server.startedAt || null,
      server.readyAt || null,
      server.stoppedAt || null,
      server.lastSeenAt || null,
      server.createdAt || now,
      server.updatedAt || now
    ]);

    const r = res.rows[0];
    return {
      ...r,
      memoryLimitGb: Number(r.memoryLimitGb),
      cpuLimitCores: Number(r.cpuLimitCores),
      diskLimitGb: Number(r.diskLimitGb),
      primaryPort: Number(r.primaryPort)
    };
  }

  public async update(id: string, updates: Partial<Server>): Promise<Server | null> {
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
    if (updates.software !== undefined) {
      fields.push(`software = $${idx++}`);
      values.push(updates.software);
    }
    if (updates.version !== undefined) {
      fields.push(`version = $${idx++}`);
      values.push(updates.version);
    }
    if (updates.javaVersion !== undefined) {
      fields.push(`java_version = $${idx++}`);
      values.push(updates.javaVersion);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.nodeId !== undefined) {
      fields.push(`node_id = $${idx++}`);
      values.push(updates.nodeId);
    }
    if (updates.ownerId !== undefined) {
      fields.push(`owner_id = $${idx++}`);
      values.push(updates.ownerId);
    }
    if (updates.memoryLimitGb !== undefined) {
      fields.push(`memory_limit_gb = $${idx++}`);
      values.push(updates.memoryLimitGb);
    }
    if (updates.cpuLimitCores !== undefined) {
      fields.push(`cpu_limit_cores = $${idx++}`);
      values.push(updates.cpuLimitCores);
    }
    if (updates.diskLimitGb !== undefined) {
      fields.push(`disk_limit_gb = $${idx++}`);
      values.push(updates.diskLimitGb);
    }
    if (updates.primaryPort !== undefined) {
      fields.push(`primary_port = $${idx++}`);
      values.push(updates.primaryPort);
    }
    if (updates.startupCommand !== undefined) {
      fields.push(`startup_command = $${idx++}`);
      values.push(updates.startupCommand);
    }
    if (updates.jvmFlags !== undefined) {
      fields.push(`jvm_flags = $${idx++}`);
      values.push(updates.jvmFlags);
    }
    if (updates.variables !== undefined) {
      fields.push(`variables = $${idx++}`);
      values.push(JSON.stringify(updates.variables));
    }
    if (updates.activeWorld !== undefined) {
      fields.push(`active_world = $${idx++}`);
      values.push(updates.activeWorld);
    }
    if (updates.autoRestart !== undefined) {
      fields.push(`auto_restart = $${idx++}`);
      values.push(updates.autoRestart);
    }
    if (updates.maintenanceMode !== undefined) {
      fields.push(`maintenance_mode = $${idx++}`);
      values.push(updates.maintenanceMode);
    }
    if (updates.containerId !== undefined) {
      fields.push(`container_id = $${idx++}`);
      values.push(updates.containerId);
    }
    if (updates.startedAt !== undefined) {
      fields.push(`started_at = $${idx++}`);
      values.push(updates.startedAt);
    }
    if (updates.readyAt !== undefined) {
      fields.push(`ready_at = $${idx++}`);
      values.push(updates.readyAt);
    }
    if (updates.stoppedAt !== undefined) {
      fields.push(`stopped_at = $${idx++}`);
      values.push(updates.stoppedAt);
    }
    if (updates.lastSeenAt !== undefined) {
      fields.push(`last_seen_at = $${idx++}`);
      values.push(updates.lastSeenAt);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE servers
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, owner_id as "ownerId", node_id as "nodeId", name, description,
                software, version, java_version as "javaVersion", status,
                memory_limit_gb::numeric as "memoryLimitGb",
                cpu_limit_cores as "cpuLimitCores",
                disk_limit_gb::numeric as "diskLimitGb",
                primary_port as "primaryPort",
                startup_command as "startupCommand",
                jvm_flags as "jvmFlags",
                variables,
                active_world as "activeWorld",
                auto_restart as "autoRestart",
                maintenance_mode as "maintenanceMode",
                container_id as "containerId",
                started_at as "startedAt",
                ready_at as "readyAt",
                stopped_at as "stoppedAt",
                last_seen_at as "lastSeenAt",
                created_at as "createdAt",
                updated_at as "updatedAt"
    `;

    const res = await query<any>(sql, values);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      memoryLimitGb: Number(r.memoryLimitGb),
      cpuLimitCores: Number(r.cpuLimitCores),
      diskLimitGb: Number(r.diskLimitGb),
      primaryPort: Number(r.primaryPort)
    };
  }

  public async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM servers WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  // --- Server Settings ---
  public async getSettings(serverId: string): Promise<ServerSettings | null> {
    const res = await query<any>(`
      SELECT id, server_id as "serverId", crash_detection as "crashDetection",
             auto_save_interval as "autoSaveInterval", query_enabled as "queryEnabled",
             rcon_enabled as "rconEnabled", rcon_port as "rconPort", rcon_password as "rconPassword",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM server_settings
      WHERE server_id = $1
      LIMIT 1
    `, [serverId]);
    return res.rows[0] || null;
  }

  public async saveSettings(settings: Partial<ServerSettings> & { serverId: string }): Promise<ServerSettings> {
    const id = settings.id || `set_${settings.serverId}`;
    const res = await query<any>(`
      INSERT INTO server_settings (
        id, server_id, crash_detection, auto_save_interval, query_enabled, rcon_enabled, rcon_port, rcon_password, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (server_id) DO UPDATE SET
        crash_detection = EXCLUDED.crash_detection,
        auto_save_interval = EXCLUDED.auto_save_interval,
        query_enabled = EXCLUDED.query_enabled,
        rcon_enabled = EXCLUDED.rcon_enabled,
        rcon_port = EXCLUDED.rcon_port,
        rcon_password = EXCLUDED.rcon_password,
        updated_at = NOW()
      RETURNING id, server_id as "serverId", crash_detection as "crashDetection",
                auto_save_interval as "autoSaveInterval", query_enabled as "queryEnabled",
                rcon_enabled as "rconEnabled", rcon_port as "rconPort", rcon_password as "rconPassword",
                created_at as "createdAt", updated_at as "updatedAt"
    `, [
      id,
      settings.serverId,
      settings.crashDetection ?? true,
      settings.autoSaveInterval ?? 5,
      settings.queryEnabled ?? true,
      settings.rconEnabled ?? true,
      settings.rconPort || null,
      settings.rconPassword || null
    ]);
    return res.rows[0];
  }
}
