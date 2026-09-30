// Component: JavaRuntimeManager
import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, HardDrive, CheckCircle2, AlertCircle, Download, Trash2,
  RefreshCw, Terminal, ShieldCheck, Zap, Layers, Boxes, ExternalLink,
  Clock, Activity, ChevronRight, Check
} from 'lucide-react';

interface JavaVerification {
  valid: boolean;
  versionString?: string;
  vmString?: string;
  fullOutput?: string;
  returnCode?: number;
  error?: string;
}

interface JavaRuntimeInfo {
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

interface JavaProgressStatus {
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
}

interface JavaRuntimeManagerProps {
  token: string;
  onRefreshHostStats?: () => void;
  onViewServers?: () => void;
}

export const JavaRuntimeManager: React.FC<JavaRuntimeManagerProps> = ({
  token,
  onRefreshHostStats,
  onViewServers
}) => {
  const [runtimes, setRuntimes] = useState<JavaRuntimeInfo[]>([]);
  const [systemJava, setSystemJava] = useState<any>(null);
  const [runtimeDir, setRuntimeDir] = useState<string>('');
  const [arch, setArch] = useState<string>('x64');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dependency Modal State
  const [inUseModal, setInUseModal] = useState<{
    version: string;
    serverCount: number;
    usingServers: Array<{ id: string; name: string; software: string; version: string; status: string }>;
  } | null>(null);
  
  // Progress tracking per version
  const [installProgress, setInstallProgress] = useState<Record<string, JavaProgressStatus>>({});
  const [installingVersions, setInstallingVersions] = useState<Set<string>>(new Set());
  const [verifyingVersion, setVerifyingVersion] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<Record<string, any>>({});

  const fetchRuntimes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/runtimes/java', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to load Java runtimes (HTTP ${res.status})`);
      const data = await res.json();
      setRuntimes(data.runtimes || []);
      setSystemJava(data.systemJava || null);
      setRuntimeDir(data.runtimeDir || '');
      setArch(data.arch || 'x64');
    } catch (err: any) {
      setError(err.message || 'Failed to load Java runtimes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuntimes();
    return () => {
      // Clear any polling on unmount
      Object.values(pollIntervalRef.current).forEach(id => clearInterval(id));
    };
  }, [token]);

  const startPollingProgress = (version: string) => {
    if (pollIntervalRef.current[version]) {
      clearInterval(pollIntervalRef.current[version]);
    }

    pollIntervalRef.current[version] = setInterval(async () => {
      try {
        const res = await fetch(`/api/java/${version}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const status: JavaProgressStatus = await res.json();
          setInstallProgress(prev => ({ ...prev, [version]: status }));

          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollIntervalRef.current[version]);
            delete pollIntervalRef.current[version];
            setInstallingVersions(prev => {
              const next = new Set(prev);
              next.delete(version);
              return next;
            });
            fetchRuntimes();
            if (onRefreshHostStats) onRefreshHostStats();
          }
        }
      } catch (e) {
        // Poll failed
      }
    }, 600);
  };

  const handleInstall = async (version: string, force = false) => {
    try {
      setError(null);
      setSuccessMessage(null);
      setInstallingVersions(prev => new Set(prev).add(version));
      setInstallProgress(prev => ({
        ...prev,
        [version]: {
          status: 'resolving',
          percent: 5,
          phase: `Connecting to OpenJDK repository for Java ${version}...`
        }
      }));

      startPollingProgress(version);

      const res = await fetch(`/api/java/${version}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ force })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to install Java ${version}`);
      }

      setSuccessMessage(`Java ${version} successfully installed and verified!`);
      fetchRuntimes();
      if (onRefreshHostStats) onRefreshHostStats();
    } catch (err: any) {
      setError(err.message || `Installation failed for Java ${version}`);
      setInstallProgress(prev => ({
        ...prev,
        [version]: {
          status: 'failed',
          percent: 0,
          phase: 'Installation Failed',
          error: err.message
        }
      }));
    } finally {
      setInstallingVersions(prev => {
        const next = new Set(prev);
        next.delete(version);
        return next;
      });
      if (pollIntervalRef.current[version]) {
        clearInterval(pollIntervalRef.current[version]);
        delete pollIntervalRef.current[version];
      }
    }
  };

  const handleVerify = async (version: string) => {
    try {
      setVerifyingVersion(version);
      setError(null);
      const res = await fetch(`/api/java/${version}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.valid) {
        setSuccessMessage(`Java ${version} verified healthy! (${data.versionString})`);
      } else {
        setError(`Java ${version} verification failed: ${data.error || 'Unknown error'}`);
      }
      fetchRuntimes();
    } catch (err: any) {
      setError(err.message || `Failed to verify Java ${version}`);
    } finally {
      setVerifyingVersion(null);
    }
  };

  const handleDelete = async (version: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      const res = await fetch(`/api/java/${version}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.status === 409 || data.inUse) {
        setInUseModal({
          version,
          serverCount: data.serverCount || data.usingServers?.length || 1,
          usingServers: data.usingServers || []
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to remove Java ${version}`);
      }

