// Component: AdminAuditLogs
import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AdminAuditLogsProps {
  auditLogs: any[];
}

export const AdminAuditLogs: React.FC<AdminAuditLogsProps> = ({ auditLogs }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white">Audit Trail & Security Logs</h3>
          <p className="text-xs text-zinc-400">Real-time administrator action logs</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3 bg-gradient-to-br from-purple-950/20 via-black/25 to-black/35">
        {auditLogs.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">No audit records logged yet.</p>
        ) : (
          auditLogs.map((log, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-xl border border-white/5 text-xs">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-white font-medium">{log.action || log.message}</span>
              </div>
              <span className="text-zinc-500 text-[11px] font-mono">
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
