// Component: AdminOverview
import React from 'react';
import { Server as ServerIcon, Users, Network, Settings } from 'lucide-react';

interface AdminOverviewProps {
  servers: any[];
  usersList: any[];
  hostStats: any;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  servers,
  usersList,
  hostStats
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-5 glass-panel rounded-2xl border border-white/10 space-y-2 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
          <span>Total Active Servers</span>
          <ServerIcon className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">{servers.length}</div>
        <div className="text-[11px] text-emerald-400 font-medium">
          {servers.filter(s => s.status === 'Running').length} Running
        </div>
      </div>

      <div className="p-5 glass-panel rounded-2xl border border-white/10 space-y-2 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
          <span>System Users</span>
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">{usersList.length}</div>
        <div className="text-[11px] text-zinc-400">Registered Panel Accounts</div>
      </div>

      <div className="p-5 glass-panel rounded-2xl border border-white/10 space-y-2 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
          <span>Node Infrastructure</span>
          <Network className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">1 Node Online</div>
        <div className="text-[11px] text-purple-300">Default Local Daemon</div>
      </div>

      <div className="p-5 glass-panel rounded-2xl border border-white/10 space-y-2 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
          <span>Host Hardware Memory</span>
          <Settings className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          {hostStats ? `${hostStats.ramUsedGb} / ${hostStats.ramTotalGb} GB` : 'Loading...'}
        </div>
        <div className="text-[11px] text-zinc-400">Host Hardware RAM</div>
      </div>
    </div>
  );
};
