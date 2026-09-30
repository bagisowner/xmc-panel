import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Database } from '../db/Database.js';

export class BackupService {
  private static instance: BackupService | null = null;
  private db = Database.getInstance();
  private backupsRoot = '/srv/minecraft/backups';
  private serversRoot = '/srv/minecraft/servers';

  private constructor() {
    if (!fs.existsSync(this.backupsRoot)) {
      try {
        fs.mkdirSync(this.backupsRoot, { recursive: true });
      } catch (err: any) {
        console.error(`[BackupService] Failed to create /srv/minecraft/backups:`, err.message);
        this.backupsRoot = path.resolve(process.cwd(), 'storage/backups');
        if (!fs.existsSync(this.backupsRoot)) {
          fs.mkdirSync(this.backupsRoot, { recursive: true });
        }
      }
    }
    if (!fs.existsSync(this.serversRoot)) {
      try {
        fs.mkdirSync(this.serversRoot, { recursive: true });
      } catch (err: any) {
        console.error(`[BackupService] Failed to create /srv/minecraft/servers:`, err.message);
        this.serversRoot = path.resolve(process.cwd(), 'storage/servers');
        if (!fs.existsSync(this.serversRoot)) {
          fs.mkdirSync(this.serversRoot, { recursive: true });
        }
      }
    }
  }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  public async createBackup(serverId: string, backupName: string): Promise<string> {
    const backupId = `bk_${Date.now()}`;
    const serverDir = path.resolve(this.serversRoot, serverId);
    
    if (!fs.existsSync(serverDir)) {
      throw new Error('Server directory does not exist');
    }

    const archiveName = `${backupId}.tar.gz`;
    const archivePath = path.resolve(this.backupsRoot, archiveName);

    // Save initial backup record
    await this.db.insert('backups', {
      id: backupId,
      serverId,
      name: backupName || `Backup_${new Date().toISOString().slice(0, 10)}`,
      sizeBytes: 0,
      status: 'Creating',
      createdAt: new Date().toISOString(),
      filePath: archivePath
    });

    // Run tar creation asynchronously
    const cmd = `tar -czf "${archivePath}" -C "${serverDir}" .`;
    exec(cmd, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup ${backupId} failed:`, stderr || error.message);
        await this.db.update('backups', b => b.id === backupId, b => {
          b.status = 'Failed';
        });
      } else {
        const stats = fs.statSync(archivePath);
        await this.db.update('backups', b => b.id === backupId, b => {
          b.status = 'Completed';
          b.sizeBytes = stats.size;
          b.completedAt = new Date().toISOString();
        });
      }
    });

    return backupId;
  }

  public async restoreBackup(serverId: string, backupId: string): Promise<void> {
    const backups = await this.db.getTable('backups');
    const backup = backups.find(b => b.id === backupId && b.serverId === serverId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const serverDir = path.resolve(this.serversRoot, serverId);
    if (!fs.existsSync(backup.filePath)) {
      throw new Error('Backup file does not exist on disk');
    }

    // Update backup status during restore
    await this.db.update('backups', b => b.id === backupId, b => {
      b.status = 'Restoring';
    });

    // Run restore asynchronously
    // Clear directory first, keeping target structure
    try {
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      fs.mkdirSync(serverDir, { recursive: true });
    } catch (err: any) {
      await this.db.update('backups', b => b.id === backupId, b => {
        b.status = 'Completed';
      });
      throw new Error(`Failed to clean server directory: ${err.message}`);
    }

    const cmd = `tar -xzf "${backup.filePath}" -C "${serverDir}"`;
    exec(cmd, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Restore ${backupId} failed:`, stderr || error.message);
        await this.db.update('backups', b => b.id === backupId, b => {
          b.status = 'Failed';
        });
      } else {
        await this.db.update('backups', b => b.id === backupId, b => {
          b.status = 'Completed';
        });
      }
    });
  }

  public async deleteBackup(serverId: string, backupId: string): Promise<void> {
    const backups = await this.db.getTable('backups');
    const backup = backups.find(b => b.id === backupId && b.serverId === serverId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    if (fs.existsSync(backup.filePath)) {
      try {
        fs.unlinkSync(backup.filePath);
      } catch (err) {
        console.error('Failed to delete backup file:', err);
      }
    }

    await this.db.delete('backups', b => b.id === backupId);
  }
}
