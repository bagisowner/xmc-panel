import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { EngineInstaller, VersionResolution, InstallResult, StartCommandResult } from './EngineInstaller';
import { DownloadManager, DownloadProgress } from '../DownloadManager';
import { JarVerifier } from '../JarVerifier';
import { JavaService } from '../JavaService';

export class ForgeInstaller implements EngineInstaller {
  public readonly engineId = 'Forge';
  public readonly displayName = 'Minecraft Forge';
  public readonly isProxy = false;

  private static readonly PROMO_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal)';

  public async getAvailableVersions(): Promise<string[]> {
    try {
      const res = await fetch(ForgeInstaller.PROMO_URL, {
        headers: { 'User-Agent': ForgeInstaller.USER_AGENT }
      });
      if (!res.ok) throw new Error(`Forge Promo API returned HTTP ${res.status}`);
      const data: any = await res.json();
      const promos = data.promos || {};

      // Extract unique Minecraft versions from promo keys (e.g. "1.20.1-recommended" -> "1.20.1")
      const versionsSet = new Set<string>();
      for (const key of Object.keys(promos)) {
        const mcVer = key.replace(/-(recommended|latest)$/, '');
        if (mcVer && /^[0-9]+(\.[0-9]+)+$/.test(mcVer)) {
          versionsSet.add(mcVer);
        }
      }

      return Array.from(versionsSet).reverse();
    } catch (e: any) {
      console.error('[ForgeInstaller] Failed to fetch Forge promotions:', e);
      return ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'];
    }
  }

  public getJavaRequirement(version: string): string {
    const parts = version.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10));
    const minor = parts[1] || 20;
    const patch = parts[2] || 0;

    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return '21';
    }
    if (minor >= 17) {
      return '17';
    }
    return '17';
  }

  public async resolveVersion(version: string): Promise<VersionResolution> {
    const trimmedVer = version.trim();
    const res = await fetch(ForgeInstaller.PROMO_URL, {
      headers: { 'User-Agent': ForgeInstaller.USER_AGENT }
    });

    if (!res.ok) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `Failed to query Forge promotions metadata (HTTP ${res.status}).`
      };
    }

    const data: any = await res.json();
    const promos = data.promos || {};

    const forgeBuild = promos[`${trimmedVer}-recommended`] || promos[`${trimmedVer}-latest`] || promos[trimmedVer];

    if (!forgeBuild) {
      return {
        supported: false,
        engine: this.engineId,
        minecraftVersion: trimmedVer,
        resolvedBuild: '',
        downloadUrl: '',
        javaVersion: this.getJavaRequirement(trimmedVer),
        isProxy: false,
        error: `No compatible Forge release promotion found for Minecraft ${trimmedVer}.`
      };
    }

    const fullForgeVer = `${trimmedVer}-${forgeBuild}`;
    const dlUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeVer}/forge-${fullForgeVer}-installer.jar`;
    const javaVersion = this.getJavaRequirement(trimmedVer);

    return {
      supported: true,
      engine: this.engineId,
      minecraftVersion: trimmedVer,
      resolvedBuild: String(forgeBuild),
      downloadUrl: dlUrl,
      fileName: `forge-${fullForgeVer}-installer.jar`,
      javaVersion,
      isProxy: false,
      extra: {
        forgeVersion: String(forgeBuild),
        fullForgeVersion: fullForgeVer
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
    const installerPath = path.join(targetDir, 'forge-installer.jar');
    onLog(`[ForgeInstaller] Downloading official Forge installer for Minecraft ${resolution.minecraftVersion} (Forge ${resolution.resolvedBuild})...`);

    await DownloadManager.downloadFile(resolution.downloadUrl, installerPath, {
      onProgress,
      onLog,
      validateJarStructure: true
    });

    onLog(`[ForgeInstaller] Forge installer verified and saved as forge-installer.jar.`);
    return installerPath;
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
    const installerPath = path.join(srvPath, 'forge-installer.jar');
    if (!fs.existsSync(installerPath)) {
      throw new Error('forge-installer.jar is missing from server workspace.');
    }

    onLog(`[ForgeInstaller] Resolving Java runtime for Forge server extraction...`);
    const javaBin = await JavaService.getInstance().resolveJavaBinaryPath(resolution.javaVersion || '17');
    onLog(`[ForgeInstaller] Running server installer: ${javaBin} -jar forge-installer.jar --installServer`);

    // Execute installer with live stdout/stderr capture
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(javaBin, ['-jar', 'forge-installer.jar', '--installServer'], {
        cwd: srvPath
      });

      proc.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) onLog(`[Forge Installer] ${text}`);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) onLog(`[Forge Installer] ${text}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Forge installer failed with exit code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    // Cleanup installer files
    try { fs.unlinkSync(installerPath); } catch {}
    try { fs.unlinkSync(path.join(srvPath, 'forge-installer.jar.log')); } catch {}

    // Verify generated server files and determine launch command
    const files = fs.readdirSync(srvPath);
    let executable = 'server.jar';
    let startCommand = '';

    // Check for modern Forge run.sh / user_jvm_args.txt / unix_args.txt
    const unixArgsPath = this.findUnixArgsFile(srvPath);
    const hasRunSh = files.includes('run.sh');
    const hasUserJvmArgs = files.includes('user_jvm_args.txt');

    if (unixArgsPath && hasUserJvmArgs) {
      executable = unixArgsPath;
      startCommand = `java @user_jvm_args.txt @${unixArgsPath} nogui`;
      onLog(`[ForgeInstaller] Detected modern Forge structure: using @user_jvm_args.txt and @${unixArgsPath}`);
    } else {
      // Check for standalone forge-*.jar
      const forgeJars = files.filter(f => f.includes('forge') && f.endsWith('.jar') && !f.includes('installer'));
      if (forgeJars.length > 0) {
        executable = forgeJars[0];
        startCommand = `java -Xms\${minRam} -Xmx\${maxRam} -jar ${executable} nogui`;
        onLog(`[ForgeInstaller] Detected Forge executable JAR: ${executable}`);
      } else if (hasRunSh) {
        executable = 'run.sh';
        startCommand = `bash run.sh nogui`;
        try { fs.chmodSync(path.join(srvPath, 'run.sh'), '755'); } catch {}
        onLog(`[ForgeInstaller] Detected Forge launch script: run.sh`);
      } else {
        // Fallback: check if server.jar exists or create normalized entry
        executable = 'server.jar';
        startCommand = `java -Xms\${minRam} -Xmx\${maxRam} -jar server.jar nogui`;
      }
    }

    // Persist normalized Forge metadata
    const metadata = {
      engine: 'forge',
      minecraftVersion: resolution.minecraftVersion,
      forgeVersion: resolution.resolvedBuild,
      installer: 'forge-installer.jar',
      executable,
      startCommand
    };
    fs.writeFileSync(path.join(srvPath, 'forge-metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    onLog(`[ForgeInstaller] Forge installation successfully verified and registered.`);
    return {
      executable,
      startCommand,
      metadata
    };
  }

  private findUnixArgsFile(srvPath: string): string | null {
    const libsDir = path.join(srvPath, 'libraries', 'net', 'minecraftforge', 'forge');
    if (!fs.existsSync(libsDir)) return null;

    try {
      const versions = fs.readdirSync(libsDir);
      for (const v of versions) {
        const candidate = path.join(libsDir, v, 'unix_args.txt');
        if (fs.existsSync(candidate)) {
          return path.relative(srvPath, candidate);
        }
      }
    } catch {}
    return null;
  }

  public async prepare(srvPath: string, config: any, onLog: (msg: string) => void): Promise<void> {
    if (config.acceptEula) {
      fs.writeFileSync(path.join(srvPath, 'eula.txt'), 'eula=true\n', 'utf8');
      onLog('[ForgeInstaller] Accepted Minecraft EULA (eula.txt generated).');
    }

    const port = config.port || 25565;
    const defaultProps = `# Minecraft server properties (Generated by CCC ForgeInstaller)
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
motd=${config.name || 'A Minecraft Forge Server'}
`;
    fs.writeFileSync(path.join(srvPath, 'server.properties'), defaultProps, 'utf8');
    onLog(`[ForgeInstaller] Configured server.properties with port ${port}.`);
  }

  public getStartCommand(
    srvPath: string,
    javaBin: string,
    config: any,
    installResult: InstallResult
  ): StartCommandResult {
    const minRam = config.minRamGb || '512M';
    const maxRamGb = Math.max(1, Math.min(config.memoryLimitGb || 2, 8));

    // Check if unix_args.txt exists for modern Forge
    const unixArgsPath = this.findUnixArgsFile(srvPath);
    if (unixArgsPath && fs.existsSync(path.join(srvPath, 'user_jvm_args.txt'))) {
      return {
        command: javaBin,
        args: [`-Xms${minRam}`, `-Xmx${maxRamGb}G`, '@user_jvm_args.txt', `@${unixArgsPath}`, 'nogui']
      };
    }

    // Check for standalone jar
    const files = fs.readdirSync(srvPath);
    const forgeJars = files.filter(f => f.includes('forge') && f.endsWith('.jar') && !f.includes('installer'));
    const jarToRun = forgeJars.length > 0 ? forgeJars[0] : (installResult.executable || 'server.jar');

    return {
      command: javaBin,
      args: [`-Xms${minRam}`, `-Xmx${maxRamGb}G`, '-jar', jarToRun, 'nogui']
    };
  }

  public detectReady(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.includes('done (') || lower.includes('for help, type "help"');
  }
}
