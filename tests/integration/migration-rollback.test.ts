// Migration Rollback Integration Tests
// Tests for rollback behavior using backups and transaction safety
// Run against temporary in-memory/file-backed databases only
// DO NOT run against production council.db

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MigrationLedger } from '../../src/migration-runner/ledger.js';
import { BackupManager } from '../../src/migration-runner/backup.js';
import { RollbackEngine } from '../../src/migration-runner/rollback.js';
import { MigrationRegistry } from '../../src/migration-runner/registry.js';

interface TestDB {
  db: Database.Database;
  path: string;
  close: () => void;
}

function createTestDB(filePath?: string): TestDB {
  const db = filePath ? new Database(filePath) : new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const fullPath = filePath ?? ':memory:';
  return {
    db,
    path: fullPath,
    close: () => db.close()
  };
}

// Phase 4 base schema (subset for testing)
function createPhase4Schema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS divisions (
      division_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      head_staff_id TEXT,
      budget_limit REAL NOT NULL DEFAULT 0,
      permissions TEXT NOT NULL DEFAULT '[]',
      strategic_objectives TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS staff_agents (
      staff_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      division_id TEXT NOT NULL,
      runtime_instances TEXT NOT NULL DEFAULT '[]',
      permissions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS division_members (
      division_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (division_id, staff_id),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      memory_id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL CHECK (owner_type IN ('seat', 'division', 'staff', 'founder')),
      owner_id TEXT NOT NULL,
      category TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
      version INTEGER NOT NULL DEFAULT 1,
      supersedes_id TEXT,
      meeting_id TEXT,
      division_id TEXT,
      task_id TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assigned_to_type TEXT NOT NULL CHECK (assigned_to_type IN ('division', 'staff')),
      assigned_to_id TEXT NOT NULL,
      created_by_type TEXT NOT NULL CHECK (created_by_type IN ('founder', 'council', 'division_head')),
      created_by_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      budget_allocated REAL NOT NULL DEFAULT 0,
      due_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      deliverable_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      submitted_by_type TEXT NOT NULL CHECK (submitted_by_type IN ('staff', 'division')),
      submitted_by_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
      reviewed_by_type TEXT,
      reviewed_by_id TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );
  `);
}

function setupRollbackEngine(db: Database.Database, backupDir: string = 'data/backups') {
  const registry = new MigrationRegistry({ directory: 'migrations' });
  const ledger = new MigrationLedger(db);
  ledger.initialize();
  const backupManager = new BackupManager(backupDir);

  return { registry, ledger, backupManager };
}

describe('Migration Rollback Integration Tests', () => {
  let testDB: TestDB;
  let backupDir: string;

  beforeEach(() => {
    // Create temp backup directory
    backupDir = path.join(process.cwd(), 'test-rollbacks-' + Date.now().toString());
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (testDB) {
      try {
        testDB.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      testDB.close();
    }
    if (fs.existsSync(backupDir)) {
      try {
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe('Test 1: Rollback safety checks', () => {
    test('rollback is rejected when migration not found in ledger', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      const engine = new RollbackEngine(db, ledger, backupManager);

      // No migrations applied
      const result = await engine.rollback('001');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Migration not found in ledger');
    });

    test('rollback is rejected when migration status is not success', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Record a failed migration
      ledger.recordFailure('001', 'test.sql', 'checksum', new Error('Test failure'), 100, '');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = await engine.rollback('001');
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not successful') || result.error?.includes('failed'));
    });

    test('rollback is rejected when no backup is available', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Record successful migration without backup
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = await engine.rollback('001');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'No backup available for rollback');
    });

    test('rollback is rejected when backup file does not exist', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Record successful migration with non-existent backup path
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '/nonexistent/backup.db');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = await engine.rollback('001');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Backup file no longer exists');
    });
  });

  describe('Test 2: Successful rollback', () => {
    test('rollback succeeds with valid backup and migration', async () => {
      const dbPath = path.join(backupDir, 'test.db');

      const testDB = createTestDB(dbPath);
      createPhase4Schema(testDB.db);

      // Insert test data
      testDB.db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-1', 'Division 1');
      testDB.db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id, status) VALUES (?, ?, ?, ?, ?)")
        .run('staff-1', 'Agent 1', 'role', 'div-1', 'active');
      testDB.db.pragma('wal_checkpoint = TRUNCATE');
      testDB.close();

      // Create backup
      const backupManager = new BackupManager(backupDir);
      await backupManager.createBackup(dbPath, { method: 'binary', verify: true }, 'test');

      // Verify backup was created
      const backups = backupManager.listBackups();
      assert.ok(backups.length > 0, 'Backup should exist');

      // Reopen database and record in ledger
      const ledgerDb = new Database(dbPath);
      const ledger = new MigrationLedger(ledgerDb);
      ledger.initialize();
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, backups[0]);

      // Create target DB for rollback
      const targetPath = path.join(backupDir, 'target.db');
      const targetDB = createTestDB(targetPath);
      createPhase4Schema(targetDB.db);
      targetDB.db.pragma('wal_checkpoint = TRUNCATE');
      targetDB.close();

      // Perform rollback
      const engine = new RollbackEngine(new Database(targetPath), ledger, backupManager);
      const result = await engine.rollback('001', { method: 'backup' });

      assert.strictEqual(result.success, true);

      // Verify ledger shows rolled_back status
      const entries = ledger.getAll();
      const rolledBackEntry = entries.find(e => e.migration_id === '001');
      assert.ok(rolledBackEntry, 'Rollled back entry should exist');
      assert.strictEqual(rolledBackEntry?.status, 'rolled_back');

      // Verify data was restored
      const verifyDb = new Database(targetPath, { readonly: true });
      const count = verifyDb.prepare('SELECT COUNT(*) as c FROM divisions').get() as { c: number };
      assert.strictEqual(count.c, 1, 'Data should be restored');
      verifyDb.close();
      ledgerDb.close();
    });

    test('dry run rollback reports success without actual rollback', async () => {
      const dbPath = path.join(backupDir, 'dryrun.db');
      const testDB = createTestDB(dbPath);
      createPhase4Schema(testDB.db);

      const backupManager = new BackupManager(backupDir);
      const backupResult = await backupManager.createBackup(dbPath, { method: 'binary', verify: true }, 'test');

      const ledgerDb = new Database(dbPath);
      const ledger = new MigrationLedger(ledgerDb);
      ledger.initialize();
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, backupResult.backupPath);

      const engine = new RollbackEngine(new Database(path.join(backupDir, 'dryrun-target.db')), ledger, backupManager);
      const result = await engine.rollback('001', { dryRun: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.was_safe, true);
      assert.ok(!result.error, 'Dry run should not have error');

      ledgerDb.close();
      testDB.close();
    });

    test('force flag allows rollback without backup', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Record successful migration without backup
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = await engine.rollback('001', { force: true, method: 'backup' });

      // Force should allow the rollback attempt, but it will fail due to no backup path
      assert.strictEqual(result.success, false);
    });
  });

  describe('Test 3: Rollback multiple migrations', () => {
    test('rollbackTo rolls back all migrations after target in reverse order', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Create backups for each migration
      const backup1 = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test-1');
      const backup2 = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test-2');
      const backup3 = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test-3');

      // Record three successful migrations
      ledger.recordSuccess('001', 'test1.sql', 'checksum1', 100, backup1.backupPath);
      ledger.recordSuccess('002', 'test2.sql', 'checksum2', 100, backup2.backupPath);
      ledger.recordSuccess('003', 'test3.sql', 'checksum3', 100, backup3.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);

      // Verify rollback history
      const history = engine.getRollbackHistory();
      assert.strictEqual(history.length, 3);
      assert.strictEqual(history.every(h => h.status === 'success'), true);

      // Test rollbackTo with target 002 (should rollback 003)
      const result = await engine.rollbackTo('002', { method: 'backup' });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].success, true);
    });

    test('rollbackAll rolls back all successful migrations', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Create backups
      const backup1 = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test-1');
      const backup2 = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test-2');

      // Record two successful migrations
      ledger.recordSuccess('001', 'test1.sql', 'checksum1', 100, backup1.backupPath);
      ledger.recordSuccess('002', 'test2.sql', 'checksum2', 100, backup2.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);
      const results = await engine.rollbackAll({ method: 'backup' });

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results.every(r => r.success), true);
    });
  });

  describe('Test 4: Transaction safety on rollback failure', () => {
    test('rollback transaction is rolled back on failure', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);

      // Record with non-existent backup
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '/nonexistent/backup.db');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = await engine.rollback('001');

      assert.strictEqual(result.success, false);
      // Ledger should still show success (rollback didn't commit)
      const status = ledger.getStatus('001');
      assert.strictEqual(status, 'success');
    });

    test('rollback does not corrupt database on failure', async () => {
      const dbPath = path.join(backupDir, 'corrupt.db');
      const targetPath = path.join(backupDir, 'target.db');

      // Create source DB with data
      const sourceDB = createTestDB(dbPath);
      createPhase4Schema(sourceDB.db);
      sourceDB.db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-1', 'Division 1');
      sourceDB.db.pragma('wal_checkpoint = TRUNCATE');
      sourceDB.close();

      // Create target DB
      const targetDB = createTestDB(targetPath);
      createPhase4Schema(targetDB.db);
      targetDB.db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-target', 'Target Division');
      targetDB.pragma('wal_checkpoint = TRUNCATE');
      targetDB.close();

      // Setup ledger with non-existent backup (will fail)
      const ledgerDb = new Database(targetPath);
      const ledger = new MigrationLedger(ledgerDb);
      ledger.initialize();
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '/nonexistent/backup.db');

      const backupManager = new BackupManager(backupDir);
      const engine = new RollbackEngine(ledgerDb, ledger, backupManager);

      const result = await engine.rollback('001');
      assert.strictEqual(result.success, false);

      // Verify target DB still has original data
      const verifyDb = new Database(targetPath, { readonly: true });
      const count = verifyDb.prepare('SELECT COUNT(*) as c FROM divisions').get() as { c: number };
      assert.strictEqual(count.c, 1, 'Target DB should still have original data');
      verifyDb.close();
      ledgerDb.close();
    });
  });

  describe('Test 5: Migration tracking metadata', () => {
    test('rollback updates ledger with rollback metadata', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      const backupResult = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test');

      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, backupResult.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);
      await engine.rollback('001', { method: 'backup' });

      const entries = ledger.getAll();
      const rolledBack = entries.find(e => e.migration_id === '001');
      assert.ok(rolledBack, 'Entry should exist');
      assert.strictEqual(rolledBack?.status, 'rolled_back');
      assert.strictEqual(rolledBack?.notes?.method, 'backup');
    });

    test('getRollbackHistory returns correct status for each migration', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      const backupResult = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test');

      // Record one as success, one as rolled_back
      ledger.recordSuccess('001', 'test1.sql', 'checksum1', 100, backupResult.backupPath);
      ledger.recordSuccess('002', 'test2.sql', 'checksum2', 100, backupResult.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);
      await engine.rollback('001', { method: 'backup' });

      const history = engine.getRollbackHistory();
      assert.strictEqual(history.length, 2);

      const rolledBack = history.find(h => h.id === '001');
      const stillSuccess = history.find(h => h.id === '002');

      assert.strictEqual(rolledBack?.status, 'rolled_back');
      assert.strictEqual(stillSuccess?.status, 'success');
      assert.strictEqual(stillSuccess?.backup_available, true);
    });
  });

  describe('Test 6: Verify rollback target', () => {
    test('verifyRollbackTarget indicates safety status', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      const backupResult = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test');

      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, backupResult.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = engine.verifyRollbackTarget('001');

      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.can_proceed, true);
      assert.strictEqual(result.issues.length, 0);
    });

    test('verifyRollbackTarget reports missing backup', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      ledger.recordSuccess('001', 'test.sql', 'checksum', 100, '');

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = engine.verifyRollbackTarget('001');

      assert.strictEqual(result.safe, false);
      assert.ok(result.issues.includes('No backup available'));
      assert.strictEqual(result.can_proceed, false);
    });

    test('verifyRollbackTarget reports when migrations applied after target', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);

      const { ledger, backupManager } = setupRollbackEngine(db, backupDir);
      const backup = await backupManager.createBackup(':memory:', { method: 'binary', verify: true }, 'test');

      ledger.recordSuccess('001', 'test1.sql', 'checksum1', 100, backup.backupPath);
      ledger.recordSuccess('002', 'test2.sql', 'checksum2', 100, backup.backupPath);

      const engine = new RollbackEngine(db, ledger, backupManager);
      const result = engine.verifyRollbackTarget('001');

      assert.strictEqual(result.safe, true);
      assert.ok(result.issues.some(i => i.includes('will also be rolled back')));
    });
  });

  describe('Test 7: Data integrity after rollback', () => {
    test('restored database passes integrity check', async () => {
      const dbPath = path.join(backupDir, 'integrity.db');
      const backupPath = path.join(backupDir, 'integrity-backup.db');

      // Create source with data
      const sourceDB = createTestDB(dbPath);
      createPhase4Schema(sourceDB.db);
      sourceDB.db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-1', 'Division 1');
      sourceDB.db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id, status) VALUES (?, ?, ?, ?, ?)")
        .run('staff-1', 'Agent 1', 'role', 'div-1', 'active');
      sourceDB.db.pragma('wal_checkpoint = TRUNCATE');
      sourceDB.close();

      // Create backup
      const backupManager = new BackupManager(backupDir);
      const backupResult = await backupManager.createBackup(dbPath, { method: 'binary', verify: true }, 'test');

      // Create empty target and restore
      const targetDB = createTestDB(path.join(backupDir, 'target-integrity.db'));
      createPhase4Schema(targetDB.db);
      targetDB.pragma('wal_checkpoint = TRUNCATE');
      targetDB.close();

      // Restore
      await backupManager.restoreBackup(backupResult.backupPath, path.join(backupDir, 'target-integrity.db'));

      // Verify integrity
      const restoredDB = new Database(path.join(backupDir, 'target-integrity.db'), { readonly: true });
      const fkCheck = restoredDB.prepare('PRAGMA foreign_key_check').all();
      assert.strictEqual(fkCheck.length, 0, 'No FK violations after restore');

      const integrityCheck = restoredDB.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      assert.strictEqual(integrityCheck.integrity_check, 'ok', 'Integrity check passes');

      restoredDB.close();
    });

    test('FK relationships preserved after rollback', async () => {
      const dbPath = path.join(backupDir, 'fk.db');

      const sourceDB = createTestDB(dbPath);
      createPhase4Schema(sourceDB.db);

      // Create data with FK relationships
      sourceDB.db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-1', 'Division 1');
      sourceDB.db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id, status) VALUES (?, ?, ?, ?, ?)")
        .run('staff-1', 'Agent 1', 'role', 'div-1', 'active');
      sourceDB.db.prepare("INSERT INTO division_members (division_id, staff_id, role) VALUES (?, ?, ?)")
        .run('div-1', 'staff-1', 'member');
      sourceDB.db.pragma('wal_checkpoint = TRUNCATE');
      sourceDB.close();

      // Backup and restore
      const backupManager = new BackupManager(backupDir);
      const backupResult = await backupManager.createBackup(dbPath, { method: 'binary', verify: true }, 'test');

      const restoredDB = createTestDB(path.join(backupDir, 'fk-restored.db'));
      await backupManager.restoreBackup(backupResult.backupPath, restoredDB.path);
      restoredDB.close();

      // Verify FK relationships
      const verifyDB = new Database(path.join(backupDir, 'fk-restored.db'), { readonly: true });
      const staff = verifyDB.prepare('SELECT division_id FROM staff_agents WHERE staff_id = ?').get('staff-1');
      assert.strictEqual(staff.division_id, 'div-1', 'FK relationship preserved');

      const members = verifyDB.prepare('SELECT * FROM division_members').all();
      assert.strictEqual(members.length, 1, 'Division members restored');
      verifyDB.close();
    });
  });
});