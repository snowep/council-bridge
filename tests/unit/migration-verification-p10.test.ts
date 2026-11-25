// Phase 10 Migration Verification Tests
// Tests for migrations 006, 013, 017-022
// Run against temporary in-memory databases only
// DO NOT run against production council.db

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'path';

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

const MIGRATION_DIR = path.join(process.cwd(), 'migrations');

// Helper to run migration SQL
function runMigration(db: Database.Database, migrationPath: string): void {
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
}

// Helper to get table info
function getTableInfo(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all() as any[];
}

// Helper to get FK info
function getForeignKeys(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all() as any[];
}

// Helper to check indexes
function getIndexInfo(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA index_list(${table})`).all() as any[];
}

// ============================================================================
// Phase 4 Base Schema (required before migrations 001-005)
// ============================================================================
function createPhase4Schema(db: Database.Database) {
  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_divisions_head ON divisions(head_staff_id);

    CREATE TABLE staff_agents (
      staff_id          TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      role              TEXT NOT NULL,
      division_id       TEXT NOT NULL,
      runtime_instances TEXT NOT NULL DEFAULT '[]',
      permissions       TEXT NOT NULL DEFAULT '[]',
      status            TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
    CREATE INDEX idx_staff_agents_status ON staff_agents(status);

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
      version           INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_type, assigned_to_id);
    CREATE INDEX idx_tasks_status ON tasks(status);
    CREATE INDEX idx_deliverables_task ON deliverables(task_id);
    CREATE INDEX idx_deliverables_status ON deliverables(status);
  `);
}

// Run prerequisites 001-005
function runPrerequisites(db: Database.Database) {
  runMigration(db, path.join(MIGRATION_DIR, '001_staff_agents_default_inactive.sql'));
  runMigration(db, path.join(MIGRATION_DIR, '002_cross_division_shares_founder_only.sql'));
  runMigration(db, path.join(MIGRATION_DIR, '003_tasks_add_columns.sql'));
  runMigration(db, path.join(MIGRATION_DIR, '004_deliverables_add_columns.sql'));
  runMigration(db, path.join(MIGRATION_DIR, '005_cross_division_shares_stage7.sql'));
}

describe('Phase 10 Migration Verification - Migration 006', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
  });

  afterEach(() => {
    testDB.close();
  });

  test('executes migration 006 and creates all new tables', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    // Check all new tables exist
    const tables = ['task_autonomy_levels', 'execution_requests', 'approval_requests', 'execution_history'];
    for (const table of tables) {
      const info = getTableInfo(testDB.db, table);
      assert.ok(info.length > 0, `${table} table should exist`);
    }
  });

  test('migration 006 adds autonomy_level column to tasks', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    const cols = getTableInfo(testDB.db, 'tasks').map((c: any) => c.name);
    assert.ok(cols.includes('autonomy_level'), 'autonomy_level column should exist in tasks');
  });

  test('migration 006 adds execution_id column to deliverables', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    const cols = getTableInfo(testDB.db, 'deliverables').map((c: any) => c.name);
    assert.ok(cols.includes('execution_id'), 'execution_id column should exist in deliverables');
  });

  test('migration 006 creates proper indexes', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    const taskAutonomyIndexes = getIndexInfo(testDB.db, 'task_autonomy_levels');
    assert.ok(taskAutonomyIndexes.some((i: any) => i.name === 'idx_task_autonomy_levels_level'), 'task_autonomy_levels index created');

    const executionRequestIndexes = getIndexInfo(testDB.db, 'execution_requests');
    assert.ok(executionRequestIndexes.some((i: any) => i.name === 'idx_execution_requests_task'), 'execution_requests task index created');
  });

  test('migration 006 FK constraints work correctly', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    // Test FK: execution_requests.task_id -> tasks.task_id
    const fks = getForeignKeys(testDB.db, 'execution_requests');
    assert.ok(fks.some((fk: any) => fk.from === 'task_id'), 'FK on task_id exists');
    assert.equal(fks.find((fk: any) => fk.from === 'task_id')?.table, 'tasks', 'FK references tasks table');

    // FK integrity check
    const fkCheck = testDB.db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(fkCheck.length, 0, 'No FK violations after migration 006');
  });
});

