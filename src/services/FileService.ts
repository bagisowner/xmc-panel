import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MetricsService } from './MetricsService.js';

const execFileAsync = promisify(execFile);

export interface FileItem {
  name: string;
  size: number;
  isDirectory: boolean;
  mtime: string;
  type: string;
  permissions?: string;
}

export class FileService {
  private static instance: FileService | null = null;
  private storageRoot: string;

  private constructor() {
    // Workspace persistent storage directory
    this.storageRoot = path.resolve(process.cwd(), 'storage', 'servers');
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }

    // Migrate existing server files from /srv/minecraft/servers if present
    const oldPath = '/srv/minecraft/servers';
    if (fs.existsSync(oldPath)) {
      try {
        const entries = fs.readdirSync(oldPath);
        for (const entry of entries) {
          const oldEntry = path.join(oldPath, entry);
          const newEntry = path.join(this.storageRoot, entry);
          if (!fs.existsSync(newEntry)) {
            fs.cpSync(oldEntry, newEntry, { recursive: true });
            console.log(`[FileService] Migrated server files from ${oldEntry} to ${newEntry}`);
          }
        }
      } catch (err: any) {
        console.warn('[FileService] Notice migrating server files:', err.message);
      }
    }
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  public getStorageRoot(): string {
    return this.storageRoot;
  }

  /**
   * Safely resolve a path relative to a server's root.
   * Throws an error if path traversal is detected.
   */
  public resolvePath(serverId: string, relativePath: string): string {
    let serverRoot = path.resolve(this.storageRoot, serverId);

    // If serverRoot doesn't exist, check if serverId matches a server name or ID in db
    if (!fs.existsSync(serverRoot)) {
      try {
        const primaryDb = path.join(process.cwd(), 'db.json');
        const storageDb = path.join(process.cwd(), 'storage', 'db.json');
        const activeDb = fs.existsSync(primaryDb) ? primaryDb : (fs.existsSync(storageDb) ? storageDb : null);
        if (activeDb) {
          const dbData = JSON.parse(fs.readFileSync(activeDb, 'utf8'));
          const match = (dbData.servers || []).find((s: any) => s.id === serverId || s.name === serverId);
          if (match) {
            const candidate = path.resolve(this.storageRoot, match.id);
            if (fs.existsSync(candidate)) {
              serverRoot = candidate;
            }
          }
        }
      } catch {
        // Use default path
      }
    }
    
    // Ensure server folder itself exists
    if (!fs.existsSync(serverRoot)) {
      fs.mkdirSync(serverRoot, { recursive: true });
    }

    // Treat blank or leading slash as root
    const normalizedRelative = relativePath ? relativePath.replace(/^[\/\\]+/, '') : '';
    const resolvedPath = path.resolve(serverRoot, normalizedRelative);

    // Path traversal check
    if (!resolvedPath.startsWith(serverRoot)) {
      throw new Error('Access denied: Path traversal detected.');
    }

    return resolvedPath;
  }

  public listFiles(serverId: string, relativePath: string): FileItem[] {
    const fullPath = this.resolvePath(serverId, relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('Directory does not exist');
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      throw new Error('Target is not a directory');
    }

    const items = fs.readdirSync(fullPath);
    const result: FileItem[] = [];

    for (const item of items) {
      try {
        const itemFullPath = path.join(fullPath, item);
        const itemStat = fs.statSync(itemFullPath);
        
        let fileType = 'file';
        if (itemStat.isDirectory()) {
          fileType = 'directory';
        } else if (item.endsWith('.properties')) {
          fileType = 'properties';
        } else if (item.endsWith('.yml') || item.endsWith('.yaml')) {
          fileType = 'yaml';
        } else if (item.endsWith('.json')) {
          fileType = 'json';
        } else if (item.endsWith('.txt') || item.endsWith('.log')) {
          fileType = 'text';
        } else if (item.endsWith('.jar') || item.endsWith('.jar.disabled')) {
          fileType = 'jar';
        } else if (item.endsWith('.zip') || item.endsWith('.tar.gz') || item.endsWith('.gz')) {
          fileType = 'archive';
        } else if (item.endsWith('.png') || item.endsWith('.jpg') || item.endsWith('.ico')) {
          fileType = 'image';
        }

        result.push({
          name: item,
          size: itemStat.size,
          isDirectory: itemStat.isDirectory(),
          mtime: itemStat.mtime.toISOString(),
          type: fileType
        });
      } catch {
        // Skip unreadable files/folders
      }
    }

    // Sort: directories first, then files alphabetically
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getFileContent(serverId: string, relativePath: string): string {
    const fullPath = this.resolvePath(serverId, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error('Target is a directory');
    }

    // Cap read size to 10MB
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds maximum editable size limit (10MB)');
    }

    return fs.readFileSync(fullPath, 'utf8');
  }

