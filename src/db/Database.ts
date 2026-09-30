import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { query, testConnection, isDbConnected } from './client.js';
import { Migrator } from './migrator.js';
import {
  AppUser,
  User,
  AuthSession,
  RefreshToken,
  OAuthAccount,
  ApiKey,
  ProjectApp,
  FirestoreDocument,
  SecurityRule,
  AuthSettings,
  AuditLog,
  DbMetrics,
  Server,
  Allocation,
  Backup,
  Job,
  Schedule,
  AuditEvent,
  Alert,
  JavaRuntimeRecord,
  NodeRecord,
  DbSchema
} from './schema.js';
import { UserRepository } from './repositories/UserRepository.js';
import { ServerRepository } from './repositories/ServerRepository.js';
import { NodeRepository } from './repositories/NodeRepository.js';
import { AllocationRepository } from './repositories/AllocationRepository.js';
import { BackupRepository } from './repositories/BackupRepository.js';
import { ScheduleRepository } from './repositories/ScheduleRepository.js';
import { AuditRepository } from './repositories/AuditRepository.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { JobRepository } from './repositories/JobRepository.js';
import { JavaRuntimeRepository } from './repositories/JavaRuntimeRepository.js';
import { FirestoreRepository } from './repositories/FirestoreRepository.js';

dotenv.config();

const handleDbError = (context: string, err: any) => {
  if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
    return; // Suppress connection refused logs when PostgreSQL is not running locally
  }
  console.error(`[${context}]:`, err?.message || err);
};

export * from './schema.js';
export { UserRepository } from './repositories/UserRepository.js';
export { ServerRepository } from './repositories/ServerRepository.js';
export { NodeRepository } from './repositories/NodeRepository.js';
export { AllocationRepository } from './repositories/AllocationRepository.js';
export { BackupRepository } from './repositories/BackupRepository.js';
export { ScheduleRepository } from './repositories/ScheduleRepository.js';
export { AuditRepository } from './repositories/AuditRepository.js';
export { SettingsRepository } from './repositories/SettingsRepository.js';
export { JobRepository } from './repositories/JobRepository.js';
export { JavaRuntimeRepository } from './repositories/JavaRuntimeRepository.js';
export { FirestoreRepository } from './repositories/FirestoreRepository.js';
export { ServerTransaction } from './transactions/ServerTransaction.js';

export class Database {
  private static instance: Database | null = null;
  private isInitialized = false;

  // Repositories
  private userRepo = UserRepository.getInstance();
  private serverRepo = ServerRepository.getInstance();
  private nodeRepo = NodeRepository.getInstance();
  private allocRepo = AllocationRepository.getInstance();
  private backupRepo = BackupRepository.getInstance();
  private scheduleRepo = ScheduleRepository.getInstance();
  private auditRepo = AuditRepository.getInstance();
  private settingsRepo = SettingsRepository.getInstance();
  private jobRepo = JobRepository.getInstance();
  private javaRepo = JavaRuntimeRepository.getInstance();
  private firestoreRepo = FirestoreRepository.getInstance();

  // In-memory runtime mirror for high-speed synchronous reads, continuously synced with PostgreSQL
  private data: DbSchema = {
    users: [],
    sessions: [],
    refreshTokens: [],
    oauthAccounts: [],
    apiKeys: [],
    projects: [],
    documents: [],
    securityRules: [],
    authSettings: {
      allowPasswordSignup: true,
      requireEmailVerification: false,
      passwordMinLength: 6
    },
    auditLogs: [],
    metrics: { totalReads: 0, totalWrites: 0, totalDeletes: 0 },
    servers: [],
    allocations: [],
    backups: [],
    jobs: [],
    schedules: [],
    auditEvents: [],
    alerts: [],
    javaRuntimes: [],
    nodes: []
  };

