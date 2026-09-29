// Component: MetricsHistoryCharts
import React from 'react';
import { Cpu, HardDrive, Activity, Zap } from 'lucide-react';

interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number; // in MB
  networkRx?: number;
  networkTx?: number;
}

interface MetricsHistoryChartsProps {
  history: MetricPoint[];
  cpuCores: number;
  memoryLimitGb: number;
  currentCpu: number;
  currentMemoryMb: number;
  isRunning: boolean;
}

export const MetricsHistoryCharts: React.FC<MetricsHistoryChartsProps> = ({
  history = [],
  cpuCores = 2,
  memoryLimitGb = 4,
  currentCpu = 0,
  currentMemoryMb = 0,
  isRunning = false
}) => {
  // Ensure we have at least 15 points to display a clean line
  const maxPoints = 40;
  const samples = history.slice(-maxPoints);

  // Pad data if freshly started
  const displaySamples: Array<{ cpu: number; memory: number }> = samples.length > 0
    ? samples.map(s => ({ cpu: s.cpu || 0, memory: s.memory || 0 }))
    : Array.from({ length: 15 }, () => ({ cpu: 0, memory: 0 }));

  // Helper to build SVG paths
  const buildSvgPath = (values: number[], maxVal: number, width = 300, height = 80) => {
    if (values.length === 0) return { path: '', area: '' };
    const step = width / Math.max(values.length - 1, 1);
    const points = values.map((v, i) => {
      const x = i * step;
      const normalized = maxVal > 0 ? Math.min(Math.max(v / maxVal, 0), 1) : 0;
      const y = height - normalized * (height - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const path = `M ${points.join(' L ')}`;
    const area = `${path} L ${width},${height} L 0,${height} Z`;
    return { path, area };
  };

  const cpuValues = displaySamples.map(s => s.cpu);
  const memoryValues = displaySamples.map(s => s.memory);
  const memoryLimitMb = memoryLimitGb * 1024;

  const { path: cpuPath, area: cpuArea } = buildSvgPath(cpuValues, 100, 400, 90);
  const { path: memPath, area: memArea } = buildSvgPath(memoryValues, memoryLimitMb, 400, 90);

  const peakCpu = isRunning ? Math.max(...cpuValues, currentCpu, 1).toFixed(1) : '0.0';
  const peakMemMb = isRunning ? Math.max(...memoryValues, currentMemoryMb, 0) : 0;
  const peakMemFormatted = peakMemMb >= 1024 ? `${(peakMemMb / 1024).toFixed(2)} GB` : `${peakMemMb.toFixed(0)} MB`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0 w-full">
      {/* CPU HISTORY CARD */}
      <div className="rounded-2xl sm:rounded-3xl glass-panel p-4 sm:p-5 border border-indigo-500/25 flex flex-col justify-between shadow-xl shadow-indigo-950/20 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">Real-Time CPU History</h3>
              <p className="text-[11px] text-zinc-200 truncate font-mono">
                Load: {isRunning ? `${currentCpu.toFixed(1)}%` : '0.0%'} · Peak: {peakCpu}% ({cpuCores} Cores)
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-950/80 text-indigo-200 border border-indigo-500/40 shrink-0">
            60s Window
          </span>
        </div>

        {/* SVG Sparkline Chart */}
        <div className="relative h-24 sm:h-28 w-full overflow-hidden rounded-xl bg-purple-950/25 border border-purple-500/20 pt-2">
          <svg
            viewBox="0 0 400 90"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid guide lines */}
            <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
            <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
            <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />

            {/* Area Fill */}
            {isRunning && cpuArea && <path d={cpuArea} fill="url(#cpuGradient)" />}

            {/* Polyline */}
            {isRunning && cpuPath && (
              <path
                d={cpuPath}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-mono">
              Server Offline · No telemetry stream
            </div>
          )}
        </div>
      </div>

      {/* MEMORY HISTORY CARD */}
      <div className="rounded-2xl sm:rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/25 flex flex-col justify-between shadow-xl min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">Real-Time Memory History</h3>
              <p className="text-[11px] text-zinc-200 truncate font-mono">
                Used: {isRunning ? (currentMemoryMb >= 1024 ? `${(currentMemoryMb / 1024).toFixed(2)} GB` : `${currentMemoryMb.toFixed(0)} MB`) : '0.00 GB'} / {memoryLimitGb} GB
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-purple-950/80 text-purple-200 border border-purple-500/40 shrink-0">
            Peak: {peakMemFormatted}
          </span>
        </div>

        {/* SVG Sparkline Chart */}
        <div className="relative h-24 sm:h-28 w-full overflow-hidden rounded-xl bg-purple-950/25 border border-purple-500/20 pt-2">
          <svg
            viewBox="0 0 400 90"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            <defs>
              <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid guide lines */}
            <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
            <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
            <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />

            {/* Area Fill */}
            {isRunning && memArea && <path d={memArea} fill="url(#memGradient)" />}

            {/* Polyline */}
            {isRunning && memPath && (
              <path
                d={memPath}
                fill="none"
                stroke="#e879f9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-mono">
              Server Offline · No telemetry stream
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
