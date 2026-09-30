// Component: PortsManager
import React from 'react';
import { Globe } from 'lucide-react';

interface PortsManagerProps {
  serverDetails: any;
  newPortNumber: string;
  setNewPortNumber: (val: string) => void;
  newPortLabel: string;
  setNewPortLabel: (val: string) => void;
  allocateExtraPort: () => void;
  allocatingPort: boolean;
  releaseExtraPort: (port: number) => void;
}

export const PortsManager: React.FC<PortsManagerProps> = ({
  serverDetails,
  newPortNumber,
  setNewPortNumber,
  newPortLabel,
  setNewPortLabel,
  allocateExtraPort,
  allocatingPort,
  releaseExtraPort
}) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-5 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-purple-400" />
        <h3 className="text-base font-bold text-white">Port Allocations & Network Bindings</h3>
      </div>
      <div className="flex flex-wrap gap-2.5 items-center">
        <input
          type="number"
          placeholder="Port (e.g. 25566)"
          value={newPortNumber}
          onChange={(e) => setNewPortNumber(e.target.value)}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white w-40"
        />
        <input
          type="text"
          placeholder="Label (e.g. Dynmap, Votifier)"
          value={newPortLabel}
          onChange={(e) => setNewPortLabel(e.target.value)}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1 min-w-[150px]"
        />
        <button
          onClick={allocateExtraPort}
          disabled={allocatingPort || !newPortNumber}
          className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-40"
        >
          {allocatingPort ? 'Assigning...' : 'Assign Port'}
        </button>
      </div>

      <div className="divide-y divide-white/5 mt-4">
        {(serverDetails?.ports || []).map((alloc: any) => (
          <div key={alloc.port} className="py-3 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="font-bold text-white">:{alloc.port}</span>
              <span className="text-zinc-400 ml-2">({alloc.label})</span>
            </div>
            {alloc.isPrimary ? (
              <span className="px-2.5 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider font-mono">
                Primary Port
              </span>
            ) : (
              <button
                onClick={() => releaseExtraPort(alloc.port)}
                className="text-rose-400 hover:text-rose-300 hover:underline transition cursor-pointer"
              >
                Release
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
