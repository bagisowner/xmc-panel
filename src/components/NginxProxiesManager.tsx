// Component: NginxProxiesManager
import React from 'react';
import { Activity, Trash2 } from 'lucide-react';

interface NginxProxiesManagerProps {
  proxies: any[];
  newProxyDomain: string;
  setNewProxyDomain: (val: string) => void;
  newProxyPort: string;
  setNewProxyPort: (val: string) => void;
  createProxy: () => void;
  deleteProxy: (id: string) => void;
}

export const NginxProxiesManager: React.FC<NginxProxiesManagerProps> = ({
  proxies,
  newProxyDomain,
  setNewProxyDomain,
  newProxyPort,
  setNewProxyPort,
  createProxy,
  deleteProxy
}) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-5 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-5 h-5 text-purple-400" />
        <h3 className="text-base font-bold text-white">Nginx Reverse Proxy & Custom Domains</h3>
      </div>
      <div className="flex flex-wrap gap-2.5 items-center">
        <input
          type="text"
          placeholder="Domain (e.g. play.myserver.com)"
          value={newProxyDomain}
          onChange={(e) => setNewProxyDomain(e.target.value)}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1 min-w-[150px]"
        />
        <input
          type="number"
          placeholder="Port"
          value={newProxyPort}
          onChange={(e) => setNewProxyPort(e.target.value)}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white w-28"
        />
        <button
          onClick={createProxy}
          disabled={!newProxyDomain}
          className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition border border-purple-400/40 shadow-md cursor-pointer disabled:opacity-40"
        >
          Add Proxy
        </button>
      </div>

      <div className="divide-y divide-white/5 mt-4">
        {proxies.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs italic">
            No reverse proxy routings configured.
          </div>
        ) : (
          proxies.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-white font-mono">{p.domainName} &rarr; :{p.targetPort}</span>
              <button
                onClick={() => deleteProxy(p.id)}
                className="text-rose-400 hover:text-rose-300 transition cursor-pointer p-1"
                title="Remove Proxy Rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
