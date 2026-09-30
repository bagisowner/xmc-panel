// Component: ServerDashboard
import React from 'react';
import { Cpu, HardDrive, Activity, Wifi, Users, Boxes, ShieldAlert, Layers } from 'lucide-react';
import { ServerHero } from './ServerHero';
import { ConsoleViewer } from './ConsoleViewer';
import { FileManager } from './FileManager';
import { PluginManager } from './PluginManager';
import { ModManager } from './ModManager';
import { PlayersManager } from './PlayersManager';
import { BackupManager } from './BackupManager';
import { SchedulesManager } from './SchedulesManager';
import { ConfigEditor } from './ConfigEditor';
import { PortsManager } from './PortsManager';
import { StartupSettingsManager } from './StartupSettingsManager';
import { NginxProxiesManager } from './NginxProxiesManager';

interface ServerDashboardProps {
  serverDetails: any;
  executeLifecycle: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => void;
  hostStats: any;
  serverRealtimeMetrics: any;
  metricsStatus: 'live' | 'stale' | 'reconnecting';
  selectedServerTab: string;
  wsConnected: boolean;
  consoleSearch: string;
  setConsoleSearch: (val: string) => void;
  autoScroll: boolean;
  setAutoScroll: (val: boolean) => void;
  setConsoleLogs: React.Dispatch<React.SetStateAction<string[]>>;
  filteredConsoleLogs: string[];
  consoleViewportRef: React.RefObject<HTMLDivElement | null>;
  handleConsoleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  sendQuickCommand: (cmd: string) => void;
  sendConsoleCommand: (e: React.FormEvent) => void;
  commandInput: string;
  setCommandInput: (val: string) => void;
  commandInputRef: React.RefObject<HTMLInputElement | null>;
  handleConsoleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  cpuHistory: number[];
  ramHistory: number[];
  diskHistory: number[];
  netRxHistory: number[];
  netTxHistory: number[];
  token: string;
  refreshServerStorageStats: () => void;
  backups: any[];
  createBackup: () => void;
  downloadBackup: (b: any) => void;
  restoreBackup: (bId: string) => void;
  deleteBackup: (bId: string) => void;
  schedules: any[];
  newSchedule: any;
  setNewSchedule: any;
  createSchedule: () => void;
  newPortNumber: string;
  setNewPortNumber: (val: string) => void;
  newPortLabel: string;
  setNewPortLabel: (val: string) => void;
  allocateExtraPort: () => void;
  allocatingPort: boolean;
  releaseExtraPort: (port: number) => void;
  editingStartup: any;
  setEditingStartup: any;
  saveStartupSettings: () => void;
  proxies: any[];
  newProxyDomain: string;
  setNewProxyDomain: (val: string) => void;
  newProxyPort: string;
  setNewProxyPort: (val: string) => void;
  createProxy: () => void;
  deleteProxy: (id: string) => void;
  showToast: any;
  loadProperties: () => void;
}

function isModded(software: string): boolean {
  const sw = (software || '').toLowerCase();
  return sw === 'fabric' || sw === 'forge' || sw === 'neoforge';
}

