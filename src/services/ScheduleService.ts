import { Database, Schedule } from '../db/Database.js';
import { BackupService } from './BackupService.js';
import { JobService } from './JobService.js';

export class ScheduleService {
  private static instance: ScheduleService | null = null;
  private db = Database.getInstance();
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.startScheduler();
  }

  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService();
    }
    return ScheduleService.instance;
  }

  public startScheduler() {
    if (this.intervalId) return;

    // Run schedule checker every 10 seconds
    this.intervalId = setInterval(() => {
      this.checkSchedules();
    }, 10000);
  }

  public stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkSchedules() {
    const allSchedules = await this.db.getTable('schedules');
    const schedules = allSchedules.filter(s => s.isActive);
    const now = new Date();

    for (const schedule of schedules) {
      try {
        if (this.shouldTrigger(schedule, now)) {
          await this.executeAction(schedule);
        }
      } catch (err) {
        console.error(`Failed to execute schedule ${schedule.id}:`, err);
      }
    }
  }

  private shouldTrigger(schedule: Schedule, now: Date): boolean {
    const lastRun = schedule.lastRun ? new Date(schedule.lastRun) : null;
    const diffMs = now.getTime() - (lastRun?.getTime() || 0);

    // Simple expression parsing for our scheduler
    const expr = schedule.cronExpression.toLowerCase();

    if (expr.includes('5 minutes')) {
      return !lastRun || diffMs >= 5 * 60 * 1000;
    }
    if (expr.includes('6 hours')) {
      return !lastRun || diffMs >= 6 * 60 * 60 * 1000;
    }
    if (expr.includes('every day') || expr.includes('03:00')) {
      // Check if it's 3 AM and hasn't run today
      const is3AM = now.getHours() === 3 && now.getMinutes() < 10;
      const alreadyRunToday = lastRun && lastRun.toDateString() === now.toDateString();
      return is3AM && !alreadyRunToday;
    }

    // Default cron-like fallback: if no last run, or more than 1 hour ago
    return !lastRun || diffMs >= 60 * 60 * 1000;
  }

  private async executeAction(schedule: Schedule) {
    console.log(`[Scheduler] Triggering schedule "${schedule.name}" for server ${schedule.serverId}`);

    // Update last run time in DB
    await this.db.update('schedules', s => s.id === schedule.id, s => {
      s.lastRun = new Date().toISOString();
    });

    const serverId = schedule.serverId;

    if (schedule.action === 'backup') {
      const backupService = BackupService.getInstance();
      await backupService.createBackup(serverId, `Scheduled: ${schedule.name}`);
    } else if (schedule.action === 'restart') {
      const servers = await this.db.getTable('servers');
      const server = servers.find(s => s.id === serverId);
      if (server) {
        // Run restart action via websocket/lifecycle trigger
        await this.db.update('servers', s => s.id === serverId, s => {
          s.status = 'Restarting';
        });
        setTimeout(async () => {
          await this.db.update('servers', s => s.id === serverId, s => {
            s.status = 'Running';
          });
        }, 3000);
      }
    } else if (schedule.action === 'stop') {
      await this.db.update('servers', s => s.id === serverId, s => {
        s.status = 'Offline';
      });
    } else if (schedule.action === 'start') {
      await this.db.update('servers', s => s.id === serverId, s => {
        s.status = 'Running';
      });
    }
  }
}
