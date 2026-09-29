import fs from 'fs';
import path from 'path';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';

export class PaperInstaller implements EngineInstaller {
  public readonly engineId = 'Paper';
  public readonly displayName = 'PaperMC';
  public readonly isProxy = false;

  private static readonly API_BASE = 'https://fill.papermc.io/v3/projects/paper';
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal)';

  public async getAvailableVersions(): Promise<string[]> {
    try {
      const res = await fetch(PaperInstaller.API_BASE, {
        headers: { 'User-Agent': PaperInstaller.USER_AGENT }
      });
      if (!res.ok) {
        throw new Error(`Paper API returned HTTP ${res.status}`);
      }
      const data: any = await res.json();
      if (!data.versions) return [];

      let versionsList: string[] = [];
      if (Array.isArray(data.versions)) {
        versionsList = data.versions;
      } else if (typeof data.versions === 'object') {
        // Map of major version -> array of patch versions
        versionsList = Object.values(data.versions).flat() as string[];
      }

      // Return unique versions, sorted descending
      return Array.from(new Set(versionsList)).filter(v => typeof v === 'string' && v.trim().length > 0);
    } catch (e: any) {
      console.error('[PaperInstaller] Failed to fetch versions list:', e);
      // Fallback essential list if upstream is completely unreachable
      return ['1.21.11', '1.21.10', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'];
    }
  }

  public getJavaRequirement(version: string, extra?: any): string {
    if (extra?.minimumJava) {
      return String(extra.minimumJava);
    }
    // Parse version
    const parts = version.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10));
    const major = parts[0] || 1;
    const minor = parts[1] || 21;
    const patch = parts[2] || 0;

    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return '21';
    }
    if (minor >= 18 || (minor === 17 && patch >= 0)) {
      return '17';
    }
    return '17';
  }

  public async resolveVersion(version: string): Promise<VersionResolution> {
    const trimmedVer = version.trim();
    const verRes = await fetch(`${PaperInstaller.API_BASE}/versions/${trimmedVer}`, {
      headers: { 'User-Agent': PaperInstaller.USER_AGENT }
    });

    if (!verRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `Version '${trimmedVer}' was not found in the official PaperMC registry (HTTP ${verRes.status}).`
      };
    }

    const verData: any = await verRes.json();
    const builds: number[] = verData.builds || [];
    if (builds.length === 0) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `No published builds found for Paper version '${trimmedVer}'.`
      };
    }

    const latestBuild = Math.max(...builds);
    const minJava = verData.version?.java?.version?.minimum;
    const javaVersion = this.getJavaRequirement(trimmedVer, { minimumJava: minJava });

    // Fetch the build details to obtain the verified direct download URL and checksum
    const buildRes = await fetch(`${PaperInstaller.API_BASE}/versions/${trimmedVer}/builds/${latestBuild}`, {
      headers: { 'User-Agent': PaperInstaller.USER_AGENT }
    });

    if (!buildRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: String(latestBuild),
        downloadUrl: '',
        javaVersion,
        isProxy: false,
        error: `Failed to retrieve build metadata for Paper build #${latestBuild}.`
      };
    }

    const buildData: any = await buildRes.json();
    const downloads = buildData.downloads || {};
    const downloadObj: any = downloads['server:default'] || downloads['application'] || Object.values(downloads)[0];

    if (!downloadObj || !downloadObj.url) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: String(latestBuild),
        downloadUrl: '',
        javaVersion,
        isProxy: false,
        error: `Could not locate server download artifact in Paper build #${latestBuild}.`
      };
    }

    return {
      supported: true,
      engine: this.engineId,
      minecraftVersion: trimmedVer,
      resolvedBuild: String(latestBuild),
      downloadUrl: downloadObj.url,
      checksum: downloadObj.checksums?.sha256,
      fileSize: downloadObj.size,
      fileName: downloadObj.name || `paper-${trimmedVer}-${latestBuild}.jar`,
      javaVersion,
      isProxy: false,
      extra: {
        channel: buildData.channel || 'STABLE'
      }
    };
  }

  public async validateVersion(version: string): Promise<VersionResolution> {
    return this.resolveVersion(version);
  }

  public async download(
    resolution: VersionResolution,
    targetDir: string,
    onProgress: (p: DownloadProgress) => void,
    onLog: (msg: string) => void
  ): Promise<string> {
    const targetJarPath = path.join(targetDir, 'server.jar');
    onLog(`[PaperInstaller] Downloading Paper ${resolution.minecraftVersion} (Build #${resolution.resolvedBuild})...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, targetJarPath, {
      expectedSha256: resolution.checksum,
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[PaperInstaller] Download verified. server.jar committed.`);
    return targetJarPath;
  }

  public async verify(filePath: string, resolution: VersionResolution): Promise<boolean> {
    const check = JarVerifier.verifyJar(filePath, {
      expectedSha256: resolution.checksum
    });
    return check.valid;
  }

  public async install(
    srvPath: string,
    resolution: VersionResolution,
    config: any,
    onLog: (msg: string) => void
  ): Promise<InstallResult> {
    const jarPath = path.join(srvPath, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      throw new Error('server.jar is missing from server workspace.');
    }

    onLog(`[PaperInstaller] Paper environment initialized at ${srvPath}.`);
    return {
      executable: 'server.jar',
      startCommand: 'java -Xms${minRam} -Xmx${maxRam} -jar server.jar nogui'
    };
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    // Write eula.txt
    if (config.acceptEula) {
      fs.writeFileSync(path.join(srvPath, 'eula.txt'), 'eula=true\n', 'utf8');
      onLog('[PaperInstaller] Accepted Minecraft EULA (eula.txt generated).');
    }

    // Write server.properties
    const port = config.port || 25565;
    const defaultProps = `# Minecraft server properties (Generated by CCC PaperInstaller)
server-port=${port}
query.port=${port}
gamemode=${config.gamemode || 'survival'}
difficulty=${config.difficulty || 'easy'}
pvp=${config.pvp !== undefined ? config.pvp : 'true'}
max-players=${config.maxPlayers || 20}
level-name=world
view-distance=${config.viewDistance || '10'}
simulation-distance=${config.simulationDistance || '10'}
online-mode=${config.onlineMode !== undefined ? config.onlineMode : 'true'}
enable-rcon=false
motd=${config.name || 'A Minecraft Server'}
`;
    fs.writeFileSync(path.join(srvPath, 'server.properties'), defaultProps, 'utf8');
    onLog(`[PaperInstaller] Configured server.properties with port ${port}.`);
  }

  public getStartCommand(
    srvPath: string,
    javaBin: string,
    config: any,
    installResult: InstallResult
  ): StartCommandResult {
    const minRam = config.minRamGb || '512M';
    const maxRamGb = Math.max(1, Math.min(config.memoryLimitGb || 2, 8));
    return {
      command: javaBin,
      args: [`-Xms${minRam}`, `-Xmx${maxRamGb}G`, '-jar', 'server.jar', 'nogui']
    };
  }

  public detectReady(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('done (') || lower.includes('for help, type "help"') || lower.includes('timings reset');
  }
}
