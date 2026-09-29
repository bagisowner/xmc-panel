import Docker from 'dockerode';
import fs from 'fs';

import path from 'path';

export interface DockerNodeStats {
  version: string;
  containersCount: {
    total: number;
    running: number;
    stopped: number;
  };
  imagesCount: number;
  volumesCount: number;
  networksCount: number;
  isAvailable: boolean;
  errorDetail?: string;
}

export class DockerService {
  private static instance: DockerService | null = null;
  private docker: Docker | null = null;
  private socketPath = '/var/run/docker.sock';
  private availabilityChecked = false;
  private available = false;
  private lastError = '';

  private constructor() {
    this.initDocker();
  }

  public static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  private initDocker() {
    try {
      // Check if socket exists
      const socketExists = fs.existsSync(this.socketPath);
      if (socketExists) {
        this.docker = new Docker({ socketPath: this.socketPath });
        this.available = true;
      } else {
        // Try fallback default configurations
        this.docker = new Docker();
        this.available = false;
        this.lastError = `Docker socket not found at ${this.socketPath}`;
      }
    } catch (err: any) {
      this.docker = null;
      this.available = false;
      this.lastError = err?.message || 'Failed to initialize Dockerode client';
    }
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.docker) return false;
    try {
      await this.docker.ping();
      this.available = true;
      return true;
    } catch (err: any) {
      this.available = false;
      this.lastError = err?.message || 'Docker ping timed out';
      return false;
    }
  }

  public getLastError(): string {
    return this.lastError;
  }

  public async getSystemStats(): Promise<DockerNodeStats> {
    const isAvail = await this.isAvailable();
    if (!isAvail || !this.docker) {
      return {
        version: 'Unknown',
        containersCount: { total: 0, running: 0, stopped: 0 },
        imagesCount: 0,
        volumesCount: 0,
        networksCount: 0,
        isAvailable: false,
        errorDetail: this.lastError || 'Docker daemon is offline'
      };
    }

    try {
      const info = await this.docker.info();
      const images = await this.docker.listImages();
      const volumes = await this.docker.listVolumes();
      const networks = await this.docker.listNetworks();

      return {
        version: info.ServerVersion || 'Unknown',
        containersCount: {
          total: info.Containers || 0,
          running: info.ContainersRunning || 0,
          stopped: info.ContainersStopped || 0
        },
        imagesCount: images.length,
        volumesCount: volumes.Volumes?.length || 0,
        networksCount: networks.length,
        isAvailable: true
      };
    } catch (err: any) {
      return {
        version: 'Unknown',
        containersCount: { total: 0, running: 0, stopped: 0 },
        imagesCount: 0,
        volumesCount: 0,
        networksCount: 0,
        isAvailable: false,
        errorDetail: err.message || 'Failed to query Docker details'
      };
    }
  }

  public async listContainers() {
    if (!this.docker || !(await this.isAvailable())) {
      throw new Error(`Docker service unavailable: ${this.lastError}`);
    }
    return this.docker.listContainers({ all: true });
  }

  public async createMinecraftContainer(options: {
    serverId: string;
    serverName: string;
    javaVersion: '17' | '21' | '25';
    memoryLimitGb: number;
    cpuLimitCores: number;
    primaryPort: number;
    additionalPorts: number[];
    env: Record<string, string>;
  }) {
    if (!this.docker || !(await this.isAvailable())) {
      throw new Error(`Docker service unavailable: ${this.lastError}`);
    }

    // Determine the Docker image depending on Java selection
    const imageName = `eclipse-temurin:${options.javaVersion}-jre`;

    // Setup Port Bindings
    const PortBindings: any = {};
    const ExposedPorts: any = {};

    // Primary Minecraft Port
    const mainPortStr = `${options.primaryPort}/tcp`;
    PortBindings[mainPortStr] = [{ HostPort: options.primaryPort.toString() }];
    ExposedPorts[mainPortStr] = {};

    // Extra Ports
    for (const p of options.additionalPorts) {
      const pStr = `${p}/tcp`;
      PortBindings[pStr] = [{ HostPort: p.toString() }];
      ExposedPorts[pStr] = {};
    }

    // Setup Host configuration for resource limits
    const HostConfig: any = {
      PortBindings,
      Binds: [
        `${path.resolve(process.cwd(), 'storage', 'servers', options.serverId)}:/server`
      ],
      RestartPolicy: { Name: 'unless-stopped' },
      Memory: options.memoryLimitGb * 1024 * 1024 * 1024,
      NanoCpus: options.cpuLimitCores * 1000000000
    };

    // Environment variables
    const EnvArray = Object.entries(options.env).map(([key, val]) => `${key}=${val}`);

    // Create container
    const container = await this.docker.createContainer({
      Image: imageName,
      name: `mc-server-${options.serverId}`,
      WorkingDir: '/server',
      Cmd: ['java', '-Xms512M', `-Xmx${options.memoryLimitGb}G`, '-jar', 'server.jar', 'nogui'],
      ExposedPorts,
      Env: EnvArray,
      HostConfig,
      Tty: true,
      OpenStdin: true
    });

    return container.id;
  }

  public async startContainer(containerId: string) {
    if (!this.docker) throw new Error('Docker uninitialized');
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  public async stopContainer(containerId: string) {
    if (!this.docker) throw new Error('Docker uninitialized');
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  public async killContainer(containerId: string) {
    if (!this.docker) throw new Error('Docker uninitialized');
    const container = this.docker.getContainer(containerId);
    await container.kill();
  }

  public async getContainerLogs(containerId: string): Promise<string> {
    if (!this.docker) throw new Error('Docker uninitialized');
    const container = this.docker.getContainer(containerId);
    const logsBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: true
    });
    return logsBuffer.toString('utf8');
  }

  public getContainerId(serverId: string): string | null {
    // In local dev/containerized setups, containers follow the pattern mc_server_<id>
    return `mc_server_${serverId.substring(0, 8)}`;
  }

  public async sendCommand(containerId: string, command: string) {
    if (!this.docker) throw new Error('Docker uninitialized');
    const container = this.docker.getContainer(containerId);
    
    // Attach stream or use docker exec
    // Since we create Minecraft with OpenStdin: true and Tty: true, we can write directly to the stream.
    // Or we can invoke RCON. For raw container input, docker exec is sometimes simpler or RCON is preferred.
    // Let's implement RCON command or standard docker exec.
    // Let's handle via attach/write if container is running.
    // Alternatively, we can use container exec.
    const exec = await container.exec({
      Cmd: ['rcon-cli', command], // if rcon is set up in container, or similar
      AttachStdout: true,
      AttachStderr: true
    });
    const stream = await exec.start({});
    return new Promise<string>((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });
      stream.on('end', () => {
        resolve(output);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