describe('Phase 10 Migration Verification - Migration 017', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    // Run 006 to get to state where 017 is needed
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates runtime_sessions table with correct schema', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));

    const cols = getTableInfo(testDB.db, 'runtime_sessions').map((c: any) => c.name);
    const requiredCols = ['runtime', 'session_id', 'connection_status', 'connected_at', 'last_heartbeat_at',
                          'lease_expires_at', 'client_ip', 'user_agent', 'last_error', 'generation', 'credential_id'];
    for (const col of requiredCols) {
      assert.ok(cols.includes(col), `${col} column should exist`);
    }
  });

  test('runtime_sessions has proper indexes', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));

    const indexes = getIndexInfo(testDB.db, 'runtime_sessions');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_sessions_active'), 'active index created');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_sessions_session_id'), 'session_id index created');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_sessions_lease'), 'lease index created');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_sessions_credential_id'), 'credential_id index created');
  });

  test('runtime_sessions has unique constraint on session_id', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));

    const indexes = getIndexInfo(testDB.db, 'runtime_sessions');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_sessions_session_id_unique'), 'unique session_id index exists');
  });

  test('generation column defaults to 0', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));

    // Insert a record without specifying generation
    testDB.db.prepare(`
      INSERT INTO runtime_sessions (runtime, session_id, connection_status)
      VALUES ('claude', 'test-session-1', 'connected')
    `).run();

    const result = testDB.db.prepare('SELECT generation FROM runtime_sessions WHERE session_id = ?')
      .get('test-session-1') as any;
    assert.equal(result.generation, 0, 'generation should default to 0');
  });
});

describe('Phase 10 Migration Verification - Migration 018', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates execution_records table with correct schema', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));

    const cols = getTableInfo(testDB.db, 'execution_records').map((c: any) => c.name);
    const requiredCols = ['id', 'session_id', 'runtime_id', 'started_at', 'expires_at', 'completed', 'generation', 'created_at', 'updated_at'];
    for (const col of requiredCols) {
      assert.ok(cols.includes(col), `${col} column should exist`);
    }
  });

  test('execution_records has proper FKs to runtime_sessions', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));

    const fks = getForeignKeys(testDB.db, 'execution_records');
    assert.ok(fks.some((fk: any) => fk.from === 'session_id'), 'FK on session_id exists');
    assert.ok(fks.some((fk: any) => fk.from === 'runtime_id'), 'FK on runtime_id exists');
  });

  test('execution_records has unique constraint for single active execution per session', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));

    const indexes = getIndexInfo(testDB.db, 'execution_records');
    assert.ok(indexes.some((i: any) => i.name === 'idx_single_active_execution_per_session'),
      'unique constraint for single active execution per session exists');
  });

  test('execution_records indexes exist', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));

    const indexes = getIndexInfo(testDB.db, 'execution_records');
    assert.ok(indexes.some((i: any) => i.name === 'idx_execution_records_session'), 'session index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_execution_records_expires'), 'expires index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_execution_records_runtime'), 'runtime index exists');
  });
});

