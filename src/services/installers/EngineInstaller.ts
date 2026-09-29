import { DownloadProgress } from '../DownloadManager';

export interface VersionResolution {
  supported: boolean;
  engine: string;
  minecraftVersion: string;
  resolvedBuild: string;
  downloadUrl: string;
  checksum?: string;
  fileSize?: number;
  fileName?: string;
  javaVersion: string;
  isProxy: boolean;
  requestId?: string;
  extra?: Record<string, any>;
  error?: string;
}

export interface InstallResult {
  executable: string;
  startCommand: string;
  extraFiles?: string[];
  metadata?: Record<string, any>;
}

export interface StartCommandResult {
  command: string;
  args: string[];
}

export interface EngineInstaller {
  readonly engineId: string;
  readonly displayName: string;
  readonly isProxy: boolean;

  /**
   * Fetches the complete real list of available versions directly from upstream.
   */
  getAvailableVersions(): Promise<string[]>;

  /**
   * Resolves build, download URL, checksum, and Java requirement for a version.
   */
  resolveVersion(version: string): Promise<VersionResolution>;

  /**
   * Validates if a version exists and can be deployed.
   */
  validateVersion(version: string): Promise<VersionResolution>;

  /**
   * Resolves the required Java runtime version for the engine & Minecraft release.
   */
  getJavaRequirement(version: string, extra?: any): string;

  /**
   * Streams the download using DownloadManager to .part and atomically renames.
   */
  download(
    resolution: VersionResolution,
    targetDir: string,
    onProgress: (p: DownloadProgress) => void,
    onLog: (msg: string) => void
  ): Promise<string>;

  /**
   * Verifies downloaded file on disk.
   */
  verify(filePath: string, resolution: VersionResolution): Promise<boolean>;

  /**
   * Executes engine-specific workspace installation (e.g. Forge bootstrap extraction).
   */
  install(
    srvPath: string,
    resolution: VersionResolution,
    config: any,
    onLog: (msg: string) => void
  ): Promise<InstallResult>;

  /**
   * Configures server files (eula.txt, server.properties, velocity.toml, config.yml, etc.).
   */
  prepare(
    srvPath: string,
    config: any,
    onLog: (msg: string) => void
  ): Promise<void>;

  /**
   * Determines the exact binary execution and JVM arguments.
   */
  getStartCommand(
    srvPath: string,
    javaBin: string,
    config: any,
    installResult: InstallResult
  ): StartCommandResult;

  /**
   * Inspects process output line to confirm server is ready and accepting traffic.
   */
  detectReady(line: string): boolean;
}
