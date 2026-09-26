import React, { useState } from 'react';
import {
  Play, Square, RotateCw, Terminal as TerminalIcon, Copy, Check,
  Cpu, HardDrive, Users, Layers, Globe, Server as ServerIcon, AlertCircle, Shield
} from 'lucide-react';

interface ServerCardProps {
  server: any;
  onSelect: (serverId: string) => void;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => void;
  onOpenConsole: (serverId: string) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
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
  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          <span>RUNNING</span>
        </div>
      );
    }
    if (isStarting) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/40 text-amber-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>STARTING</span>
        </div>
      );
    }
    if (isStopping) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-950/60 border border-orange-500/40 text-orange-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span>STOPPING</span>
        </div>
      );
    }
    if (isInstalling) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-500/40 text-purple-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-spin" />
          <span>INSTALLING</span>
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/60 border border-rose-500/40 text-rose-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>FAILED</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/60 border border-zinc-700/60 text-zinc-400 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-zinc-500" />
        <span>OFFLINE</span>
      </div>
    );
  };

  // Banner background based on software
  const getBannerGradient = () => {
    const sw = (server.software || 'Paper').toLowerCase();
    if (sw === 'paper') return 'from-purple-900/40 via-indigo-950/30 to-zinc-950/50';
    if (sw === 'purpur') return 'from-fuchsia-900/40 via-purple-950/30 to-zinc-950/50';
    if (sw === 'fabric') return 'from-cyan-900/40 via-slate-950/30 to-zinc-950/50';
    if (sw === 'forge') return 'from-amber-900/40 via-stone-950/30 to-zinc-950/50';
    return 'from-emerald-900/40 via-zinc-950/30 to-zinc-950/50';
  };

  return (
    <div
      onClick={() => onSelect(server.id)}
      className="group relative flex flex-col justify-between glass-card hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-purple-950/40 transition-all duration-300 cursor-pointer"
    >
      {/* Top Banner Artwork */}
      <div className={`relative h-28 w-full bg-gradient-to-r ${getBannerGradient()} p-4 flex flex-col justify-between overflow-hidden border-b border-white/5`}>
        {/* Subtle grid pattern in banner */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
        />

        <div className="relative z-10 flex items-center justify-between">
          {getStatusBadge()}
          
          {/* Quick IP Address Pill */}
          <button
            type="button"
            onClick={copyIp}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950/70 hover:bg-zinc-900 border border-white/10 text-[11px] font-mono text-zinc-300 transition-colors"
            title="Click to copy server IP:Port"
          >
            <span>:{server.primaryPort || 25565}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
        </div>

        {/* Server Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-200 shadow-md backdrop-blur-sm group-hover:scale-105 transition-transform">
            <ServerIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight truncate group-hover:text-purple-300 transition-colors">
              {server.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="font-semibold text-purple-400">{server.software || 'Paper'}</span>
              <span>·</span>
              <span>{server.version || '1.21.1'}</span>
              <span>·</span>
              <span>Java {server.javaVersion || '21'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body Statistics */}
      <div className="p-4 space-y-3.5">
        {/* Memory & CPU meters */}
        <div className="grid grid-cols-2 gap-3">
          {/* RAM */}
          <div className="p-2.5 bg-black/25 border border-white/5 rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Memory
              </span>
              <span className="font-mono tabular-nums text-zinc-200">{server.memoryLimitGb || 4} GB</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: isRunning ? '42%' : '0%' }}
              />
            </div>
          </div>

          {/* CPU */}
          <div className="p-2.5 bg-black/25 border border-white/5 rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> CPU Limit
              </span>
              <span className="font-mono tabular-nums text-zinc-200">{server.cpuLimitCores || 2} Cores</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: isRunning ? '28%' : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Players & Node Info */}
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span className="tabular-nums">{isRunning ? '0 / 50 Players' : 'Offline'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Node-01</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-black/35 border-t border-white/5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenConsole(server.id);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-lg transition-colors"
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
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-sm shadow-emerald-950/50 transition-all"
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
                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-lg transition-colors"
                title="Restart Server"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={powerLoading || isStopping}
                onClick={(e) => handlePower(e, 'stop')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg shadow-sm shadow-rose-950/50 transition-all"
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
