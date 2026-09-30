// Component: ConsoleViewer
import React from 'react';
import { Search } from 'lucide-react';

interface ConsoleViewerProps {
  serverDetails: any;
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
}

export const ConsoleViewer: React.FC<ConsoleViewerProps> = ({
  serverDetails,
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
  handleConsoleKeyDown
}) => {
  return (
    /* Console Card */
    <div className="rounded-3xl glass-panel overflow-hidden flex flex-col h-[560px] min-h-0 shadow-2xl border border-purple-500/25">
      {/* Console Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-purple-950/40 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          </div>
          <span className="text-xs font-mono text-purple-200 font-semibold">
            bash · minecraft-daemon @ 127.0.0.1:{serverDetails?.primaryPort || 25565}
          </span>
        </div>

        {/* Controls & Connection Status */}
        <div className="flex items-center gap-3">
          {/* Real WebSocket status badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950/60 border border-purple-400/30 text-[11px] font-mono shadow-sm">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={wsConnected ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
              {wsConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={consoleSearch}
              onChange={(e) => setConsoleSearch(e.target.value)}
              className="pl-8 pr-3 py-1 text-[11px] glass-input rounded-lg text-white placeholder-zinc-400 focus:outline-none"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
              autoScroll
                ? 'bg-purple-600/30 text-purple-200 border-purple-400/40 shadow-sm'
                : 'bg-purple-950/40 text-zinc-300 border-purple-500/20'
            }`}
          >
            Auto-Scroll
          </button>

          {/* Clear Console */}
          <button
            type="button"
            onClick={() => setConsoleLogs([])}
            className="px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 rounded-lg transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Console Output Area (Brighter background, improved text contrast) */}
      <div
        ref={consoleViewportRef}
        onScroll={handleConsoleScroll}
        className="flex-1 min-h-0 p-4 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-purple-900 bg-[#0e0a22]/85 select-text relative"
      >
        {filteredConsoleLogs.length === 0 ? (
          <div className="text-zinc-400 text-center py-20 italic">
            No log streams recorded. Start server to view live console output.
          </div>
        ) : (
          filteredConsoleLogs.map((log, index) => {
            // Highlight TPS output with vibrant green badge on numbers
            if (log.includes('TPS from last') || log.includes('Current TPS')) {
              const parts = log.split(/(TPS from last [^:]*:\s*|Current TPS\s*=\s*)/);
              if (parts.length >= 3) {
                return (
                  <div key={index} className="leading-relaxed whitespace-pre-wrap text-zinc-300 flex flex-wrap items-center gap-1.5 py-0.5">
                    <span>{parts[0]}</span>
                    <span className="text-zinc-200">{parts[1]}</span>
                    <span className="text-emerald-400 font-bold font-mono text-xs drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-400/50 shadow-sm shadow-emerald-500/20">
                      {parts[2]}
                    </span>
                  </div>
                );
              }
              return (
                <div key={index} className="leading-relaxed whitespace-pre-wrap text-emerald-400 font-bold drop-shadow-sm py-0.5">
                  {log}
                </div>
              );
            }

            // Highlight Tick time / MSPT lines
            if (log.includes('Tick time:') || log.includes('Current MSPT:')) {
              return (
                <div key={index} className="leading-relaxed whitespace-pre-wrap text-emerald-300 font-semibold py-0.5">
                  {log}
                </div>
              );
            }

            let colorClass = 'text-zinc-100';
            if (log.includes('[ERROR]') || log.includes('Exception') || log.includes('FATAL')) {
              colorClass = 'text-rose-400 font-semibold drop-shadow-sm';
            } else if (log.includes('[WARN]') || log.includes('WARNING')) {
              colorClass = 'text-amber-300 font-medium';
            } else if (log.includes('[Panel System]') || log.includes('[Panel]')) {
              colorClass = 'text-purple-300 font-semibold';
            } else if (log.includes('ConsoleInput') || log.startsWith('>')) {
              colorClass = 'text-cyan-300 font-bold';
            } else if (log.includes('Done (') || log.includes('For help, type "help"')) {
              colorClass = 'text-emerald-300 font-semibold';
            }

            return (
              <div key={index} className={`leading-relaxed whitespace-pre-wrap ${colorClass}`}>
                {log}
              </div>
            );
          })
        )}

        {/* Floating Scroll Indicator Button */}
        {!autoScroll && filteredConsoleLogs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              const el = consoleViewportRef.current;
              if (el) {
                el.scrollTop = el.scrollHeight;
              }
            }}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-full shadow-lg border border-purple-400/40 animate-bounce cursor-pointer"
          >
            ↓ New Logs
          </button>
        )}
      </div>

      {/* Quick Command Chips */}
      <div className="px-3 py-2 bg-purple-950/40 border-t border-purple-500/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-purple-300 font-semibold uppercase font-mono mr-1">Quick:</span>
        {['help', 'list', 'tps', 'whitelist on', 'save-all', 'op admin'].map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => sendQuickCommand(cmd)}
            className="px-2.5 py-0.5 text-[11px] font-mono bg-purple-950/60 hover:bg-purple-900/80 hover:text-purple-100 hover:border-purple-400/50 border border-purple-500/30 rounded text-purple-200 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Command Input Box */}
      <form onSubmit={sendConsoleCommand} className="p-3 bg-[#130d2e]/90 border-t border-purple-500/25 flex items-center gap-2">
        <span className="text-purple-300 font-mono font-bold pl-2 text-sm">&gt;</span>
        <input
          ref={commandInputRef}
          type="text"
          placeholder="Type a Minecraft command (e.g. op, whitelist, tp, gamemode, help)..."
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleConsoleKeyDown}
          className="flex-1 bg-transparent text-xs font-mono text-white placeholder-zinc-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 disabled:opacity-40 rounded-xl transition-all shadow-md cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
};