  public saveFileContent(serverId: string, relativePath: string, content: string): void {
    const fullPath = this.resolvePath(serverId, relativePath);
    const parentDir = path.dirname(fullPath);
    
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public saveFileBuffer(serverId: string, relativePath: string, buffer: Buffer): void {
    const fullPath = this.resolvePath(serverId, relativePath);
    const parentDir = path.dirname(fullPath);
    
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public createFile(serverId: string, relativePath: string): void {
    const fullPath = this.resolvePath(serverId, relativePath);
    if (fs.existsSync(fullPath)) {
      throw new Error('File already exists');
    }
    this.saveFileContent(serverId, relativePath, '');
  }

  public createFolder(serverId: string, relativePath: string): void {
    const fullPath = this.resolvePath(serverId, relativePath);
    if (fs.existsSync(fullPath)) {
      throw new Error('Folder already exists');
    }
    fs.mkdirSync(fullPath, { recursive: true });
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public renameFile(serverId: string, oldRelative: string, newRelative: string): void {
    const oldPath = this.resolvePath(serverId, oldRelative);
    const newPath = this.resolvePath(serverId, newRelative);

    if (!fs.existsSync(oldPath)) {
      throw new Error('Source file or directory does not exist');
    }
    if (fs.existsSync(newPath)) {
      throw new Error('Target name already exists');
    }

    const parentDir = path.dirname(newPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.renameSync(oldPath, newPath);
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public copyFile(serverId: string, sourceRelative: string, targetRelative: string): void {
    const srcPath = this.resolvePath(serverId, sourceRelative);
    const destPath = this.resolvePath(serverId, targetRelative);

    if (!fs.existsSync(srcPath)) {
      throw new Error('Source path does not exist');
    }

    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public moveFile(serverId: string, sourceRelative: string, targetRelative: string): void {
    this.renameFile(serverId, sourceRelative, targetRelative);
  }

  public deleteFile(serverId: string, relativePath: string): void {
    const fullPath = this.resolvePath(serverId, relativePath);
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  /**
   * Archives selected files/directories into a ZIP file safely using Python zipfile
   */
  public async zipFiles(serverId: string, relativePaths: string[], outputZipName: string, currentDir = ''): Promise<string> {
    const serverRoot = path.resolve(this.storageRoot, serverId);
    const targetDir = this.resolvePath(serverId, currentDir);
    const outZipPath = path.join(targetDir, outputZipName.endsWith('.zip') ? outputZipName : `${outputZipName}.zip`);

    const fullItems = relativePaths.map(p => this.resolvePath(serverId, p));

    const pyCode = `
import zipfile, os, sys

out_zip = sys.argv[1]
items = sys.argv[2:]

with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for item in items:
        if os.path.isdir(item):
            base_dir = os.path.dirname(item)
            for root, dirs, files in os.walk(item):
                for file in files:
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, base_dir)
                    zf.write(full_p, rel_p)
        elif os.path.isfile(item):
            zf.write(item, os.path.basename(item))
print("ZIP_SUCCESS")
`;

    const { stdout } = await execFileAsync('python3', ['-c', pyCode, outZipPath, ...fullItems]);
    if (!stdout.includes('ZIP_SUCCESS')) {
      throw new Error('Failed to create ZIP archive');
    }
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
    return outZipPath;
  }

  /**
   * Safely extracts a ZIP archive into the destination directory
   */
  public async unzipFile(serverId: string, zipRelative: string, destDirRelative = ''): Promise<void> {
    const zipPath = this.resolvePath(serverId, zipRelative);
    const destPath = this.resolvePath(serverId, destDirRelative);

    if (!fs.existsSync(zipPath)) {
      throw new Error('Archive file does not exist');
    }

    const pyCode = `
import zipfile, os, sys

zip_path = sys.argv[1]
dest_dir = sys.argv[2]
os.makedirs(dest_dir, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as zf:
    for member in zf.infolist():
        # Prevent ZipSlip (Path traversal)
        target_path = os.path.abspath(os.path.join(dest_dir, member.filename))
        if not target_path.startswith(os.path.abspath(dest_dir)):
            raise Exception(f"Unsafe zip archive entry: {member.filename}")
    zf.extractall(dest_dir)
print("UNZIP_SUCCESS")
`;

    const { stdout } = await execFileAsync('python3', ['-c', pyCode, zipPath, destPath]);
    if (!stdout.includes('UNZIP_SUCCESS')) {
      throw new Error('Failed to extract ZIP archive');
    }
    try { MetricsService.getInstance().invalidateDiskCache(serverId); } catch {}
  }

  public getFolderSize(dirPath: string): number {
    let size = 0;
    if (!fs.existsSync(dirPath)) return 0;
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return stat.size;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      try {
        const itemPath = path.join(dirPath, file);
        const itemStat = fs.statSync(itemPath);
        if (itemStat.isDirectory()) {
          size += this.getFolderSize(itemPath);
        } else {
          size += itemStat.size;
        }
      } catch {
        // Ignore unreadable items
      }
    }
    return size;
  }
}
