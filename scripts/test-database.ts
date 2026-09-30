import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE DATABASE SUITE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Test Migrations Structure
  test('Migrations: All 10 SQL migration files exist and are valid', () => {
    const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    if (files.length < 10) {
      throw new Error(`Expected at least 10 migration files, found ${files.length}`);
    }
    const expected = [
      '001_initial_schema.sql',
      '002_auth.sql',
      '003_panel.sql',
      '004_minecraft.sql',
      '005_backups.sql',
      '006_schedules.sql',
      '007_audit.sql',
      '008_settings.sql',
      '009_indexes.sql',
      '010_constraints.sql'
    ];
    for (const exp of expected) {
      if (!files.includes(exp)) {
        throw new Error(`Missing expected migration file: ${exp}`);
      }
      const content = fs.readFileSync(path.join(migrationsDir, exp), 'utf8');
      if (!content.trim()) {
        throw new Error(`Migration file ${exp} is empty`);
      }
    }
  });

  // 2. Test Password Hashing
  test('Security: Secure bcrypt password hashing and comparison', () => {
    const rawPass = '@@##admin123';
    const hash = bcrypt.hashSync(rawPass, 10);
    if (!hash.startsWith('$2') || hash.length < 50) {
      throw new Error('Invalid bcrypt hash format generated');
    }
    if (!bcrypt.compareSync(rawPass, hash)) {
      throw new Error('Bcrypt failed to compare matching password');
    }
    if (bcrypt.compareSync('wrong_password', hash)) {
      throw new Error('Bcrypt erroneously accepted invalid password');
    }
  });

  // 3. Test Database Layer Exports
  await testAsync('Database: Repository instances and schema interfaces loaded', async () => {
    const { Database, UserRepository, ServerRepository, NodeRepository, AllocationRepository, SettingsRepository } = await import('../src/db/Database.js');
    const db = Database.getInstance();
    if (!db) throw new Error('Failed to get Database singleton');
    if (!UserRepository.getInstance()) throw new Error('Failed to get UserRepository singleton');
    if (!ServerRepository.getInstance()) throw new Error('Failed to get ServerRepository singleton');
    if (!NodeRepository.getInstance()) throw new Error('Failed to get NodeRepository singleton');
    if (!AllocationRepository.getInstance()) throw new Error('Failed to get AllocationRepository singleton');
    if (!SettingsRepository.getInstance()) throw new Error('Failed to get SettingsRepository singleton');
  });

  // 4. Test In-Memory Synchronization
  await testAsync('Database: Synchronous runtime getters for existing server controllers', async () => {
    const { Database } = await import('../src/db/Database.js');
    const db = Database.getInstance();
    const users = db.getUsers();
    if (!Array.isArray(users)) throw new Error('getUsers did not return an array');
    const nodes = db.getTable('nodes');
    if (!Array.isArray(nodes)) throw new Error('getTable nodes did not return an array');
    const servers = db.getTable('servers');
    if (!Array.isArray(servers)) throw new Error('getTable servers did not return an array');
  });

  console.log('\n====================================================');
  console.log(`📊 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
