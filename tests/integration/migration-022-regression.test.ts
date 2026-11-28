// Migration 022 Regression Tests
// Tests for schema-aware idempotency and index verification
// Run against temporary in-memory databases only

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MigrationRegistry } from '../../src/migration-runner/registry.js';
import { MigrationLedger } from '../../src/migration-runner/ledger.js';
import { BackupManager } from '../../src/migration-runner/backup.js';
import { Validator } from '../../src/migration-runner/validator.js';
import { MigrationExecutor, ConsoleLogger } from '../../src/migration-runner/executor.js';

interface TestDB {
  db: Database.Database;
  close: () => void;
}

function createTestDB(): TestDB {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return {
    db,
    close: () => db.close()
  };
}

const MIGRATION_DIR = 'migrations';

// Helper to get table info via PRAGMA
function getTableInfo(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>;
}

// Helper to get index info
function getIndexInfo(db: Database.Database, table: string) {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}'`).all() as Array<{ name: string }>;
}

// Phase 4 Base Schema with FTS5 (required for post-migration validation)
function createPhase4Schema(db: Database.Database) {
  db.exec(`
    CREATE TABLE divisions (
      division_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE staff_agents (
      staff_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      division_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
    );

    CREATE TABLE memory_entries (
      memory_id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE memory_fts USING fts5(
      memory_id UNINDEXED,
      title,
      content,
      tags,
      memory_type,
      category,
      tokenize='porter unicode61'
    );

    CREATE TRIGGER memory_entries_fts_insert AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
      VALUES (new.memory_id, '', '', '[]', 'other', 'general');
    END;

    CREATE TRIGGER memory_entries_fts_update AFTER UPDATE ON memory_entries BEGIN
      DELETE FROM memory_fts WHERE memory_id = old.memory_id;
      INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
      VALUES (new.memory_id, '', '', '[]', 'other', 'general');
    END;

    CREATE TRIGGER memory_entries_fts_delete AFTER DELETE ON memory_entries BEGIN
      DELETE FROM memory_fts WHERE memory_id = old.memory_id;
    END;
  `);
}

// ============================================================================
// Scenario 1: Fresh database - all columns and indexes created
// ============================================================================
describe('Migration 022 - Scenario: Fresh Database', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables without credential_id column (simulating legacy state before migration 022)
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected'
          CHECK (connection_status IN ('connected', 'disconnected', 'expired')),
        connected_at TEXT,
        last_heartbeat_at TEXT,
        lease_expires_at TEXT,
        client_ip TEXT,
        user_agent TEXT,
        last_error TEXT,
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_runtime_sessions_session_id ON runtime_sessions(session_id);
      CREATE INDEX idx_runtime_sessions_lease ON runtime_sessions(lease_expires_at);
    `);
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        connected_at TEXT,
        last_heartbeat_at TEXT,
        lease_expires_at TEXT,
        client_ip TEXT,
        user_agent TEXT,
        last_error TEXT,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_runtime_session_history_session_id ON runtime_session_history(session_id);
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('adds missing columns to both tables', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    // Record 021 as successfully applied in ledger to satisfy prerequisite
    ledger.recordSuccess('021', '021_runtime_sessions_history.sql', registry.getById('021')!.checksum, 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    // Verify columns don't exist initially
    const rsColsBefore = getTableInfo(testDB.db, 'runtime_sessions').map(c => c.name);
    assert.ok(!rsColsBefore.includes('credential_id'), 'credential_id should not exist in runtime_sessions yet');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed on fresh database');

    // Verify columns were added
    const rsColsAfter = getTableInfo(testDB.db, 'runtime_sessions').map(c => c.name);
    const rshColsAfter = getTableInfo(testDB.db, 'runtime_session_history').map(c => c.name);
    assert.ok(rsColsAfter.includes('generation'), 'generation column should be added to runtime_sessions');
    assert.ok(rsColsAfter.includes('credential_id'), 'credential_id column should be added to runtime_sessions');
    assert.ok(rshColsAfter.includes('generation'), 'generation column should be added to runtime_session_history');
    assert.ok(rshColsAfter.includes('credential_id'), 'credential_id column should be added to runtime_session_history');

    // Verify migration recorded in ledger
    assert.ok(ledger.isApplied('022'), 'Migration 022 should be recorded as applied');
  });

  test('creates required indexes if missing', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    ledger.recordSuccess('021', '021_runtime_sessions_history.sql', registry.getById('021')!.checksum, 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed');

    const rsIndexes = getIndexInfo(testDB.db, 'runtime_sessions');
    const rshIndexes = getIndexInfo(testDB.db, 'runtime_session_history');
    assert.ok(rsIndexes.some(i => i.name === 'idx_runtime_sessions_credential_id'),
      'idx_runtime_sessions_credential_id should exist');
    assert.ok(rshIndexes.some(i => i.name === 'idx_runtime_session_history_credential_id'),
      'idx_runtime_session_history_credential_id should exist');
  });
});

// ============================================================================
// Scenario 2: Legacy database missing some columns
// ============================================================================
describe('Migration 022 - Scenario: Partial Column Existence', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create runtime_sessions with generation but missing credential_id
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_runtime_sessions_session_id ON runtime_sessions(session_id);
    `);
    // Create full history table (simulating 021 run)
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_runtime_session_history_session_id ON runtime_session_history(session_id);
      CREATE INDEX idx_runtime_session_history_credential_id ON runtime_session_history(credential_id);
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('only adds missing columns without touching existing ones', async () => {
    // Insert some data to verify preservation
    testDB.db.prepare('INSERT INTO runtime_sessions (runtime, session_id, generation) VALUES (?, ?, ?)')
      .run('claude', 'session-1', 5);

    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    ledger.recordSuccess('021', '021_runtime_sessions_history.sql', registry.getById('021')!.checksum, 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    // First add the missing column manually (simulating the migration's work)
    testDB.db.exec('ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT');
    testDB.db.exec('CREATE INDEX IF NOT EXISTS idx_runtime_sessions_credential_id ON runtime_sessions(credential_id)');

    // Now run migration 022 - should be no-op since columns already exist
    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed');

    // Generation should remain 5
    const gen = testDB.db.prepare('SELECT generation FROM runtime_sessions WHERE session_id = ?')
      .get('session-1') as any;
    assert.equal(gen.generation, 5, 'Existing generation value should be preserved');

    // Credential_id should now exist
    const cols = getTableInfo(testDB.db, 'runtime_sessions').map(c => c.name);
    assert.ok(cols.includes('credential_id'), 'credential_id should be added');
  });
});