  private constructor() {
    this.bootstrapDefaultState();
    this.init();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[Database] Connecting to PostgreSQL database engine...');
      const conn = await testConnection();

      if (conn.ok) {
        console.log(`[Database] PostgreSQL connection established (${conn.latencyMs}ms latency). Running migrations...`);
        const migrator = new Migrator();
        await migrator.runMigrations();

        // Hydrate from PostgreSQL database
        await this.syncFromPostgres();
        await this.bootstrapAdminIfNeeded();

        console.log('[Database] PostgreSQL database initialized as single source of truth.');
      } else {
        console.warn(`[Database] Notice: PostgreSQL direct connection: ${conn.error}. Ready to connect upon DATABASE_URL configuration.`);
        await this.bootstrapDefaultState();
      }

      this.isInitialized = true;
    } catch (err: any) {
      console.error('[Database] Initialization error:', err.message);
      await this.bootstrapDefaultState();
      this.isInitialized = true;
    }
  }

  private async bootstrapAdminIfNeeded(): Promise<void> {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@xorvilahost.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || '@@##admin123';
    const existing = await this.userRepo.findByEmail(adminEmail);

    if (!existing) {
      console.log(`[Database] Bootstrapping primary administrator (${adminEmail})...`);
      const passwordHash = bcrypt.hashSync(adminPassword, 10);
      const admin = await this.userRepo.create({
        id: 'usr_admin',
        email: adminEmail,
        normalizedEmail: adminEmail,
        username: adminEmail.split('@')[0],
        displayName: 'System Admin',
        passwordHash,
        role: 'Admin',
        emailVerified: true,
        disabled: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      console.log(`[Database] Admin ${admin.email} created in PostgreSQL.`);
    }
  }

  private async bootstrapDefaultState(): Promise<void> {
    // Default admin in memory if DB not connected yet
    const defaultHash = bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || '@@##admin123', 10);
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@xorvilahost.com';
    this.data.users = [
      {
        id: 'usr_admin',
        email: adminEmail,
        normalizedEmail: adminEmail.toLowerCase().trim(),
        username: adminEmail.split('@')[0],
        displayName: 'System Admin',
        passwordHash: defaultHash,
        role: 'Admin',
        emailVerified: true,
        disabled: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      }
    ];

    this.data.nodes = [
      {
        id: 'node_01',
        name: 'Node 01',
        status: 'ONLINE',
        description: 'Primary Minecraft hosting node cluster',
        location: 'India',
        country: 'India',
        ipAddress: '125.16.24.110',
        port: 8080,
        maxMemoryGb: 32,
        allocatedMemoryGb: 0,
        maxCpuCores: 16,
        allocatedCpuCores: 0,
        maxDiskGb: 500,
        allocatedDiskGb: 0,
        lastHeartbeat: new Date().toISOString(),
        daemonStatus: 'Connected'
      }
    ];

    this.data.allocations = [
      { id: 'alloc_25565', ipAddress: '0.0.0.0', port: 25565, serverId: null, label: 'Minecraft Default', isPrimary: true },
      { id: 'alloc_25566', ipAddress: '0.0.0.0', port: 25566, serverId: null, label: 'Minecraft Node Port 2', isPrimary: false },
      { id: 'alloc_25567', ipAddress: '0.0.0.0', port: 25567, serverId: null, label: 'Minecraft Node Port 3', isPrimary: false }
    ];
  }

  public async syncFromPostgres(): Promise<void> {
    try {
      const [
        users,
        servers,
        nodes,
        allocations,
        backups,
        schedules,
        jobs,
        javaRuntimes,
        auditLogs,
        authSettings,
        collections
      ] = await Promise.all([
        this.userRepo.findAll(),
        this.serverRepo.findAll(),
        this.nodeRepo.findAll(),
        this.allocRepo.findAll(),
        this.backupRepo.findAll(),
        this.scheduleRepo.findAll(),
        this.jobRepo.findAll(),
        this.javaRepo.findAll(),
        this.auditRepo.findAll(300),
        this.userRepo.getAuthSettings(),
        this.firestoreRepo.getCollections()
      ]);

      this.data.users = users;
      this.data.servers = servers;
      this.data.nodes = nodes;
      this.data.allocations = allocations;
      this.data.backups = backups;
      this.data.schedules = schedules;
      this.data.jobs = jobs;
      this.data.javaRuntimes = javaRuntimes;
      this.data.auditLogs = auditLogs;
      this.data.authSettings = authSettings;

      // Load documents from collections
      const allDocs: FirestoreDocument[] = [];
      for (const col of collections) {
        const docs = await this.firestoreRepo.getDocuments(col);
        allDocs.push(...docs);
      }
      this.data.documents = allDocs;
      this.data.securityRules = await this.firestoreRepo.getSecurityRules();
    } catch (err: any) {
      console.warn('[Database] Sync from PostgreSQL warning:', err.message);
    }
  }

  /**
   * Compatibility method: NO JSON FILE WRITING.
   * Changes are persisted directly in PostgreSQL.
   */
  public saveToFile(): void {
    // Intentionally removed JSON file writes.
    // PostgreSQL is now the single source of truth.
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
    }

    // Async write-through to PostgreSQL
    this.writeThroughInsert(tableName, record).catch(err => {
      handleDbError(`Database Insert Error on ${String(tableName)}`, err);
    });
  }

  private async writeThroughInsert(tableName: keyof DbSchema, record: any): Promise<void> {
    if (tableName === 'users') {
      await this.userRepo.create(record);
    } else if (tableName === 'servers') {
      await this.serverRepo.create(record);
    } else if (tableName === 'nodes') {
      await this.nodeRepo.create(record);
    } else if (tableName === 'allocations') {
      await this.allocRepo.create(record);
    } else if (tableName === 'backups') {
      await this.backupRepo.create(record);
    } else if (tableName === 'schedules') {
      await this.scheduleRepo.create(record);
    } else if (tableName === 'jobs') {
      await this.jobRepo.create(record);
    } else if (tableName === 'javaRuntimes') {
      await this.javaRepo.save(record);
    } else if (tableName === 'auditLogs') {
      await this.auditRepo.create(record);
    }
  }

  public update<T = any>(
    tableName: keyof DbSchema,
    predicate: (item: T) => boolean,
    patchOrUpdater: Partial<T> | ((item: T) => void)
  ): void {
    const table = this.getTable(tableName);
    if (Array.isArray(table)) {
      for (const item of table) {
        if (predicate(item as T)) {
          if (typeof patchOrUpdater === 'function') {
            (patchOrUpdater as (item: T) => void)(item as T);
          } else if (patchOrUpdater && typeof patchOrUpdater === 'object') {
            Object.assign(item, patchOrUpdater);
          }

          // Async write-through update
          this.writeThroughUpdate(tableName, item).catch(err => {
            handleDbError(`Database Update Error on ${String(tableName)}`, err);
          });
        }
      }
    }
  }

  private async writeThroughUpdate(tableName: keyof DbSchema, item: any): Promise<void> {
    if (!item?.id) return;
    if (tableName === 'users') {
      await this.userRepo.update(item.id, item);
    } else if (tableName === 'servers') {
      await this.serverRepo.update(item.id, item);
    } else if (tableName === 'nodes') {
      await this.nodeRepo.update(item.id, item);
    } else if (tableName === 'allocations') {
      await this.allocRepo.create(item);
    } else if (tableName === 'backups') {
      await this.backupRepo.update(item.id, item);
    } else if (tableName === 'schedules') {
      await this.scheduleRepo.update(item.id, item);
    } else if (tableName === 'jobs') {
      await this.jobRepo.update(item.id, item);
    } else if (tableName === 'javaRuntimes') {
      await this.javaRepo.save(item);
    }
  }

  public delete<T = any>(
    tableName: keyof DbSchema,
    predicate: (item: T) => boolean
  ): void {
    const table = this.getTable(tableName);
    if (Array.isArray(table)) {
      const toDelete = table.filter(item => predicate(item as T));
      (this.data as any)[tableName] = table.filter(item => !predicate(item as T));

      for (const item of toDelete) {
        this.writeThroughDelete(tableName, item).catch(err => {
          handleDbError(`Database Delete Error on ${String(tableName)}`, err);
        });
      }
    }
  }

  private async writeThroughDelete(tableName: keyof DbSchema, item: any): Promise<void> {
    if (!item) return;
    const id = item.id || item.port;
    if (!id) return;

    if (tableName === 'users') {
      await this.userRepo.delete(item.id);
    } else if (tableName === 'servers') {
      await this.serverRepo.delete(item.id);
    } else if (tableName === 'nodes') {
      await this.nodeRepo.delete(item.id);
    } else if (tableName === 'allocations') {
      await this.allocRepo.delete(item.id || item.port);
    } else if (tableName === 'backups') {
      await this.backupRepo.delete(item.id);
    } else if (tableName === 'schedules') {
      await this.scheduleRepo.delete(item.id);
    } else if (tableName === 'javaRuntimes') {
      await this.javaRepo.delete(item.id || item.version);
    }
  }

  // User queries & mutations
  public getUsers(): AppUser[] {
    return this.data.users || [];
  }

  public getUserById(id: string): AppUser | undefined {
    return (this.data.users || []).find((u: AppUser) => u.id === id);
  }

  public getUserByEmail(email: string): AppUser | undefined {
    const clean = email.toLowerCase().trim();
    return (this.data.users || []).find((u: AppUser) => u.email.toLowerCase() === clean);
  }

  public getUserByUsername(username: string): AppUser | undefined {
    const clean = username.toLowerCase().trim();
    return (this.data.users || []).find((u: AppUser) => u.username.toLowerCase() === clean);
  }

  public getUserByGoogleId(googleId: string): AppUser | undefined {
    return (this.data.users || []).find((u: AppUser) => u.googleId === googleId);
  }

  public addUser(user: AppUser): void {
    if (!this.data.users) this.data.users = [];
    this.data.users.push(user);
    this.userRepo.create(user).catch(err => {
      handleDbError('UserRepo Create Error', err);
    });
  }

  public updateUser(id: string, updates: Partial<AppUser>): AppUser | null {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.userRepo.update(id, updates).catch(err => {
      handleDbError('UserRepo Update Error', err);
    });
    return user;
  }

  public deleteUser(id: string): boolean {
    const index = (this.data.users || []).findIndex((u: AppUser) => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    this.data.sessions = (this.data.sessions || []).filter((s: AuthSession) => s.userId !== id);
    this.data.refreshTokens = (this.data.refreshTokens || []).filter((rt: RefreshToken) => rt.userId !== id);
    this.data.apiKeys = (this.data.apiKeys || []).filter((k: ApiKey) => k.userId !== id);
    this.userRepo.delete(id).catch(err => {
      handleDbError('UserRepo Delete Error', err);
    });
    return true;
  }

  // Session management
  public getSessions(): AuthSession[] {
    return this.data.sessions || [];
  }

  public getSessionsForUser(userId: string): AuthSession[] {
    const now = new Date();
    return (this.data.sessions || []).filter((s: AuthSession) => s.userId === userId && !s.revoked && new Date(s.expiresAt) > now);
  }

  public addSession(session: AuthSession): void {
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions.push(session);
    this.userRepo.createSession(session).catch(err => {
      handleDbError('UserRepo CreateSession Error', err);
    });
  }

  public getSessionByToken(token: string): AuthSession | undefined {
    const now = new Date();
    return (this.data.sessions || []).find((s: AuthSession) => s.token === token && !s.revoked && new Date(s.expiresAt) > now);
  }

  public revokeSession(tokenIdOrId: string): boolean {
    const session = (this.data.sessions || []).find((s: AuthSession) => s.id === tokenIdOrId || s.token === tokenIdOrId);
    if (!session) return false;
    session.revoked = true;
    this.userRepo.revokeSession(tokenIdOrId).catch(err => {
      handleDbError('UserRepo RevokeSession Error', err);
    });
    return true;
  }

  public revokeAllSessionsForUser(userId: string, exceptToken?: string): void {
    for (const session of this.getSessions()) {
      if (session.userId === userId && session.token !== exceptToken) {
        session.revoked = true;
      }
    }
    this.userRepo.revokeAllSessionsForUser(userId, exceptToken).catch(err => {
      handleDbError('UserRepo RevokeAllSessions Error', err);
    });
  }

  // OAuth Account Links
  public getOAuthAccount(provider: 'google' | 'discord', providerUserId: string): OAuthAccount | undefined {
    return (this.data.oauthAccounts || []).find((o: OAuthAccount) => o.provider === provider && o.providerUserId === providerUserId);
  }

  public addOAuthAccount(account: OAuthAccount): void {
    if (!this.data.oauthAccounts) this.data.oauthAccounts = [];
    this.data.oauthAccounts.push(account);
    this.userRepo.createOAuthAccount(account).catch(err => {
      handleDbError('UserRepo CreateOAuth Error', err);
    });
  }

  // API Key Management
  public getApiKeys(userId?: string): ApiKey[] {
    const keys = this.data.apiKeys || [];
    if (userId) {
      return keys.filter((k: ApiKey) => k.userId === userId);
    }
    return keys;
  }

  public addApiKey(apiKey: ApiKey): void {
    if (!this.data.apiKeys) this.data.apiKeys = [];
    this.data.apiKeys.push(apiKey);
    this.userRepo.createApiKey(apiKey).catch(err => {
      handleDbError('UserRepo CreateApiKey Error', err);
    });
  }

  public revokeApiKey(id: string, userId: string): boolean {
    const key = (this.data.apiKeys || []).find((k: ApiKey) => k.id === id && k.userId === userId);
    if (!key) return false;
    key.revoked = true;
    this.userRepo.revokeApiKey(id, userId).catch(err => {
      handleDbError('UserRepo RevokeApiKey Error', err);
    });
    return true;
  }

  public verifyApiKey(rawKey: string): ApiKey | null {
    if (!rawKey) return null;
    const prefix = rawKey.substring(0, 10);
    const keys = (this.data.apiKeys || []).filter((k: ApiKey) => !k.revoked && k.keyPrefix === prefix);

    for (const k of keys) {
      if (bcrypt.compareSync(rawKey, k.keyHash)) {
        k.lastUsedAt = new Date().toISOString();
        return k;
      }
    }
    return null;
  }

  // Document Operations
  public getCollections(): string[] {
    const set = new Set<string>();
    for (const doc of this.data.documents || []) {
      set.add(doc.collection);
    }
    return Array.from(set).sort();
  }

  public getDocuments(collection: string): FirestoreDocument[] {
    this.data.metrics.totalReads++;
    return (this.data.documents || []).filter((d: FirestoreDocument) => d.collection === collection);
  }

  public getDocument(collection: string, docId: string): FirestoreDocument | undefined {
    this.data.metrics.totalReads++;
    return (this.data.documents || []).find((d: FirestoreDocument) => d.collection === collection && d.id === docId);
  }

  public createDocument(collection: string, docId: string | undefined, data: Record<string, any>): FirestoreDocument {
    const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    if (!this.data.documents) this.data.documents = [];
    const existingIndex = this.data.documents.findIndex((d: FirestoreDocument) => d.collection === collection && d.id === id);

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
    this.firestoreRepo.createOrUpdateDocument(collection, id, data).catch(err => {
      handleDbError('FirestoreRepo CreateDoc Error', err);
    });
    return newDoc;
  }

  public updateDocument(collection: string, docId: string, patch: Record<string, any>): FirestoreDocument | null {
    const doc = this.getDocument(collection, docId);
    if (!doc) return null;

    doc.data = { ...doc.data, ...patch };
    doc.updatedAt = new Date().toISOString();
    this.data.metrics.totalWrites++;

    this.firestoreRepo.patchDocument(collection, docId, patch).catch(err => {
      handleDbError('FirestoreRepo PatchDoc Error', err);
    });
    return doc;
  }

  public deleteDocument(collection: string, docId: string): boolean {
    const index = (this.data.documents || []).findIndex((d: FirestoreDocument) => d.collection === collection && d.id === docId);
    if (index === -1) return false;
    this.data.documents.splice(index, 1);
    this.data.metrics.totalDeletes++;

    this.firestoreRepo.deleteDocument(collection, docId).catch(err => {
      handleDbError('FirestoreRepo DeleteDoc Error', err);
    });
    return true;
  }

  // Security Rules
  public getSecurityRules(): SecurityRule[] {
    return this.data.securityRules || [];
  }

  public setSecurityRules(rules: SecurityRule[]): void {
    this.data.securityRules = rules;
    this.firestoreRepo.setSecurityRules(rules).catch(err => {
      handleDbError('FirestoreRepo SetRules Error', err);
    });
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
    this.userRepo.updateAuthSettings(settings).catch(err => {
      handleDbError('UserRepo UpdateAuthSettings Error', err);
    });
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
    this.auditRepo.create(newLog).catch(err => {
      handleDbError('AuditRepo Create Error', err);
    });
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs || [];
  }

  public getMetrics(): DbMetrics {
    return this.data.metrics || { totalReads: 0, totalWrites: 0, totalDeletes: 0 };
  }
}
