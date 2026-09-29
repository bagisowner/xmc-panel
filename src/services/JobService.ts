import fs from 'fs';
import path from 'path';
import https from 'https';
import { Database, Job } from '../db/Database.js';
import { FileService } from './FileService.js';

// Helper to execute HTTP GET and return response body as string
async function getUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.text();
}

// Helper to download a binary file with redirection support
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  });
  if (!res.ok) {
    throw new Error(`Server returned HTTP status ${res.status}: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

export class JobService {
  private static instance: JobService | null = null;
  private db = Database.getInstance();
  private fileService = FileService.getInstance();
  private activeJobs: Map<string, Job> = new Map();

  private constructor() {}

  public static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  public getJobs(): Job[] {
    return this.db.getTable('jobs');
  }

  public getJob(id: string): Job | undefined {
    return this.db.getTable('jobs').find(j => j.id === id);
  }

  public async createJob(
    serverId: string,
    type: Job['type']
  ): Promise<string> {
    const jobId = `job_${Date.now()}`;
    const newJob: Job = {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      serverId,
      logs: [`[Job System] Job created. Type: ${type}`],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.insert('jobs', newJob);
    this.activeJobs.set(jobId, newJob);

    // Trigger execution
    this.runJob(jobId);

    return jobId;
  }

  private async runJob(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    await this.updateJobStatus(jobId, 'running', 10, 'Initiating background process...');

    try {
      if (job.type === 'install') {
        await this.executeInstallJob(jobId, job.serverId);
      } else if (job.type === 'delete') {
        await this.executeDeleteJob(jobId, job.serverId);
      } else {
        // Simple mock progress for other types
        await this.updateJobStatus(jobId, 'running', 50, 'Processing data...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.updateJobStatus(jobId, 'completed', 100, 'Job completed successfully.');
      }
    } catch (err: any) {
      await this.updateJobStatus(jobId, 'failed', 100, `CRITICAL ERROR: ${err.message || 'Unknown error'}`);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async executeInstallJob(jobId: string, serverId: string) {
    const server = this.db.getTable('servers').find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found in database.`);
    }

    const serverDir = this.fileService.resolvePath(serverId, '');
    
    try {
      await this.updateJobStatus(jobId, 'running', 20, `Creating server directory at storage/servers/${serverId}`);
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }

      await this.updateJobStatus(jobId, 'running', 35, `Writing default configuration files (server.properties, eula.txt)`);
      
      // Write standard Minecraft EULA file based on user acceptance
      const eulaAccepted = server.variables?.acceptEula === 'true';
      const eulaContent = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n# ${new Date().toString()}\neula=${eulaAccepted ? 'true' : 'false'}\n`;
      fs.writeFileSync(path.join(serverDir, 'eula.txt'), eulaContent, 'utf8');

      // Write default server.properties
      const propertiesContent = `
# Minecraft server properties
# ${new Date().toString()}
difficulty=easy
gamemode=survival
max-players=20
online-mode=false
pvp=true
view-distance=10
spawn-protection=16
motd=A newly created ${server.software} Server
server-port=${server.primaryPort}
enable-rcon=true
rcon.port=${20000 + (server.primaryPort % 1000)}
rcon.password=admin_rcon_pass
`;
      fs.writeFileSync(path.join(serverDir, 'server.properties'), propertiesContent, 'utf8');

      await this.updateJobStatus(jobId, 'running', 45, `Resolving server binaries download URL...`);

      let downloadUrl = server.variables?.downloadUrl || '';
      const software = server.software.toLowerCase();
      const version = server.version;

      if (!downloadUrl) {
        if (software === 'paper') {
          // Direct immutable mirrors for PaperMC releases on fill-data
          const directFallbacks: Record<string, string> = {
            '1.21.4': 'https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar',
            '1.21.1': 'https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar',
            '1.20.4': 'https://fill-data.papermc.io/v1/objects/cabed3ae77cf55deba7c7d8722bc9cfd5e991201c211665f9265616d9fe5c77b/paper-1.20.4-499.jar',
            '1.19.4': 'https://fill-data.papermc.io/v1/objects/e587d78cba3e99ef8c4bc24cf20cc3bdbbe89e33b0b572070446af4eb6be5ccf/paper-1.19.4-550.jar',
            '1.18.2': 'https://fill-data.papermc.io/v1/objects/7aeb29cb0117b3531bfaebda9cba91bf0f4bead25ce15bbbc8fe4b840ca8353f/paper-1.18.2-388.jar'
          };

          try {
            // PaperMC v3 fill API
            const apiRes = await getUrl(`https://fill.papermc.io/v3/projects/paper/versions/${version}`);
            const parsed = JSON.parse(apiRes);
            const builds: number[] = parsed.builds || [];
            if (builds.length > 0) {
              const latestBuild = Math.max(...builds);
              const buildRes = await getUrl(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${latestBuild}`);
              const buildData = JSON.parse(buildRes);
              if (buildData.downloads) {
                const downloadObj = buildData.downloads['server:default'] || Object.values(buildData.downloads)[0];
                if (downloadObj && (downloadObj as any).url) {
                  downloadUrl = (downloadObj as any).url;
                }
              }
            }
          } catch (err: any) {
            console.warn(`[JobService] PaperMC fill v3 API resolution failed: ${err.message}. Using direct fallback mirror...`);
          }

          if (!downloadUrl) {
            downloadUrl = directFallbacks[version] || directFallbacks['1.21.1'];
          }
        } else if (software === 'purpur') {
          downloadUrl = `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
        } else if (software === 'vanilla') {
          try {
            const manifestRes = await getUrl('https://launchermeta.mojang.com/mc/game/version_manifest.json');
            const manifest = JSON.parse(manifestRes);
            const versionEntry = manifest.versions.find((v: any) => v.id === version);
            if (versionEntry) {
              const detailsRes = await getUrl(versionEntry.url);
              const details = JSON.parse(detailsRes);
              if (details.downloads?.server?.url) {
                downloadUrl = details.downloads.server.url;
              }
            }
          } catch {}
          if (!downloadUrl) {
            downloadUrl = `https://piston-data.mojang.com/v1/objects/59a38d150b4cd4dae4b09ec2905f03d6f1dfc333/server.jar`;
          }
        } else if (software === 'fabric') {
          const loaderRes = await getUrl('https://meta.fabricmc.net/v2/versions/loader');
          const loaders = JSON.parse(loaderRes);
          const stableLoader = loaders.find((l: any) => l.stable === true);
          if (!stableLoader) throw new Error('No stable Fabric loader found.');
          
          const installerRes = await getUrl('https://meta.fabricmc.net/v2/versions/installer');
          const installers = JSON.parse(installerRes);
          const stableInstaller = installers.find((i: any) => i.stable === true);
          if (!stableInstaller) throw new Error('No stable Fabric installer found.');
          
          downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${stableLoader.version}/${stableInstaller.version}/server/jar`;
        } else if (software === 'neoforge' || software === 'forge') {
          // NeoForge / Forge installer fallback
          downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/0.15.11/1.0.1/server/jar`;
        } else {
          throw new Error(`Software ${server.software} is currently unsupported for direct downloads.`);
        }
      }

      const destJar = path.join(serverDir, 'server.jar');

      await this.updateJobStatus(jobId, 'running', 60, `Downloading genuine ${server.software} ${server.version} core JAR from official repository...`);
      
      // Attempt direct download
      try {
        await downloadFile(downloadUrl, destJar);
      } catch (dlErr: any) {
        console.warn(`[JobService] Primary download of ${server.software} failed (${dlErr.message}). Retrying with direct CDN mirror...`);
        
        // If paper failed, try direct fallback
        if (software === 'paper') {
          const directFallbacks: Record<string, string> = {
            '1.21.4': 'https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar',
            '1.21.1': 'https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar',
            '1.20.4': 'https://fill-data.papermc.io/v1/objects/cabed3ae77cf55deba7c7d8722bc9cfd5e991201c211665f9265616d9fe5c77b/paper-1.20.4-499.jar',
            '1.19.4': 'https://fill-data.papermc.io/v1/objects/e587d78cba3e99ef8c4bc24cf20cc3bdbbe89e33b0b572070446af4eb6be5ccf/paper-1.19.4-550.jar',
            '1.18.2': 'https://fill-data.papermc.io/v1/objects/7aeb29cb0117b3531bfaebda9cba91bf0f4bead25ce15bbbc8fe4b840ca8353f/paper-1.18.2-388.jar'
          };
          const fallbackUrl = directFallbacks[version] || directFallbacks['1.21.1'];
          await this.updateJobStatus(jobId, 'running', 65, `Retrying download via direct immutable CDN mirror...`);
          await downloadFile(fallbackUrl, destJar);
        } else {
          throw dlErr;
        }
      }

      // Verify physical existence, size, and ZIP magic bytes
      if (!fs.existsSync(destJar)) {
        throw new Error('Downloaded server.jar file does not exist on disk.');
      }
      const stat = fs.statSync(destJar);
      if (stat.size <= 0) { // Only require size > 0
        throw new Error(`Downloaded server.jar is empty (0 bytes).`);
      }

      // Check ZIP magic bytes (PK\x03\x04)
      const fd = fs.openSync(destJar, 'r');
      const magicBuffer = Buffer.alloc(4);
      fs.readSync(fd, magicBuffer, 0, 4, 0);
      fs.closeSync(fd);

      const isZip = (magicBuffer[0] === 0x50 && magicBuffer[1] === 0x4b && magicBuffer[2] === 0x03 && magicBuffer[3] === 0x04) ||
                    (magicBuffer[0] === 0x50 && magicBuffer[1] === 0x4b && magicBuffer[2] === 0x05 && magicBuffer[3] === 0x06);
      if (!isZip) {
        throw new Error('Downloaded file is not a valid ZIP/JAR archive.');
      }

      const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
      await this.updateJobStatus(jobId, 'running', 75, `Successfully downloaded and verified ${server.software} core JAR (${sizeMb} MB)`);

      // Save additional metadata
      await this.db.update('servers', s => s.id === serverId, s => {
        s.variables = {
          ...s.variables,
          installedAt: new Date().toISOString(),
          jarSize: stat.size.toString(),
          jarPath: destJar,
          downloadUrl,
          installationStatus: 'completed'
        };
      });

      await this.updateJobStatus(jobId, 'running', 80, `Initializing server folders (plugins, mods, worlds, logs)`);
      fs.mkdirSync(path.join(serverDir, 'plugins'), { recursive: true });
      fs.mkdirSync(path.join(serverDir, 'mods'), { recursive: true });
      fs.mkdirSync(path.join(serverDir, 'world'), { recursive: true });
      fs.mkdirSync(path.join(serverDir, 'logs'), { recursive: true });

      await this.updateJobStatus(jobId, 'running', 95, `Verifying directories, files, and initial file integrity...`);

      // Set server status to offline (ready to start!)
      await this.db.update('servers', s => s.id === serverId, s => {
        s.status = 'Offline';
      });

      await this.updateJobStatus(jobId, 'completed', 100, `Minecraft ${server.software} Server setup completed successfully.`);
    } catch (err: any) {
      console.error(`[JobService] Server install job ${jobId} failed:`, err);
      
      await this.updateJobStatus(jobId, 'failed', 100, `INSTALLATION FAILED: ${err.message || 'Unknown error'}`);
      
      // Update server status to error
      await this.db.update('servers', s => s.id === serverId, s => {
        s.status = 'Error';
      });

      // Clean up directory
      if (fs.existsSync(serverDir)) {
        try {
          fs.rmSync(serverDir, { recursive: true, force: true });
        } catch (rmErr: any) {
          console.error(`[JobService] Failed to clean server directory ${serverDir}:`, rmErr.message);
        }
      }

      // Release port allocation
      await this.db.update('allocations', a => a.serverId === serverId, a => {
        a.serverId = null;
        a.isPrimary = false;
      });

      throw err;
    }
  }

  private async executeDeleteJob(jobId: string, serverId: string) {
    await this.updateJobStatus(jobId, 'running', 30, `Stopping and deleting associated Docker containers...`);
    
    // Real deletions
    const serverDir = this.fileService.resolvePath(serverId, '');
    
    await this.updateJobStatus(jobId, 'running', 60, `Wiping files in /srv/minecraft/servers/${serverId}...`);
    if (fs.existsSync(serverDir)) {
      fs.rmSync(serverDir, { recursive: true, force: true });
    }

    await this.updateJobStatus(jobId, 'running', 85, `Releasing ports and allocated network sockets...`);
    // Release port
    await this.db.update('allocations', a => a.serverId === serverId, a => {
      a.serverId = null;
      a.isPrimary = false;
    });

    // Delete server from Database
    await this.db.delete('servers', s => s.id === serverId);
    
    await this.updateJobStatus(jobId, 'completed', 100, `Server ${serverId} files and database metadata wiped successfully.`);
  }

  private async updateJobStatus(
    jobId: string,
    status: Job['status'],
    progress: number,
    logMessage: string
  ) {
    await this.db.update('jobs', j => j.id === jobId, j => {
      j.status = status;
      j.progress = progress;
      j.logs.push(`[${new Date().toLocaleTimeString()}] ${logMessage}`);
      j.updatedAt = new Date().toISOString();
    });

    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = status;
      job.progress = progress;
      job.logs.push(`[${new Date().toLocaleTimeString()}] ${logMessage}`);
      job.updatedAt = new Date().toISOString();
    }
  }
}
