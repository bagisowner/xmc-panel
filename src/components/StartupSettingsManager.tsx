// Component: StartupSettingsManager
import React from 'react';
import { Layers, Check, Settings } from 'lucide-react';

interface StartupSettingsManagerProps {
  serverDetails: any;
  editingStartup: any;
  setEditingStartup: any;
  saveStartupSettings: () => void;
}

export const StartupSettingsManager: React.FC<StartupSettingsManagerProps> = ({
  serverDetails,
  editingStartup,
  setEditingStartup,
  saveStartupSettings
}) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-5 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-base font-bold text-white">Java & Startup Arguments</h3>
            <p className="text-xs text-zinc-400">Configure Java runtime environment and memory limits.</p>
          </div>
        </div>
        <button
          onClick={saveStartupSettings}
          className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-md cursor-pointer"
        >
          Save Configuration
        </button>
      </div>

      {/* CONNECTED INFRASTRUCTURE STACK (Requirements #3 & #7) */}
      <div className="p-4 bg-black/40 border border-purple-500/20 rounded-2xl space-y-3">
        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-purple-400" /> Connected Infrastructure Stack
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-zinc-400 font-mono uppercase">Java Runtime</div>
            <div className="font-bold text-white flex items-center gap-1">
              <span>OpenJDK {serverDetails?.javaVersion || '21'}</span>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate">/usr/lib/jvm/java-{serverDetails?.javaVersion || '21'}-openjdk</div>
          </div>
          <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-zinc-400 font-mono uppercase">Docker Container</div>
            <div className="font-bold text-purple-300 font-mono truncate">mc-server-{serverDetails?.id?.slice(0, 8)}</div>
            <div className="text-[10px] text-zinc-500 font-mono">Image: eclipse-temurin:{serverDetails?.javaVersion || '21'}-jre</div>
          </div>
          <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
            <div className="text-[10px] text-zinc-400 font-mono uppercase">Port Allocation</div>
            <div className="font-bold text-emerald-400 font-mono">127.0.0.1:{serverDetails?.primaryPort || 25565}</div>
            <div className="text-[10px] text-zinc-500 font-mono">Protocol: TCP/UDP Minecraft</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-zinc-300 mb-1 block">Java Runtime</label>
          <select
            value={editingStartup.javaVersion}
            onChange={(e) => setEditingStartup({ ...editingStartup, javaVersion: e.target.value })}
            className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white cursor-pointer animate-none focus:outline-none"
          >
            <option value="21">Adoptium OpenJDK 21 (LTS - Recommended)</option>
            <option value="17">Adoptium OpenJDK 17 (Legacy 1.18 - 1.20)</option>
            <option value="25">OpenJDK 25 (Latest Frontier)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300 mb-1 block">Startup Command</label>
          <input
            type="text"
            value={editingStartup.startupCommand}
            onChange={(e) => setEditingStartup({ ...editingStartup, startupCommand: e.target.value })}
            className="w-full px-3 py-2 text-xs font-mono glass-input rounded-xl text-white"
          />
        </div>
      </div>
    </div>
  );
};
