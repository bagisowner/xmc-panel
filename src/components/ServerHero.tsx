// Component: ServerHero
import React, { useState, useEffect } from 'react';
import {
  Play, Square, RotateCw, Power, Copy, Check, Server as ServerIcon,
  HardDrive, Cpu, Activity, Users, Clock, ShieldAlert, Boxes, Wifi, Trash2, Layers
} from 'lucide-react';
import { RealtimeServerMetrics } from '../services/MetricsService';

interface UptimeTickerProps {
  serverId: string;
  isRunning: boolean;
  token?: string | null;
  initialStartedAt?: string;
  onStartedAtLoaded?: (startedAt: string) => void;
}

export const UptimeTicker: React.FC<UptimeTickerProps> = ({
  serverId,
  isRunning,
  token,
  initialStartedAt,
  onStartedAtLoaded
}) => {
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt || null);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  useEffect(() => {
    if (!isRunning) {
      setUptimeSeconds(0);
      return;
    }

    const fetchRuntime = async () => {
      try {
        const res = await fetch(`/api/servers/${serverId}/runtime`);
        if (res.ok) {
          const data = await res.json();
          if (data.startedAt) {
            setStartedAt(data.startedAt);
            if (onStartedAtLoaded) {
              onStartedAtLoaded(data.startedAt);
            }
            const diff = Math.max(0, Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000));
            setUptimeSeconds(diff);
          }
        }
      } catch (err) {
        console.error('Failed to fetch runtime info:', err);
      }
    };

    fetchRuntime();
    const interval = setInterval(fetchRuntime, 5000);
    return () => clearInterval(interval);
  }, [serverId, isRunning, token]);

  useEffect(() => {
    if (!isRunning || !startedAt) {
      return;
    }

    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      setUptimeSeconds(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, startedAt]);

  if (!isRunning) {
    return <span className="text-zinc-400">OFFLINE</span>;
  }

  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const pad = (num: number) => String(num).padStart(2, '0');

  if (hours > 0) {
    return (
      <span className="text-purple-100 font-bold">
        {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
      </span>
    );
  }
  return (
    <span className="text-purple-100 font-bold">
      {pad(minutes)}m {pad(seconds)}s
    </span>
  );
};

interface ServerHeroProps {
  server: any;
  onPowerAction: (action: 'start' | 'stop' | 'restart' | 'kill') => void;
  hostStats?: any;
  metrics?: RealtimeServerMetrics | null;
  metricsStatus?: 'live' | 'stale' | 'reconnecting';
}

export const ServerHero: React.FC<ServerHeroProps> = ({
  server,
  onPowerAction,
  hostStats,
  metrics,
  metricsStatus = 'live'
}) => {
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadedStartedAt, setLoadedStartedAt] = useState<string | null>(server?.startedAt || null);

  // Status prioritizing real live process metric status
  const currentStatus = (metrics?.status || server.status || 'Offline').toLowerCase();
  const isRunning = currentStatus === 'running';
  const isStarting = currentStatus === 'starting';
  const isStopping = currentStatus === 'stopping';
  const isInstalling = currentStatus === 'installing';

  // Live real metrics values directly from backend process inspection (immediately active upon start)
  const isMonitored = isRunning || isStarting;
  const cpuVal = isMonitored ? (metrics?.cpuPercent !== undefined ? metrics.cpuPercent : 0.0) : 0.0;
  const cpuCores = server.cpuLimitCores || metrics?.cpuCores || 2;
  const cpuVsAlloc = metrics?.cpuUsageVsAllocationPercent !== undefined
    ? metrics.cpuUsageVsAllocationPercent
    : (cpuCores > 0 ? parseFloat(((cpuVal / (cpuCores * 100)) * 100).toFixed(1)) : 0);

  const memoryFormatted = isMonitored ? (metrics?.memoryUsedFormatted || '0.00 GB') : '0.00 GB';
  const memoryLimit = server.memoryLimitGb || metrics?.memoryLimitGb || 4;
  const isMb = memoryFormatted.toLowerCase().includes('mb');
  const memoryUsedGb = isMonitored 
    ? (isMb ? parseFloat(memoryFormatted) / 1024 : parseFloat(memoryFormatted))
    : 0;
  const memoryPercent = memoryLimit > 0 ? parseFloat(((memoryUsedGb / memoryLimit) * 100).toFixed(1)) : 0;
  const diskLimit = server.diskLimitGb || metrics?.diskLimitGb || 15;
  const diskUsedBytes = metrics?.diskUsedBytes ?? server.diskUsedBytes ?? 0;
  const diskUsedGb = diskUsedBytes / (1024 * 1024 * 1024);
  const diskPercent = diskLimit > 0 ? (diskUsedGb / diskLimit) * 100 : 0;
  const diskFormatted = metrics?.diskUsedFormatted || server.diskUsedFormatted || (diskUsedBytes > 0 ? `${(diskUsedBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB');
  const diskAvailableGb = Math.max(0, diskLimit - diskUsedGb);
  const playersCount = isRunning ? (metrics?.playersOnline || 0) : 0;
  const maxPlayers = metrics?.playersMax || 20;
  const uptimeStr = metrics?.performance?.uptimeFormatted || 'Offline';

  const copyAddress = () => {
    navigator.clipboard.writeText(`127.0.0.1:${server.primaryPort || 25565}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    setActionLoading(true);
    try {
      await onPowerAction(action);
    } finally {
      setTimeout(() => setActionLoading(false), 1200);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* 1. COMPACT SERVER HEADER CARD (Brighter Arix-Style) */}
      <div className="relative rounded-2xl sm:rounded-3xl glass-panel border border-purple-500/30 overflow-hidden shadow-xl p-4 sm:p-5 bg-gradient-to-r from-purple-950/60 via-indigo-950/50 to-purple-950/70">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Server Identity & Badges */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-600/70 to-indigo-600/70 border border-purple-300/40 flex items-center justify-center text-purple-100 shadow-md shrink-0">
              <ServerIcon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate drop-shadow-sm">
                  {server.name}
                </h1>

                {/* Real Server State Badge */}
                {isRunning && (
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-bold shadow-sm shadow-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                    RUNNING
                  </span>
                )}
                {isStarting && (
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-bold shadow-sm shadow-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-sm shadow-amber-400" />
                    STARTING
                  </span>
                )}
                {isStopping && (
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-orange-500/20 border border-orange-400/50 text-orange-300 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    STOPPING
                  </span>
                )}
                {isInstalling && (
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-purple-500/25 border border-purple-400/50 text-purple-200 text-[11px] font-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-purple-300 animate-spin" />
                    INSTALLING
                  </span>
                )}
                {!isRunning && !isStarting && !isStopping && !isInstalling && (
                  <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-600/60 text-zinc-300 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    STOPPED
                  </span>
                )}
              </div>

              {/* Subtitle with engine specs, PID, Uptime, & IP pill */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-200 mt-1 font-medium">
                <span className="font-bold text-purple-300">{server.software || 'Paper'}</span>
                <span className="text-zinc-400">•</span>
                <span className="text-zinc-200">v{server.version || '1.21.1'}</span>

                <span className="text-zinc-400">•</span>
                <button
                  onClick={copyAddress}
                  className="group/port relative inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-purple-950/90 via-indigo-950/80 to-purple-900/90 hover:from-purple-900 hover:to-indigo-900 border border-purple-400/40 hover:border-purple-300 text-[11px] font-mono font-bold text-purple-200 hover:text-white transition-all duration-200 shadow-md shadow-purple-950/60 active:scale-95 cursor-pointer backdrop-blur-md"
                  title="Copy IP Address"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-xs shadow-purple-400 animate-pulse" />
                  <span className="tracking-wider">127.0.0.1:{server.primaryPort || 25565}</span>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-300/80 group-hover/port:text-purple-200" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right Power Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isRunning ? (
              <button
                type="button"
                disabled={actionLoading || isStarting || isInstalling}
                onClick={() => handleAction('start')}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('restart')}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 rounded-xl shadow-md transition-colors active:scale-95 cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>RESTART</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading || isStopping}
                  onClick={() => handleAction('stop')}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 border border-rose-400/40 disabled:opacity-50 rounded-xl shadow-lg shadow-rose-950/50 transition-all active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>STOP</span>
                </button>
              </>
            )}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleAction('kill')}
              className="p-2 text-amber-300 hover:text-amber-200 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/40 rounded-xl transition-colors cursor-pointer"
              title="Kill Process (SIGKILL)"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME METRICS GRID (CPU Load, Memory, Disk Space, Players, Network Speed, Uptime) */}
      {/* 2. REAL-TIME METRICS GRID (Row 1: CPU, Memory, Disk Space | Row 2: Players, Uptime, Network Speed) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 min-w-0 w-full">
        {/* ROW 1 - CARD 1: CPU LOAD (Server-Only, 100% per core) */}
        <div className="p-4 rounded-2xl glass-panel border border-indigo-500/25 min-w-0 overflow-hidden flex flex-col shadow-lg shadow-indigo-950/20 bg-black/20 hover:border-indigo-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-indigo-200 uppercase tracking-wider truncate">
                <Cpu className="w-4 h-4 text-indigo-400 shrink-0" /> CPU Load
              </span>
            </div>
            
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums my-1 truncate drop-shadow-sm">
              {cpuVal.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2 mt-auto pt-2.5 border-t border-white/10 text-xs text-zinc-300 font-mono">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Allocated:</span>
              <span className="text-zinc-200 font-bold truncate">{cpuCores} Cores</span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Usage:</span>
              <span className="text-zinc-200 font-bold">{cpuVal.toFixed(1)}%</span>
            </div>
            <div className="space-y-1 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-zinc-400">Allocation:</span>
                <span className={`font-bold ${cpuVsAlloc > 80 ? 'text-amber-300 animate-pulse' : 'text-zinc-200'}`}>{cpuVsAlloc}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-900/90 rounded-full overflow-hidden border border-white/10 mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${cpuVsAlloc > 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-400'}`}
                  style={{ width: `${Math.min(Math.max(cpuVsAlloc, isMonitored ? 2 : 0), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 1 - CARD 2: RAM / MEMORY (Never clipped on sidebar collapse/expand) */}
        <div className="p-4 rounded-2xl glass-panel border border-purple-500/25 min-w-0 overflow-hidden flex flex-col shadow-md bg-black/20 hover:border-purple-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-purple-200 uppercase tracking-wider truncate">
                <Layers className="w-4 h-4 text-purple-400 shrink-0" /> Memory
              </span>
            </div>
            
            <div className="flex items-baseline gap-1.5 font-mono my-1 min-w-0 flex-nowrap">
              <span className="text-lg sm:text-xl lg:text-2xl font-black text-white tabular-nums drop-shadow-sm shrink-0">
                {isMonitored ? memoryFormatted : '0.00 GB'}
              </span>
              <span className="text-xs text-zinc-400 font-medium shrink-0 whitespace-nowrap">
                / {memoryLimit} GB
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-auto pt-2.5 border-t border-white/10 text-xs text-zinc-300 font-mono">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Used:</span>
              <span className="text-zinc-200 font-bold">{isMonitored ? memoryFormatted : '0.00 GB'}</span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Limit:</span>
              <span className="text-zinc-200 font-bold">{memoryLimit} GB</span>
            </div>
            <div className="space-y-1 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-zinc-400">Usage percentage:</span>
                <span className="text-purple-300 font-bold">{memoryPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-900/90 rounded-full overflow-hidden border border-white/10 mt-1">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(memoryPercent, isMonitored ? 4 : 0), 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 1 - CARD 3: DISK STORAGE (Pure Purple & Fuchsia Glass Aesthetics) */}
        <div className="p-4 rounded-2xl glass-panel border border-fuchsia-500/25 min-w-0 overflow-hidden flex flex-col shadow-md bg-black/20 hover:border-fuchsia-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-fuchsia-200 uppercase tracking-wider truncate">
                <HardDrive className="w-4 h-4 text-fuchsia-400 shrink-0" /> Disk Space
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 font-mono my-1 min-w-0 flex-nowrap">
              <span className="text-lg sm:text-xl lg:text-2xl font-black text-white tabular-nums drop-shadow-sm shrink-0">
                {diskFormatted}
              </span>
              <span className="text-xs text-zinc-400 font-medium shrink-0 whitespace-nowrap">
                / {diskLimit} GB
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-auto pt-2.5 border-t border-white/10 text-xs text-zinc-300 font-mono min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Available:</span>
              <span className="text-zinc-200 font-bold truncate">{diskAvailableGb.toFixed(2)} GB</span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400">Pool:</span>
              <span className="text-zinc-200 font-bold">{diskLimit} GB</span>
            </div>
            <div className="space-y-1 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-zinc-400">Usage percentage:</span>
                <span className="text-fuchsia-300 font-bold">{diskPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-900/90 rounded-full overflow-hidden border border-white/10 mt-1">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(diskPercent, diskUsedBytes > 0 ? 1 : 0), 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2 - CARD 1: PLAYERS (Real online / Real max from server.properties) */}
        <div className="p-4 rounded-2xl glass-panel border border-purple-500/25 min-w-0 overflow-hidden flex flex-col shadow-md bg-black/20 hover:border-purple-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-purple-200 uppercase tracking-wider truncate">
                <Users className="w-4 h-4 text-purple-400 shrink-0" /> Players
              </span>
              <span className="text-[10px] font-mono text-purple-300/90 shrink-0 ml-1">Max {maxPlayers}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-100 font-mono tabular-nums my-1 truncate drop-shadow-sm">
              {playersCount} / {maxPlayers}
            </div>
          </div>
          <div className="text-xs text-zinc-400 font-mono mt-auto pt-2 border-t border-white/10 truncate">
            {playersCount > 0 ? `${playersCount} player(s) in world` : 'No players connected'}
          </div>
        </div>

        {/* ROW 2 - CARD 2: UPTIME (Real Minecraft server uptime, dedicated authoritative ticker) */}
        <div className="p-4 rounded-2xl glass-panel border border-purple-500/25 min-w-0 overflow-hidden flex flex-col shadow-md bg-black/20 hover:border-purple-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-purple-200 uppercase tracking-wider truncate">
                <Clock className="w-4 h-4 text-purple-400 shrink-0" /> Uptime
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums my-1 truncate drop-shadow-sm">
              <UptimeTicker
                serverId={server.id}
                isRunning={isRunning}
                initialStartedAt={server.startedAt}
                onStartedAtLoaded={setLoadedStartedAt}
              />
            </div>
          </div>
          <div className="text-xs text-zinc-400 font-mono mt-auto pt-2 border-t border-white/10 truncate">
            {isRunning && (loadedStartedAt || server.startedAt) ? (
              `Since ${new Date(loadedStartedAt || server.startedAt).toLocaleTimeString()}`
            ) : '—'}
          </div>
        </div>

        {/* ROW 2 - CARD 3: NETWORK SPEED (Real-Time I/O, Balanced Purple/Indigo Aesthetic) */}
        <div className="p-4 rounded-2xl glass-panel border border-indigo-500/25 min-w-0 overflow-hidden flex flex-col shadow-lg shadow-indigo-950/20 bg-black/20 hover:border-indigo-400/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5 min-w-0 font-medium">
              <span className="flex items-center gap-1.5 font-bold text-indigo-200 uppercase tracking-wider truncate">
                <Activity className="w-4 h-4 text-indigo-400 shrink-0" /> Network Speed
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-300 font-mono tabular-nums my-1 truncate drop-shadow-sm">
              {isMonitored ? `${metrics?.network?.rxRateFormatted || '0 KB/s'} ↓` : '—'}
            </div>
          </div>
          <div className="text-xs text-zinc-400 font-mono mt-auto pt-2 border-t border-white/10 truncate">
            {isMonitored ? `Upload: ${metrics?.network?.txRateFormatted || '0 KB/s'} ↑` : 'Offline'}
          </div>
        </div>
      </div>
    </div>
  );
};
