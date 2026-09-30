export interface AppUser {
  id: string;
  email: string;
  normalizedEmail?: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: 'Admin' | 'Developer' | 'User' | 'Viewer' | string;
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
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface User extends AppUser {
  permissions?: string[];
}

export interface UserProfile {
  id: string;
  userId: string;
  preferences: Record<string, any>;
  theme: Record<string, any>;
  sidebarCollapsed: boolean;
  audioFxEnabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  provider: 'google' | 'discord' | string;
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

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

export interface Server {
  id: string;
  ownerId?: string;
  nodeId?: string;
  name: string;
  description: string;
  software: 'Vanilla' | 'Paper' | 'Purpur' | 'Spigot' | 'Fabric' | 'Forge' | 'NeoForge' | 'Velocity' | 'BungeeCord' | 'Custom' | string;
  version: string;
  javaVersion: '8' | '11' | '16' | '17' | '21' | '25' | string;
  status: 'Installing' | 'Starting' | 'Running' | 'Stopping' | 'Offline' | 'Crashed' | 'Restarting' | 'Error' | 'Suspended';
  nodeName?: string;
  location?: string;
  memoryLimitGb: number;
  cpuLimitCores: number;
  diskLimitGb: number;
  primaryPort: number;
  startupCommand: string;
  jvmFlags: string;
  variables: Record<string, any>;
  activeWorld: string;
  autoRestart: 'Never' | 'OnCrash' | 'Always' | string;
  maintenanceMode: boolean;
  containerId?: string | null;
  startedAt?: string | null;
  readyAt?: string | null;
  stoppedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  role: string;
  permissions: string[];
  createdAt: string;
}

export interface NodeRecord {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | string;
  description: string;
  hostname?: string;
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
  portRange?: string;
  enabled?: boolean;
  daemonStatus?: string;
  lastHeartbeat?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Allocation {
  id: string;
  nodeId?: string;
  serverId: string | null;
  ipAddress: string;
  port: number;
  label: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface ServerSettings {
  id: string;
  serverId: string;
  crashDetection: boolean;
  autoSaveInterval: number;
  queryEnabled: boolean;
  rconEnabled: boolean;
  rconPort?: number;
  rconPassword?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  sizeBytes: number;
  status: 'Creating' | 'Completed' | 'Failed' | 'Restoring' | string;
  filePath: string;
  checksum?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Job {
  id: string;
  serverId: string;
  type: 'install' | 'rebuild' | 'backup' | 'restore' | 'delete' | 'import' | string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  progress: number;
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
  action: 'backup' | 'restart' | 'stop' | 'start' | string;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JavaRuntimeRecord {
  id: string;
  name: string;
  version: '8' | '11' | '16' | '17' | '21' | '25' | string;
  major: number;
  vendor: string;
  path: string;
  directory: string;
  status: 'Installed' | 'Installing' | 'Failed' | string;
  sizeBytes: number;
  sizeFormatted: string;
  verification?: {
    valid: boolean;
    versionString?: string;
    vmString?: string;
    error?: string;
  };
  installedAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  serverId?: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  serverId: string;
  type: 'CPU' | 'RAM' | 'Disk' | string;
  threshold: number;
  triggerValue: number;
  status: 'Active' | 'Resolved' | string;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  category?: string;
  inStock: boolean;
  tags: string[];
  rating: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface UserBalance {
  userId: string;
  balance: number;
  credits: number;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: string;
  details?: string;
  createdAt: string;
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
  allowRead: 'all' | 'authenticated' | 'owner' | 'admin' | string;
  allowWrite: 'all' | 'authenticated' | 'owner' | 'admin' | string;
  createdAt: string;
}

export interface AuthSettings {
  allowPasswordSignup: boolean;
  requireEmailVerification: boolean;
  passwordMinLength: number;
}

export interface BrandingSettings {
  id: string;
  brandName: string;
  brandLogo: string;
  customLogos: Record<string, any>;
  themeSettings: Record<string, any>;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  theme: Record<string, any>;
  sidebarCollapsed: boolean;
  audioFx: boolean;
  customPreferences: Record<string, any>;
  updatedAt: string;
}

export interface DbMetrics {
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
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
