import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { Database, JavaRuntimeRecord } from '../db/Database.js';

const execFileAsync = promisify(execFile);

export interface JavaVerification {
  valid: boolean;
  versionString?: string;
  vmString?: string;
  fullOutput?: string;
  returnCode?: number;
  error?: string;
}

export interface JavaRuntimeInfo {
  version: string;
  major: number;
  vendor: string;
  recommendedFor: string;
  installed: boolean;
  path: string | null;
  directory: string | null;
  sizeBytes: number;
  sizeFormatted: string;
  verification: JavaVerification | null;
  architecture: string;
  isInstalling?: boolean;
}

export interface JavaRuntimesListResponse {
  runtimeDir: string;
  arch: string;
  platform: string;
  runtimes: JavaRuntimeInfo[];
  systemJava: {
    path: string | null;
    available: boolean;
    verification: JavaVerification | null;
  };
}

export interface JavaProgressStatus {
  status: 'idle' | 'resolving' | 'downloading' | 'extracting' | 'verifying' | 'completed' | 'failed';
  downloadedBytes?: number;
  totalBytes?: number;
  downloadedFormatted?: string;
  totalFormatted?: string;
  percent: number;
  speedBytesPerSec?: number;
  speedFormatted?: string;
  etaSeconds?: number;
  etaFormatted?: string;
  phase: string;
  error?: string;
  path?: string;
  verification?: JavaVerification;
}

export class JavaService {
  private static instance: JavaService | null = null;
  private runtimeDir: string;
  private db = Database.getInstance();
  private installingVersions: Set<string> = new Set();
  private progressStatusMap: Map<string, JavaProgressStatus> = new Map();

  private constructor() {
    this.runtimeDir = process.env.JAVA_RUNTIME_DIR || path.resolve(process.cwd(), 'runtimes', 'java');
    
    if (!fs.existsSync(this.runtimeDir)) {
      try {
        fs.mkdirSync(this.runtimeDir, { recursive: true });
      } catch (e: any) {
        console.warn('[JavaService] Could not create runtimeDir:', e.message);
      }
    }
  }

  public static getInstance(): JavaService {
    if (!JavaService.instance) {
      JavaService.instance = new JavaService();
    }
    return JavaService.instance;
  }

  public getRuntimeDir(): string {
    return this.runtimeDir;
  }

  public isInstalling(version: string): boolean {
    const cleanVer = version.replace(/[^0-9]/g, '');
    return this.installingVersions.has(cleanVer);
  }

