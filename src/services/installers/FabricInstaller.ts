import fs from 'fs';
import path from 'path';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';

export class FabricInstaller implements EngineInstaller {
  public readonly engineId = 'Fabric';
  public readonly displayName = 'Fabric';
  public readonly isProxy = false;

  private static readonly META_BASE = 'https://meta.fabricmc.net/v2/versions';
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal)';

  public async getAvailableVersions(): Promise<string[]> {
    try {
      const res = await fetch(`${FabricInstaller.META_BASE}/game`, {
        headers: { 'User-Agent': FabricInstaller.USER_AGENT }
      });
      if (!res.ok) throw new Error(`Fabric Meta API returned HTTP ${res.status}`);
      const data: any[] = await res.json();
      // Filter to release versions or standard versions
      const releases = data.filter(g => g.stable).map(g => g.version);
      return releases.length > 0 ? releases : data.map(g => g.version);
    } catch (e: any) {
      console.error('[FabricInstaller] Failed to fetch game versions:', e);
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

    // 1. Verify game version exists and resolve compatible loader
    const loaderRes = await fetch(`${FabricInstaller.META_BASE}/loader/${trimmedVer}`, {
      headers: { 'User-Agent': FabricInstaller.USER_AGENT }
    });

    if (!loaderRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `Fabric does not have compatible loader releases for Minecraft ${trimmedVer}.`
      };
    }

    const loaders: any[] = await loaderRes.json();
    if (!loaders || loaders.length === 0) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `No compatible Fabric loaders found for version ${trimmedVer}.`
      };
    }

    const selectedLoader = loaders[0]?.loader?.version;
    if (!selectedLoader) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `Failed to resolve Fabric loader version for Minecraft ${trimmedVer}.`
      };
    }

    // 2. Dynamically resolve the latest compatible Fabric installer version
    const installerRes = await fetch(`${FabricInstaller.META_BASE}/installer`, {
      headers: { 'User-Agent': FabricInstaller.USER_AGENT }
    });

    if (!installerRes.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: `Loader: ${selectedLoader}`,
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: 'Failed to query Fabric installer metadata.'
      };
    }

    const installers: any[] = await installerRes.json();
    const selectedInstaller = installers[0]?.version || '1.1.2';

    // 3. Construct official executable Fabric server launcher
    const dlUrl = `${FabricInstaller.META_BASE}/loader/${trimmedVer}/${selectedLoader}/${selectedInstaller}/server/jar`;
    const javaVersion = this.getJavaRequirement(trimmedVer);

    return {
      supported: true,
      engine: this.engineId,
      minecraftVersion: trimmedVer,
      resolvedBuild: `Loader ${selectedLoader} (Installer ${selectedInstaller})`,
      downloadUrl: dlUrl,
      fileName: `fabric-server-launcher-${trimmedVer}.jar`,
      javaVersion,
      isProxy: false,
      extra: {
        loaderVersion: selectedLoader,
        installerVersion: selectedInstaller
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
    onLog(`[FabricInstaller] Downloading Fabric executable server launcher: Minecraft ${resolution.minecraftVersion} with ${resolution.resolvedBuild}...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, targetJarPath, {
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[FabricInstaller] Download verified. Fabric server launcher saved as server.jar.`);
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
      throw new Error('Fabric server.jar launcher is missing.');
    }

    // Write fabric-server-launcher.properties if needed
    const propsPath = path.join(srvPath, 'fabric-server-launcher.properties');
    if (!fs.existsSync(propsPath)) {
      fs.writeFileSync(propsPath, `serverJar=server.jar\n`, 'utf8');
    }

    onLog(`[FabricInstaller] Fabric server launcher initialized. First run will bootstrap vanilla dependencies.`);
    return {
      executable: 'server.jar',
      startCommand: 'java -Xms${minRam} -Xmx${maxRam} -jar server.jar nogui'
    };
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    if (config.acceptEula) {
      fs.writeFileSync(path.join(srvPath, 'eula.txt'), 'eula=true\n', 'utf8');
      onLog('[FabricInstaller] Accepted Minecraft EULA (eula.txt generated).');
    }

    const port = config.port || 25565;
    const defaultProps = `# Minecraft server properties (Generated by CCC FabricInstaller)
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
motd=${config.name || 'A Fabric Minecraft Server'}
`;
    fs.writeFileSync(path.join(srvPath, 'server.properties'), defaultProps, 'utf8');
    onLog(`[FabricInstaller] Configured server.properties with port ${port}.`);
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
    return lower.includes('done (') || lower.includes('for help, type "help"') || lower.includes('thread rcon listener started');
  }
}
