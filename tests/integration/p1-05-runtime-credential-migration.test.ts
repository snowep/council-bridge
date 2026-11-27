// P1-05: Integration tests for runtime credential forward migration
// Tests that migration 022 correctly handles:
// 1. Fresh install where 017 already has columns (idempotent)
// 2. Legacy databases where 017 was applied but columns are missing

import { describe, it } from 'node:test';
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

// Create runtime_sessions table WITHOUT generation and credential_id columns
// This simulates an old migration 017 that was applied before columns were added
function createLegacyRuntimeSessions(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_sessions (
      runtime TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      connection_status TEXT NOT NULL,
      connected_at TEXT,
      last_heartbeat_at TEXT,
      lease_expires_at TEXT,
      client_ip TEXT,
      user_agent TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_runtime
      ON runtime_sessions(connection_status)
      WHERE connection_status = 'connected';

    CREATE INDEX IF NOT EXISTS idx_runtime_sessions_active
      ON runtime_sessions(connection_status)
      WHERE connection_status IN ('connecting', 'connected', 'switching');

    CREATE INDEX IF NOT EXISTS idx_runtime_sessions_session_id
      ON runtime_sessions(session_id);

    CREATE INDEX IF NOT EXISTS idx_runtime_sessions_lease
      ON runtime_sessions(lease_expires_at);
  `);
}

function setupMigrationRunner(db: Database.Database) {
  const registry = new MigrationRegistry({ directory: 'migrations' });
  const ledger = new MigrationLedger(db);
  ledger.initialize();
  const backupManager = new BackupManager('data/backups');
  const validator = new Validator(db);
  const logger = new ConsoleLogger();
  const executor = new MigrationExecutor(db, registry, ledger, backupManager, validator, logger);
  return { registry, ledger, backupManager, validator, executor, logger };
}

describe('P1-05: Runtime Credential Forward Migration', () => {
  describe('Fresh Installation (migration 017 creates table with columns)', () => {
    it('should have generation and credential_id after running migration 017', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Run just migration 017 which creates the table with generation/credential_id
      const { executor } = setupMigrationRunner(db);
      await executor.executeAll(['017'], { createBackup: false });

      // Verify columns exist (migration 017 creates them)
      const columns = db.prepare('PRAGMA table_info(runtime_sessions)').all() as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      assert.ok(columnNames.includes('generation'), 'generation column should exist from migration 017');
      assert.ok(columnNames.includes('credential_id'), 'credential_id column should exist from migration 017');

      db.close();
    });
  });

  describe('Legacy Database', () => {
    it('should add missing columns to runtime_sessions for legacy databases', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Create runtime_sessions WITHOUT generation and credential_id (legacy state)
      createLegacyRuntimeSessions(db);

      // Create runtime_session_history (migration 021)
      db.exec(`CREATE TABLE IF NOT EXISTS runtime_session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        credential_id TEXT,
        connection_status TEXT NOT NULL,
        connected_at TEXT,
        last_heartbeat_at TEXT,
        lease_expires_at TEXT,
        client_ip TEXT,
        user_agent TEXT,
        last_error TEXT,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Verify columns are missing
      const columnsBefore = db.prepare('PRAGMA table_info(runtime_sessions)').all() as Array<{ name: string }>;
      const columnNamesBefore = columnsBefore.map(c => c.name);

      assert.ok(!columnNamesBefore.includes('generation'), 'generation column should be missing before migration 022');
      assert.ok(!columnNamesBefore.includes('credential_id'), 'credential_id column should be missing before migration 022');

      // Run migration 022 through executor to add missing columns
      const { ledger, executor } = setupMigrationRunner(db);
      await executor.executeAll(['022'], { createBackup: false });

      // Verify migration is recorded as successful
      assert.ok(ledger.isApplied('022'), 'Migration 022 should be marked as applied');

      // Verify columns now exist
      const columnsAfter = db.prepare('PRAGMA table_info(runtime_sessions)').all() as Array<{ name: string }>;
      const columnNamesAfter = columnsAfter.map(c => c.name);

      assert.ok(columnNamesAfter.includes('generation'), 'generation column should be added');
      assert.ok(columnNamesAfter.includes('credential_id'), 'credential_id column should be added');

      // Verify default value for generation
      db.prepare('INSERT INTO runtime_sessions (runtime, session_id, connection_status) VALUES (?, ?, ?)')
        .run('test-runtime', 'test-session-123', 'connected');

      const testData = db.prepare('SELECT generation, credential_id FROM runtime_sessions WHERE runtime = ?').get('test-runtime') as { generation: number; credential_id: string | null };
      assert.strictEqual(testData.generation, 0, 'generation should default to 0');
      assert.strictEqual(testData.credential_id, null, 'credential_id should default to NULL');

      db.close();
    });
  });

  describe('Migration Runner Execution', () => {
    it('should handle duplicate column errors gracefully (idempotent)', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Create runtime_sessions with columns already present (like from 017)
      createLegacyRuntimeSessions(db);
      db.exec('ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0');
      db.exec('ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT');

      // Create history table (migration 022 also touches this)
      db.exec(`CREATE TABLE IF NOT EXISTS runtime_session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        credential_id TEXT,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Initialize migration runner
      const { ledger, executor } = setupMigrationRunner(db);

      // Run migration 022 - should succeed because it handles duplicate columns
      await executor.executeAll(['022'], { createBackup: false });

      // Verify migration is recorded as successful
      assert.ok(ledger.isApplied('022'), 'Migration 022 should be marked as applied');

      db.close();
    });
  });

  describe('After Migration', () => {
    it('should be able to use database bootstrap correctly after migration 022', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Create legacy runtime_sessions without columns
      createLegacyRuntimeSessions(db);

      // Create history table
      db.exec(`CREATE TABLE IF NOT EXISTS runtime_session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        credential_id TEXT,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Run migration 022 through executor
      const { executor } = setupMigrationRunner(db);
      await executor.executeAll(['022'], { createBackup: false });

      // Verify we can insert a session with generation and credential_id
      db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, generation, credential_id)
        VALUES (?, ?, ?, ?, ?)
      `).run('claude', 'test-session-123', 'connected', 1, 'cred-abc-123');

      const session = db.prepare('SELECT * FROM runtime_sessions WHERE runtime = ?').get('claude');
      assert.strictEqual((session as any)?.generation, 1, 'session should have correct generation');
      assert.strictEqual((session as any)?.credential_id, 'cred-abc-123', 'session should have correct credential_id');

      db.close();
    });

    it('should handle idempotency when run multiple times', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      createLegacyRuntimeSessions(db);
      db.exec('ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0');
      db.exec('ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT');

      // Create history table
      db.exec(`CREATE TABLE IF NOT EXISTS runtime_session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        credential_id TEXT,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Run migration 022 multiple times via executor
      const { ledger, executor } = setupMigrationRunner(db);

      await executor.executeAll(['022'], { createBackup: false });

      // Run again - should still succeed
      await executor.executeAll(['022'], { createBackup: false, force: true });

      const columns = db.prepare('PRAGMA table_info(runtime_sessions)').all() as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);
      assert.ok(columnNames.includes('generation'), 'generation should exist after repeated runs');
      assert.ok(columnNames.includes('credential_id'), 'credential_id should exist after repeated runs');

      db.close();
    });
  });

  describe('Foreign Key Integrity', () => {
    it('should maintain FK constraints after migration 022', async () => {
      const { db } = createTestDB();
      db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);

      // Create runtime_sessions with columns from start
      db.exec(`
      CREATE TABLE runtime_sessions (
        runtime TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        connection_status TEXT NOT NULL,
        connected_at TEXT,
        last_heartbeat_at TEXT,
        lease_expires_at TEXT,
        client_ip TEXT,
        user_agent TEXT,
        last_error TEXT,
        generation INTEGER DEFAULT 0,
        credential_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE execution_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        runtime_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        generation INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (runtime_id) REFERENCES runtime_sessions(runtime) ON DELETE CASCADE
      );

      CREATE TABLE runtime_session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        credential_id TEXT,
        connection_status TEXT NOT NULL,
        generation INTEGER DEFAULT 0,
        disconnected_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      `);

      // Run migration 022 through executor
      const { executor } = setupMigrationRunner(db);
      await executor.executeAll(['022'], { createBackup: false });

      // Insert test session
      db.prepare('INSERT INTO runtime_sessions (runtime, session_id, connection_status) VALUES (?, ?, ?)')
        .run('claude', 'test-sess-1', 'connected');

      // Insert execution record that references session
      const now = Date.now();
      db.prepare(`
        INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, generation)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('exec-1', 'test-sess-1', 'claude', now, now + 60000, 1);

      // Verify FK integrity
      const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
      assert.strictEqual(fkCheck.length, 0, 'No foreign key violations');

      // Verify cascading delete works
      db.prepare('DELETE FROM runtime_sessions WHERE runtime = ?').run('claude');
      const remainingExec = db.prepare('SELECT * FROM execution_records WHERE session_id = ?').get('test-sess-1');
      assert.strictEqual(remainingExec, undefined, 'execution records should cascade delete');

      db.close();
    });
  });
});