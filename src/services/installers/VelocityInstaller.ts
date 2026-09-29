import fs from 'fs';
import path from 'path';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';

export class VelocityInstaller implements EngineInstaller {
  public readonly engineId = 'Velocity';
  public readonly displayName = 'Velocity Proxy';
  public readonly isProxy = true;

  private static readonly API_BASE = 'https://fill.papermc.io/v3/projects/velocity';
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal)';

  public async getAvailableVersions(): Promise<string[]> {
    try {
      const res = await fetch(VelocityInstaller.API_BASE, {
        headers: { 'User-Agent': VelocityInstaller.USER_AGENT }
      });
      if (!res.ok) throw new Error(`Velocity API returned HTTP ${res.status}`);
      const data: any = await res.json();
      if (!data.versions) return [];

      let versionsList: string[] = [];
      if (Array.isArray(data.versions)) {
        versionsList = data.versions;
      } else if (typeof data.versions === 'object') {
        versionsList = Object.values(data.versions).flat() as string[];
      }

      return Array.from(new Set(versionsList)).filter(v => typeof v === 'string' && v.trim().length > 0);
    } catch (e: any) {
      console.error('[VelocityInstaller] Failed to fetch versions list:', e);
      return ['3.3.0-SNAPSHOT', '3.4.0-SNAPSHOT', '3.5.0', '3.6.0-SNAPSHOT', '4.0.0', '4.1.1', '4.2.1-SNAPSHOT'];
    }
  }

  public getJavaRequirement(version: string): string {
    // Velocity 3.3+ requires Java 17+, recommended Java 21
    if (version.startsWith('4.') || version.startsWith('3.4') || version.startsWith('3.5') || version.startsWith('3.6')) {
      return '21';
    }
    return '17';
  }

  public async resolveVersion(version: string): Promise<VersionResolution> {
    const trimmedVer = version.trim();
    const verRes = await fetch(`${VelocityInstaller.API_BASE}/versions/${trimmedVer}`, {
      headers: { 'User-Agent': VelocityInstaller.USER_AGENT }
    });

    if (!verRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: true,
        error: `Velocity proxy version '${trimmedVer}' does not exist in PaperMC registry.`
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
        isProxy: true,
        error: `No builds available for Velocity version '${trimmedVer}'.`
      };
    }

    const latestBuild = Math.max(...builds);
    const javaVersion = this.getJavaRequirement(trimmedVer);

    // Fetch build metadata for download URL
    const buildRes = await fetch(`${VelocityInstaller.API_BASE}/versions/${trimmedVer}/builds/${latestBuild}`, {
      headers: { 'User-Agent': VelocityInstaller.USER_AGENT }
    });

    if (!buildRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: String(latestBuild),
        downloadUrl: '',
        javaVersion,
        isProxy: true,
        error: `Failed to retrieve build metadata for Velocity build #${latestBuild}.`
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
        isProxy: true,
        error: `No download artifact found for Velocity build #${latestBuild}.`
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
      fileName: downloadObj.name || `velocity-${trimmedVer}-${latestBuild}.jar`,
      javaVersion,
      isProxy: true
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
    const targetJarPath = path.join(targetDir, 'velocity.jar');
    onLog(`[VelocityInstaller] Downloading Velocity Proxy ${resolution.minecraftVersion} (Build #${resolution.resolvedBuild})...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, targetJarPath, {
      expectedSha256: resolution.checksum,
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[VelocityInstaller] Velocity distribution verified and saved as velocity.jar.`);
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
    const jarPath = path.join(srvPath, 'velocity.jar');
    if (!fs.existsSync(jarPath)) {
      throw new Error('velocity.jar is missing from proxy server workspace.');
    }

    onLog(`[VelocityInstaller] Velocity proxy environment ready.`);
    return {
      executable: 'velocity.jar',
      startCommand: 'java -Xms${minRam} -Xmx${maxRam} -jar velocity.jar'
    };
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    const port = config.port || 25577;
    const tomlContent = `# Velocity Proxy Configuration (Generated by CCC VelocityInstaller)
config-version = "2.7"
bind = "0.0.0.0:${port}"
motd = "<#7c3aed>Craft Command Center <#a855f7>Velocity Proxy"
show-max-players = 500
online-mode = ${config.onlineMode !== false ? 'true' : 'false'}
force-key-authentication = false
player-info-forwarding-mode = "modern"
forwarding-secret-file = ""
announce-forge = true

[servers]
lobby = "127.0.0.1:25565"
try = [ "lobby" ]

[forced-hosts]

[advanced]
compression-threshold = 256
compression-level = -1
login-ratelimit = 3000
connection-timeout = 5000
read-timeout = 30000
haproxy-protocol = false
tcp-fast-open = true
bungee-plugin-message-channel = true
show-ping-requests = false
failover-on-unexpected-server-disconnect = true
announce-proxy-commands = true
log-command-executions = false

[query]
enabled = false
port = ${port}
map = "Velocity"
show-plugins = false
`;
    fs.writeFileSync(path.join(srvPath, 'velocity.toml'), tomlContent, 'utf8');
    onLog(`[VelocityInstaller] Generated velocity.toml configured on port ${port}.`);
  }

  public getStartCommand(
    srvPath: string,
    javaBin: string,
    config: any,
    installResult: InstallResult
  ): StartCommandResult {
    const minRam = config.minRamGb || '512M';
    const maxRamGb = Math.max(1, Math.min(config.memoryLimitGb || 2, 4));
    return {
      command: javaBin,
      args: [`-Xms${minRam}`, `-Xmx${maxRamGb}G`, '-jar', 'velocity.jar']
    };
  }

  public detectReady(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('listening on') || lower.includes('booting velocity') || lower.includes('done (');
  }
}