  private updateStatus(version: string, status: JavaProgressStatus) {
    const cleanVer = version.replace(/[^0-9]/g, '');
    this.progressStatusMap.set(cleanVer, status);
    try {
      const statusFile = path.join(this.runtimeDir, `.install_${cleanVer}.json`);
      fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), 'utf8');
    } catch {}
  }

  public getStatus(version: string): JavaProgressStatus {
    const cleanVer = version.replace(/[^0-9]/g, '');
    if (this.progressStatusMap.has(cleanVer)) {
      return this.progressStatusMap.get(cleanVer)!;
    }

    const statusFile = path.join(this.runtimeDir, `.install_${cleanVer}.json`);
    const binPath = path.join(this.runtimeDir, cleanVer, 'bin', 'java');

    if (fs.existsSync(statusFile)) {
      try {
        const raw = fs.readFileSync(statusFile, 'utf8');
        return JSON.parse(raw);
      } catch {}
    }

    if (fs.existsSync(binPath)) {
      return {
        status: 'completed',
        percent: 100,
        phase: 'Installed & Verified ✓',
        path: binPath
      };
    }

    return {
      status: this.installingVersions.has(cleanVer) ? 'downloading' : 'idle',
      percent: this.installingVersions.has(cleanVer) ? 25 : 0,
      phase: this.installingVersions.has(cleanVer) ? 'Processing installation...' : 'Not installed'
    };
  }

  /**
   * Helper to format byte counts
   */
  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Recursively calculates directory size on disk
   */
  public getFolderSize(dirPath: string): number {
    let size = 0;
    if (!fs.existsSync(dirPath)) return 0;
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) return stat.size;

      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        try {
          const itemPath = path.join(dirPath, file);
          const itemStat = fs.statSync(itemPath);
          if (itemStat.isDirectory()) {
            size += this.getFolderSize(itemPath);
          } else {
            size += itemStat.size;
          }
        } catch {}
      }
    } catch {}
    return size;
  }

  /**
   * Directly verifies a java binary by executing <binary> -version
   */
  public async verifyRuntimeBinary(binPath: string): Promise<JavaVerification> {
    if (!fs.existsSync(binPath)) {
      return { valid: false, error: 'Executable binary does not exist on disk.' };
    }

    try {
      fs.chmodSync(binPath, 0o755);
      const { stdout, stderr } = await execFileAsync(binPath, ['-version'], { timeout: 8000 });
      const fullOutput = (stdout + '\n' + stderr).trim();
      const lines = fullOutput.split('\n').map(l => l.trim()).filter(Boolean);

      const versionLine = lines.find(l => l.includes('version') || l.includes('OpenJDK') || l.includes('Java')) || lines[0] || 'Java Runtime';
      const vmLine = lines.find(l => l.includes('VM') || l.includes('build') || l.includes('64-Bit')) || lines[1] || '';

      const valid = fullOutput.includes('version') || fullOutput.includes('OpenJDK') || fullOutput.includes('Java');

      return {
        valid,
        versionString: versionLine,
        vmString: vmLine,
        fullOutput
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err.message || 'Verification execution failed'
      };
    }
  }

  /**
   * Clean up obsolete/duplicate OpenJDK 21 installer files, temporary downloads,
   * old extraction folders, unused .py installer files and broken runtime copies.
   */
  public async cleanupOldJavaFiles(): Promise<void> {
    console.log('[JavaService] Cleaning up obsolete installer scripts, temp downloads, and duplicate runtime files...');

    const itemsToDelete = [
      path.resolve(process.cwd(), 'install_java.py'),
      path.resolve(process.cwd(), 'scripts', 'java_manager.py'),
      path.resolve(process.cwd(), 'extract_urls.py'),
      path.resolve(process.cwd(), 'resolve_hosts.py'),
      path.resolve(process.cwd(), 'test_api.py'),
      path.resolve(process.cwd(), 'test_api_headers.py'),
      path.resolve(process.cwd(), 'test_api_ua.py'),
      path.resolve(process.cwd(), 'test_graphql.py'),
      path.resolve(process.cwd(), 'dns_output.txt'),
      path.resolve(process.cwd(), 'headers_output.txt'),
      path.resolve(process.cwd(), 'raw_urls.txt'),
      path.resolve(process.cwd(), 'test_output.txt'),
      path.resolve(process.cwd(), 'ua_output.txt'),
      path.join(this.runtimeDir, '.tmp')
    ];

    for (const itemPath of itemsToDelete) {
      if (fs.existsSync(itemPath)) {
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(itemPath);
          }
          console.log(`[JavaService] Removed obsolete file/dir: ${itemPath}`);
        } catch (e: any) {
          console.warn(`[JavaService] Could not remove ${itemPath}:`, e.message);
        }
      }
    }

    // Clean any temp archive files in runtimeDir
    try {
      const files = fs.readdirSync(this.runtimeDir);
      for (const f of files) {
        if (f.startsWith('.tmp_') || f.endsWith('.tar.gz') || f.endsWith('.zip')) {
          const fPath = path.join(this.runtimeDir, f);
          try {
            fs.rmSync(fPath, { recursive: true, force: true });
            console.log(`[JavaService] Cleaned temp installation artifact: ${fPath}`);
          } catch {}
        }
      }
    } catch {}
  }

  /**
   * Synchronize runtimes on disk with Database entries
   */
  public async syncRuntimesFromDiskAndDb(): Promise<void> {
    const versions: Array<'17' | '21' | '25'> = ['17', '21', '25'];

    for (const ver of versions) {
      const binPath = path.join(this.runtimeDir, ver, 'bin', 'java');
      const targetDir = path.join(this.runtimeDir, ver);

      if (fs.existsSync(binPath)) {
        const verification = await this.verifyRuntimeBinary(binPath);
        if (verification.valid) {
          const sizeBytes = this.getFolderSize(targetDir);
          const record: JavaRuntimeRecord = {
            id: `java_${ver}`,
            name: `Adoptium OpenJDK ${ver}`,
            version: ver,
            major: parseInt(ver, 10),
            vendor: ver === '25' ? 'Azul Zulu / Adoptium OpenJDK 25' : 'Eclipse Adoptium Temurin',
            path: binPath,
            directory: targetDir,
            status: 'Installed',
            installedAt: new Date().toISOString(),
            sizeBytes,
            sizeFormatted: this.formatBytes(sizeBytes),
            verification
          };

          const dbRuntimes = this.db.getTable('javaRuntimes') || [];
          const existing = dbRuntimes.find(r => r.version === ver);
          if (existing) {
            await this.db.update('javaRuntimes', r => r.version === ver, r => {
              Object.assign(r, record);
            });
          } else {
            await this.db.insert('javaRuntimes', record);
          }
        }
      }
    }
  }

  /**
   * Returns list of Java runtimes with verification status
   */
  public async getRuntimes(): Promise<JavaRuntimesListResponse> {
    await this.syncRuntimesFromDiskAndDb();

    const knownVersions = [
      {
        version: '17',
        major: 17,
        vendor: 'Eclipse Adoptium Temurin',
        recommendedFor: 'Minecraft 1.18 - 1.20.4'
      },
      {
        version: '21',
        major: 21,
        vendor: 'Eclipse Adoptium Temurin',
        recommendedFor: 'Minecraft 1.20.5+ / 1.21.x (Standard LTS)'
      },
      {
        version: '25',
        major: 25,
        vendor: 'Azul Zulu / Eclipse Adoptium OpenJDK 25',
        recommendedFor: 'Modern Cutting-edge Minecraft & High-Performance JVM'
      }
    ];

    const dbRuntimes = this.db.getTable('javaRuntimes') || [];
    const runtimesList: JavaRuntimeInfo[] = [];

    for (const v of knownVersions) {
      const binPath = path.join(this.runtimeDir, v.version, 'bin', 'java');
      const targetDir = path.join(this.runtimeDir, v.version);
      const isInstalled = fs.existsSync(binPath);
      const dbRecord = dbRuntimes.find(r => r.version === v.version);
      
      let sizeBytes = 0;
      if (isInstalled) {
        sizeBytes = this.getFolderSize(targetDir);
      }

      let verification: JavaVerification | null = dbRecord?.verification || null;
      if (isInstalled && !verification?.valid) {
        verification = await this.verifyRuntimeBinary(binPath);
      }

      runtimesList.push({
        version: v.version,
        major: v.major,
        vendor: v.vendor,
        recommendedFor: v.recommendedFor,
        installed: isInstalled,
        path: isInstalled ? binPath : null,
        directory: isInstalled ? targetDir : null,
        sizeBytes,
        sizeFormatted: this.formatBytes(sizeBytes),
        verification: isInstalled ? verification : null,
        architecture: process.arch,
        isInstalling: this.installingVersions.has(v.version)
      });
    }

    // System Java check
    let sysJavaPath: string | null = null;
    let sysJavaVer: JavaVerification | null = null;
    if (fs.existsSync('/usr/bin/java')) {
      sysJavaPath = '/usr/bin/java';
      sysJavaVer = await this.verifyRuntimeBinary('/usr/bin/java');
    } else {
      const defaultRuntimePath = path.join(this.runtimeDir, '21', 'bin', 'java');
      if (fs.existsSync(defaultRuntimePath)) {
        sysJavaPath = defaultRuntimePath;
        sysJavaVer = await this.verifyRuntimeBinary(defaultRuntimePath);
      }
    }

    return {
      runtimeDir: this.runtimeDir,
      arch: process.arch,
      platform: process.platform,
      runtimes: runtimesList,
      systemJava: {
        path: sysJavaPath,
        available: !!sysJavaPath,
        verification: sysJavaVer
      }
    };
  }

  /**
   * Returns dictionary format required by /api/java
   */
  public async getJavaApiDictionary(): Promise<Record<string, any>> {
    const list = await this.getRuntimes();
    const result: Record<string, any> = {};

    for (const r of list.runtimes) {
      if (r.installed && r.verification?.valid) {
        result[r.version] = {
          installed: true,
          path: r.path,
          version: r.verification.versionString || `Java ${r.version}`,
          vm: r.verification.vmString || '',
          architecture: r.architecture,
          sizeFormatted: r.sizeFormatted,
          sizeBytes: r.sizeBytes,
          vendor: r.vendor
        };
      } else {
        result[r.version] = {
          installed: false,
          isInstalling: this.installingVersions.has(r.version),
          vendor: r.vendor,
          recommendedFor: r.recommendedFor,
          architecture: list.arch
        };
      }
    }

    return result;
  }

  /**
   * Pure TypeScript implementation of OpenJDK download, extraction, and verification.
   */
  public async installRuntime(version: string, force = false): Promise<any> {
    const cleanVer = version.replace(/[^0-9]/g, '') || '21';
    if (!['17', '21', '25'].includes(cleanVer)) {
      throw new Error(`Invalid Java version ${version}. Supported versions: 17, 21, 25.`);
    }

    if (this.installingVersions.has(cleanVer)) {
      throw new Error(`Java ${cleanVer} installation is already in progress.`);
    }

    const binPath = path.join(this.runtimeDir, cleanVer, 'bin', 'java');
    const targetDir = path.join(this.runtimeDir, cleanVer);

    if (!force && fs.existsSync(binPath)) {
      const existingVer = await this.verifyRuntimeBinary(binPath);
      if (existingVer.valid) {
        console.log(`[JavaService] Java ${cleanVer} is already installed and verified at ${binPath}.`);
        return {
          success: true,
          version: cleanVer,
          path: binPath,
          message: `Java ${cleanVer} is already installed and verified.`,
          verification: existingVer
        };
      }
    }

    this.installingVersions.add(cleanVer);
    console.log(`[JavaService] Initiating Pure TypeScript OpenJDK installer for Java ${cleanVer}...`);

    this.updateStatus(cleanVer, {
      status: 'resolving',
      percent: 5,
      phase: `Resolving official OpenJDK ${cleanVer} release binaries for ${process.platform}/${process.arch}...`
    });

    try {
      // Direct mirrors with fallback
      const downloadUrls: Record<string, string[]> = {
        '17': [
          'https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse',
          'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.12_7.tar.gz'
        ],
        '21': [
          'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse',
          'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jdk_x64_linux_hotspot_21.0.4_7.tar.gz'
        ],
        '25': [
          'https://api.adoptium.net/v3/binary/latest/25/ea/linux/x64/jdk/hotspot/normal/eclipse',
          'https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25%2B10-ea/OpenJDK25U-jdk_x64_linux_hotspot_25_10-ea.tar.gz'
        ]
      };

      const urls = downloadUrls[cleanVer] || downloadUrls['21'];
      let lastErr: Error | null = null;
      const tempTarPath = path.join(this.runtimeDir, `.tmp_jdk_${cleanVer}_${Date.now()}.tar.gz`);

      for (const dlUrl of urls) {
        try {
          console.log(`[JavaService] Downloading OpenJDK ${cleanVer} from: ${dlUrl}`);
          
          this.updateStatus(cleanVer, {
            status: 'downloading',
            percent: 15,
            phase: `Downloading OpenJDK ${cleanVer} archive from official repository...`
          });

          const res = await fetch(dlUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': '*/*'
            }
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
          
          if (res.body) {
            const reader = res.body.getReader();
            const fileStream = fs.createWriteStream(tempTarPath);
            let downloadedBytes = 0;
            const startTime = Date.now();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                downloadedBytes += value.length;
                fileStream.write(Buffer.from(value));

                const elapsedSec = (Date.now() - startTime) / 1000;
                const speed = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
                const percent = totalBytes > 0 ? Math.min(Math.round((downloadedBytes / totalBytes) * 75) + 15, 88) : 50;

                this.updateStatus(cleanVer, {
                  status: 'downloading',
                  downloadedBytes,
                  totalBytes,
                  downloadedFormatted: this.formatBytes(downloadedBytes),
                  totalFormatted: this.formatBytes(totalBytes),
                  percent,
                  speedBytesPerSec: Math.round(speed),
                  speedFormatted: `${this.formatBytes(speed)}/s`,
                  phase: `Downloading OpenJDK ${cleanVer} (${this.formatBytes(downloadedBytes)} / ${this.formatBytes(totalBytes)})...`
                });
              }
            }
            fileStream.end();
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            const arrayBuffer = await res.arrayBuffer();
            fs.writeFileSync(tempTarPath, Buffer.from(arrayBuffer));
          }

          lastErr = null;
          break; // Successfully downloaded
        } catch (err: any) {
          console.warn(`[JavaService] Download attempt from ${dlUrl} failed: ${err.message}. Retrying fallback mirror...`);
          lastErr = err;
        }
      }

      if (lastErr || !fs.existsSync(tempTarPath)) {
        throw new Error(lastErr?.message || `Failed to download Java ${cleanVer} from all mirrors.`);
      }

      // Extraction Phase
      this.updateStatus(cleanVer, {
        status: 'extracting',
        percent: 90,
        phase: `Extracting OpenJDK ${cleanVer} files...`
      });

      const tempExtractDir = path.join(this.runtimeDir, `.tmp_extract_${cleanVer}_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });

      await execFileAsync('tar', ['-xzf', tempTarPath, '-C', tempExtractDir]);

      // Find extracted root directory
      const subdirs = fs.readdirSync(tempExtractDir);
      let extractedRoot = tempExtractDir;
      for (const dir of subdirs) {
        const fullSub = path.join(tempExtractDir, dir);
        if (fs.statSync(fullSub).isDirectory() && fs.existsSync(path.join(fullSub, 'bin', 'java'))) {
          extractedRoot = fullSub;
          break;
        }
      }

      // If target directory already exists, replace cleanly
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }

      fs.renameSync(extractedRoot, targetDir);

      // Clean up temp items
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
      try { fs.unlinkSync(tempTarPath); } catch {}

      // Set permissions
      if (fs.existsSync(binPath)) {
        fs.chmodSync(binPath, 0o755);
      }

      // Verification Phase
      this.updateStatus(cleanVer, {
        status: 'verifying',
        percent: 97,
        phase: `Verifying OpenJDK ${cleanVer} binary execution (java -version)...`
      });

      const verification = await this.verifyRuntimeBinary(binPath);
      if (!verification.valid) {
        throw new Error(`Verification of installed Java ${cleanVer} binary failed: ${verification.error || 'Invalid binary'}`);
      }

      // Record in Database
      const sizeBytes = this.getFolderSize(targetDir);
      const runtimeRecord: JavaRuntimeRecord = {
        id: `java_${cleanVer}`,
        name: `Adoptium OpenJDK ${cleanVer}`,
        version: cleanVer as any,
        major: parseInt(cleanVer, 10),
        vendor: cleanVer === '25' ? 'Azul Zulu / Adoptium OpenJDK 25' : 'Eclipse Adoptium Temurin',
        path: binPath,
        directory: targetDir,
        status: 'Installed',
        installedAt: new Date().toISOString(),
        sizeBytes,
        sizeFormatted: this.formatBytes(sizeBytes),
        verification
      };

      const dbRuntimes = this.db.getTable('javaRuntimes') || [];
      const existing = dbRuntimes.find(r => r.version === cleanVer);
      if (existing) {
        await this.db.update('javaRuntimes', r => r.version === cleanVer, r => {
          Object.assign(r, runtimeRecord);
        });
      } else {
        await this.db.insert('javaRuntimes', runtimeRecord);
      }

      const completedStatus: JavaProgressStatus = {
        status: 'completed',
        percent: 100,
        phase: `Installed & Verified ✓ (${verification.versionString || `Java ${cleanVer}`})`,
        path: binPath,
        verification
      };

      this.updateStatus(cleanVer, completedStatus);

      console.log(`[JavaService] OpenJDK ${cleanVer} successfully installed and saved to database.`);

      return {
        success: true,
        version: cleanVer,
        path: binPath,
        verification,
        message: `OpenJDK ${cleanVer} successfully installed and verified.`
      };

    } catch (err: any) {
      console.error(`[JavaService] OpenJDK ${cleanVer} installation failed:`, err);
      const failedStatus: JavaProgressStatus = {
        status: 'failed',
        percent: 0,
        phase: 'Installation Failed',
        error: err.message || 'Unknown installation error'
      };
      this.updateStatus(cleanVer, failedStatus);
      throw err;

    } finally {
      this.installingVersions.delete(cleanVer);
    }
  }

  /**
   * Verifies an installed runtime by executing java -version directly
   */
  public async verifyRuntime(version: string): Promise<JavaVerification> {
    const cleanVer = version.replace(/[^0-9]/g, '') || '21';
    const binPath = path.join(this.runtimeDir, cleanVer, 'bin', 'java');
    return await this.verifyRuntimeBinary(binPath);
  }

  /**
   * Resolves binary path for requested Java version.
   * If missing, automatically downloads and installs via TypeScript installer!
   */
  public async resolveJavaBinaryPath(requestedVersion?: string): Promise<string> {
    let cleanVer = '21';
    if (requestedVersion) {
      const matched = requestedVersion.match(/(\d+)/);
      if (matched) cleanVer = matched[1];
    }
    
    if (!['17', '21', '25'].includes(cleanVer)) {
      cleanVer = '21';
    }

    const expectedBin = path.join(this.runtimeDir, cleanVer, 'bin', 'java');
    
    if (fs.existsSync(expectedBin)) {
      try {
        fs.chmodSync(expectedBin, 0o755);
        return expectedBin;
      } catch {}
    }

    console.log(`[JavaService] Java ${cleanVer} binary missing at ${expectedBin}. Triggering pure TypeScript OpenJDK download...`);
    await this.installRuntime(cleanVer, false);

    if (fs.existsSync(expectedBin)) {
      fs.chmodSync(expectedBin, 0o755);
      return expectedBin;
    }

    if (fs.existsSync('/usr/bin/java')) return '/usr/bin/java';
    return 'java';
  }

  /**
   * Deletes a downloaded Java runtime to free disk space.
   */
  public async deleteRuntime(version: string): Promise<boolean> {
    const cleanVer = version.replace(/[^0-9]/g, '');
    const targetDir = path.join(this.runtimeDir, cleanVer);
    const statusFile = path.join(this.runtimeDir, `.install_${cleanVer}.json`);
    
    if (fs.existsSync(statusFile)) {
      try { fs.unlinkSync(statusFile); } catch {}
    }

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Delete record from Database
    await this.db.delete('javaRuntimes', r => r.version === cleanVer);

    return true;
  }
}
