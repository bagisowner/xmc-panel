// Component: AdminServers
import React from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';

interface AdminServersProps {
  servers: any[];
  adminServerSearch: string;
  setAdminServerSearch: (val: string) => void;
  setShowWizard: (val: boolean) => void;
  setWizardStep: (step: number) => void;
  onSelectServer: (id: string) => void;
  setDeleteConfirmModalServer: (server: any) => void;
}

export const AdminServers: React.FC<AdminServersProps> = ({
  servers,
  adminServerSearch,
  setAdminServerSearch,
  setShowWizard,
  setWizardStep,
  onSelectServer,
  setDeleteConfirmModalServer
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-panel rounded-2xl border border-white/10">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search server name, software, port..."
            value={adminServerSearch}
            onChange={(e) => setAdminServerSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowWizard(true);
            setWizardStep(1);
          }}
          className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy New Server</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers
          .filter(s => s.name.toLowerCase().includes(adminServerSearch.toLowerCase()))
          .map((server) => (
            <div
              key={server.id}
              className="glass-card rounded-2xl p-5 border border-white/10 space-y-4 hover:border-purple-500/40 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{server.name}</h3>
                  <p className="text-xs text-zinc-400">{server.software} {server.version}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  server.status === 'Running'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {server.status}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-zinc-400">
                <span>Port: <strong className="text-white">{server.port}</strong></span>
                <span>RAM: <strong className="text-white">{server.memoryLimitGb} GB</strong></span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectServer(server.id)}
                  className="flex-1 py-2 text-xs font-semibold text-purple-200 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 rounded-xl transition cursor-pointer"
                >
                  Manage Server
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModalServer(server)}
                  className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-xl transition cursor-pointer"
                  title="Delete Server"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
