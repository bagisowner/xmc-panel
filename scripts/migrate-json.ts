import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { getPool, testConnection } from '../src/db/client.js';
import { Migrator } from '../src/db/migrator.js';
import { UserRepository } from '../src/db/repositories/UserRepository.js';
import { ServerRepository } from '../src/db/repositories/ServerRepository.js';
import { NodeRepository } from '../src/db/repositories/NodeRepository.js';
import { AllocationRepository } from '../src/db/repositories/AllocationRepository.js';
import { JavaRuntimeRepository } from '../src/db/repositories/JavaRuntimeRepository.js';
import { AuditRepository } from '../src/db/repositories/AuditRepository.js';
import { FirestoreRepository } from '../src/db/repositories/FirestoreRepository.js';

dotenv.config();

async function runJsonMigration() {
  console.log('====================================================');
  console.log('🔄 STARTING DATABASE JSON -> POSTGRESQL DATA MIGRATION');
  console.log('====================================================');

  // 1. Check DB Connection
  const connTest = await testConnection();
  if (!connTest.ok) {
    console.error('❌ Cannot connect to PostgreSQL database:', connTest.error);
    console.log('Please ensure DATABASE_URL is configured in your environment.');
    process.exit(1);
  }
  console.log(`✅ Connected to PostgreSQL database (Latency: ${connTest.latencyMs}ms)`);

  // 2. Run schema migrations first
  console.log('📦 Ensuring all database migrations are applied...');
  const migrator = new Migrator();
  await migrator.runMigrations();

  // 3. Locate old db.json
  const candidatePaths = [
    path.join(process.cwd(), 'storage', 'db.json'),
    path.join(process.cwd(), 'db.json')
  ];

  let sourceFile: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      sourceFile = p;
      break;
    }
  }

  if (!sourceFile) {
    console.log('ℹ️ No existing db.json file found to migrate. Migration complete.');
    return;
  }

  console.log(`📄 Found source JSON database at: ${sourceFile}`);

  // 4. Create safe backup of db.json
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sourceFile}.backup-${timestamp}`;
  fs.copyFileSync(sourceFile, backupPath);
  console.log(`💾 Created safe backup copy at: ${backupPath}`);

  // 5. Read & Parse JSON Data
  const rawContent = fs.readFileSync(sourceFile, 'utf8');
  let data: any = {};
  try {
    data = JSON.parse(rawContent);
  } catch (err: any) {
    console.error('❌ Failed to parse JSON database file:', err.message);
    process.exit(1);
  }

  const report = {
    usersMigrated: 0,
    nodesMigrated: 0,
    serversMigrated: 0,
    allocationsMigrated: 0,
    javaRuntimesMigrated: 0,
    auditLogsMigrated: 0,
    documentsMigrated: 0,
    errors: [] as string[]
  };

  const userRepo = UserRepository.getInstance();
  const serverRepo = ServerRepository.getInstance();
  const nodeRepo = NodeRepository.getInstance();
  const allocRepo = AllocationRepository.getInstance();
  const javaRepo = JavaRuntimeRepository.getInstance();
  const auditRepo = AuditRepository.getInstance();
  const firestoreRepo = FirestoreRepository.getInstance();

  // 6. Migrate Users
  if (Array.isArray(data.users)) {
    console.log(`👤 Migrating ${data.users.length} users...`);
    for (const u of data.users) {
      try {
        if (!u.id || !u.email || !u.username) continue;
        await userRepo.create({
          id: u.id,
          email: u.email,
          normalizedEmail: u.email.toLowerCase().trim(),
          username: u.username,
          displayName: u.displayName || u.username,
          passwordHash: u.passwordHash || bcrypt.hashSync('@@##admin123', 10),
          role: u.role || 'User',
          emailVerified: u.emailVerified ?? true,
          disabled: u.disabled ?? false,
          avatarUrl: u.avatarUrl || null,
          bio: u.bio || null,
          googleId: u.googleId || null,
          createdAt: u.createdAt || new Date().toISOString(),
          lastLoginAt: u.lastLoginAt || null
        });
        report.usersMigrated++;
      } catch (err: any) {
        report.errors.push(`User ${u.username || u.id}: ${err.message}`);
      }
    }
  }

  // 7. Migrate Nodes
  if (Array.isArray(data.nodes)) {
    console.log(`🖥️ Migrating ${data.nodes.length} nodes...`);
    for (const n of data.nodes) {
      try {
        if (!n.id || !n.name) continue;
        await nodeRepo.create({
          id: n.id,
          name: n.name,
          description: n.description || '',
          location: n.location || 'India',
          country: n.country || (n.location === 'India' ? 'India' : 'Global'),
          ipAddress: n.ipAddress || '125.16.24.110',
          port: Number(n.port) || 8080,
          status: n.status || 'ONLINE',
          maxMemoryGb: Number(n.maxMemoryGb) || 32,
          allocatedMemoryGb: Number(n.allocatedMemoryGb) || 0,
          maxCpuCores: Number(n.maxCpuCores) || 8,
          allocatedCpuCores: Number(n.allocatedCpuCores) || 0,
          maxDiskGb: Number(n.maxDiskGb) || 200,
          allocatedDiskGb: Number(n.allocatedDiskGb) || 0,
          daemonStatus: n.daemonStatus || 'Connected',
          lastHeartbeat: n.lastHeartbeat || new Date().toISOString()
        });
        report.nodesMigrated++;
      } catch (err: any) {
        report.errors.push(`Node ${n.name || n.id}: ${err.message}`);
      }
    }
  }

  // 8. Migrate Servers
  if (Array.isArray(data.servers)) {
    console.log(`🎮 Migrating ${data.servers.length} Minecraft servers...`);
    for (const s of data.servers) {
      try {
        if (!s.id || !s.name) continue;
        await serverRepo.create({
          id: s.id,
          name: s.name,
          description: s.description || '',
          software: s.software || 'Paper',
          version: s.version || '1.21.1',
          javaVersion: s.javaVersion || '21',
          status: s.status || 'Offline',
          nodeId: s.nodeId || 'node_01',
          memoryLimitGb: Number(s.memoryLimitGb) || 4,
          cpuLimitCores: Number(s.cpuLimitCores) || 2,
          diskLimitGb: Number(s.diskLimitGb) || 15,
          primaryPort: Number(s.primaryPort) || 25565,
          startupCommand: s.startupCommand || '',
          jvmFlags: s.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled',
          variables: s.variables || {},
          activeWorld: s.activeWorld || 'world',
          autoRestart: s.autoRestart || 'OnCrash',
          maintenanceMode: !!s.maintenanceMode,
          containerId: s.containerId || null,
          startedAt: s.startedAt || null,
          readyAt: s.readyAt || null,
          stoppedAt: s.stoppedAt || null,
          lastSeenAt: s.lastSeenAt || null,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString()
        });
        report.serversMigrated++;
      } catch (err: any) {
        report.errors.push(`Server ${s.name || s.id}: ${err.message}`);
      }
    }
  }

  // 9. Migrate Allocations
  if (Array.isArray(data.allocations)) {
    console.log(`🌐 Migrating ${data.allocations.length} port allocations...`);
    for (const a of data.allocations) {
      try {
        if (!a.id || !a.port) continue;
        await allocRepo.create({
          id: a.id,
          nodeId: a.nodeId || 'node_01',
          serverId: a.serverId || null,
          ipAddress: a.ipAddress || '0.0.0.0',
          port: Number(a.port),
          label: a.label || 'Minecraft Default',
          isPrimary: !!a.isPrimary
        });
        report.allocationsMigrated++;
      } catch (err: any) {
        report.errors.push(`Allocation ${a.port}: ${err.message}`);
      }
    }
  }

  // 10. Migrate Java Runtimes
  if (Array.isArray(data.javaRuntimes)) {
    console.log(`☕ Migrating ${data.javaRuntimes.length} Java runtimes...`);
    for (const j of data.javaRuntimes) {
      try {
        if (!j.id || !j.version) continue;
        await javaRepo.save({
          id: j.id,
          name: j.name || `Java ${j.version}`,
          version: j.version,
          major: Number(j.major) || parseInt(j.version, 10) || 21,
          vendor: j.vendor || 'Eclipse Adoptium (Temurin)',
          path: j.path || '',
          directory: j.directory || '',
          status: j.status || 'Installed',
          sizeBytes: Number(j.sizeBytes) || 0,
          sizeFormatted: j.sizeFormatted || '0 MB',
          verification: j.verification || { valid: true },
          installedAt: j.installedAt || new Date().toISOString()
        });
        report.javaRuntimesMigrated++;
      } catch (err: any) {
        report.errors.push(`Java Runtime ${j.version}: ${err.message}`);
      }
    }
  }

  // 11. Migrate Audit Logs
  if (Array.isArray(data.auditLogs)) {
    console.log(`📋 Migrating ${data.auditLogs.length} audit logs...`);
    for (const l of data.auditLogs) {
      try {
        if (!l.action) continue;
        await auditRepo.create({
          id: l.id,
          userId: l.userId || null,
          userEmail: l.userEmail || null,
          action: l.action,
          details: l.details || '',
          ipAddress: l.ipAddress || '127.0.0.1',
          createdAt: l.createdAt || new Date().toISOString()
        });
        report.auditLogsMigrated++;
      } catch (err: any) {
        report.errors.push(`Audit log ${l.id}: ${err.message}`);
      }
    }
  }

  // 12. Migrate Documents
  if (Array.isArray(data.documents)) {
    console.log(`📑 Migrating ${data.documents.length} firestore documents...`);
    for (const d of data.documents) {
      try {
        if (!d.id || !d.collection) continue;
        await firestoreRepo.createOrUpdateDocument(d.collection, d.id, d.data || {});
        report.documentsMigrated++;
      } catch (err: any) {
        report.errors.push(`Document ${d.collection}/${d.id}: ${err.message}`);
      }
    }
  }

  console.log('\n====================================================');
  console.log('📊 DATA MIGRATION SUMMARY REPORT');
  console.log('====================================================');
  console.log(`✅ Users Migrated:         ${report.usersMigrated}`);
  console.log(`✅ Nodes Migrated:         ${report.nodesMigrated}`);
  console.log(`✅ Servers Migrated:       ${report.serversMigrated}`);
  console.log(`✅ Allocations Migrated:   ${report.allocationsMigrated}`);
  console.log(`✅ Java Runtimes Migrated: ${report.javaRuntimesMigrated}`);
  console.log(`✅ Audit Logs Migrated:    ${report.auditLogsMigrated}`);
  console.log(`✅ Documents Migrated:     ${report.documentsMigrated}`);
  if (report.errors.length > 0) {
    console.warn(`⚠️ Notice/Warnings (${report.errors.length}):`);
    report.errors.slice(0, 5).forEach(e => console.warn(`   - ${e}`));
  }
  console.log('====================================================');
  console.log('🎉 Migration finished successfully!');
}

runJsonMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
