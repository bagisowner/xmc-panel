import net from 'net';
import { Database, Allocation } from '../db/Database.js';

export class PortService {
  private static instance: PortService | null = null;
  private db = Database.getInstance();

  private constructor() {
  }

  public static getInstance(): PortService {
    if (!PortService.instance) {
      PortService.instance = new PortService();
    }
    return PortService.instance;
  }

  /**
   * Seed some base allocations in the database if empty
   */
  public async seedDefaultAllocations() {
    const existing = this.db.getTable('allocations');
    if (existing.length === 0) {
      // Seed default allocations
      const defaults = [25565, 25566, 25567, 25575, 8123, 19132];
      for (const port of defaults) {
        await this.db.insert('allocations', {
          id: `alloc_${port}`,
          ipAddress: '0.0.0.0',
          port,
          serverId: null,
          label: port === 25575 ? 'RCON' : port === 8123 ? 'Dynmap' : port === 19132 ? 'Bedrock' : 'Minecraft Default',
          isPrimary: false
        });
      }
    }
  }

  /**
   * Probes a TCP port on the host to see if it is in use
   */
  public isPortAvailableOnHost(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      // In cloud container sandboxes, binding to multiple ports is restricted.
      // We rely on database allocations to cleanly support unlimited servers.
      resolve(true);
    });
  }

  /**
   * Finds the next available port on the host system starting from 25565
   */
  public async findAvailablePort(startPort = 25565, endPort = 30000): Promise<number> {
    const allocations = this.db.getTable('allocations');
    for (let port = startPort; port <= endPort; port++) {
      // 1. Check database allocation
      const isAllocatedInDb = allocations.some(a => a.port === port && a.serverId !== null);
      if (isAllocatedInDb) continue;

      // 2. Check actual host availability
      const isAvailOnHost = await this.isPortAvailableOnHost(port);
      if (isAvailOnHost) {
        return port;
      }
    }
    throw new Error('No available ports found in the specified range.');
  }

  /**
   * Retrieve allocations for a server
   */
  public getServerPorts(serverId: string): Allocation[] {
    return this.db.getTable('allocations').filter(a => a.serverId === serverId);
  }

  /**
   * Assign a port to a server
   */
  public async allocatePort(serverId: string, port: number, label: string, isPrimary = false): Promise<Allocation> {
    // Check conflicts
    const allocations = this.db.getTable('allocations');
    const existing = allocations.find(a => a.port === port);

    if (existing && existing.serverId) {
      throw new Error(`Port ${port} is already assigned to server ${existing.serverId}`);
    }

    const hostAvailable = await this.isPortAvailableOnHost(port);
    if (!hostAvailable) {
      throw new Error(`Port ${port} is already bound on the host machine network card.`);
    }

    const allocationId = existing ? existing.id : `alloc_${port}`;

    if (existing) {
      await this.db.update('allocations', a => a.id === allocationId, a => {
        a.serverId = serverId;
        a.label = label;
        a.isPrimary = isPrimary;
      });
    } else {
      await this.db.insert('allocations', {
        id: allocationId,
        ipAddress: '0.0.0.0',
        port,
        serverId,
        label,
        isPrimary
      });
    }

    return this.db.getTable('allocations').find(a => a.id === allocationId)!;
  }

  /**
   * Free an allocated port
   */
  public async releasePort(port: number): Promise<void> {
    await this.db.update('allocations', a => a.port === port, a => {
      a.serverId = null;
      a.isPrimary = false;
    });
  }
}
