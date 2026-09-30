import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { getPool, testConnection, getSupabase } from '../src/db/client.js';
import { Migrator } from '../src/db/migrator.js';
import { UserRepository } from '../src/db/repositories/UserRepository.js';
import { NodeRepository } from '../src/db/repositories/NodeRepository.js';
import { AllocationRepository } from '../src/db/repositories/AllocationRepository.js';
import { SettingsRepository } from '../src/db/repositories/SettingsRepository.js';
import { query } from '../src/db/client.js';

dotenv.config();

async function seedDatabase() {
  console.log('====================================================');
  console.log('🌱 STARTING DATABASE SEED & ADMIN BOOTSTRAP');
  console.log('====================================================');

  const conn = await testConnection();
  if (!conn.ok) {
    console.error('❌ Cannot connect to PostgreSQL database:', conn.error);
    process.exit(1);
  }

  // 1. Run migrations first
  const migrator = new Migrator();
  await migrator.runMigrations();

  const userRepo = UserRepository.getInstance();
  const nodeRepo = NodeRepository.getInstance();
  const allocRepo = AllocationRepository.getInstance();
  const settingsRepo = SettingsRepository.getInstance();

  // 2. Bootstrap Admin User
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@xorvilahost.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || '@@##admin123';
  const adminUsername = adminEmail.split('@')[0];

  const existingAdmin = await userRepo.findByEmail(adminEmail);
  if (!existingAdmin) {
    console.log(`👤 Bootstrapping primary administrator (${adminEmail})...`);
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    const adminUser = await userRepo.create({
      id: 'usr_admin_bootstrap',
      email: adminEmail,
      normalizedEmail: adminEmail,
      username: adminUsername,
      displayName: 'System Administrator',
      passwordHash,
      role: 'Admin',
      emailVerified: true,
      disabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    });

    // Create Admin Role in roles table
    await query(`
      INSERT INTO roles (id, name, description, permissions, is_system, created_at)
      VALUES (
        'role_admin',
        'Administrator',
        'Full administrative access to entire Minecraft hosting infrastructure',
        ARRAY['dashboard', 'users', 'servers', 'nodes', 'infrastructure', 'settings', 'audit_logs', 'resources', 'server_deletion', 'user_management', 'permissions', 'store', 'system_config'],
        TRUE,
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    `);

    await query(`
      INSERT INTO user_roles (id, user_id, role_id, created_at)
      VALUES ('ur_admin', $1, 'role_admin', NOW())
      ON CONFLICT (user_id, role_id) DO NOTHING
    `, [adminUser.id]);

    // If Supabase Auth is enabled, create user via Supabase admin client
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { role: 'Admin', username: adminUsername }
        });
        if (error) {
          console.warn('[Supabase Auth Bootstrap Notice]:', error.message);
        } else if (data.user) {
          console.log(`[Supabase Auth] Created Supabase Auth user (${data.user.id})`);
        }
      } catch (err: any) {
        console.warn('[Supabase Auth Bootstrap Error]:', err.message);
      }
    }

    console.log(`✅ Admin account (${adminEmail}) bootstrapped successfully.`);
  } else {
    console.log(`ℹ️ Admin account (${adminEmail}) already exists. Preserving existing credentials.`);
  }

  // 3. Seed Default Node 01 (Primary Hardware Cluster)
  const existingNodes = await nodeRepo.findAll();
  if (existingNodes.length === 0) {
    console.log('🖥️ Creating default system node (Node 01)...');
    await nodeRepo.create({
      id: 'node_01',
      name: 'Node 01',
      description: 'Primary high-performance Minecraft hosting cluster',
      location: 'India',
      country: 'India',
      ipAddress: '125.16.24.110',
      port: 8080,
      status: 'ONLINE',
      maxMemoryGb: 32,
      allocatedMemoryGb: 0,
      maxCpuCores: 16,
      allocatedCpuCores: 0,
      maxDiskGb: 500,
      allocatedDiskGb: 0,
      portRange: '25565-25600',
      enabled: true,
      daemonStatus: 'Connected',
      lastHeartbeat: new Date().toISOString()
    });
    console.log('✅ Default Node 01 created.');
  }

  // 4. Seed Base Port Allocations
  const existingAllocs = await allocRepo.findAll();
  if (existingAllocs.length === 0) {
    console.log('🌐 Creating default port allocations for Node 01...');
    const defaultPorts = [
      { port: 25565, label: 'Minecraft Default', isPrimary: true },
      { port: 25566, label: 'Minecraft Node Port 2', isPrimary: false },
      { port: 25567, label: 'Minecraft Node Port 3', isPrimary: false },
      { port: 25575, label: 'RCON Remote Management', isPrimary: false },
      { port: 8123, label: 'Dynmap Web Map', isPrimary: false },
      { port: 19132, label: 'Bedrock Geyser Port', isPrimary: false }
    ];

    for (const p of defaultPorts) {
      await allocRepo.create({
        id: `alloc_node_01_${p.port}`,
        nodeId: 'node_01',
        serverId: null,
        ipAddress: '0.0.0.0',
        port: p.port,
        label: p.label,
        isPrimary: p.isPrimary
      });
    }
    console.log(`✅ Seeded ${defaultPorts.length} base port allocations.`);
  }

  // 5. Seed Default Branding & Settings
  const branding = await settingsRepo.getBranding();
  if (!branding.brandName) {
    await settingsRepo.updateBranding({
      brandName: 'Xorvila',
      brandLogo: '',
      customLogos: {},
      themeSettings: {}
    });
  }

  console.log('====================================================');
  console.log('🎉 Database seeding & bootstrap completed successfully!');
  console.log('====================================================');
}

seedDatabase().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
