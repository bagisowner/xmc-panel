import fs from 'fs';
import path from 'path';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';

export class BungeeCordInstaller implements EngineInstaller {
  public readonly engineId = 'BungeeCord';
  public readonly displayName = 'BungeeCord Proxy';
  public readonly isProxy = true;

  private static readonly JENKINS_URL = 'https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar';

  public async getAvailableVersions(): Promise<string[]> {
    return ['latest', '1.21.x', '1.20.x'];
  }

  public getJavaRequirement(): string {
    return '17';
  }

  public async resolveVersion(version: string): Promise<VersionResolution> {
    return {
      supported: true,
      engine: this.engineId,
      minecraftVersion: version || 'latest',
      resolvedBuild: 'Latest Stable CI Build',
      downloadUrl: BungeeCordInstaller.JENKINS_URL,
      fileName: 'BungeeCord.jar',
      javaVersion: '17',
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
    const targetJarPath = path.join(targetDir, 'bungeecord.jar');
    onLog(`[BungeeCordInstaller] Downloading official BungeeCord distribution from Jenkins CI...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, targetJarPath, {
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[BungeeCordInstaller] BungeeCord verified and saved as bungeecord.jar.`);
    return targetJarPath;
  }

  public async verify(filePath: string, resolution: VersionResolution): Promise<boolean> {
    const check = JarVerifier.verifyJar(filePath, {});
    return check.valid;
  }

  public async install(
    srvPath: string,
    resolution: VersionResolution,
    config: any,
    onLog: (msg: string) => void
  ): Promise<InstallResult> {
    const jarPath = path.join(srvPath, 'bungeecord.jar');
    if (!fs.existsSync(jarPath)) {
      throw new Error('bungeecord.jar is missing from server workspace.');
    }

    onLog(`[BungeeCordInstaller] BungeeCord proxy workspace ready.`);
    return {
      executable: 'bungeecord.jar',
      startCommand: 'java -Xms${minRam} -Xmx${maxRam} -jar bungeecord.jar'
    };
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    const port = config.port || 25577;
    const configContent = `server_connect_timeout: 5000
remote_ping_cache: -1
forge_support: true
player_limit: -1
permissions:
  default:
  - bungeecord.command.server
  - bungeecord.command.list
  admin:
  - bungeecord.command.alert
  - bungeecord.command.end
  - bungeecord.command.ip
  - bungeecord.command.reload
timeout: 30000
log_commands: false
network_compression_threshold: 256
online_mode: ${config.onlineMode !== false ? 'true' : 'false'}
disabled_commands:
- disabledcommandhere
servers:
  lobby:
    motd: '&1A BungeeCord Connected Server'
    address: localhost:25565
    restricted: false
listeners:
- query_port: ${port}
  motd: '&aCraft Command Center &7- &bBungeeCord Proxy'
  tab_list: GLOBAL_PING
  query_enabled: false
  proxy_protocol: false
  forced_hosts:
    pvp.md-5.net: pvp
  ping_passthrough: false
  priorities:
  - lobby
  bind_local_address: true
  host: 0.0.0.0:${port}
  max_players: 100
  tab_size: 60
  force_default_server: false
ip_forward: true
remote_ping_timeout: 5000
prevent_proxy_connections: false
connection_throttle: 4000
stats: c06518db-b9ea-4395-926f-4424eb05db3a
connection_throttle_limit: 3
`;
    fs.writeFileSync(path.join(srvPath, 'config.yml'), configContent, 'utf8');
    onLog(`[BungeeCordInstaller] Configured config.yml on port ${port}.`);
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
      args: [`-Xms${minRam}`, `-Xmx${maxRamGb}G`, '-jar', 'bungeecord.jar']
    };
  }

  public detectReady(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('listening on') || lower.includes('enabled bungeecord version');
  }
}
