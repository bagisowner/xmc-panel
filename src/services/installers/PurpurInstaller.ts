import fs from 'fs';
import path from 'path';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';

export class PurpurInstaller implements EngineInstaller {
  public readonly engineId = 'Purpur';
  public readonly displayName = 'Purpur';
  public readonly isProxy = false;

  private static readonly API_BASE = 'https://api.purpurmc.org/v2/purpur';
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal)';

  public async getAvailableVersions(): Promise<string[]> {
    try {
      const res = await fetch(PurpurInstaller.API_BASE, {
        headers: { 'User-Agent': PurpurInstaller.USER_AGENT }
      });
      if (!res.ok) throw new Error(`Purpur API returned HTTP ${res.status}`);
      const data: any = await res.json();
      const versions: string[] = data.versions || [];
      return versions.reverse();
    } catch (e: any) {
      console.error('[PurpurInstaller] Failed to fetch versions list:', e);
      return ['1.21.11', '1.21.10', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'];
    }
  }

  public getJavaRequirement(version: string): string {
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
    const verRes = await fetch(`${PurpurInstaller.API_BASE}/${trimmedVer}`, {
      headers: { 'User-Agent': PurpurInstaller.USER_AGENT }
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
        error: `Purpur version '${trimmedVer}' does not exist or has no published releases.`
      };
    }

    const data: any = await verRes.json();
    const latestBuild = data.builds?.latest || (data.builds?.all ? data.builds.all[0] : null);

    if (!latestBuild) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `No published builds found for Purpur version '${trimmedVer}'.`
      };
    }

    const dlUrl = `${PurpurInstaller.API_BASE}/${trimmedVer}/${latestBuild}/download`;
    const javaVersion = this.getJavaRequirement(trimmedVer);

    return {
      supported: true,
      engine: this.engineId,
      minecraftVersion: trimmedVer,
      resolvedBuild: String(latestBuild),
      downloadUrl: dlUrl,
      fileName: `purpur-${trimmedVer}-${latestBuild}.jar`,
      javaVersion,
      isProxy: false
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
    onLog(`[PurpurInstaller] Downloading Purpur ${resolution.minecraftVersion} (Build #${resolution.resolvedBuild})...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, targetJarPath, {
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[PurpurInstaller] Download verified. server.jar committed.`);
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
    const jarPath = path.join(srvPath, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      throw new Error('server.jar is missing from server workspace.');
    }

    onLog(`[PurpurInstaller] Purpur environment initialized at ${srvPath}.`);
    return {
      executable: 'server.jar',
      startCommand: 'java -Xms${minRam} -Xmx${maxRam} -jar server.jar nogui'
    };
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    if (config.acceptEula) {
      fs.writeFileSync(path.join(srvPath, 'eula.txt'), 'eula=true\n', 'utf8');
      onLog('[PurpurInstaller] Accepted Minecraft EULA (eula.txt generated).');
    }

    const port = config.port || 25565;
    const defaultProps = `# Minecraft server properties (Generated by CCC PurpurInstaller)
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
motd=${config.name || 'A Purpur Minecraft Server'}
`;
    fs.writeFileSync(path.join(srvPath, 'server.properties'), defaultProps, 'utf8');
    onLog(`[PurpurInstaller] Configured server.properties with port ${port}.`);
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
    return lower.includes('done (') || lower.includes('for help, type "help"');
  }
}
