import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { InstallerRegistry } from './installers/InstallerRegistry';
import { JavaService } from './JavaService';
import { DownloadProgress } from './DownloadManager';

export type DeploymentState =
  | 'PENDING'
  | 'VALIDATING'
  | 'RESOLVING'
  | 'DOWNLOADING'
  | 'VERIFYING_DOWNLOAD'
  | 'INSTALLING'
  | 'VERIFYING_INSTALLATION'
  | 'PREPARING'
  | 'STARTING'
  | 'WAITING_FOR_READY'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export interface DeploymentStepInfo {
  id: DeploymentState;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface DeploymentProgressInfo {
  serverId: string;
  state: DeploymentState;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'installing' | 'completed' | 'failed' | 'cancelled';
  percent: number;
  bytesDownloaded?: number;
  totalBytes?: number | null;
  speedBytesPerSec?: number;
  formattedDownload?: string;
  logs: string[];
  error?: string;
  updatedAt: string;
  steps: DeploymentStepInfo[];
}

export interface ServerDeploymentConfig {
  serverId: string;
  name: string;
  description?: string;
  software: string;
  version: string;
  javaVersion?: string;
  memoryLimitGb: number;
  cpuLimitCores: number;
  diskLimitGb: number;
  acceptEula: boolean;
  port: number;
  gamemode?: string;
  difficulty?: string;
  pvp?: boolean;
  onlineMode?: boolean;
  viewDistance?: string;
  simulationDistance?: string;
  minRamGb?: string;
  timezone?: string;
  startupCommand?: string;
  nodeId?: string;
  location?: string;
}

const DEPLOYMENT_STEPS: Array<{ id: DeploymentState; name: string }> = [
  { id: 'VALIDATING', name: 'Configuration & resource validation' },
  { id: 'RESOLVING', name: 'Resolving official upstream build metadata' },
  { id: 'DOWNLOADING', name: 'Streaming binary distribution' },
  { id: 'VERIFYING_DOWNLOAD', name: 'Validating archive structure & integrity' },
  { id: 'INSTALLING', name: 'Workspace initialization & engine setup' },
  { id: 'VERIFYING_INSTALLATION', name: 'Verifying server binaries & environment' },
  { id: 'PREPARING', name: 'Configuring network bindings & settings' },
  { id: 'STARTING', name: 'Launching server process with OpenJDK' },
  { id: 'WAITING_FOR_READY', name: 'Readiness probe & port verification' }
];

export class DeploymentStateMachine {
  private static instance: DeploymentStateMachine;
  private deployments = new Map<string, DeploymentProgressInfo>();
  private activeControllers = new Map<string, AbortController>();
  private runningProcessesRef: Map<string, ChildProcess> | null = null;
  private dbRef: any = null;
  private broadcastEventRef: ((event: string, data: any) => void) | null = null;
  private addConsoleLogRef: ((serverId: string, log: string) => void) | null = null;

  private constructor() {}

  public static getInstance(): DeploymentStateMachine {
    if (!DeploymentStateMachine.instance) {
      DeploymentStateMachine.instance = new DeploymentStateMachine();
    }
    return DeploymentStateMachine.instance;
  }

  public init(
    runningProcesses: Map<string, ChildProcess>,
    db: any,
    broadcastEvent: (event: string, data: any) => void,
    addConsoleLog: (serverId: string, log: string) => void
  ) {
    this.runningProcessesRef = runningProcesses;
    this.dbRef = db;
    this.broadcastEventRef = broadcastEvent;
    this.addConsoleLogRef = addConsoleLog;
  }

  public getProgress(serverId: string): DeploymentProgressInfo | null {
    return this.deployments.get(serverId) || null;
  }

  public cancelDeployment(serverId: string): boolean {
    const controller = this.activeControllers.get(serverId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(serverId);
      this.transitionState(serverId, 'CANCELLED', 'Deployment cancelled by user.', true);
      return true;
    }
    return false;
  }

  public async startDeployment(config: ServerDeploymentConfig): Promise<void> {
    const { serverId, software, version } = config;
    const controller = new AbortController();
    this.activeControllers.set(serverId, controller);

    const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);

    // Initialize state
    const initialSteps: DeploymentStepInfo[] = DEPLOYMENT_STEPS.map(s => ({
      id: s.id,
      name: s.name,
      status: 'pending'
    }));

    const progress: DeploymentProgressInfo = {
      serverId,
      state: 'PENDING',
      currentStep: 0,
      totalSteps: DEPLOYMENT_STEPS.length,
      stepName: 'Pending start',
      status: 'installing',
      percent: 5,
      logs: [`[${new Date().toLocaleTimeString()}] Deployment sequence queued for ${software} ${version}`],
      updatedAt: new Date().toISOString(),
      steps: initialSteps
    };

    this.deployments.set(serverId, progress);
    this.broadcastProgress(serverId);

    const log = (msg: string) => {
      const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
      const cur = this.deployments.get(serverId);
      if (cur) {
        cur.logs.push(line);
        if (cur.logs.length > 500) cur.logs.shift();
        cur.updatedAt = new Date().toISOString();
      }
      this.addConsoleLogRef?.(serverId, msg);
    };

    try {
      // 1. VALIDATING
      this.transitionState(serverId, 'VALIDATING', 'Validating engine and resource allocations');
      log(`[VALIDATING] Validating configuration for ${software} ${version} on port ${config.port}...`);
      
      const installer = InstallerRegistry.getInstance().getInstaller(software);
      if (!installer) {
        throw new Error(`Unsupported engine software: ${software}`);
      }

      fs.mkdirSync(srvPath, { recursive: true });
      fs.mkdirSync(path.join(srvPath, 'logs'), { recursive: true });
      
      const softwareLower = software.toLowerCase();
      const isModded = softwareLower === 'fabric' || softwareLower === 'forge' || softwareLower === 'neoforge';
      const isProxy = softwareLower === 'velocity' || softwareLower === 'bungeecord';

      if (isModded) {
        fs.mkdirSync(path.join(srvPath, 'mods'), { recursive: true });
      } else if (!isProxy) {
        fs.mkdirSync(path.join(srvPath, 'plugins'), { recursive: true });
      }

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 2. RESOLVING
      this.transitionState(serverId, 'RESOLVING', 'Querying official upstream build metadata');
      log(`[RESOLVING] Querying official upstream API for ${installer.displayName} release ${version}...`);
      
      const resolution = await installer.resolveVersion(version);
      if (!resolution.supported) {
        throw new Error(resolution.error || `Version ${version} is not supported or unavailable upstream.`);
      }

      log(`[RESOLVING] Resolved upstream build #${resolution.resolvedBuild}. Artifact: ${resolution.fileName || 'distribution JAR'}`);
      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 3. DOWNLOADING
      this.transitionState(serverId, 'DOWNLOADING', 'Streaming server artifact from upstream');
      log(`[DOWNLOADING] Downloading artifact from ${resolution.downloadUrl}...`);

      const downloadedFile = await installer.download(
        resolution,
        srvPath,
        (dlProgress: DownloadProgress) => {
          const cur = this.deployments.get(serverId);
          if (cur && cur.state === 'DOWNLOADING') {
            cur.bytesDownloaded = dlProgress.bytesDownloaded;
            cur.totalBytes = dlProgress.totalBytes;
            cur.speedBytesPerSec = dlProgress.speedBytesPerSec;
            cur.formattedDownload = dlProgress.formattedProgress;
            // Map download progress between 25% and 55%
            cur.percent = Math.min(55, Math.max(25, Math.round(25 + (dlProgress.percent * 0.3))));
            this.broadcastProgress(serverId);
          }
        },
        log
      );

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 4. VERIFYING_DOWNLOAD
      this.transitionState(serverId, 'VERIFYING_DOWNLOAD', 'Verifying artifact integrity and JAR structure');
      log(`[VERIFYING_DOWNLOAD] Validating downloaded archive structure at ${path.basename(downloadedFile)}...`);

      const isVerified = await installer.verify(downloadedFile, resolution);
      if (!isVerified) {
        throw new Error('Downloaded binary failed JAR structure or checksum integrity check.');
      }
      log(`[VERIFYING_DOWNLOAD] Artifact integrity confirmed.`);

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 5. INSTALLING
      this.transitionState(serverId, 'INSTALLING', 'Configuring engine workspace');
      log(`[INSTALLING] Setting up server workspace for ${installer.displayName}...`);

      const installResult = await installer.install(srvPath, resolution, config, log);
      log(`[INSTALLING] Engine setup complete. Target executable: ${installResult.executable}`);

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 6. VERIFYING_INSTALLATION
      this.transitionState(serverId, 'VERIFYING_INSTALLATION', 'Verifying server binaries & runtime');
      log(`[VERIFYING_INSTALLATION] Confirming OpenJDK runtime and server executable...`);

      const requiredJava = resolution.javaVersion || installer.getJavaRequirement(version);
      const javaBin = await JavaService.getInstance().resolveJavaBinaryPath(config.javaVersion || requiredJava);
      log(`[VERIFYING_INSTALLATION] OpenJDK Java binary resolved: ${javaBin}`);

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 7. PREPARING
      this.transitionState(serverId, 'PREPARING', 'Writing server configuration files');
      log(`[PREPARING] Applying configurations, network port bindings (${config.port}), and EULA...`);

      await installer.prepare(srvPath, config, log);
      log(`[PREPARING] Configuration files prepared successfully.`);

      if (controller.signal.aborted) throw new Error('Deployment cancelled.');

      // 8. STARTING
      this.transitionState(serverId, 'STARTING', 'Launching server process');
      const startCmd = installer.getStartCommand(srvPath, javaBin, config, installResult);
      log(`[STARTING] Launching process: ${startCmd.command} ${startCmd.args.join(' ')}`);

      const proc = spawn(startCmd.command, startCmd.args, { cwd: srvPath });
      if (this.runningProcessesRef) {
        this.runningProcessesRef.set(serverId, proc);
      }

      const nowIso = new Date().toISOString();
      if (this.dbRef) {
        this.dbRef.update('servers', (s: any) => s.id === serverId, {
          status: 'Starting',
          startedAt: nowIso,
          readyAt: null,
          stoppedAt: null,
          containerId: proc.pid ? String(proc.pid) : null,
          lastSeenAt: nowIso,
          updatedAt: nowIso
        });
        this.dbRef.saveToFile();
      }

      let isReady = false;

      // Robust line-by-line parser for stdout
      let stdoutBuffer = '';
      proc.stdout.on('data', (d: Buffer) => {
        stdoutBuffer += d.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || ''; // Keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            log(`[Server stdout] ${trimmed}`);
            if (!isReady && installer.detectReady(trimmed)) {
              isReady = true;
              this.handleServerReady(serverId, config, log);
            }
          }
        }
      });

      proc.stdout.on('end', () => {
        if (stdoutBuffer.trim()) {
          const trimmed = stdoutBuffer.trim();
          log(`[Server stdout] ${trimmed}`);
          if (!isReady && installer.detectReady(trimmed)) {
            isReady = true;
            this.handleServerReady(serverId, config, log);
          }
        }
      });

      // Robust line-by-line parser for stderr
      let stderrBuffer = '';
      proc.stderr.on('data', (d: Buffer) => {
        stderrBuffer += d.toString();
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            log(`[Server stderr] ${trimmed}`);
          }
        }
      });

      proc.stderr.on('end', () => {
        if (stderrBuffer.trim()) {
          log(`[Server stderr] ${stderrBuffer.trim()}`);
        }
      });

      proc.on('close', (code: number | null) => {
        if (this.runningProcessesRef) {
          this.runningProcessesRef.delete(serverId);
        }
        log(`[Process] Server closed with exit code ${code}`);

        const cur = this.deployments.get(serverId);
        if (cur && cur.status === 'installing' && !isReady) {
          this.transitionState(
            serverId,
            'FAILED',
            `Server process exited prematurely during initialization with code ${code}. Check logs above for crash details.`,
            true
          );
        }
      });

      // 9. WAITING_FOR_READY
      this.transitionState(serverId, 'WAITING_FOR_READY', 'Waiting for readiness confirmation');
      log(`[WAITING_FOR_READY] Monitoring startup stream for initialization confirmation...`);

      // Monitor for readiness with timeout
      await new Promise<void>((resolve, reject) => {
        let elapsed = 0;
        const checkInterval = setInterval(() => {
          elapsed += 1;
          if (isReady) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.runningProcessesRef?.has(serverId)) {
            clearInterval(checkInterval);
            reject(new Error('Server process terminated before becoming ready. Check logs above for crash details.'));
          } else if (elapsed > 180) { // 3 minutes timeout for heavy modpacks/slower nodes
            clearInterval(checkInterval);
            reject(new Error('Server readiness probe timed out (exceeded 180s) without detecting the ready signal.'));
          }
        }, 1000);
      });

    } catch (err: any) {
      console.error(`[Deployment Error ${serverId}]`, err);
      log(`[FATAL ERROR] Deployment failed: ${err.message}`);
      this.transitionState(serverId, 'FAILED', err.message, true);

      // Clean up server directory if aborted or broken before first complete run
      try {
        if (fs.existsSync(srvPath) && !fs.existsSync(path.join(srvPath, 'server.jar')) && !fs.existsSync(path.join(srvPath, 'velocity.jar')) && !fs.existsSync(path.join(srvPath, 'bungeecord.jar'))) {
          fs.rmSync(srvPath, { recursive: true, force: true });
        }
      } catch {}

      if (this.dbRef) {
        this.dbRef.update('servers', (s: any) => s.id === serverId, {
          status: 'Offline',
          updatedAt: new Date().toISOString()
        });
        this.dbRef.saveToFile();
      }
    } finally {
      this.activeControllers.delete(serverId);
    }
  }

  private handleServerReady(serverId: string, config: ServerDeploymentConfig, log: (msg: string) => void) {
    log(`[READY] Server initialization confirmed! Server is ONLINE and operational on port ${config.port}.`);
    this.transitionState(serverId, 'READY', 'Server successfully deployed and running', false);

    const cur = this.deployments.get(serverId);
    if (cur) {
      cur.status = 'completed';
      cur.percent = 100;
      cur.steps = cur.steps.map(s => ({ ...s, status: 'completed' }));
    }

    if (this.dbRef) {
      const nowIso = new Date().toISOString();
      const server = (this.dbRef.getTable('servers') || []).find((s: any) => s.id === serverId);
      this.dbRef.update('servers', (s: any) => s.id === serverId, {
        status: 'Running',
        startedAt: server?.startedAt || nowIso,
        readyAt: nowIso,
        updatedAt: nowIso
      });
      this.dbRef.saveToFile();
    }

    this.broadcastEventRef?.('SERVER_UPDATED', { id: serverId, status: 'Running' });
    this.broadcastProgress(serverId);
  }

  private transitionState(
    serverId: string,
    state: DeploymentState,
    stepName: string,
    isFailure = false
  ) {
    const cur = this.deployments.get(serverId);
    if (!cur) return;

    cur.state = state;
    cur.stepName = stepName;
    cur.updatedAt = new Date().toISOString();

    const stepIndex = DEPLOYMENT_STEPS.findIndex(s => s.id === state);
    if (stepIndex !== -1) {
      cur.currentStep = stepIndex;
      const stepPercent = Math.round(((stepIndex + 1) / (DEPLOYMENT_STEPS.length + 1)) * 100);
      cur.percent = Math.max(cur.percent, stepPercent);

      cur.steps = cur.steps.map((st, idx) => {
        if (idx < stepIndex) return { ...st, status: 'completed' };
        if (idx === stepIndex) return { ...st, status: isFailure ? 'failed' : 'active' };
        return { ...st, status: 'pending' };
      });
    }

    if (isFailure) {
      cur.status = state === 'CANCELLED' ? 'cancelled' : 'failed';
      cur.error = stepName;
      cur.steps = cur.steps.map(st => st.status === 'active' ? { ...st, status: 'failed' } : st);
    }

    this.broadcastProgress(serverId);
  }

  private broadcastProgress(serverId: string) {
    const cur = this.deployments.get(serverId);
    if (cur) {
      this.broadcastEventRef?.('SERVER_DEPLOYMENT_PROGRESS', cur);
    }
  }
}
