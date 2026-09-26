import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

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
  private scriptPath: string;
  private runtimeDir: string;
  private installingVersions: Set<string> = new Set();

  private constructor() {
    this.scriptPath = path.join(process.cwd(), 'scripts', 'java_manager.py');
    this.runtimeDir = process.env.JAVA_RUNTIME_DIR || path.join(process.cwd(), 'runtimes', 'java');
    
    // Ensure base directory exists
    if (!fs.existsSync(this.runtimeDir)) {
      try {
        fs.mkdirSync(this.runtimeDir, { recursive: true });
      } catch (e) {
        console.warn('[JavaService] Could not create runtimeDir:', e);
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

  /**
   * Retrieves full list of Java runtimes and their installation/verification status from Python manager.
   */
  public async getRuntimes(): Promise<JavaRuntimesListResponse> {
    try {
      const { stdout } = await execFileAsync('python3', [
        this.scriptPath,
        'list',
        '--dir', this.runtimeDir
      ], { timeout: 15000 });

      const parsed: JavaRuntimesListResponse = JSON.parse(stdout.trim());
      parsed.runtimes = parsed.runtimes.map(r => ({
        ...r,
        isInstalling: this.installingVersions.has(r.version)
      }));
      return parsed;
    } catch (err: any) {
      console.error('[JavaService] Failed to list runtimes from python manager:', err);
      // Fallback
      return {
        runtimeDir: this.runtimeDir,
        arch: process.arch,
        platform: process.platform,
        runtimes: [
          {
            version: '17',
            major: 17,
            vendor: 'Eclipse Adoptium Temurin',
            recommendedFor: 'Minecraft 1.18 - 1.20.4',
            installed: fs.existsSync(path.join(this.runtimeDir, '17', 'bin', 'java')),
            path: path.join(this.runtimeDir, '17', 'bin', 'java'),
            directory: path.join(this.runtimeDir, '17'),
            sizeBytes: 0,
            sizeFormatted: '0 MB',
            verification: null,
            architecture: process.arch
          },
          {
            version: '21',
            major: 21,
            vendor: 'Eclipse Adoptium Temurin',
            recommendedFor: 'Minecraft 1.20.5+ / 1.21.x (Standard LTS)',
            installed: fs.existsSync(path.join(this.runtimeDir, '21', 'bin', 'java')),
            path: path.join(this.runtimeDir, '21', 'bin', 'java'),
            directory: path.join(this.runtimeDir, '21'),
            sizeBytes: 0,
            sizeFormatted: '0 MB',
            verification: null,
            architecture: process.arch
          },
          {
            version: '25',
            major: 25,
            vendor: 'Azul Zulu / Eclipse Adoptium OpenJDK 25',
            recommendedFor: 'Modern Cutting-edge Minecraft & High-Performance JVM',
            installed: fs.existsSync(path.join(this.runtimeDir, '25', 'bin', 'java')),
            path: path.join(this.runtimeDir, '25', 'bin', 'java'),
            directory: path.join(this.runtimeDir, '25'),
            sizeBytes: 0,
            sizeFormatted: '0 MB',
            verification: null,
            architecture: process.arch
          }
        ],
        systemJava: {
          path: null,
          available: false,
          verification: null
        }
      };
    }
  }

  /**
   * Returns dictionary format required by `/api/java` endpoint
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
   * Gets real-time download and installation progress status
   */
  public getStatus(version: string): JavaProgressStatus {
    const cleanVer = version.replace(/[^0-9]/g, '');
    const statusFile = path.join(this.runtimeDir, `.install_${cleanVer}.json`);
    const binPath = path.join(this.runtimeDir, cleanVer, 'bin', 'java');

    if (fs.existsSync(statusFile)) {
      try {
        const raw = fs.readFileSync(statusFile, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        // Fallback
      }
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
   * Installs or downloads a real OpenJDK runtime via the Python manager asynchronously.
   */
  public async installRuntime(version: string, force = false): Promise<any> {
    const cleanVer = version.replace(/[^0-9]/g, '') || '21';
    if (this.installingVersions.has(cleanVer)) {
      throw new Error(`Java ${cleanVer} installation is already in progress.`);
    }

    this.installingVersions.add(cleanVer);
    console.log(`[JavaService] Initiating Python OpenJDK install for Java ${cleanVer} (dir: ${this.runtimeDir})...`);

    try {
      const args = [this.scriptPath, 'install', '--version', cleanVer, '--dir', this.runtimeDir];
      if (force) args.push('--force');

      const { stdout, stderr } = await execFileAsync('python3', args, {
        timeout: 240000, // 4 minutes timeout
        maxBuffer: 10 * 1024 * 1024
      });

      if (stderr) {
        console.log(`[JavaService] [Python log]: ${stderr}`);
      }

      const result = JSON.parse(stdout.trim());
      if (result.success === false) {
        throw new Error(result.error || `Installation of Java ${cleanVer} failed.`);
      }

      return result;
    } finally {
      this.installingVersions.delete(cleanVer);
    }
  }

  /**
   * Verifies an installed runtime by executing `<binary> -version`
   */
  public async verifyRuntime(version: string): Promise<JavaVerification> {
    const cleanVer = version.replace(/[^0-9]/g, '');
    try {
      const { stdout } = await execFileAsync('python3', [
        this.scriptPath,
        'verify',
        '--version', cleanVer,
        '--dir', this.runtimeDir
      ], { timeout: 10000 });

      const parsed = JSON.parse(stdout.trim());
      return parsed.result;
    } catch (e: any) {
      return {
        valid: false,
        error: e.message || 'Verification execution failed'
      };
    }
  }

  /**
   * Resolves the executable path for the requested Java version.
   * If it's not installed yet, it automatically triggers download & install!
   */
  public async resolveJavaBinaryPath(requestedVersion?: string): Promise<string> {
    let cleanVer = '21';
    if (requestedVersion) {
      const matched = requestedVersion.match(/(\d+)/);
      if (matched) cleanVer = matched[1];
    }
    
    // Check if 17, 21, or 25
    if (!['17', '21', '25'].includes(cleanVer)) {
      cleanVer = '21';
    }

    const expectedBin = path.join(this.runtimeDir, cleanVer, 'bin', 'java');
    
    // Check if binary physically exists and is executable
    if (fs.existsSync(expectedBin)) {
      try {
        fs.chmodSync(expectedBin, 0o755);
        return expectedBin;
      } catch (e) {
        // Continue
      }
    }

    // If missing, automatically download and install it via the Python manager!
    console.log(`[JavaService] Java ${cleanVer} binary not found at ${expectedBin}. Triggering on-demand OpenJDK download...`);
    await this.installRuntime(cleanVer, false);
    
    if (fs.existsSync(expectedBin)) {
      fs.chmodSync(expectedBin, 0o755);
      return expectedBin;
    }

    // Check system java as emergency fallback
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
      try { fs.unlinkSync(statusFile); } catch (e) {}
    }

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }
}