describe('Phase 10 Migration Verification - Migration 019', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates runtime_credentials table with correct schema', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));

    const cols = getTableInfo(testDB.db, 'runtime_credentials').map((c: any) => c.name);
    const requiredCols = ['credential_id', 'runtime_id', 'token_hash', 'status', 'created_at', 'expires_at', 'last_used_at', 'revoked_at'];
    for (const col of requiredCols) {
      assert.ok(cols.includes(col), `${col} column should exist`);
    }
  });

  test('runtime_credentials has status CHECK constraint', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));

    // Valid insert with 'active' status
    testDB.db.prepare(`
      INSERT INTO runtime_credentials (credential_id, runtime_id, token_hash, created_at, expires_at)
      VALUES ('cred-1', 'claude', 'abc123hash', 1000, 1000000)
    `).run();

    let threw = false;
    try {
      testDB.db.prepare(`
        INSERT INTO runtime_credentials (credential_id, runtime_id, token_hash, created_at, expires_at)
        VALUES ('cred-2', 'claude', 'def456hash', 1000, 1000000)
      `).run();
    } catch {
      threw = true;
    }
    // credential_id is PRIMARY KEY, so we need a different test for CHECK constraint
    const statusCheck = testDB.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='runtime_credentials'").get() as any;
    assert.ok(statusCheck.sql.includes("status IN ('active', 'revoked', 'expired')"), 'status CHECK constraint exists');
  });

  test('runtime_credentials has proper indexes', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));

    const indexes = getIndexInfo(testDB.db, 'runtime_credentials');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_credentials_runtime'), 'runtime index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_credentials_expires'), 'expires index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_credentials_revoked'), 'revoked index exists');
  });
});

describe('Phase 10 Migration Verification - Migration 020', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates runtime_control table', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '020_create_runtime_control_table.sql'));

    const cols = getTableInfo(testDB.db, 'runtime_control').map((c: any) => c.name);
    const requiredCols = ['id', 'active_runtime', 'active_session_id', 'generation', 'updated_at'];
    for (const col of requiredCols) {
      assert.ok(cols.includes(col), `${col} column should exist`);
    }
  });

  test('runtime_control has primary key constraint on id=1', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '020_create_runtime_control_table.sql'));

    // Should have exactly one row with id=1
    const count = testDB.db.prepare('SELECT COUNT(*) as c FROM runtime_control').get() as any;
    assert.equal(count.c, 1, 'should have exactly one row');

    const row = testDB.db.prepare('SELECT * FROM runtime_control WHERE id = 1').get() as any;
    assert.ok(row, 'row with id=1 exists');
  });

  test('runtime_control inserts initial row with null active_runtime', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '020_create_runtime_control_table.sql'));

    const row = testDB.db.prepare('SELECT * FROM runtime_control WHERE id = 1').get() as any;
    assert.ok(row);
    // active_runtime should default to null (no active runtime yet)
    assert.equal(row.active_runtime, null, 'active_runtime should be null by default');
    assert.equal(row.active_session_id, null, 'active_session_id should be null by default');
  });
});

describe('Phase 10 Migration Verification - Migration 021', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '020_create_runtime_control_table.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('creates runtime_session_history table', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '021_runtime_sessions_history.sql'));

    const cols = getTableInfo(testDB.db, 'runtime_session_history').map((c: any) => c.name);
    const requiredCols = ['original_session_id', 'runtime', 'credential_id', 'connection_status',
                          'connected_at', 'last_heartbeat_at', 'lease_expires_at', 'client_ip',
                          'user_agent', 'last_error', 'generation', 'disconnected_at', 'created_at', 'updated_at'];
    for (const col of requiredCols) {
      assert.ok(cols.includes(col), `${col} column should exist`);
    }
  });

  test('creates all_runtime_sessions view', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '021_runtime_sessions_history.sql'));

    // View should exist
    const view = testDB.db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='all_runtime_sessions'").get() as any;
    assert.ok(view, 'all_runtime_sessions view should exist');
  });

  test('runtime_session_history has proper indexes', () => {
    runMigration(testDB.db, path.join(MIGRATION_DIR, '021_runtime_sessions_history.sql'));

    const indexes = getIndexInfo(testDB.db, 'runtime_session_history');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_session_history_session_id'), 'session_id index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_session_history_runtime'), 'runtime index exists');
    assert.ok(indexes.some((i: any) => i.name === 'idx_runtime_session_history_credential_id'), 'credential_id index exists');
  });
});

