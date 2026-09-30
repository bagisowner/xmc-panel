// Component: BackupManager
import React from 'react';
import { Download, Trash2 } from 'lucide-react';

interface BackupManagerProps {
  backups: any[];
  createBackup: () => void;
  downloadBackup: (b: any) => void;
  restoreBackup: (bId: string) => void;
  deleteBackup: (bId: string) => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  backups,
  createBackup,
  downloadBackup,
  restoreBackup,
  deleteBackup
}) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-5 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">World & Server Backups</h3>
          <p className="text-xs text-zinc-400">Generate full compressed archives of your world files and configurations.</p>
        </div>
        <button
          onClick={createBackup}
          className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md cursor-pointer"
        >
          + Create Backup
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {backups.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 text-xs">
            No backup archives generated yet.
          </div>
        ) : (
          backups.map((b) => (
            <div key={b.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{b.name}</div>
                <div className="text-xs text-zinc-400 font-mono">
                  {b.sizeFormatted || `${(b.sizeBytes / (1024 * 1024)).toFixed(1)} MB`} · {new Date(b.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadBackup(b)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-purple-950/80 border border-purple-400/50 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-purple-200" /> Download .tar.gz
                </button>
                <button
                  onClick={() => restoreBackup(b.id)}
                  className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition cursor-pointer"
                >
                  Restore
                </button>
                <button
                  onClick={() => deleteBackup(b.id)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
