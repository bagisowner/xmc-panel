import React, { useState } from 'react';
import {
  Play, Square, RotateCw, Power, Copy, Check, Server as ServerIcon,
  HardDrive, Cpu, Activity, Terminal, FolderOpen, Users,
  Archive, Calendar, Sliders, Globe, Sparkles, Settings
} from 'lucide-react';

interface ServerHeroProps {
  server: any;
  activeTab: string;
  onTabChange: (tab: any) => void;
  onPowerAction: (action: 'start' | 'stop' | 'restart' | 'kill') => void;
  onDeleteServer?: () => void;
  hostStats?: any;
}

export const ServerHero: React.FC<ServerHeroProps> = ({
  server,
  activeTab,
  onTabChange,
  onPowerAction,
  onDeleteServer,
  hostStats
}) => {
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const status = (server.status || 'Offline').toLowerCase();
  const isRunning = status === 'running';
  const isStarting = status === 'starting';
  const isStopping = status === 'stopping';
  const isInstalling = status === 'installing';

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

  const tabs = [
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'files', label: 'File Manager', icon: FolderOpen },
    { id: 'plugins', label: 'Plugin Manager', icon: Sparkles },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'backups', label: 'Backups', icon: Archive },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'properties', label: 'Config Editor', icon: Sliders },
    { id: 'ports', label: 'Port Allocations', icon: Globe },
    { id: 'startup', label: 'Java & Startup', icon: Settings },
    { id: 'nginx', label: 'Nginx Proxies', icon: Activity }
  ];

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* Cinematic Hero Card */}
      <div className="relative rounded-2xl sm:rounded-3xl glass-panel border border-purple-500/20 overflow-hidden shadow-2xl">
        {/* Landscape Hero Backdrop */}
        <div className="relative min-h-[13rem] sm:min-h-[14rem] w-full bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-zinc-950/80 p-4 sm:p-6 flex flex-col justify-between gap-4 overflow-hidden border-b border-white/5">
          {/* Subtle atmospheric glow */}
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-80 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Top Status & IP Row */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {isRunning && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE & RUNNING</span>
                </div>
              )}
              {isStarting && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 text-xs font-semibold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>BOOTING CONTAINER...</span>
                </div>
              )}
              {isStopping && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-950/60 border border-orange-500/40 text-orange-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>STOPPING SERVER</span>
                </div>
              )}
              {isInstalling && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-spin" />
                  <span>DOWNLOADING CORE JAR...</span>
                </div>
              )}
              {!isRunning && !isStarting && !isStopping && !isInstalling && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900/70 border border-zinc-700/60 text-zinc-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span>SERVER OFFLINE</span>
                </div>
              )}
            </div>

            {/* IP Address Pill */}
            <button
              onClick={copyAddress}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-300 transition-colors shadow-sm cursor-pointer"
              title="Click to copy connection address"
            >
              <span>127.0.0.1:{server.primaryPort || 25565}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            </button>
          </div>

          {/* Center Identity & Power Toolbar */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-400/40 flex items-center justify-center text-purple-200 shadow-xl backdrop-blur-md shrink-0">
                <ServerIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate">
                  {server.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-300 mt-1">
                  <span className="font-semibold text-purple-400">{server.software || 'Paper'}</span>
                  <span>·</span>
                  <span>v{server.version || '1.21.1'}</span>
                  <span>·</span>
                  <span className="font-mono text-purple-300">OpenJDK {server.javaVersion || '21'}</span>
                  {server.processPid && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-emerald-400 font-semibold">PID: {server.processPid}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Power Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isRunning ? (
                <button
                  type="button"
                  disabled={actionLoading || isStarting || isInstalling}
                  onClick={() => handleAction('start')}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
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
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-zinc-200 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 rounded-xl transition-colors active:scale-95 cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>RESTART</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || isStopping}
                    onClick={() => handleAction('stop')}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl shadow-lg shadow-rose-950/50 transition-all active:scale-95 cursor-pointer"
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
                className="p-2 sm:p-2.5 text-zinc-400 hover:text-rose-400 bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 rounded-xl transition-colors cursor-pointer"
                title="Kill Process (SIGKILL)"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Real-Time Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5 bg-black/20">
          {/* RAM */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Memory
              </span>
              <span className="font-mono tabular-nums text-white font-medium text-[11px] sm:text-xs">
                {isRunning ? '1.42 GB' : '0.00 GB'} / {server.memoryLimitGb || 4} GB
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: isRunning ? '35%' : '0%' }}
              />
            </div>
          </div>

          {/* CPU */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> CPU Load
              </span>
              <span className="font-mono tabular-nums text-white font-medium text-[11px] sm:text-xs">
                {isRunning ? '4.8%' : '0.0%'} ({server.cpuLimitCores || 2} Cores)
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: isRunning ? '18%' : '0%' }}
              />
            </div>
          </div>

          {/* Disk */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Disk Usage
              </span>
              <span className="font-mono tabular-nums text-white font-medium text-[11px] sm:text-xs">
                184 MB / {server.diskLimitGb || 15} GB
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '4%' }} />
            </div>
          </div>

          {/* Players & TPS */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400">Players</div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono tabular-nums">
                {isRunning ? '0 / 50' : 'Offline'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-zinc-400">TPS</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono tabular-nums">
                {isRunning ? '20.0' : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 p-2 bg-black/40 border-t border-white/5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