export const ServerDashboard: React.FC<ServerDashboardProps> = ({
  serverDetails,
  executeLifecycle,
  hostStats,
  serverRealtimeMetrics,
  metricsStatus,
  selectedServerTab,
  wsConnected,
  consoleSearch,
  setConsoleSearch,
  autoScroll,
  setAutoScroll,
  setConsoleLogs,
  filteredConsoleLogs,
  consoleViewportRef,
  handleConsoleScroll,
  sendQuickCommand,
  sendConsoleCommand,
  commandInput,
  setCommandInput,
  commandInputRef,
  handleConsoleKeyDown,
  cpuHistory,
  ramHistory,
  diskHistory,
  netRxHistory,
  netTxHistory,
  token,
  refreshServerStorageStats,
  backups,
  createBackup,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  schedules,
  newSchedule,
  setNewSchedule,
  createSchedule,
  newPortNumber,
  setNewPortNumber,
  newPortLabel,
  setNewPortLabel,
  allocateExtraPort,
  allocatingPort,
  releaseExtraPort,
  editingStartup,
  setEditingStartup,
  saveStartupSettings,
  proxies,
  newProxyDomain,
  setNewProxyDomain,
  newProxyPort,
  setNewProxyPort,
  createProxy,
  deleteProxy,
  showToast,
  loadProperties
}) => {
  return (
    <div className="space-y-5">
      {/* SERVER CINEMATIC HERO */}
      <ServerHero
        server={serverDetails}
        onPowerAction={(action) => executeLifecycle(serverDetails.id, action)}
        hostStats={hostStats}
        metrics={serverRealtimeMetrics}
        metricsStatus={metricsStatus}
      />

      {/* TAB 1: CONSOLE */}
      {selectedServerTab === 'console' && (
        <div className="space-y-5">
          {/* Main Terminal Console */}
          <ConsoleViewer
            serverDetails={serverDetails}
            wsConnected={wsConnected}
            consoleSearch={consoleSearch}
            setConsoleSearch={setConsoleSearch}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            setConsoleLogs={setConsoleLogs}
            filteredConsoleLogs={filteredConsoleLogs}
            consoleViewportRef={consoleViewportRef}
            handleConsoleScroll={handleConsoleScroll}
            sendQuickCommand={sendQuickCommand}
            sendConsoleCommand={sendConsoleCommand}
            commandInput={commandInput}
            setCommandInput={setCommandInput}
            commandInputRef={commandInputRef}
            handleConsoleKeyDown={handleConsoleKeyDown}
          />

          {/* REAL-TIME METRIC GRAPHS (Pterodactyl-Style Real Telemetry Stream) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. CPU History Card */}
            <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-indigo-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-indigo-950/20 via-black/30 to-black/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-sm shadow-indigo-500/30">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-tight">CPU Utilization History</div>
                    <div className="text-[10px] text-zinc-300">Past 60 samples ({serverDetails?.cpuLimitCores || 2} cores)</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-indigo-300">
                    {(serverRealtimeMetrics?.cpuPercent || 0).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Peak: {Math.max(...cpuHistory, (serverRealtimeMetrics?.cpuPercent || 0)).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="h-28 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                  {(() => {
                    const points = cpuHistory.map((val, idx) => {
                      const x = (idx / Math.max(cpuHistory.length - 1, 1)) * 240;
                      const maxScale = Math.max(Math.max(...cpuHistory, 20), (serverDetails?.cpuLimitCores || 2) * 100);
                      const y = 75 - (Math.min(val, maxScale) / Math.max(maxScale, 1)) * 65;
                      return { x, y };
                    });
                    const pathD = points.length > 0
                      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                      : 'M 0 75 L 240 75';
                    const areaD = `${pathD} L 240 75 L 0 75 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#cpuGradient)" />
                        <path d={pathD} fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* 2. RAM History Card */}
            <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-purple-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-tight">Memory History</div>
                    <div className="text-[10px] text-zinc-300">Allocated heap RSS over time</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-purple-300">
                    {serverRealtimeMetrics?.memoryUsedFormatted || '0.00 GB'}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Limit: {serverDetails?.memoryLimitGb || 4} GB
                  </div>
                </div>
              </div>

              <div className="h-28 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                  {(() => {
                    const points = ramHistory.map((val, idx) => {
                      const x = (idx / Math.max(ramHistory.length - 1, 1)) * 240;
                      const maxScale = Math.max(serverDetails?.memoryLimitGb || 4, 1);
                      const y = 75 - (Math.min(val, maxScale) / maxScale) * 65;
                      return { x, y };
                    });
                    const pathD = points.length > 0
                      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                      : 'M 0 75 L 240 75';
                    const areaD = `${pathD} L 240 75 L 0 75 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#ramGradient)" />
                        <path d={pathD} fill="none" stroke="#e879f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* 3. Disk Storage History */}
            <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-purple-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-tight">Disk Storage History</div>
                    <div className="text-[10px] text-zinc-300">Server world & files storage footprint</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-purple-300">
                    {serverRealtimeMetrics?.diskUsedFormatted || '0 MB'}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Pool: {serverDetails?.diskLimitGb || 15} GB
                  </div>
                </div>
              </div>

              <div className="h-28 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#9333ea" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                  {(() => {
                    const points = diskHistory.map((val, idx) => {
                      const x = (idx / Math.max(diskHistory.length - 1, 1)) * 240;
                      const maxScale = Math.max(serverDetails?.diskLimitGb || 15, 1);
                      const y = 75 - (Math.min(val, maxScale) / maxScale) * 65;
                      return { x, y };
                    });
                    const pathD = points.length > 0
                      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                      : 'M 0 75 L 240 75';
                    const areaD = `${pathD} L 240 75 L 0 75 Z`;

                    return (
                      <>
                        <path d={areaD} fill="url(#diskGradient)" />
                        <path d={pathD} fill="none" stroke="#d8b4fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* 4. Network Traffic (Incoming & Outgoing) */}
            <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-indigo-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-indigo-950/20 via-black/30 to-black/40 relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-sm shadow-indigo-500/30 shrink-0">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white tracking-tight truncate">Network Traffic History</div>
                    <div className="text-[10px] text-zinc-300 flex items-center gap-3 font-mono mt-0.5 whitespace-nowrap">
                      <span className="text-indigo-300">↓ Incoming</span>
                      <span className="text-purple-300">↑ Outgoing</span>
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs shrink-0 whitespace-nowrap">
                  {(serverDetails?.status === 'Running' || serverDetails?.status === 'Starting') ? (
                    <>
                      <span className="text-indigo-300 font-bold mr-3">↓ {serverRealtimeMetrics?.network?.rxRateFormatted || '0 KB/s'}</span>
                      <span className="text-purple-300 font-bold">↑ {serverRealtimeMetrics?.network?.txRateFormatted || '0 KB/s'}</span>
                    </>
                  ) : (
                    <span className="text-zinc-400 font-bold">Offline</span>
                  )}
                </div>
              </div>

              <div className="h-28 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                  {(() => {
                    const maxRx = Math.max(...netRxHistory, 5);
                    const maxTx = Math.max(...netTxHistory, 5);
                    const maxNet = Math.max(maxRx, maxTx, 10);

                    const rxPoints = netRxHistory.map((val, idx) => {
                      const x = (idx / Math.max(netRxHistory.length - 1, 1)) * 240;
                      const y = 75 - (Math.min(val, maxNet) / maxNet) * 65;
                      return { x, y };
                    });
                    const txPoints = netTxHistory.map((val, idx) => {
                      const x = (idx / Math.max(netTxHistory.length - 1, 1)) * 240;
                      const y = 75 - (Math.min(val, maxNet) / maxNet) * 65;
                      return { x, y };
                    });

                    const rxD = rxPoints.length > 0
                      ? rxPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                      : 'M 0 75 L 240 75';
                    const txD = txPoints.length > 0
                      ? txPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                      : 'M 0 75 L 240 75';

                    return (
                      <>
                        {(serverDetails?.status === 'Running' || serverDetails?.status === 'Starting') && (
                          <>
                            <path d={rxD} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={txD} fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
                          </>
                        )}
                      </>
                    );
                  })()}
                </svg>

                {(serverDetails?.status !== 'Running' && serverDetails?.status !== 'Starting') && (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-mono bg-black/45 rounded-xl border border-white/5">
                    Offline
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PLAYERS ONLINE SECTION (Real Online Players) - Pure Purple Theme */}
          <div className="p-5 rounded-3xl glass-panel border border-purple-500/25 space-y-4 shadow-xl bg-gradient-to-br from-purple-950/20 via-black/25 to-black/35">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Players Online ({serverRealtimeMetrics?.playersOnline || 0} / {serverRealtimeMetrics?.playersMax || 20})
                  </h3>
                  <p className="text-[11px] text-zinc-300">Live player connections streaming directly from server engine</p>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-purple-500/30 text-purple-300 font-semibold">
                Max: {serverRealtimeMetrics?.playersMax || 20}
              </span>
            </div>

            {(!serverRealtimeMetrics?.playerList || serverRealtimeMetrics.playerList.length === 0) ? (
              <div className="py-8 text-center rounded-2xl bg-black/30 border border-white/5 text-zinc-500 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
                0 / {serverRealtimeMetrics?.playersMax || 20} Players Online — No players currently connected to the world.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serverRealtimeMetrics.playerList.map((player: any) => (
                  <div key={player.name} className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-400/40 flex items-center justify-center text-white font-bold text-xs uppercase">
                        {player.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{player.name}</span>
                          {player.isOp && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono border border-amber-500/30">
                              OP
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate">
                          {player.uuid}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono font-bold text-emerald-400">
                        {player.pingMs} ms
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {player.gamemode}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PERFORMANCE & SERVER INFORMATION MATRIX */}
          <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Performance & Diagnostics</h3>
                  <p className="text-[11px] text-zinc-400">Real-time Minecraft compute telemetry vs Host isolation</p>
                </div>
              </div>
              {serverRealtimeMetrics?.performance?.uptimeFormatted && (
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                  Uptime: {serverRealtimeMetrics.performance.uptimeFormatted}
                </span>
              )}
            </div>

            {/* Diagnostic Metrics Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                <div className="text-zinc-400 text-[10px] mb-1">CPU Load</div>
                <div className="font-bold text-white font-mono text-sm">{(serverRealtimeMetrics?.cpuPercent || 0).toFixed(1)}%</div>
                <div className="text-[10px] text-zinc-500 font-mono">{serverDetails?.cpuLimitCores || 2} Cores</div>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                <div className="text-zinc-400 text-[10px] mb-1">Memory</div>
                <div className="font-bold text-white font-mono text-sm">{serverRealtimeMetrics?.memoryUsedFormatted || '0.00 GB'}</div>
                <div className="text-[10px] text-zinc-500 font-mono">/ {serverDetails?.memoryLimitGb || 4} GB</div>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                <div className="text-zinc-400 text-[10px] mb-1">Network RX</div>
                <div className="font-bold text-purple-300 font-mono text-sm">{serverRealtimeMetrics?.network?.rxRateFormatted || '0 KB/s'}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Total: {serverRealtimeMetrics?.network?.rxTotalFormatted || '0 KB'}</div>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                <div className="text-zinc-400 text-[10px] mb-1">Network TX</div>
                <div className="font-bold text-indigo-400 font-mono text-sm">{serverRealtimeMetrics?.network?.txRateFormatted || '0 KB/s'}</div>
                <div className="text-[10px] text-zinc-500 font-mono">Total: {serverRealtimeMetrics?.network?.txTotalFormatted || '0 KB'}</div>
              </div>
            </div>

            {/* Active Performance Warnings / Alerts if any */}
            {serverRealtimeMetrics?.performance?.activeAlerts && serverRealtimeMetrics.performance.activeAlerts.length > 0 && (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-1">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" /> Active Performance Alerts
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-amber-200">
                  {serverRealtimeMetrics.performance.activeAlerts.map((alert: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-black/40 border border-amber-500/20 font-mono text-[11px]">
                      {alert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FILE MANAGER */}
      {selectedServerTab === 'files' && (
        <FileManager
          serverId={serverDetails.id}
          token={token}
          diskUsedFormatted={serverRealtimeMetrics?.diskUsedFormatted || serverDetails?.diskUsedFormatted}
          diskLimitGb={serverDetails?.diskLimitGb || 15}
          onStorageChange={refreshServerStorageStats}
        />
      )}

      {/* TAB 3: PLUGIN / MOD MANAGER */}
      {selectedServerTab === 'plugins' && (
        isModded(serverDetails.software) ? (
          <ModManager
            serverId={serverDetails.id}
            token={token}
            software={serverDetails.software}
            mcVersion={serverDetails.version}
          />
        ) : (
          <PluginManager
            serverId={serverDetails.id}
            token={token}
            software={serverDetails.software}
            mcVersion={serverDetails.version}
          />
        )
      )}

      {/* TAB 4: PLAYERS */}
      {selectedServerTab === 'players' && (
        <PlayersManager serverDetails={serverDetails} />
      )}

      {/* TAB 5: BACKUPS */}
      {selectedServerTab === 'backups' && (
        <BackupManager
          backups={backups}
          createBackup={createBackup}
          downloadBackup={downloadBackup}
          restoreBackup={restoreBackup}
          deleteBackup={deleteBackup}
        />
      )}

      {/* TAB 6: SCHEDULES */}
      {selectedServerTab === 'schedules' && (
        <SchedulesManager
          schedules={schedules}
          newSchedule={newSchedule}
          setNewSchedule={setNewSchedule}
          createSchedule={createSchedule}
        />
      )}

      {/* TAB 7: CONFIG EDITOR */}
      {selectedServerTab === 'properties' && (
        <ConfigEditor
          serverId={serverDetails.id}
          token={token}
          showToast={showToast}
          onSaved={loadProperties}
        />
      )}

      {/* TAB 8: PORTS */}
      {selectedServerTab === 'ports' && (
        <PortsManager
          serverDetails={serverDetails}
          newPortNumber={newPortNumber}
          setNewPortNumber={setNewPortNumber}
          newPortLabel={newPortLabel}
          setNewPortLabel={setNewPortLabel}
          allocateExtraPort={allocateExtraPort}
          allocatingPort={allocatingPort}
          releaseExtraPort={releaseExtraPort}
        />
      )}

      {/* TAB 9: STARTUP */}
      {selectedServerTab === 'startup' && (
        <StartupSettingsManager
          serverDetails={serverDetails}
          editingStartup={editingStartup}
          setEditingStartup={setEditingStartup}
          saveStartupSettings={saveStartupSettings}
        />
      )}

      {/* TAB 10: NGINX */}
      {selectedServerTab === 'nginx' && (
        <NginxProxiesManager
          proxies={proxies}
          newProxyDomain={newProxyDomain}
          setNewProxyDomain={setNewProxyDomain}
          newProxyPort={newProxyPort}
          setNewProxyPort={setNewProxyPort}
          createProxy={createProxy}
          deleteProxy={deleteProxy}
        />
      )}
    </div>
  );
};