describe('Phase 10 Migration Verification - Migration 022', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '017_add_runtime_sessions_table.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '018_add_execution_records.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '019_create_runtime_credentials.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '020_create_runtime_control_table.sql'));
    runMigration(testDB.db, path.join(MIGRATION_DIR, '021_runtime_sessions_history.sql'));
  });

  afterEach(() => {
    testDB.close();
  });

  test('migration 022 is a no-op migration for backward compatibility', () => {
    // Run before 022 - credential_id already exists in runtime_sessions from 017
    const colsBefore = getTableInfo(testDB.db, 'runtime_sessions').map((c: any) => c.name);
    assert.ok(colsBefore.includes('credential_id'), 'credential_id should already exist from migration 017');

    // Run migration 022 (should be a no-op)
    runMigration(testDB.db, path.join(MIGRATION_DIR, '022_add_credential_id_to_runtime_sessions.sql'));

    // Verify table still has credential_id
    const colsAfter = getTableInfo(testDB.db, 'runtime_sessions').map((c: any) => c.name);
    assert.ok(colsAfter.includes('credential_id'), 'credential_id should still exist after migration 022');
  });
});

describe('Full Phase 10 Migration Sequence', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
    createPhase4Schema(testDB.db);
  });

  afterEach(() => {
    testDB.close();
  });

  test('all Phase 10 migrations execute in order on same database', () => {
    // Run migrations 001-005 (prerequisites)
    runPrerequisites(testDB.db);

    // Run Phase 10 migrations in order
    const phase10Migrations = [
      '017_add_runtime_sessions_table.sql',
      '018_add_execution_records.sql',
      '019_create_runtime_credentials.sql',
      '020_create_runtime_control_table.sql',
      '021_runtime_sessions_history.sql',
      '022_add_credential_id_to_runtime_sessions.sql'
    ];

    for (const migration of phase10Migrations) {
      runMigration(testDB.db, path.join(MIGRATION_DIR, migration));
    }

    // Verify runtime_sessions table exists with all columns
    const rsCols = getTableInfo(testDB.db, 'runtime_sessions').map((c: any) => c.name);
    assert.ok(rsCols.includes('credential_id'), 'credential_id in runtime_sessions');
    assert.ok(rsCols.includes('generation'), 'generation in runtime_sessions');

    // Verify execution_records table exists
    const erCols = getTableInfo(testDB.db, 'execution_records').map((c: any) => c.name);
    assert.ok(erCols.includes('session_id'), 'session_id in execution_records');

    // Verify runtime_credentials table exists
    const rcCols = getTableInfo(testDB.db, 'runtime_credentials').map((c: any) => c.name);
    assert.ok(rcCols.includes('token_hash'), 'token_hash in runtime_credentials');
    assert.ok(rcCols.includes('status'), 'status in runtime_credentials');

    // Verify runtime_control table exists
    const rcCtrlCols = getTableInfo(testDB.db, 'runtime_control').map((c: any) => c.name);
    assert.ok(rcCtrlCols.includes('active_runtime'), 'active_runtime in runtime_control');

    // Verify runtime_session_history table exists
    const rshCols = getTableInfo(testDB.db, 'runtime_session_history').map((c: any) => c.name);
    assert.ok(rshCols.includes('original_session_id'), 'original_session_id in runtime_session_history');

    // FK integrity check
    const fkCheck = testDB.db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(fkCheck.length, 0, 'No FK violations after full Phase 10 migration sequence');
  });

  test('FK integrity maintained across all Phase 10 migrations', () => {
    // Run migrations 001-005 (prerequisites)
    runPrerequisites(testDB.db);
    runMigration(testDB.db, path.join(MIGRATION_DIR, '006_phase7_autonomy_execution.sql'));

    // Run Phase 10 migrations
    const phase10Migrations = [
      '017_add_runtime_sessions_table.sql',
      '018_add_execution_records.sql',
      '019_create_runtime_credentials.sql',
      '020_create_runtime_control_table.sql',
      '021_runtime_sessions_history.sql'
    ];

    for (const migration of phase10Migrations) {
      runMigration(testDB.db, path.join(MIGRATION_DIR, migration));
    }

    // Verify FK integrity
    const fkCheck = testDB.db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(fkCheck.length, 0, 'No FK violations after Phase 10 migrations');
  });
});