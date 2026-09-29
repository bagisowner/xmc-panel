import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config();

// User & Auth Interfaces
export interface AppUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: 'Admin' | 'Developer' | 'User' | 'Viewer';
  emailVerified: boolean;
  disabled: boolean;
  avatarUrl?: string;
  bio?: string;
  googleId?: string;
  emailVerificationToken?: string;
  emailVerificationExpires?: string;
  passwordResetToken?: string;
  passwordResetExpires?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface User extends AppUser {
  permissions?: string[];
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  userAgent?: string;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt: string;
  expiresAt: string;
  revoked?: boolean;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface OAuthAccount {
  id: string;
  provider: 'google';
  providerUserId: string;
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export interface ProjectApp {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreDocument {
  id: string;
  collection: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityRule {
  id: string;
  collection: string;
  allowRead: 'all' | 'authenticated' | 'owner' | 'admin';
  allowWrite: 'all' | 'authenticated' | 'owner' | 'admin';
  createdAt: string;
}

export interface AuthSettings {
  allowPasswordSignup: boolean;
  requireEmailVerification: boolean;
  passwordMinLength: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface DbMetrics {
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
}

// Minecraft Server Compatibility Interfaces
export interface Server {
  id: string;
  name: string;
  description: string;
  software: 'Vanilla' | 'Paper' | 'Purpur' | 'Spigot' | 'Fabric' | 'Forge' | 'NeoForge' | 'Velocity' | 'BungeeCord' | 'Custom' | string;
  version: string;
  javaVersion: '8' | '11' | '16' | '17' | '21' | '25' | string;
  status: 'Installing' | 'Starting' | 'Running' | 'Stopping' | 'Offline' | 'Crashed' | 'Restarting' | 'Error' | 'Suspended';
  nodeId?: string;
  nodeName?: string;
  location?: string;
  memoryLimitGb: number;
  cpuLimitCores: number;
  diskLimitGb: number;
  primaryPort: number;
  startupCommand: string;
  jvmFlags: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  activeWorld: string;
  autoRestart: 'Never' | 'OnCrash' | 'Always';
  maintenanceMode: boolean;
  startedAt?: string;
  readyAt?: string;
  stoppedAt?: string;
  lastSeenAt?: string;
  containerId?: string | null;
}

export interface Allocation {
  id: string;
  ipAddress: string;
  port: number;
  serverId: string | null;
  label: string;
  isPrimary: boolean;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  sizeBytes: number;
  status: 'Creating' | 'Completed' | 'Failed' | 'Restoring';
  createdAt: string;
  completedAt?: string;
  filePath: string;
}

export interface Job {
  id: string;
  type: 'install' | 'rebuild' | 'backup' | 'restore' | 'delete' | 'import';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  serverId: string;
  error?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  serverId: string;
  name: string;
  cronExpression: string;
  action: 'backup' | 'restart' | 'stop' | 'start';
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  username: string;
  action: string;
  serverId?: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  serverId: string;
  type: 'CPU' | 'RAM' | 'Disk';
  threshold: number;
  triggerValue: number;
  status: 'Active' | 'Resolved';
  createdAt: string;
}

export interface JavaRuntimeRecord {
  id: string;
  name: string;
  version: '17' | '21' | '25';
  major: number;
  vendor: string;
  path: string;
  directory: string;
  status: 'Installed' | 'Installing' | 'Failed';
  installedAt: string;
  sizeBytes: number;
  sizeFormatted: string;
  verification?: {
    valid: boolean;
    versionString?: string;
    vmString?: string;
    error?: string;
  };
}

export interface NodeRecord {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  description: string;
  location: string;
  country?: string;
  ipAddress?: string;
  port?: number;
  maxMemoryGb: number;
  allocatedMemoryGb: number;
  maxCpuCores: number;
  allocatedCpuCores: number;
  maxDiskGb: number;
  allocatedDiskGb: number;
  lastHeartbeat?: string;
  daemonStatus?: string;
}

export interface DbSchema {
  users: AppUser[];
  sessions: AuthSession[];
  refreshTokens: RefreshToken[];
  oauthAccounts: OAuthAccount[];
  apiKeys: ApiKey[];
  projects: ProjectApp[];
  documents: FirestoreDocument[];
  securityRules: SecurityRule[];
  authSettings: AuthSettings;
  auditLogs: AuditLog[];
  metrics: DbMetrics;
  // Minecraft Server Tables
  servers: Server[];
  allocations: Allocation[];
  backups: Backup[];
  jobs: Job[];
  schedules: Schedule[];
  auditEvents: AuditEvent[];
  alerts: Alert[];
  javaRuntimes: JavaRuntimeRecord[];
  nodes: NodeRecord[];
}

const defaultAdminPasswordHash = bcrypt.hashSync('@@##admin123', 10);

const initialDbState: DbSchema = {
  users: [
    {
      id: 'usr_admin',
      email: 'admin@craftcommand.center',
      username: 'admin',
      displayName: 'System Admin',
      passwordHash: defaultAdminPasswordHash,
      role: 'Admin',
      emailVerified: true,
      disabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }
  ],
  sessions: [],
  refreshTokens: [],
  oauthAccounts: [],
  apiKeys: [],
  projects: [
    {
      id: 'proj_default',
      name: 'Default Command Project',
      description: 'Primary production project container',
      ownerId: 'usr_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  documents: [
    {
      id: 'doc_welcome',
      collection: 'app_settings',
      data: {
        appName: 'Craft Command Center',
        version: '3.0.0-backend',
        environment: 'production',
        maintenance: false,
        maxStorageMb: 10000
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  securityRules: [
    {
      id: 'rule_default',
      collection: '*',
      allowRead: 'authenticated',
      allowWrite: 'authenticated',
      createdAt: new Date().toISOString()
    },
    {
      id: 'rule_users',
      collection: 'users',
      allowRead: 'authenticated',
      allowWrite: 'owner',
      createdAt: new Date().toISOString()
    }
  ],
  authSettings: {
    allowPasswordSignup: true,
    requireEmailVerification: false,
    passwordMinLength: 6
  },
  auditLogs: [
    {
      id: 'audit_init',
      userEmail: 'system',
      action: 'SYSTEM_BOOT',
      details: 'Craft Command Center Auth & Database Engine initialized.',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString()
    }
  ],
  metrics: {
    totalReads: 12,
    totalWrites: 5,
    totalDeletes: 0
  },
  // Minecraft Defaults
  servers: [
    {
      id: "5249517e-3027-4db3-a6a3-8e273dbead4b",
      name: "test",
      description: "Minecraft Server on storage/servers",
      software: "Paper",
      version: "1.21.1",
      javaVersion: "21",
      status: "Offline",
      memoryLimitGb: 15,
      cpuLimitCores: 6,
      diskLimitGb: 15,
      primaryPort: 25565,
      startupCommand: "java -Xms512M -Xmx15G -jar server.jar nogui",
      jvmFlags: "-XX:+UseG1GC -XX:+ParallelRefProcEnabled",
      variables: {
        acceptEula: "true",
        jarPath: "storage/servers/5249517e-3027-4db3-a6a3-8e273dbead4b/server.jar",
        installationStatus: "completed"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeWorld: "world",
      autoRestart: "OnCrash",
      maintenanceMode: false
    }
  ],
  allocations: [
    {
      id: "alloc_25565",
      ipAddress: "0.0.0.0",
      port: 25565,
      serverId: "5249517e-3027-4db3-a6a3-8e273dbead4b",
      label: "Minecraft Default",
      isPrimary: true
    }
  ],
  backups: [],
  jobs: [],
  schedules: [],
  auditEvents: [],
  alerts: [],
  javaRuntimes: [],
  nodes: [
    {
      id: "node_01",
      name: "Node 01",
      status: "ONLINE",
      description: "Primary Minecraft hosting node",
      location: "India",
      country: "India",
      ipAddress: "125.16.24.110",
      port: 8080,
      maxMemoryGb: 32,
      allocatedMemoryGb: 8,
      maxCpuCores: 16,
      allocatedCpuCores: 4,
      maxDiskGb: 500,
      allocatedDiskGb: 120,
      lastHeartbeat: new Date().toISOString(),
      daemonStatus: "Connected"
    },
    {
      id: "node_02",
      name: "Node 02",
      status: "OFFLINE",
      description: "Failover Minecraft Node",
      location: "USA",
      country: "United States",
      ipAddress: "192.168.10.22",
      port: 8080,
      maxMemoryGb: 32,
      allocatedMemoryGb: 0,
      maxCpuCores: 8,
      allocatedCpuCores: 0,
      maxDiskGb: 200,
      allocatedDiskGb: 0,
      lastHeartbeat: "2026-09-27T08:12:00.000Z",
      daemonStatus: "Unreachable"
    },
    {
      id: "node_03",
      name: "Node 03",
      status: "MAINTENANCE",
      description: "Testing and Staging Node",
      location: "Germany",
      country: "Germany",
      ipAddress: "10.0.4.15",
      port: 8080,
      maxMemoryGb: 32,
      allocatedMemoryGb: 0,
      maxCpuCores: 8,
      allocatedCpuCores: 0,
      maxDiskGb: 200,
      allocatedDiskGb: 0,
      lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
      daemonStatus: "Degraded"
    }
  ]
};

export class Database {
  private static instance: Database | null = null;
  private data: DbSchema = { ...initialDbState };
  private isInitialized = false;
  private dbFilePath: string;

  private constructor() {
    this.dbFilePath = path.join(process.cwd(), 'db.json');
    this.init();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public init(): void {
    if (this.isInitialized) return;

    try {
      if (fs.existsSync(this.dbFilePath)) {
        const fileContent = fs.readFileSync(this.dbFilePath, 'utf8');
        try {
          const parsed = JSON.parse(fileContent);
          this.data = {
            ...initialDbState,
            ...parsed,
            users: parsed.users || initialDbState.users,
            sessions: parsed.sessions || [],
            refreshTokens: parsed.refreshTokens || [],
            oauthAccounts: parsed.oauthAccounts || [],
            apiKeys: parsed.apiKeys || [],
            projects: parsed.projects || initialDbState.projects,
            documents: parsed.documents || initialDbState.documents,
            securityRules: parsed.securityRules || initialDbState.securityRules,
            authSettings: parsed.authSettings || initialDbState.authSettings,
            auditLogs: parsed.auditLogs || [],
            metrics: parsed.metrics || initialDbState.metrics,
            servers: parsed.servers || initialDbState.servers,
            allocations: parsed.allocations || initialDbState.allocations,
            backups: parsed.backups || [],
            jobs: parsed.jobs || [],
            schedules: parsed.schedules || [],
            auditEvents: parsed.auditEvents || [],
            alerts: parsed.alerts || [],
            javaRuntimes: parsed.javaRuntimes || [],
            nodes: parsed.nodes || initialDbState.nodes
          };
          const adminUser = (this.data.users || []).find(u => u.username === 'admin' || u.id === 'usr_admin');
          if (adminUser) {
            adminUser.passwordHash = defaultAdminPasswordHash;
            adminUser.role = 'Admin';
            adminUser.disabled = false;
          } else {
            this.data.users.push({
              id: 'usr_admin',
              email: 'admin@craftcommand.center',
              username: 'admin',
              displayName: 'System Admin',
              passwordHash: defaultAdminPasswordHash,
              role: 'Admin',
              emailVerified: true,
              disabled: false,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            });
          }
          this.saveToFile();
          console.log('[Database] Loaded existing database file successfully and updated admin password.');
        } catch (err) {
          console.error('[Database] Error parsing db.json, maintaining state.', err);
          this.data = JSON.parse(JSON.stringify(initialDbState));
          this.saveToFile();
        }
      } else {
        console.log('[Database] db.json does not exist. Creating fresh database schema.');
        this.data = JSON.parse(JSON.stringify(initialDbState));
        this.saveToFile();
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[Database] Failed to initialize database:', err);
      this.data = JSON.parse(JSON.stringify(initialDbState));
    }
  }

  public saveToFile(): void {
    try {
      const jsonStr = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.dbFilePath, jsonStr, 'utf8');

      const storageDbDir = path.join(process.cwd(), 'storage');
      if (fs.existsSync(storageDbDir)) {
        fs.writeFileSync(path.join(storageDbDir, 'db.json'), jsonStr, 'utf8');
      }
    } catch (err) {
      console.error('[Database] Failed to save database to file:', err);
    }
  }

  public getData(): DbSchema {
    return this.data;
  }

  // Generic DB methods for compatibility
  public getTable<K extends keyof DbSchema>(tableName: K): DbSchema[K] {
    if (!this.data[tableName]) {
      (this.data as any)[tableName] = [];
    }
    return this.data[tableName];
  }

  public insert<K extends keyof DbSchema>(tableName: K, record: any): void {
    const table = this.getTable(tableName);
    if (Array.isArray(table)) {
      table.push(record);
      this.saveToFile();
    }
  }

  public update<T = any>(
    tableName: keyof DbSchema,
    predicate: (item: T) => boolean,
    patchOrUpdater: Partial<T> | ((item: T) => void)
  ): void {
    const table = this.getTable(tableName as keyof DbSchema);
    if (Array.isArray(table)) {
      for (const item of table) {
        if (predicate(item as T)) {
          if (typeof patchOrUpdater === 'function') {
            (patchOrUpdater as (item: T) => void)(item as T);
          } else if (patchOrUpdater && typeof patchOrUpdater === 'object') {
            Object.assign(item, patchOrUpdater);
          }
        }
      }
      this.saveToFile();
    }
  }

  public delete<T = any>(
    tableName: keyof DbSchema,
    predicate: (item: T) => boolean
  ): void {
    const table = this.getTable(tableName as keyof DbSchema);
    if (Array.isArray(table)) {
      const filtered = table.filter(item => !predicate(item as T));
      (this.data as any)[tableName] = filtered;
      this.saveToFile();
    }
  }

  // User queries & mutations
  public getUsers(): AppUser[] {
    return this.data.users || [];
  }

  public getUserById(id: string): AppUser | undefined {
    return this.getUsers().find(u => u.id === id);
  }

  public getUserByEmail(email: string): AppUser | undefined {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  public getUserByUsername(username: string): AppUser | undefined {
    return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  }

  public getUserByGoogleId(googleId: string): AppUser | undefined {
    return this.getUsers().find(u => u.googleId === googleId);
  }

  public addUser(user: AppUser): void {
    this.data.users.push(user);
    this.saveToFile();
  }

  public updateUser(id: string, updates: Partial<AppUser>): AppUser | null {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.saveToFile();
    return user;
  }

  public deleteUser(id: string): boolean {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    this.data.sessions = this.data.sessions.filter(s => s.userId !== id);
    this.data.refreshTokens = this.data.refreshTokens.filter(rt => rt.userId !== id);
    this.data.apiKeys = this.data.apiKeys.filter(k => k.userId !== id);
    this.saveToFile();
    return true;
  }

  // Session management
  public getSessions(): AuthSession[] {
    return this.data.sessions || [];
  }

  public getSessionsForUser(userId: string): AuthSession[] {
    const now = new Date();
    return this.getSessions().filter(s => s.userId === userId && !s.revoked && new Date(s.expiresAt) > now);
  }

  public addSession(session: AuthSession): void {
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions.push(session);
    this.saveToFile();
  }

  public getSessionByToken(token: string): AuthSession | undefined {
    const now = new Date();
    return this.getSessions().find(s => s.token === token && !s.revoked && new Date(s.expiresAt) > now);
  }

  public revokeSession(tokenIdOrId: string): boolean {
    const session = this.data.sessions.find(s => s.id === tokenIdOrId || s.token === tokenIdOrId);
    if (!session) return false;
    session.revoked = true;
    this.saveToFile();
    return true;
  }

  public revokeAllSessionsForUser(userId: string, exceptToken?: string): void {
    for (const session of this.getSessions()) {
      if (session.userId === userId && session.token !== exceptToken) {
        session.revoked = true;
      }
    }
    this.saveToFile();
  }

  // OAuth Account Links
  public getOAuthAccount(provider: 'google', providerUserId: string): OAuthAccount | undefined {
    return (this.data.oauthAccounts || []).find(o => o.provider === provider && o.providerUserId === providerUserId);
  }

  public addOAuthAccount(account: OAuthAccount): void {
    if (!this.data.oauthAccounts) this.data.oauthAccounts = [];
    this.data.oauthAccounts.push(account);
    this.saveToFile();
  }

  // API Key Management
  public getApiKeys(userId?: string): ApiKey[] {
    const keys = this.data.apiKeys || [];
    if (userId) {
      return keys.filter(k => k.userId === userId);
    }
    return keys;
  }

  public addApiKey(apiKey: ApiKey): void {
    if (!this.data.apiKeys) this.data.apiKeys = [];
    this.data.apiKeys.push(apiKey);
    this.saveToFile();
  }

  public revokeApiKey(id: string, userId: string): boolean {
    const key = (this.data.apiKeys || []).find(k => k.id === id && k.userId === userId);
    if (!key) return false;
    key.revoked = true;
    this.saveToFile();
    return true;
  }

  public verifyApiKey(rawKey: string): ApiKey | null {
    if (!rawKey) return null;
    const prefix = rawKey.substring(0, 10);
    const keys = (this.data.apiKeys || []).filter(k => !k.revoked && k.keyPrefix === prefix);
    
    for (const k of keys) {
      if (bcrypt.compareSync(rawKey, k.keyHash)) {
        k.lastUsedAt = new Date().toISOString();
        this.saveToFile();
        return k;
      }
    }
    return null;
  }

  // Document Operations
  public getCollections(): string[] {
    const set = new Set<string>();
    for (const doc of this.data.documents) {
      set.add(doc.collection);
    }
    return Array.from(set).sort();
  }

  public getDocuments(collection: string): FirestoreDocument[] {
    this.data.metrics.totalReads++;
    this.saveToFile();
    return (this.data.documents || []).filter(d => d.collection === collection);
  }

  public getDocument(collection: string, docId: string): FirestoreDocument | undefined {
    this.data.metrics.totalReads++;
    this.saveToFile();
    return (this.data.documents || []).find(d => d.collection === collection && d.id === docId);
  }

  public createDocument(collection: string, docId: string | undefined, data: Record<string, any>): FirestoreDocument {
    const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    if (!this.data.documents) this.data.documents = [];
    const existingIndex = this.data.documents.findIndex(d => d.collection === collection && d.id === id);

    const newDoc: FirestoreDocument = {
      id,
      collection,
      data,
      createdAt: existingIndex >= 0 ? this.data.documents[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      this.data.documents[existingIndex] = newDoc;
    } else {
      this.data.documents.push(newDoc);
    }

    this.data.metrics.totalWrites++;
    this.saveToFile();
    return newDoc;
  }

  public updateDocument(collection: string, docId: string, patch: Record<string, any>): FirestoreDocument | null {
    const doc = this.getDocument(collection, docId);
    if (!doc) return null;

    doc.data = { ...doc.data, ...patch };
    doc.updatedAt = new Date().toISOString();
    this.data.metrics.totalWrites++;
    this.saveToFile();
    return doc;
  }

  public deleteDocument(collection: string, docId: string): boolean {
    const index = (this.data.documents || []).findIndex(d => d.collection === collection && d.id === docId);
    if (index === -1) return false;
    this.data.documents.splice(index, 1);
    this.data.metrics.totalDeletes++;
    this.saveToFile();
    return true;
  }

  // Security Rules
  public getSecurityRules(): SecurityRule[] {
    return this.data.securityRules || [];
  }

  public setSecurityRules(rules: SecurityRule[]): void {
    this.data.securityRules = rules;
    this.saveToFile();
  }

  // Auth Settings
  public getAuthSettings(): AuthSettings {
    return this.data.authSettings || {
      allowPasswordSignup: true,
      requireEmailVerification: false,
      passwordMinLength: 6
    };
  }

  public updateAuthSettings(settings: Partial<AuthSettings>): AuthSettings {
    Object.assign(this.data.authSettings, settings);
    this.saveToFile();
    return this.data.authSettings;
  }

  // Audit Log
  public addAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): void {
    const newLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      ...log,
      createdAt: new Date().toISOString()
    };
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(newLog);
    if (this.data.auditLogs.length > 300) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 300);
    }
    this.saveToFile();
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs || [];
  }

  public getMetrics(): DbMetrics {
    return this.data.metrics || { totalReads: 0, totalWrites: 0, totalDeletes: 0 };
  }
}
