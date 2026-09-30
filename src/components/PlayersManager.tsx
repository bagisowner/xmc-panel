// Component: PlayersManager
import React from 'react';
import { Users } from 'lucide-react';

interface PlayersManagerProps {
  serverDetails: any;
}

export const PlayersManager: React.FC<PlayersManagerProps> = ({ serverDetails }) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-4 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-purple-400" />
        <h3 className="text-base font-bold text-white">Connected Players & Operators</h3>
      </div>
      <p className="text-xs text-zinc-400">Manage real-time players, operators, and whitelisted members.</p>
      <div className="p-12 text-center text-zinc-500 text-xs">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-400 animate-pulse" />
        <span>No players currently connected. Start server to monitor active player sessions.</span>
      </div>
    </div>
  );
};
