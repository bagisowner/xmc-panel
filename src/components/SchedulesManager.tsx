// Component: SchedulesManager
import React from 'react';
import { Calendar, Plus } from 'lucide-react';

interface SchedulesManagerProps {
  schedules: any[];
  newSchedule: { name: string; cronExpression: string; action: string };
  setNewSchedule: React.Dispatch<React.SetStateAction<{ name: string; cronExpression: string; action: string }>>;
  createSchedule: () => void;
}

export const SchedulesManager: React.FC<SchedulesManagerProps> = ({
  schedules,
  newSchedule,
  setNewSchedule,
  createSchedule
}) => {
  return (
    <div className="p-6 rounded-3xl glass-panel space-y-4 border border-purple-500/20 shadow-xl bg-black/20">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-5 h-5 text-purple-400" />
        <h3 className="text-base font-bold text-white">Cron Schedules & Automated Tasks</h3>
      </div>
      <div className="flex flex-wrap gap-2.5 items-center">
        <input
          type="text"
          placeholder="Schedule Name (e.g. Daily Restart)"
          value={newSchedule.name}
          onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1 min-w-[150px]"
        />
        <input
          type="text"
          placeholder="Cron (e.g. 0 4 * * *)"
          value={newSchedule.cronExpression}
          onChange={(e) => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
          className="px-3 py-2 text-xs font-mono glass-input rounded-xl text-white w-36"
        />
        <select
          value={newSchedule.action}
          onChange={(e) => setNewSchedule({ ...newSchedule, action: e.target.value })}
          className="px-3 py-2 text-xs glass-input rounded-xl text-white"
        >
          <option value="restart">Restart Server</option>
          <option value="stop">Stop Server</option>
          <option value="backup">Generate Backup</option>
        </select>
        <button
          onClick={createSchedule}
          className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Schedule</span>
        </button>
      </div>
      
      <div className="divide-y divide-white/5 mt-4">
        {schedules.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs italic">
            No automated schedules created yet.
          </div>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white block">{s.name}</span>
                <span className="text-zinc-400 font-mono text-[10px]">Expression: {s.cronExpression}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950/60 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wider font-mono">
                {s.action}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