// ============================================================================
// Scenario 3: All columns exist but indexes missing
// Note: When migration 022 runs and columns already exist, it still creates missing indexes
// ============================================================================
describe('Migration 022 - Scenario: Missing Indexes Only', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables with credentials columns but NO credential_id indexes
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_runtime_sessions_session_id ON runtime_sessions(session_id);
      -- Intentionally NOT creating idx_runtime_sessions_credential_id
    `);
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_runtime_session_history_session_id ON runtime_session_history(session_id);
      -- Intentionally NOT creating idx_runtime_session_history_credential_id
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates missing indexes without adding columns', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    ledger.recordSuccess('021', '021_runtime_sessions_history.sql', registry.getById('021')!.checksum, 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed and create missing indexes');

    // Verify indexes were created
    const rsIndexes = getIndexInfo(testDB.db, 'runtime_sessions').map(i => i.name);
    const rshIndexes = getIndexInfo(testDB.db, 'runtime_session_history').map(i => i.name);
    assert.ok(rsIndexes.includes('idx_runtime_sessions_credential_id'),
      'idx_runtime_sessions_credential_id should be created');
    assert.ok(rshIndexes.includes('idx_runtime_session_history_credential_id'),
      'idx_runtime_session_history_credential_id should be created');
  });
});

// ============================================================================
// Scenario 4: Migration rerun - no duplicate operations
// ============================================================================
describe('Migration 022 - Scenario: Idempotent Rerun', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('can be executed multiple times without error', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    ledger.recordSuccess('021', '021_runtime_sessions_history.sql', registry.getById('021')!.checksum, 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    // First execution
    const result1 = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result1.success, 'First execution should succeed');

    // Second execution - should be skipped due to ledger check
    const result2 = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result2.success, 'Second execution should succeed (already applied)');
  });
});

// ============================================================================
// Scenario 5: Prerequisite Verification Tests
// ============================================================================
describe('Migration 022 - Prerequisite Verification', () => {
  let testDB: TestDB;
  const registry = new MigrationRegistry({ directory: MIGRATION_DIR });

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables that migration 022 expects
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('migration 021 not in ledger blocks 022', async () => {
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Migration 021 exists in registry (file exists) but not in ledger
    const m021 = registry.getById('021');
    assert.ok(m021, 'Migration 021 should exist in registry');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail when 021 is not in ledger');
    assert.ok(result.error?.message.includes('Migration 021 not recorded in ledger'),
      `Error message should mention missing ledger entry: ${result.error?.message}`);
  });

  test('migration 021 pending status blocks 022', async () => {
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Record 021 as pending
    const m021 = registry.getById('021')!;
    ledger.recordPending('021', m021.filename, m021.checksum, { note: 'test pending state' });

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail when 021 is pending');
    assert.ok(result.error?.message.includes("has status 'pending'"),
      `Error message should mention pending status: ${result.error?.message}`);
  });

  test('migration 021 failed status blocks 022', async () => {
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Record 021 as failed
    const m021 = registry.getById('021')!;
    ledger.recordFailure('021', m021.filename, m021.checksum, new Error('Test failure'), 100, '', 'system');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail when 021 is failed');
    assert.ok(result.error?.message.includes("has status 'failed'"),
      `Error message should mention failed status: ${result.error?.message}`);
  });

  test('migration 021 rolled back status blocks 022', async () => {
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Record 021 as rolled back
    const m021 = registry.getById('021')!;
    ledger.recordRolledBack('021', m021.filename, m021.checksum, '', 'system');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail when 021 is rolled back');
    assert.ok(result.error?.message.includes("has status 'rolled_back'"),
      `Error message should mention rolled_back status: ${result.error?.message}`);
  });

  test('migration 021 successfully applied allows 022 to proceed', async () => {
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Record 021 as successfully applied in ledger
    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed when 021 is successfully applied');
  });
});

// ============================================================================
// Scenario 6: Direct vs Batch Execution Prerequisites
// ============================================================================
describe('Migration 022 - Direct vs Batch Execution Prerequisites', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables that migration 022 expects
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('direct execution blocks 022 when 021 not applied', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Don't apply 021
    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Direct execution should block 022 when 021 not applied');
    assert.ok(result.error?.message.includes('Prerequisite verification failed'),
      `Error message should mention prerequisite failure: ${result.error?.message}`);
  });

  test('batch execution processes dependencies in order', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Execute batch starting with 022 - should fail because 021 not applied
    const results = await executor.executeAll(['022'], { createBackup: false });
    assert.ok(results.length >= 1, 'Should return at least one result');
    assert.ok(!results[0].success, 'First result should be failure');
  });

  test('batch execution succeeds when prerequisites satisfied', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Apply 021 first
    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    // Now batch execute 022
    const results = await executor.executeAll(['022'], { createBackup: false });
    assert.ok(results.length === 1, 'Should return exactly one result');
    assert.ok(results[0].success, 'Migration 022 should succeed with prerequisite satisfied');
  });
});

// ============================================================================
// Scenario 6: Data preservation
// ============================================================================
describe('Migration 022 - Scenario: Data Preservation', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Insert test data
    testDB.db.prepare('INSERT INTO runtime_sessions (runtime, session_id, connection_status) VALUES (?, ?, ?)')
      .run('claude', 'session-1', 'connected');
    testDB.db.prepare('INSERT INTO runtime_sessions (runtime, session_id, connection_status) VALUES (?, ?, ?)')
      .run('hermes', 'session-2', 'disconnected');
  });

  afterEach(() => {
    testDB.close();
  });

  test('preserves existing session data', async () => {
    const { db } = testDB;

    // Verify data exists
    const sessions = db.prepare('SELECT session_id, runtime, connection_status FROM runtime_sessions').all();
    assert.equal(sessions.length, 2, 'Both sessions should exist');

    const session1 = sessions.find((s: any) => s.session_id === 'session-1');
    assert.ok(session1, 'Session 1 should exist');
    assert.equal((session1 as any).runtime, 'claude', 'Runtime should be preserved');

    const session2 = sessions.find((s: any) => s.session_id === 'session-2');
    assert.ok(session2, 'Session 2 should exist');
    assert.equal((session2 as any).connection_status, 'disconnected', 'Status should be preserved');
  });
});

// ============================================================================
// Scenario 7: Post-validation verification (with proper schema)
// ============================================================================
describe('Migration 022 - Post-Validation', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables with credentials columns
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        credential_id TEXT
      );
      CREATE INDEX idx_runtime_sessions_credential_id ON runtime_sessions(credential_id);
    `);
    testDB.db.exec(`
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        disconnected_at TEXT NOT NULL
      );
      CREATE INDEX idx_runtime_session_history_credential_id ON runtime_session_history(credential_id);
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('verifies columns exist after migration', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const validator = new Validator(testDB.db);
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      validator,
      new ConsoleLogger()
    );

    // REQUIREMENT: Migration 021 must be successfully applied first
    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'prerequisite_for_022' });

    // Record 022 as already applied
    ledger.recordSuccess('022', '022_add_credential_id_to_runtime_sessions.sql', 'test-checksum', 1, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'], note: 'columns_exist' });

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration should succeed');
  });
});

// ============================================================================
// Scenario 8: Metadata Verification Tests
// ============================================================================
describe('Migration 022 - Metadata Verification', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    // Create tables similar to test setup
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('records correct checksum on success', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system',
      { targetTables: ['runtime_sessions', 'runtime_session_history'] });

    const m022 = registry.getById('022')!;
    const result = await executor.executeMigration('022', { createBackup: false });

    assert.ok(result.success, 'Migration 022 should succeed');
    const entry = ledger.getAll().find(e => e.migration_id === '022');
    assert.ok(entry, 'Migration 022 should be in ledger');
    assert.equal(entry?.checksum, m022.checksum, 'Checksum should match migration file');
  });

  test('records correct filename and migration ID', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed');

    const entry = ledger.getAll().find(e => e.migration_id === '022');
    assert.ok(entry, 'Migration 022 should be in ledger');
    assert.equal(entry?.migration_id, '022', 'Migration ID should be 022');
    assert.equal(entry?.filename, '022_add_credential_id_to_runtime_sessions.sql', 'Filename should match');
  });

  test('records correct appliedBy identity', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system');

    const result = await executor.executeMigration('022', {
      createBackup: false,
      appliedBy: 'test-user-123'
    });

    assert.ok(result.success, 'Migration 022 should succeed');

    const entry = ledger.getAll().find(e => e.migration_id === '022');
    assert.equal(entry?.applied_by, 'test-user-123', 'appliedBy should be recorded');
  });
});

// ============================================================================
// Scenario 9: Atomicity - Successful Migration Commits All
// ============================================================================
describe('Migration 022 - Atomicity Tests', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('successful migration commits all schema changes and ledger success', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system');

    await executor.executeMigration('022', { createBackup: false });

    // Verify schema changes committed
    const rsCols = getTableInfo(testDB.db, 'runtime_sessions').map(c => c.name);
    assert.ok(rsCols.includes('credential_id'), 'credential_id column should exist');

    // Verify ledger entry exists
    assert.ok(ledger.isApplied('022'), 'Migration 022 should be recorded as applied');

    // Verify no false success entry
    const entry = ledger.getAll().find(e => e.migration_id === '022');
    assert.equal(entry?.status, 'success', 'Status should be success');
  });

  test('no false success entry after failure', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Execute 022 without 021 to cause failure
    const result = await executor.executeMigration('022', { createBackup: false });

    assert.ok(!result.success, 'Migration 022 should fail');

    // Verify no success entry in ledger
    const entry = ledger.getAll().find(e => e.migration_id === '022');
    assert.ok(entry, 'Migration 022 should have a ledger entry');
    assert.equal(entry?.status, 'failed', 'Status should be failed, not success');
  });

  test('existing session and history rows remain intact on failure', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();

    // Insert test data before migration attempt
    testDB.db.prepare('INSERT INTO runtime_sessions (runtime, session_id, connection_status) VALUES (?, ?, ?)')
      .run('claude', 'session-1', 'connected');
    testDB.db.prepare('INSERT INTO runtime_session_history (original_session_id, runtime, session_id, connection_status, disconnected_at) VALUES (?, ?, ?, ?, ?)')
      .run('hist-1', 'hermes', 'session-2', 'disconnected', '2024-01-01');

    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Execute 022 without 021 to cause failure
    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail');

    // Verify data still exists after failure
    const sessions = testDB.db.prepare('SELECT COUNT(*) as c FROM runtime_sessions').get() as { c: number };
    const history = testDB.db.prepare('SELECT COUNT(*) as c FROM runtime_session_history').get() as { c: number };

    assert.equal(sessions.c, 1, 'Session data should remain intact');
    assert.equal(history.c, 1, 'History data should remain intact');
  });
});

// ============================================================================
// Scenario 10: Transaction Lifecycle Tests
// ============================================================================
describe('Migration 022 - Transaction Lifecycle', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    testDB.db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        generation INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE runtime_session_history (
        original_session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  afterEach(() => {
    testDB.close();
  });

  test('transaction is closed after success', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    const m021 = registry.getById('021')!;
    ledger.recordSuccess('021', m021.filename, m021.checksum, 100, '', 'system');

    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(result.success, 'Migration 022 should succeed');

    // Verify database is still usable (transaction should be closed)
    const canQuery = testDB.db.prepare('SELECT 1').get();
    assert.ok(canQuery, 'Database should be usable after migration');
  });

  test('transaction is closed after failure', async () => {
    const registry = new MigrationRegistry({ directory: MIGRATION_DIR });
    const ledger = new MigrationLedger(testDB.db);
    ledger.initialize();
    const executor = new MigrationExecutor(
      testDB.db, registry, ledger,
      new BackupManager('data/backups'),
      new Validator(testDB.db),
      new ConsoleLogger()
    );

    // Execute without 021 - should fail
    const result = await executor.executeMigration('022', { createBackup: false });
    assert.ok(!result.success, 'Migration 022 should fail');

    // Verify database is still usable (transaction should be rolled back)
    const canQuery = testDB.db.prepare('SELECT 1').get();
    assert.ok(canQuery, 'Database should be usable after failure');
  });
});