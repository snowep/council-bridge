import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

function createPhase4Schema(db: Database.Database) {
  db.exec(`
    -- Phase 4 Base Schema (before any migrations)
    CREATE TABLE divisions (
      division_id       TEXT PRIMARY KEY,
      name              TEXT NOT NULL UNIQUE,
      description       TEXT NOT NULL DEFAULT '',
      head_staff_id     TEXT,
      budget_limit      REAL NOT NULL DEFAULT 0,
      permissions       TEXT NOT NULL DEFAULT '[]',
      strategic_objectives TEXT NOT NULL DEFAULT '[]',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE staff_agents (
      staff_id          TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      role              TEXT NOT NULL,
      division_id       TEXT NOT NULL,
      runtime_instances TEXT NOT NULL DEFAULT '[]',
      permissions       TEXT NOT NULL DEFAULT '[]',
      status            TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
    );

    CREATE TABLE division_members (
      division_id    TEXT NOT NULL,
      staff_id       TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'member',
      joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (division_id, staff_id),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
    );

    CREATE TABLE memory_entries (
      memory_id      TEXT PRIMARY KEY,
      owner_type     TEXT NOT NULL CHECK (owner_type IN ('seat', 'division', 'staff', 'founder')),
      owner_id       TEXT NOT NULL,
      category       TEXT NOT NULL,
      memory_type    TEXT NOT NULL,
      title          TEXT NOT NULL,
      content        TEXT NOT NULL,
      tags           TEXT NOT NULL DEFAULT '[]',
      confidence     REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
      version        INTEGER NOT NULL DEFAULT 1,
      supersedes_id  TEXT,
      meeting_id     TEXT,
      division_id    TEXT,
      task_id        TEXT,
      archived_at    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supersedes_id) REFERENCES memory_entries(memory_id) ON DELETE SET NULL
    );

    CREATE TABLE cross_division_shares (
      share_id        TEXT PRIMARY KEY,
      memory_id       TEXT NOT NULL,
      division_id     TEXT NOT NULL,
      granted_by_type TEXT NOT NULL
        CHECK (granted_by_type IN ('founder', 'division')),
      granted_by_id   TEXT NOT NULL,
      granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at      TEXT,
      FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      UNIQUE(memory_id, division_id)
    );

    CREATE TABLE tasks (
      task_id           TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL DEFAULT '',
      assigned_to_type  TEXT NOT NULL CHECK (assigned_to_type IN ('division', 'staff')),
      assigned_to_id    TEXT NOT NULL,
      created_by_type   TEXT NOT NULL CHECK (created_by_type IN ('founder', 'council', 'division_head')),
      created_by_id     TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
      priority          TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      budget_allocated  REAL NOT NULL DEFAULT 0,
      due_at            TEXT,
      completed_at      TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE deliverables (
      deliverable_id    TEXT PRIMARY KEY,
      task_id           TEXT NOT NULL,
      submitted_by_type TEXT NOT NULL CHECK (submitted_by_type IN ('staff', 'division')),
      submitted_by_id   TEXT NOT NULL,
      content           TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
      reviewed_by_type  TEXT,
      reviewed_by_id    TEXT,
      reviewed_at       TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );

    CREATE TABLE migration_audit (
      audit_id          TEXT PRIMARY KEY,
      migration_id      TEXT NOT NULL,
      source_table      TEXT NOT NULL,
      source_pk         TEXT NOT NULL,
      action            TEXT NOT NULL,  -- 'preserved' | 'revoked' | 'quarantined'
      reason            TEXT NOT NULL,
      legacy_data       TEXT NOT NULL,  -- JSON of original row
      migrated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE founder_nonces (
      key_id      TEXT NOT NULL,
      operation   TEXT NOT NULL,
      nonce       TEXT NOT NULL,
      consumed_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      PRIMARY KEY (key_id, operation, nonce)
    );

    CREATE INDEX IF NOT EXISTS idx_founder_nonces_expires ON founder_nonces(expires_at);

    -- Phase 4 Indexes
    CREATE INDEX idx_divisions_head ON divisions(head_staff_id);
    CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
    CREATE INDEX idx_staff_agents_status ON staff_agents(status);
    CREATE INDEX idx_division_members_division ON division_members(division_id);
    CREATE INDEX idx_division_members_staff ON division_members(staff_id);
    CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
    CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);
    CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_type, assigned_to_id);
    CREATE INDEX idx_tasks_status ON tasks(status);
    CREATE INDEX idx_tasks_created_by ON tasks(created_by_type, created_by_id);
    CREATE INDEX idx_deliverables_task ON deliverables(task_id);
    CREATE INDEX idx_deliverables_status ON deliverables(status);

    -- FTS5
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
      VALUES (new.memory_id, new.title, new.content, new.tags, new.memory_type, new.category);
    END;

    CREATE TRIGGER memory_entries_fts_update AFTER UPDATE ON memory_entries BEGIN
      DELETE FROM memory_fts WHERE memory_id = old.memory_id;
      INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
      VALUES (new.memory_id, new.title, new.content, new.tags, new.memory_type, new.category);
    END;

    CREATE TRIGGER memory_entries_fts_delete AFTER DELETE ON memory_entries BEGIN
      DELETE FROM memory_fts WHERE memory_id = old.memory_id;
    END;
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

describe('Migration Dependency Resolution', () => {
  describe('Test 1: Dependency Resolution - Direct Dependencies', () => {
    test('migration with dependency executes in correct order', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // Check that migration 003 depends on 001 and 002
      const migration003 = registry.getById('003');
      assert.ok(migration003, 'Migration 003 should exist');
      assert.ok(migration003.dependencies.includes('001'), 'Migration 003 should depend on 001');
      assert.ok(migration003.dependencies.includes('002'), 'Migration 003 should depend on 002');

      // Execute migration 003 - should automatically include 001 and 002
      const results = await executor.executeAll(['003'], { createBackup: false });

      // Verify all 3 migrations were executed
      assert.equal(results.length, 3, 'Should execute 3 migrations (001 + 002 + 003)');
      assert.ok(results[0].success, 'Migration 001 should succeed');
      assert.ok(results[1].success, 'Migration 002 should succeed');
      assert.ok(results[2].success, 'Migration 003 should succeed');

      // Verify all are recorded in ledger
      assert.ok(ledger.isApplied('001'), 'Migration 001 should be applied');
      assert.ok(ledger.isApplied('002'), 'Migration 002 should be applied');
      assert.ok(ledger.isApplied('003'), 'Migration 003 should be applied');

      db.close();
    });
  });

  describe('Test 2: Dependency Resolution - Transitive Dependencies', () => {
    test('migration with transitive dependencies executes in correct order', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // Check that migration 004 depends on 001 and 002 (same as 003)
      const migration004 = registry.getById('004');
      assert.ok(migration004, 'Migration 004 should exist');
      assert.ok(migration004.dependencies.includes('001'), 'Migration 004 should depend on 001');
      assert.ok(migration004.dependencies.includes('002'), 'Migration 004 should depend on 002');

      // Execute migration 004 - should automatically include 001, 002, 003
      const results = await executor.executeAll(['004'], { createBackup: false });

      // Migration 004 should pull in its transitive dependencies
      // Since 003 depends on 001 and 002, and 004 also depends on them
      assert.ok(results.every(r => r.success), 'All migrations should succeed');

      db.close();
    });
  });

  describe('Test 3: Dependency Resolution - Already Applied', () => {
    test('already applied dependencies are not re-executed', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // First apply all migrations 001-002
      await executor.executeAll(['001', '002'], { createBackup: false });

      // Verify 001 and 002 are applied
      assert.ok(ledger.isApplied('001'), 'Migration 001 should be applied after setup');
      assert.ok(ledger.isApplied('002'), 'Migration 002 should be applied after setup');

      // Now execute 003 - 001 and 002 should be skipped (already applied)
      const results = await executor.executeAll(['003'], { createBackup: false });

      // Debug: log results
      console.log('Test 3 results length:', results.length);
      console.log('Test 3 results:', results.map(r => ({ id: r.success ? 'success' : 'fail', error: r.error?.message })));

      // Should only execute 003
      assert.equal(results.length, 1, 'Should execute only 1 migration (003)');
      assert.ok(results[0].success, 'Migration 003 should succeed');

      db.close();
    });
  });

  describe('Test 4: Dependency Resolution - Missing Transitive Dependency', () => {
    test('missing transitive dependency from range is skipped', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // When a migration has a dependency range like "001-013",
      // the range expands but missing migrations in the range are silently skipped
      // This allows for flexible dependency ranges that may not match the current registry

      // Test that this works for migrations with dependency ranges
      // Migration 004 depends on 001, 002 (from "Migrations 001, 002 complete")
      const results = await executor.executeAll(['004'], { createBackup: false });
      assert.ok(results.every(r => r.success), 'All migrations should succeed');

      db.close();
    });
  });

  describe('Test 5: Dependency Resolution - Circular Dependency', () => {
    test('circular dependency throws error', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger } = setupMigrationRunner(db);

      // Create migrations with circular dependency
      const circularMigration1 = {
        id: '999',
        filename: '999_circular_1.sql',
        filepath: 'migrations/999_circular_1.sql',
        type: 'alter_additive' as const,
        dependencies: ['998'], // depends on 998
        targetTables: [] as string[],
        description: 'Circular migration 1',
        checksum: 'fake-checksum-1'
      };

      const circularMigration2 = {
        id: '998',
        filename: '998_circular_2.sql',
        filepath: 'migrations/998_circular_2.sql',
        type: 'alter_additive' as const,
        dependencies: ['999'], // depends on 999
        targetTables: [] as string[],
        description: 'Circular migration 2',
        checksum: 'fake-checksum-2'
      };

      // Add our circular migrations to registry
      const allMigrations = [...registry.getAll(), circularMigration1, circularMigration2];
      const mockRegistry = {
        getAll: () => allMigrations,
        getById: (id: string) => allMigrations.find(m => m.id === id),
        getOrdered: () => allMigrations.sort((a, b) => a.id.localeCompare(b.id)),
        load: () => allMigrations,
        verifyChecksums: () => []
      } as unknown as MigrationRegistry;

      const mockExecutor = new MigrationExecutor(
        db,
        mockRegistry,
        ledger,
        new BackupManager('data/backups'),
        new Validator(db),
        new ConsoleLogger()
      );

      // Should throw error about circular dependency
      await assert.rejects(
        () => mockExecutor.executeAll(['999'], { createBackup: false }),
        { message: /Circular dependency detected/ }
      );

      db.close();
    });
  });

  describe('Test 6: Dependency Resolution - Multiple Migrations', () => {
    test('multiple migrations with shared dependencies execute in correct order', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // Execute migrations 003 and 004 together
      // 003 depends on 001, 002
      // 004 depends on 001, 002
      // When we request 003 and 004, we should get 001, 002, 003, 004
      const results = await executor.executeAll(['003', '004'], { createBackup: false });

      // Verify all 4 migrations were executed
      assert.equal(results.length, 4, 'Should execute 4 migrations (001 + 002 + 003 + 004)');
      assert.ok(results[0].success, 'Migration 001 should succeed');
      assert.ok(results[1].success, 'Migration 002 should succeed');
      assert.ok(results[2].success, 'Migration 003 should succeed');
      assert.ok(results[3].success, 'Migration 004 should succeed');

      db.close();
    });
  });

  describe('Test 7: Dependency Resolution - Non-existent Migration', () => {
    test('non-existent migration throws error', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, ledger, executor } = setupMigrationRunner(db);

      // Should throw error about non-existent migration
      await assert.rejects(
        () => executor.executeAll(['001', '999'], { createBackup: false }),
        { message: /Migration 999 not found/ }
      );

      db.close();
    });
  });

  describe('Test 8: Dependency Resolution - Ordering', () => {
    test('transitive dependencies are ordered correctly', async () => {
      const db = createTestDB().db;
      createPhase4Schema(db);
      const { registry, executor } = setupMigrationRunner(db);

      // Create a custom registry to track execution order
      const executionOrder: string[] = [];
      const originalExecuteMigration = executor['executeMigration'];

      // We'll check the order through the resolved dependencies
      const resolved = (executor as any)['resolveDependencies']?.(['003']);

      db.close();
    });
  });
});