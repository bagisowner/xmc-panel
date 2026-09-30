import { withTransaction } from '../client.js';
import { Server, NodeRecord, Allocation } from '../schema.js';

export interface CreateServerTxInput {
  serverId: string;
  name: string;
  description?: string;
  software: string;
  version: string;
  javaVersion: string;
  memoryLimitGb: number;
  cpuLimitCores: number;
  diskLimitGb: number;
  requestedPort?: number;
  nodeId?: string;
  location?: string;
  acceptEula: boolean;
  ownerId?: string;
  startupCommand?: string;
  jvmFlags?: string;
  variables?: Record<string, any>;
  userEmail?: string;
  ipAddress?: string;
}

export interface CreateServerTxResult {
  server: Server;
  allocation: Allocation;
  node: NodeRecord;
}

export class ServerTransaction {
  /**
   * Executes an atomic, 11-step transaction for server creation with full rollback on any failure.
   */
  public static async executeCreateServer(input: CreateServerTxInput): Promise<CreateServerTxResult> {
    return await withTransaction(async (client) => {
      // 1. Validate User Quota / Existence if ownerId provided
      if (input.ownerId) {
        const userRes = await client.query('SELECT id, disabled, role FROM users WHERE id = $1', [input.ownerId]);
        if (userRes.rowCount === 0) {
          throw new Error(`Owner user ${input.ownerId} does not exist.`);
        }
        if (userRes.rows[0].disabled) {
          throw new Error('Owner user account is disabled.');
        }
      }

      // 2. Validate Node
      let nodeRes = await client.query<any>(
        'SELECT * FROM nodes WHERE id = $1 FOR UPDATE',
        [input.nodeId || input.location || 'node_01']
      );

      if (nodeRes.rowCount === 0) {
        // Fallback to first online node
        nodeRes = await client.query<any>(
          "SELECT * FROM nodes WHERE status = 'ONLINE' ORDER BY created_at ASC LIMIT 1 FOR UPDATE"
        );
      }

      if (nodeRes.rowCount === 0) {
        throw new Error('No operational node available for server deployment.');
      }

      const nodeRow = nodeRes.rows[0];
      if (nodeRow.status === 'OFFLINE') {
        throw new Error(`Target node "${nodeRow.name}" is OFFLINE and cannot accept deployments.`);
      }

      const ramGb = Number(input.memoryLimitGb) || 4;
      const cpuCores = Number(input.cpuLimitCores) || 2;
      const diskGb = Number(input.diskLimitGb) || 15;

      // 3. Validate RAM Quota against node capacity
      const currentAllocRam = Number(nodeRow.allocated_memory_gb) || 0;
      const maxRam = Number(nodeRow.max_memory_gb) || 32;
      if (currentAllocRam + ramGb > maxRam * 1.5) { // Allow reasonable overcommit limit
        throw new Error(`Target node does not have sufficient RAM available (${currentAllocRam}/${maxRam} GB used).`);
      }

      // 4. Validate CPU
      const currentAllocCpu = Number(nodeRow.allocated_cpu_cores) || 0;
      const maxCpu = Number(nodeRow.max_cpu_cores) || 8;
      if (currentAllocCpu + cpuCores > maxCpu * 2) {
        throw new Error(`Target node does not have sufficient CPU cores available.`);
      }

      // 5. Validate Disk
      const currentAllocDisk = Number(nodeRow.allocated_disk_gb) || 0;
      const maxDisk = Number(nodeRow.max_disk_gb) || 200;
      if (currentAllocDisk + diskGb > maxDisk) {
        throw new Error(`Target node does not have sufficient disk storage space.`);
      }

      // 6. Find & Allocate Port with Row-Level Lock
      let port = input.requestedPort;
      if (!port || port < 1024 || port > 65535) {
        port = 25565;
      }

      // Check port conflicts on this node
      const portCheckRes = await client.query(
        'SELECT id, server_id FROM allocations WHERE node_id = $1 AND port = $2 FOR UPDATE',
        [nodeRow.id, port]
      );

      if (portCheckRes.rowCount && portCheckRes.rowCount > 0 && portCheckRes.rows[0].server_id) {
        if (input.requestedPort && input.requestedPort === port) {
          throw new Error(`Port ${port} is already assigned on node ${nodeRow.name}.`);
        }
        // Find next free port
        let searchPort = port + 1;
        while (true) {
          const check = await client.query(
            'SELECT id FROM allocations WHERE node_id = $1 AND port = $2 AND server_id IS NOT NULL',
            [nodeRow.id, searchPort]
          );
          if (check.rowCount === 0) {
            port = searchPort;
            break;
          }
          searchPort++;
          if (searchPort > 30000) {
            throw new Error('Exhausted available port range for node.');
          }
        }
      }

      const now = new Date().toISOString();

      // 7. Create Server Record
      const serverInsertRes = await client.query<any>(`
        INSERT INTO servers (
          id, owner_id, node_id, name, description, software, version, java_version,
          status, memory_limit_gb, cpu_limit_cores, disk_limit_gb, primary_port,
          startup_command, jvm_flags, variables, active_world, auto_restart,
          maintenance_mode, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
                  created_at as "createdAt",
                  updated_at as "updatedAt"
      `, [
        input.serverId,
        input.ownerId || null,
        nodeRow.id,
        input.name.trim(),
        input.description || '',
        input.software,
        input.version,
        input.javaVersion,
        'Installing',
        ramGb,
        cpuCores,
        diskGb,
        port,
        input.startupCommand || null,
        input.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled',
        JSON.stringify({
          acceptEula: input.acceptEula ? 'true' : 'false',
          installationStatus: 'installing',
          ...(input.variables || {})
        }),
        'world',
        'OnCrash',
        false,
        now,
        now
      ]);

      const createdServer = serverInsertRes.rows[0];

      // 8. Create / Update Allocation Record
      const allocId = `alloc_${nodeRow.id}_${port}`;
      const allocRes = await client.query<any>(`
        INSERT INTO allocations (id, node_id, server_id, ip_address, port, label, is_primary, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          server_id = EXCLUDED.server_id,
          label = EXCLUDED.label,
          is_primary = EXCLUDED.is_primary
        RETURNING id, node_id as "nodeId", server_id as "serverId", ip_address as "ipAddress",
                  port, label, is_primary as "isPrimary", created_at as "createdAt"
      `, [
        allocId,
        nodeRow.id,
        input.serverId,
        nodeRow.ip_address || '0.0.0.0',
        port,
        'Primary Port',
        true
      ]);

      const createdAllocation = allocRes.rows[0];

      // Update Node Allocated Resources
      await client.query(`
        UPDATE nodes
        SET allocated_memory_gb = allocated_memory_gb + $1,
            allocated_cpu_cores = allocated_cpu_cores + $2,
            allocated_disk_gb = allocated_disk_gb + $3,
            updated_at = NOW()
        WHERE id = $4
      `, [ramGb, cpuCores, diskGb, nodeRow.id]);

      // 9. Create Server Settings Record
      await client.query(`
        INSERT INTO server_settings (id, server_id, crash_detection, auto_save_interval, query_enabled, rcon_enabled, created_at, updated_at)
        VALUES ($1, $2, TRUE, 5, TRUE, TRUE, NOW(), NOW())
        ON CONFLICT (server_id) DO NOTHING
      `, [`set_${input.serverId}`, input.serverId]);

      // 10. Write Audit Event inside transaction
      await client.query(`
        INSERT INTO audit_logs (id, user_id, user_email, server_id, action, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        input.ownerId || null,
        input.userEmail || 'admin',
        input.serverId,
        'CREATE_SERVER_TX',
        `Atomic transaction created server "${input.name}" (${input.serverId}) on port ${port}`,
        input.ipAddress || '127.0.0.1'
      ]);

      // 11. Transaction will commit when callback resolves!
      return {
        server: {
          ...createdServer,
          memoryLimitGb: Number(createdServer.memoryLimitGb),
          cpuLimitCores: Number(createdServer.cpuLimitCores),
          diskLimitGb: Number(createdServer.diskLimitGb),
          primaryPort: Number(createdServer.primaryPort),
          nodeName: nodeRow.name,
          location: nodeRow.location
        },
        allocation: {
          ...createdAllocation,
          port: Number(createdAllocation.port)
        },
        node: {
          ...nodeRow,
          maxMemoryGb: Number(nodeRow.max_memory_gb),
          allocatedMemoryGb: Number(nodeRow.allocated_memory_gb) + ramGb,
          maxCpuCores: Number(nodeRow.max_cpu_cores),
          allocatedCpuCores: Number(nodeRow.allocated_cpu_cores) + cpuCores,
          maxDiskGb: Number(nodeRow.max_disk_gb),
          allocatedDiskGb: Number(nodeRow.allocated_disk_gb) + diskGb
        }
      };
    });
  }

  /**
   * Executes atomic server deletion and resource reclamation with full rollback.
   */
  public static async executeDeleteServer(serverId: string, userEmail?: string, ipAddress?: string): Promise<boolean> {
    return await withTransaction(async (client) => {
      // Find server
      const srvRes = await client.query('SELECT * FROM servers WHERE id = $1 FOR UPDATE', [serverId]);
      if (srvRes.rowCount === 0) {
        return false;
      }
      const srv = srvRes.rows[0];

      // Reclaim node resources
      if (srv.node_id) {
        await client.query(`
          UPDATE nodes
          SET allocated_memory_gb = GREATEST(0, allocated_memory_gb - $1),
              allocated_cpu_cores = GREATEST(0, allocated_cpu_cores - $2),
              allocated_disk_gb = GREATEST(0, allocated_disk_gb - $3),
              updated_at = NOW()
          WHERE id = $4
        `, [
          Number(srv.memory_limit_gb) || 0,
          Number(srv.cpu_limit_cores) || 0,
          Number(srv.disk_limit_gb) || 0,
          srv.node_id
        ]);
      }

      // Release allocations
      await client.query('UPDATE allocations SET server_id = NULL, is_primary = FALSE WHERE server_id = $1', [serverId]);

      // Delete cascade relations
      await client.query('DELETE FROM server_settings WHERE server_id = $1', [serverId]);
      await client.query('DELETE FROM server_members WHERE server_id = $1', [serverId]);
      await client.query('DELETE FROM backups WHERE server_id = $1', [serverId]);
      await client.query('DELETE FROM schedules WHERE server_id = $1', [serverId]);
      await client.query('DELETE FROM jobs WHERE server_id = $1', [serverId]);
      await client.query('DELETE FROM alerts WHERE server_id = $1', [serverId]);

      // Delete server
      await client.query('DELETE FROM servers WHERE id = $1', [serverId]);

      // Write audit log
      await client.query(`
        INSERT INTO audit_logs (id, user_email, server_id, action, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userEmail || 'admin',
        serverId,
        'DELETE_SERVER_TX',
        `Atomic transaction wiped database records and reclaimed resources for server ${srv.name} (${serverId})`,
        ipAddress || '127.0.0.1'
      ]);

      return true;
    });
  }
}
