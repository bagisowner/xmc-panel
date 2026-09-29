// Component: ServerCard
import React, { useState } from 'react';
import {
  Play, Square, RotateCw, Terminal as TerminalIcon, Copy, Check,
  Cpu, HardDrive, Users, Layers, Globe, Server as ServerIcon, AlertCircle, Shield, Trash2
} from 'lucide-react';

interface ServerCardProps {
  server: any;
  isSelected?: boolean;
  onSelect: (serverId: string) => void;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => void;
  onOpenConsole: (serverId: string) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  isSelected,
  onSelect,
  onPowerAction,
  onOpenConsole
}) => {
  const [copied, setCopied] = useState(false);
  const [powerLoading, setPowerLoading] = useState(false);

  const status = (server.status || 'Offline').toLowerCase();
  const isRunning = status === 'running';
  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';
  const isInstalling = status === 'installing';
  const isFailed = status === 'failed' || status === 'crashed';

  const metrics = server.metrics;

  // Calculate real memory usage percent
  const memoryLimit = server.memoryLimitGb || metrics?.memoryLimitGb || 4;
  const memoryUsedFormatted = metrics?.memoryUsedFormatted || '0.00 GB';
  const isMb = memoryUsedFormatted.toLowerCase().includes('mb');
  const memoryUsedGb = isRunning 
    ? (isMb ? parseFloat(memoryUsedFormatted) / 1024 : parseFloat(memoryUsedFormatted))
    : 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsedGb / memoryLimit) * 100 : 0;

  // Calculate real cpu percent
  const cpuVal = isRunning ? (metrics?.cpuPercent || 0) : 0;
  const cpuCores = server.cpuLimitCores || 2;
  const cpuPercent = cpuCores > 0 ? (cpuVal / (cpuCores * 100)) * 100 : 0;

  // Players
  const playersOnline = isRunning ? (metrics?.playersOnline || 0) : 0;
  const playersMax = metrics?.playersMax || server.playersMax || 20;

  const copyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = `127.0.0.1:${server.primaryPort || 25565}`;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePower = async (e: React.MouseEvent, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    setPowerLoading(true);
    try {
      await onPowerAction(server.id, action);
    } finally {
      setTimeout(() => setPowerLoading(false), 1200);
    }
  };

  // Status badge styling
  // Status badge styling - brighter, vivid high-contrast badges
  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold shadow-sm shadow-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          <span>RUNNING</span>
        </div>
      );
    }
    if (isStarting) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold shadow-sm shadow-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-sm shadow-amber-400" />
          <span>STARTING</span>
        </div>
      );
    }
    if (isStopping) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/20 border border-orange-400/50 text-orange-300 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span>STOPPING</span>
        </div>
      );
    }
    if (isInstalling) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/25 border border-purple-400/50 text-purple-200 text-xs font-bold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-purple-300 animate-spin" />
          <span>INSTALLING</span>
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-400/50 text-rose-300 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>FAILED</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-600/60 text-zinc-300 text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-zinc-400" />
        <span>OFFLINE</span>
      </div>
    );
  };

  // Banner background based on software - brighter, richer twilight gradients
  const getBannerGradient = () => {
    const sw = (server.software || 'Paper').toLowerCase();
    if (sw === 'paper') return 'from-purple-900/60 via-indigo-900/50 to-purple-950/70';
    if (sw === 'purpur') return 'from-fuchsia-900/60 via-purple-900/50 to-purple-950/70';
    if (sw === 'fabric') return 'from-cyan-900/60 via-blue-950/50 to-purple-950/70';
    if (sw === 'forge') return 'from-amber-900/60 via-orange-950/50 to-purple-950/70';
    return 'from-emerald-900/60 via-teal-950/50 to-purple-950/70';
  };

  return (
    <div
      onClick={() => onSelect(server.id)}
      className={`group relative flex flex-col justify-between glass-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-purple-400 ring-2 ring-purple-400/50 bg-purple-950/40 shadow-purple-900/30'
          : 'hover:border-purple-400/50'
      }`}
    >
      {/* Top Banner Artwork */}
      <div className={`relative h-28 w-full bg-gradient-to-r ${getBannerGradient()} p-4 flex flex-col justify-between overflow-hidden border-b border-purple-500/20`}>
        {/* Subtle grid pattern in banner */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #e9d5ff 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
        />

        <div className="relative z-10 flex items-center justify-between">
          {getStatusBadge()}
          
          {/* Quick IP Address Pill (Unique Cyber Neon Port Badge) */}
          <button
            type="button"
            onClick={copyIp}
            className="group/port relative flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-purple-950/90 via-indigo-950/80 to-purple-900/90 hover:from-purple-900 hover:to-indigo-900 border border-purple-400/40 hover:border-purple-300 text-[11px] font-mono font-bold text-purple-200 hover:text-white transition-all duration-200 shadow-md shadow-purple-950/60 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Click to copy server port / IP"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-xs shadow-purple-400 animate-pulse" />
            <span className="tracking-wider">{server.primaryPort || 25565}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-purple-300/80 group-hover/port:text-purple-200 shrink-0" />
            )}
          </button>
        </div>

        {/* Server Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-900/80 border border-purple-400/40 flex items-center justify-center text-purple-100 shadow-sm group-hover:scale-105 transition-transform">
            <ServerIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight truncate group-hover:text-purple-300 transition-colors drop-shadow-sm">
              {server.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-200 font-medium">
              <span className="font-bold text-purple-300">{server.software || 'Paper'}</span>
              <span className="text-zinc-400">·</span>
              <span>{server.version || '1.21.1'}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-purple-200">Java {server.javaVersion || '21'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body Statistics */}
      <div className="p-4 space-y-3.5">
        {/* Memory & CPU meters */}
        <div className="grid grid-cols-2 gap-3">
          {/* RAM */}
          <div className="p-2.5 bg-purple-950/30 border border-purple-500/20 rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-zinc-300 mb-1.5 font-medium">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-purple-300" /> Memory
              </span>
              <span className="font-mono tabular-nums text-white font-bold">{isRunning ? memoryUsedFormatted : '0.00 GB'}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(memoryPercent, isRunning ? 4 : 0), 100)}%` }}
              />
            </div>
          </div>

          {/* CPU */}
          <div className="p-2.5 bg-purple-950/30 border border-purple-500/20 rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-zinc-300 mb-1.5 font-medium">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-300" /> CPU Limit
              </span>
              <span className="font-mono tabular-nums text-white font-bold">{isRunning ? `${cpuVal.toFixed(1)}%` : '0%'}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 shadow-sm shadow-indigo-500/40"
                style={{ width: `${Math.min(Math.max(cpuPercent, isRunning ? 2 : 0), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Players & Node Info */}
        <div className="flex items-center justify-between text-xs text-zinc-300 px-1 font-medium">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-300" />
            <span className="tabular-nums font-semibold text-zinc-200">{isRunning ? `${playersOnline} / ${playersMax} Players` : 'Offline'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-300">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold">Node-01</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-purple-950/30 border-t border-purple-500/20 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenConsole(server.id);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-lg transition-colors shadow-sm"
        >
          <TerminalIcon className="w-3.5 h-3.5 text-purple-400" />
          <span>Console</span>
        </button>

        {/* Power Action Buttons */}
        <div className="flex items-center gap-1.5">
          {!isRunning ? (
            <button
              type="button"
              disabled={powerLoading || isStarting || isInstalling}
              onClick={(e) => handlePower(e, 'start')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 disabled:opacity-50 rounded-lg shadow-sm shadow-emerald-950/50 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={powerLoading}
                onClick={(e) => handlePower(e, 'restart')}
                className="p-1.5 text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 rounded-lg transition-colors"
                title="Restart Server"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={powerLoading || isStopping}
                onClick={(e) => handlePower(e, 'stop')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 border border-rose-400/40 disabled:opacity-50 rounded-lg shadow-sm shadow-rose-950/50 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
