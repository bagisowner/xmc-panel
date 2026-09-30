// Component: AdminNodes
import React, { useState, useEffect } from 'react';
import { 
  Plus, Network, Server, Cpu, HardDrive, Wifi, ShieldCheck, 
  Terminal, Settings, RefreshCw, Layers, MapPin, Trash2, CheckCircle2, AlertTriangle, Copy, Check
} from 'lucide-react';

interface AdminNodesProps {
  setShowCreateNodeModal: (val: boolean) => void;
  token?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminNodes: React.FC<AdminNodesProps> = ({
  setShowCreateNodeModal,
  token,
  showToast
}) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/nodes', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
      }
    } catch (err) {
      console.error('Failed to fetch nodes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handlePingNode = async (nodeId: string) => {
    setPingingId(nodeId);
    try {
      const res = await fetch(`/api/admin/nodes/${nodeId}/ping`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (showToast) showToast(`Node ${nodeId} heartbeat successful (${data.latencyMs}ms)`, 'success');
        fetchNodes();
      } else {
        if (showToast) showToast('Failed to ping node daemon', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Node daemon unreachable', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm('Are you sure you want to remove this node from PostgreSQL?')) return;
    try {
      const res = await fetch(`/api/admin/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        if (showToast) showToast('Node removed successfully', 'success');
        fetchNodes();
      } else {
        if (showToast) showToast('Failed to delete node', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error deleting node', 'error');
    }
  };

  const copyInstallCommand = (node: any) => {
    const tokenArg = node.pairingToken ? ` --pairing-token ${node.pairingToken}` : '';
    const cmd = `curl -fsSL https://ais-dev-7a7idwpopqsbrjzj22ixgt-228418918684.asia-east1.run.app/install.sh | sudo bash -s --${tokenArg}`;
    navigator.clipboard.writeText(cmd);
    setCopiedId(node.id);
    if (showToast) showToast('Secure one-time pairing command copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Node Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10 bg-gradient-to-br from-purple-950/20 via-black/25 to-black/35 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-950/40">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold uppercase tracking-wider font-mono">
                PostgreSQL & Node Agent Fleet
              </span>
              <span className="text-xs text-zinc-400">· {nodes.length} Registered Nodes</span>
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">Production Node Infrastructure</h3>
            <p className="text-xs text-zinc-400">Real-time hardware telemetry, automatic secure pairing, and systemd agent verification</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchNodes}
            className="px-3.5 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            title="Refresh Nodes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateNodeModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Node</span>
          </button>
        </div>
      </div>

      {/* Node Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {nodes.map((node) => {
          const isOnline = node.status === 'ONLINE';
          const isPending = node.status === 'PENDING_INSTALLATION';
          const ramPercent = Math.round(((node.allocatedMemoryGb || 0) / (node.maxMemoryGb || 32)) * 100);
          const cpuPercent = Math.round(((node.allocatedCpuCores || 0) / (node.maxCpuCores || 8)) * 100);
          const diskPercent = Math.round(((node.allocatedDiskGb || 0) / (node.maxDiskGb || 200)) * 100);

          return (
            <div
              key={node.id}
              className="rounded-3xl glass-panel border border-purple-500/20 overflow-hidden shadow-2xl bg-gradient-to-br from-[#120a2e]/50 via-black/40 to-black/50 hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Header Area */}
                <div className="p-5 border-b border-purple-500/10 bg-purple-950/20 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-950/40">
                      <Network className={`w-6 h-6 ${isOnline ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-white tracking-tight">{node.name}</h4>
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-md flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {node.location || 'Global'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>{node.ipAddress || '127.0.0.1'}</span>
                        <span>·</span>
                        <span className="text-zinc-500">{node.daemonStatus || node.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Connection Badges */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[11px] font-mono font-extrabold rounded-lg flex items-center gap-1.5 shadow-sm ${
                      isOnline 
                        ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 shadow-emerald-500/10'
                        : isPending
                        ? 'text-amber-400 bg-amber-950/80 border border-amber-500/30 shadow-amber-500/10 animate-pulse'
                        : 'text-rose-400 bg-rose-950/80 border border-rose-500/30 shadow-rose-500/10'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : isPending ? 'bg-amber-400' : 'bg-rose-400'}`} />
                      {node.status}
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 rounded-lg flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      TLS
                    </span>
                  </div>
                </div>

                {/* Pending Installation Banner or Real-time Allocation Statistics */}
                {isPending ? (
                  <div className="p-6 space-y-4 bg-amber-950/10 border-b border-amber-500/10">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Waiting for agent installation & connection...</span>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Run this installation command on your target VPS as root (`sudo`) to install the agent, JDK 17/21/25, Docker, and systemd service:
                    </p>
                    <div className="p-3 bg-zinc-950 border border-amber-500/20 rounded-xl font-mono text-[11px] text-amber-200 overflow-x-auto flex items-center justify-between gap-2">
                      <span className="select-all">
                        curl -fsSL https://ais-dev-7a7idwpopqsbrjzj22ixgt-228418918684.asia-east1.run.app/install.sh | sudo bash -s -- --pairing-token {node.pairingToken || 'PENDING_TOKEN'}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyInstallCommand(node)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {copiedId === node.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === node.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[10px] font-bold text-purple-300 uppercase tracking-wider font-mono">Hardware & Resource Allocations</h5>
                      <span className="text-[10px] font-mono text-zinc-400">UUID: {node.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* RAM Allocation Progress */}
                      <div className="space-y-2 p-3.5 bg-black/30 border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                            <span>RAM</span>
                          </div>
                          <span className="font-mono text-white text-[11px]">{ramPercent}%</span>
                        </div>
                        <div className="text-sm font-extrabold text-white font-mono">{node.allocatedMemoryGb || 0} GB / {node.maxMemoryGb || 32} GB</div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${Math.min(ramPercent, 100)}%` }} />
                        </div>
                      </div>

                      {/* CPU Core mapping */}
                      <div className="space-y-2 p-3.5 bg-black/30 border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                            <span>CPU Cores</span>
                          </div>
                          <span className="font-mono text-white text-[11px]">{cpuPercent}%</span>
                        </div>
                        <div className="text-sm font-extrabold text-white font-mono">{node.allocatedCpuCores || 0} / {node.maxCpuCores || 8} Cores</div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full" style={{ width: `${Math.min(cpuPercent, 100)}%` }} />
                        </div>
                      </div>

                      {/* Storage Capacity */}
                      <div className="space-y-2 p-3.5 bg-black/30 border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-pink-400" />
                            <span>Disk Pool</span>
                          </div>
                          <span className="font-mono text-white text-[11px]">{diskPercent}%</span>
                        </div>
                        <div className="text-sm font-extrabold text-white font-mono">{node.allocatedDiskGb || 0} / {node.maxDiskGb || 200} GB</div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                          <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full" style={{ width: `${Math.min(diskPercent, 100)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* JDK Runtime Status Badges */}
                    <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-300">Java Runtimes:</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> JDK 17 ✓
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> JDK 21 ✓
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> JDK 25 ✓
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">Docker v26.0+</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Daemon Management Actions Footer */}
              <div className="p-4 bg-purple-950/15 border-t border-purple-500/10 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 font-mono text-[10px] text-purple-300 bg-purple-500/5 px-2.5 py-1 rounded-lg border border-purple-500/20">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Port Range: {node.portRange || '25565-25700'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyInstallCommand(node)}
                    className="px-3 py-1.5 text-[11px] font-semibold text-cyan-200 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-400/30 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    title="Copy Automated Pairing Script Command"
                  >
                    {copiedId === node.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-300" />}
                    <span>Pair Script</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePingNode(node.id)}
                    disabled={pingingId === node.id}
                    className="px-3 py-1.5 text-[11px] font-bold text-purple-200 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingingId === node.id ? 'animate-spin text-purple-400' : 'text-purple-300'}`} />
                    <span>{pingingId === node.id ? 'PINGING...' : 'PING'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteNode(node.id)}
                    className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-xl transition cursor-pointer"
                    title="Delete Node from PostgreSQL"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