      setSuccessMessage(`Java ${version} runtime files permanently removed from disk.`);
      fetchRuntimes();
      if (onRefreshHostStats) onRefreshHostStats();
    } catch (err: any) {
      setError(err.message || `Failed to delete Java ${version}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-indigo-950/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Core Runtime Engine
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Arch: {arch}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-6 h-6 text-purple-400" />
              OpenJDK Runtime Manager
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Real, downloadable OpenJDK environments (Java 17, 21, and 25). Each version is verified via real binary execution and shared across all Minecraft server instances without duplication.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={fetchRuntimes}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Rescan Runtimes
            </button>
          </div>
        </div>

        {/* Runtime Directory info bar */}
        <div className="mt-4 pt-4 border-t border-purple-500/15 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 font-mono">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>JAVA_RUNTIME_DIR: <span className="text-purple-300">{runtimeDir || '/opt/craft-command-center/runtimes/java'}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Sandboxed Process Isolation & Binary Signature Checks</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-rose-300">Operation Error</p>
            <p className="text-xs text-rose-200/90 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-xs font-mono">Dismiss</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="font-medium text-emerald-300">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200 text-xs font-mono">Dismiss</button>
        </div>
      )}

      {/* Java Versions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {runtimes.map((rt) => {
          const isCurrentInstalling = installingVersions.has(rt.version) || rt.isInstalling;
          const progress = installProgress[rt.version];
          const isVerifying = verifyingVersion === rt.version;

          return (
            <div
              key={rt.version}
              className={`glass-card rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                rt.installed
                  ? 'border-purple-500/30 bg-slate-900/60 shadow-lg shadow-purple-950/20'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-800/80">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white tracking-tight">OpenJDK {rt.version}</h3>
                      {rt.installed ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Installed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Available
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-purple-300/80 mt-0.5 font-medium">{rt.vendor}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Boxes className="w-4 h-4" />
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[32px]">
                  {rt.recommendedFor}
                </p>
              </div>

              {/* Card Body / Details */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between text-xs">
                {/* Active Installation Progress State */}
                {isCurrentInstalling && progress && (
                  <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-200 flex items-center gap-1.5 text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                        {progress.phase || 'Processing...'}
                      </span>
                      <span className="font-mono text-purple-300 font-bold">{progress.percent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, progress.percent)}%` }}
                      />
                    </div>

                    {progress.downloadedFormatted && progress.totalFormatted && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{progress.downloadedFormatted} / {progress.totalFormatted}</span>
                        {progress.speedFormatted && <span>{progress.speedFormatted}</span>}
                        {progress.etaFormatted && <span>ETA: {progress.etaFormatted}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Installed Specs */}
                {rt.installed && !isCurrentInstalling && (
                  <div className="space-y-2 font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Runtime Path:</span>
                        <span className="text-slate-300 font-bold">{rt.sizeFormatted}</span>
                      </div>
                      <div className="text-purple-300 truncate text-[11px]" title={rt.path || ''}>
                        {rt.path}
                      </div>
                    </div>

                    {rt.verification?.versionString && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px]">
                        <div className="font-semibold text-emerald-200 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Signature Verified
                        </div>
                        <div className="text-slate-300 text-[10px] mt-0.5 truncate" title={rt.verification.versionString}>
                          {rt.verification.versionString}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!rt.installed && !isCurrentInstalling && (
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-center py-4">
                    <Download className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
                    <p className="font-medium text-slate-300">Ready to download & install</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Automated checksum & binary validation</p>
                  </div>
                )}
              </div>

              {/* Card Footer / Actions */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center gap-2">
                {rt.installed ? (
                  <>
                    <button
                      onClick={() => handleVerify(rt.version)}
                      disabled={isVerifying || isCurrentInstalling}
                      className="flex-1 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>

                    <button
                      onClick={() => handleInstall(rt.version, true)}
                      disabled={isCurrentInstalling}
                      title="Reinstall OpenJDK"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(rt.version)}
                      disabled={isCurrentInstalling}
                      title="Delete from disk"
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleInstall(rt.version, false)}
                    disabled={isCurrentInstalling}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-900/30 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 ${isCurrentInstalling ? 'animate-bounce' : ''}`} />
                    {isCurrentInstalling ? 'Installing OpenJDK...' : `Install Java ${rt.version}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* System Java & Architecture Overview Panel */}
      <div className="glass-card p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          Environment & Host JVM Diagnostics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <span className="text-slate-400 font-medium">Host Architecture & OS</span>
            <p className="font-mono text-slate-200">
              Linux ({arch}) • OpenJDK Architecture Auto-Detection Active
            </p>
            <p className="text-[11px] text-slate-500">
              Packages are dynamically mapped to match your exact CPU instruction set.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <span className="text-slate-400 font-medium">Automatic Server Resolution</span>
            <p className="font-mono text-purple-300">
              Paper 1.21.x → OpenJDK 21 | Paper 1.20.4 → OpenJDK 17
            </p>
            <p className="text-[11px] text-slate-500">
              Whenever a server starts, Craft Command Center resolves and launches the verified Java binary directly.
            </p>
          </div>
        </div>
      </div>

      {/* IN USE DEPENDENCY BLOCK MODAL */}
      {inUseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
          <div className="relative w-full max-w-md glass-modal rounded-3xl p-6 shadow-2xl border border-amber-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Cannot Delete Java {inUseModal.version}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInUseModal(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-amber-200 font-semibold">
                Java {inUseModal.version} is currently used by {inUseModal.serverCount} server{inUseModal.serverCount > 1 ? 's' : ''}.
              </p>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {inUseModal.usingServers.map((s) => (
                  <div key={s.id} className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{s.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{s.software} v{s.version}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/20">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-400">
                Reassign these servers to a different Java runtime before deleting this OpenJDK version to prevent broken server configurations.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setInUseModal(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              {onViewServers && (
                <button
                  type="button"
                  onClick={() => {
                    setInUseModal(null);
                    onViewServers();
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md"
                >
                  View Servers
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
