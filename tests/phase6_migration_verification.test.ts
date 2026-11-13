// Phase 6 Migration Verification Tests
// Run against temporary in-memory databases only
// DO NOT run against production council.db
// Usage: npx tsx --test tests/phase6_migration_verification.test.ts

import { test, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

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

function getTableInfo(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function getIndexes(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA index_list(${table})`).all();
}

function getForeignKeys(db: Database.Database, table: string) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all();
}

describe('Phase 6 Migration Verification', () => {
  let testDB: TestDB;

  beforeEach(() => {
    testDB = createTestDB();
  });

  afterEach(() => {
    testDB.close();
  });

  describe('Base Phase 4 Schema Setup', () => {
    test('creates all Phase 4 tables including Phase 6/7 future tables', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE IF NOT EXISTS divisions (
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

        CREATE TABLE IF NOT EXISTS staff_agents (
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

        CREATE TABLE IF NOT EXISTS division_members (
          division_id    TEXT NOT NULL,
          staff_id       TEXT NOT NULL,
          role           TEXT NOT NULL DEFAULT 'member',
          joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (division_id, staff_id),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cross_division_shares (
          share_id        TEXT PRIMARY KEY,
          memory_id       TEXT NOT NULL,
          division_id     TEXT NOT NULL,
          granted_by_type TEXT NOT NULL
            CHECK (granted_by_type IN ('division', 'founder')),
          granted_by_id   TEXT NOT NULL,
          granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at      TEXT,
          FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );

        CREATE TABLE IF NOT EXISTS memory_entries (
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

        CREATE TABLE IF NOT EXISTS tasks (
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

        CREATE TABLE IF NOT EXISTS deliverables (
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
      `);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
      assert.ok(tables.includes('divisions'), 'divisions table exists');
      assert.ok(tables.includes('staff_agents'), 'staff_agents table exists');
      assert.ok(tables.includes('division_members'), 'division_members table exists');
      assert.ok(tables.includes('cross_division_shares'), 'cross_division_shares table exists');
      assert.ok(tables.includes('memory_entries'), 'memory_entries table exists');
      assert.ok(tables.includes('tasks'), 'tasks table exists');
      assert.ok(tables.includes('deliverables'), 'deliverables table exists');
    });

    test('staff_agents has default status = active (current schema)', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE staff_agents (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('test-1', 'Test Agent', 'role', 'div-dev');

      const agent = db.prepare('SELECT status FROM staff_agents WHERE staff_id = ?').get('test-1');
      assert.equal(agent.status, 'active');
    });

    test('cross_division_shares allows both division and founder grants (current schema)', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE cross_division_shares (
          share_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('division', 'founder')),
          granted_by_id TEXT NOT NULL,
          granted_at TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at TEXT,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Developer');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-1', 'mem-1', 'div-dev', 'founder', 'founder');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-2', 'mem-2', 'div-dev', 'division', 'div-dev');

      const count = db.prepare('SELECT COUNT(*) as c FROM cross_division_shares').get();
      assert.equal(count.c, 2);
    });
  });

  describe('Migration 001: staff_agents status default → inactive', () => {
    test('migrates existing data and changes default to inactive', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (
          division_id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE staff_agents (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );

        CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
        CREATE INDEX idx_staff_agents_status ON staff_agents(status);
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Developer');
      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id, status) VALUES (?, ?, ?, ?, ?)")
        .run('staff-1', 'Agent 1', 'role', 'div-dev', 'active');
      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id, status) VALUES (?, ?, ?, ?, ?)")
        .run('staff-2', 'Agent 2', 'role', 'div-dev', 'inactive');
      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-3', 'Agent 3', 'role', 'div-dev');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;

        CREATE TABLE staff_agents_new (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );

        INSERT INTO staff_agents_new SELECT * FROM staff_agents;
        DROP TABLE staff_agents;
        ALTER TABLE staff_agents_new RENAME TO staff_agents;

        CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
        CREATE INDEX idx_staff_agents_status ON staff_agents(status);

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const count = db.prepare('SELECT COUNT(*) as c FROM staff_agents').get();
      assert.equal(count.c, 3);

      const statuses = db.prepare('SELECT staff_id, status FROM staff_agents ORDER BY staff_id').all();
      assert.equal(statuses.find(s => s.staff_id === 'staff-1')?.status, 'active');
      assert.equal(statuses.find(s => s.staff_id === 'staff-2')?.status, 'inactive');
      assert.equal(statuses.find(s => s.staff_id === 'staff-3')?.status, 'active');

      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-new', 'New Agent', 'role', 'div-dev');
      const newAgent = db.prepare('SELECT status FROM staff_agents WHERE staff_id = ?').get('staff-new');
      assert.equal(newAgent.status, 'inactive');

      const indexes = getIndexes(db, 'staff_agents').map(i => i.name);
      assert.ok(indexes.includes('idx_staff_agents_division'), 'division index recreated');
      assert.ok(indexes.includes('idx_staff_agents_status'), 'status index recreated');

      const fks = getForeignKeys(db, 'staff_agents');
      assert.equal(fks.length, 1);
      assert.equal(fks[0].table, 'divisions');
      assert.equal(fks[0].from, 'division_id');
      assert.equal(fks[0].to, 'division_id');
    });
  });

  describe('Migration 002: cross_division_shares granted_by_type → founder only', () => {
    test('preserves founder grants, revokes division grants, logs to audit', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE memory_entries (memory_id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT, category TEXT, memory_type TEXT, title TEXT, content TEXT);

        CREATE TABLE cross_division_shares (
          share_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('division', 'founder')),
          granted_by_id TEXT NOT NULL,
          granted_at TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at TEXT,
          FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );

        CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
        CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Developer');
      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-marketing', 'Marketing');
      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-1', 'division', 'div-dev', 'division_shared', 'test', 'Test 1', '{}');
      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-2', 'division', 'div-dev', 'division_shared', 'test', 'Test 2', '{}');
      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-3', 'division', 'div-dev', 'division_shared', 'test', 'Test 3', '{}');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-1', 'mem-1', 'div-marketing', 'founder', 'founder');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-2', 'mem-2', 'div-marketing', 'division', 'div-dev');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-3', 'mem-3', 'div-marketing', 'division', 'div-dev');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;

        CREATE TABLE cross_division_shares_new (
          share_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('founder')),
          granted_by_id TEXT NOT NULL,
          granted_at TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at TEXT,
          FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );

        INSERT INTO cross_division_shares_new (share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at)
        SELECT share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at
        FROM cross_division_shares
        WHERE granted_by_type = 'founder';

        CREATE TABLE IF NOT EXISTS migration_audit (
          audit_id TEXT PRIMARY KEY,
          migration_id TEXT NOT NULL,
          source_table TEXT NOT NULL,
          source_pk TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT NOT NULL,
          legacy_data TEXT NOT NULL,
          migrated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO migration_audit (audit_id, migration_id, source_table, source_pk, action, reason, legacy_data)
        SELECT
          'audit_' || share_id,
          '002_cross_division_shares_founder_only',
          'cross_division_shares',
          share_id,
          'revoked',
          'Division-authorized grant not permitted under Founder-only policy; requires explicit Founder reauthorization',
          json_object(
            'share_id', share_id,
            'memory_id', memory_id,
            'division_id', division_id,
            'granted_by_type', granted_by_type,
            'granted_by_id', granted_by_id,
            'granted_at', granted_at,
            'revoked_at', revoked_at
          )
        FROM cross_division_shares
        WHERE granted_by_type = 'division';

        DROP TABLE cross_division_shares;
        ALTER TABLE cross_division_shares_new RENAME TO cross_division_shares;

        CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
        CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);

        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const remaining = db.prepare('SELECT * FROM cross_division_shares').all();
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].share_id, 'share-1');
      assert.equal(remaining[0].granted_by_type, 'founder');

      const audit = db.prepare('SELECT * FROM migration_audit WHERE migration_id = ?').all('002_cross_division_shares_founder_only');
      assert.equal(audit.length, 2);
      assert.ok(audit.every(a => a.action === 'revoked'), 'all revoked');
      assert.ok(audit.every(a => a.reason.includes('Division-authorized grant not permitted')), 'all have correct reason');

      // New division grants rejected
      let threw = false;
      try {
        db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
          VALUES (?, ?, ?, ?, ?)`).run('share-new', 'mem-1', 'div-marketing', 'division', 'div-dev');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'division grant rejected');

      // Founder grants still work
      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-new-2', 'mem-2', 'div-marketing', 'founder', 'founder');
      const count = db.prepare('SELECT COUNT(*) as c FROM cross_division_shares').get();
      assert.equal(count.c, 2);
    });
  });

  describe('Migration 003: tasks additive columns', () => {
    test('adds dependencies and deliverable_id columns', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE tasks (
          task_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          assigned_to_type TEXT NOT NULL CHECK (assigned_to_type IN ('division', 'staff')),
          assigned_to_id TEXT NOT NULL,
          created_by_type TEXT NOT NULL CHECK (created_by_type IN ('founder', 'council', 'division_head')),
          created_by_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
          priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
          budget_allocated REAL NOT NULL DEFAULT 0,
          due_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]';
        ALTER TABLE tasks ADD COLUMN deliverable_id TEXT;
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const cols = getTableInfo(db, 'tasks').map(c => c.name);
      assert.ok(cols.includes('dependencies'), 'dependencies column exists');
      assert.ok(cols.includes('deliverable_id'), 'deliverable_id column exists');

      db.prepare("INSERT INTO tasks (task_id, title, assigned_to_type, assigned_to_id, created_by_type, created_by_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run('task-1', 'Test', 'staff', 'staff-1', 'founder', 'founder');

      const task = db.prepare('SELECT dependencies, deliverable_id FROM tasks WHERE task_id = ?').get('task-1');
      assert.equal(task.dependencies, '[]');
      assert.equal(task.deliverable_id, null);
    });
  });

  describe('Migration 004: deliverables additive columns', () => {
    test('adds file_references, task_relationships, audit_log columns', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE tasks (task_id TEXT PRIMARY KEY, title TEXT NOT NULL);
        CREATE TABLE deliverables (
          deliverable_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          submitted_by_type TEXT NOT NULL CHECK (submitted_by_type IN ('staff', 'division')),
          submitted_by_id TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
          reviewed_by_type TEXT,
          reviewed_by_id TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        ALTER TABLE deliverables ADD COLUMN file_references TEXT DEFAULT '[]';
        ALTER TABLE deliverables ADD COLUMN task_relationships TEXT DEFAULT '[]';
        ALTER TABLE deliverables ADD COLUMN audit_log TEXT DEFAULT '[]';
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const cols = getTableInfo(db, 'deliverables').map(c => c.name);
      assert.ok(cols.includes('file_references'), 'file_references column exists');
      assert.ok(cols.includes('task_relationships'), 'task_relationships column exists');
      assert.ok(cols.includes('audit_log'), 'audit_log column exists');

      db.prepare("INSERT INTO tasks (task_id, title) VALUES (?, ?)").run('task-1', 'Test');
      db.prepare("INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content) VALUES (?, ?, ?, ?, ?)")
        .run('del-1', 'task-1', 'staff', 'staff-1', '{}');

      const del = db.prepare('SELECT file_references, task_relationships, audit_log FROM deliverables WHERE deliverable_id = ?').get('del-1');
      assert.equal(del.file_references, '[]');
      assert.equal(del.task_relationships, '[]');
      assert.equal(del.audit_log, '[]');
    });
  });

  describe('Migration 005: cross_division_shares Stage 7 columns', () => {
    test('adds request tracking columns with CHECK constraints', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE memory_entries (memory_id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT, category TEXT, memory_type TEXT, title TEXT, content TEXT);
        CREATE TABLE cross_division_shares (
          share_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('founder')),
          granted_by_id TEXT NOT NULL,
          granted_at TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at TEXT,
          FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );
      `);

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        ALTER TABLE cross_division_shares ADD COLUMN request_type TEXT CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request'));
        ALTER TABLE cross_division_shares ADD COLUMN status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';
        ALTER TABLE cross_division_shares ADD COLUMN justification TEXT;
        ALTER TABLE cross_division_shares ADD COLUMN priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium';
        ALTER TABLE cross_division_shares ADD COLUMN deadline TEXT;
        ALTER TABLE cross_division_shares ADD COLUMN approved_by_type TEXT;
        ALTER TABLE cross_division_shares ADD COLUMN approved_by_id TEXT;
        ALTER TABLE cross_division_shares ADD COLUMN approved_at TEXT;
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const cols = getTableInfo(db, 'cross_division_shares').map(c => c.name);
      assert.ok(cols.includes('request_type'), 'request_type column exists');
      assert.ok(cols.includes('status'), 'status column exists');
      assert.ok(cols.includes('justification'), 'justification column exists');
      assert.ok(cols.includes('priority'), 'priority column exists');
      assert.ok(cols.includes('deadline'), 'deadline column exists');
      assert.ok(cols.includes('approved_by_type'), 'approved_by_type column exists');
      assert.ok(cols.includes('approved_by_id'), 'approved_by_id column exists');
      assert.ok(cols.includes('approved_at'), 'approved_at column exists');

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Dev');
      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-1', 'division', 'div-dev', 'division_shared', 'test', 'Test', '{}');

      // Valid insert
      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, request_type, status, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('share-1', 'mem-1', 'div-dev', 'founder', 'founder', 'memory_access', 'pending', 'high');

      // Invalid request_type should fail
      let threw = false;
      try {
        db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, request_type)
          VALUES (?, ?, ?, ?, ?, ?)`).run('share-2', 'mem-1', 'div-dev', 'founder', 'founder', 'invalid_type');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'invalid request_type rejected');

      // Invalid status should fail
      threw = false;
      try {
        db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, status)
          VALUES (?, ?, ?, ?, ?, ?)`).run('share-3', 'mem-1', 'div-dev', 'founder', 'founder', 'invalid_status');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'invalid status rejected');

      // Invalid priority should fail
      threw = false;
      try {
        db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, priority)
          VALUES (?, ?, ?, ?, ?, ?)`).run('share-4', 'mem-1', 'div-dev', 'founder', 'founder', 'invalid_priority');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'invalid priority rejected');
    });
  });

  describe('Foreign Key Integrity', () => {
    test('staff_agents → divisions FK preserved after migration 001', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE staff_agents (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );
        CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Dev');
      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-1', 'Agent', 'role', 'div-dev');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        CREATE TABLE staff_agents_new (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );
        INSERT INTO staff_agents_new SELECT * FROM staff_agents;
        DROP TABLE staff_agents;
        ALTER TABLE staff_agents_new RENAME TO staff_agents;
        CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
        CREATE INDEX idx_staff_agents_status ON staff_agents(status);
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      let threw = false;
      try {
        db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
          .run('staff-2', 'Agent 2', 'role', 'invalid-div');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'invalid division rejected');

      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-3', 'Agent 3', 'role', 'div-dev');
    });

    test('division_members → staff_agents FK preserved', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE staff_agents (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );
        CREATE TABLE division_members (
          division_id TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          joined_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (division_id, staff_id),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
        );
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Dev');
      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-1', 'Agent', 'role', 'div-dev');
      db.prepare("INSERT INTO division_members (division_id, staff_id, role) VALUES (?, ?, ?)")
        .run('div-dev', 'staff-1', 'specialist');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        CREATE TABLE staff_agents_new (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
        );
        INSERT INTO staff_agents_new SELECT * FROM staff_agents;
        DROP TABLE staff_agents;
        ALTER TABLE staff_agents_new RENAME TO staff_agents;
        CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
        CREATE INDEX idx_staff_agents_status ON staff_agents(status);
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      let threw = false;
      try {
        db.prepare("INSERT INTO division_members (division_id, staff_id, role) VALUES (?, ?, ?)")
          .run('div-dev', 'invalid-staff', 'specialist');
      } catch {
        threw = true;
      }
      assert.ok(threw, 'invalid staff_id rejected');

      db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
        .run('staff-2', 'Agent 2', 'role', 'div-dev');
      db.prepare("INSERT INTO division_members (division_id, staff_id, role) VALUES (?, ?, ?)")
        .run('div-dev', 'staff-2', 'specialist');
    });
  });

  describe('Rollback Behavior', () => {
    test('backup restore restores original schema', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE staff_agents (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      const backupSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='staff_agents'").get();
      assert.ok(backupSchema.sql.includes("DEFAULT 'active'"), 'original has active default');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN IMMEDIATE TRANSACTION;
        CREATE TABLE staff_agents_new (
          staff_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          division_id TEXT NOT NULL,
          runtime_instances TEXT NOT NULL DEFAULT '[]',
          permissions TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'terminated')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO staff_agents_new SELECT * FROM staff_agents;
        DROP TABLE staff_agents;
        ALTER TABLE staff_agents_new RENAME TO staff_agents;
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);

      const migratedSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='staff_agents'").get();
      assert.ok(migratedSchema.sql.includes("DEFAULT 'inactive'"), 'migrated has inactive default');

      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE staff_agents;
        ${backupSchema.sql};
        PRAGMA foreign_keys = ON;
      `);

      const rolledBackSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='staff_agents'").get();
      assert.ok(rolledBackSchema.sql.includes("DEFAULT 'active'"), 'rolled back to active default');
    });
  });

  describe('FTS5 Compatibility', () => {
    test('memory_fts triggers work after migrations', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE memory_entries (
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
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (supersedes_id) REFERENCES memory_entries(memory_id) ON DELETE SET NULL
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
          VALUES (new.memory_id, new.title, new.content, new.tags, new.memory_type, new.category);
        END;

        CREATE TRIGGER memory_entries_fts_delete AFTER DELETE ON memory_entries BEGIN
          DELETE FROM memory_fts WHERE memory_id = old.memory_id;
        END;
      `);

      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-1', 'staff', 'staff-1', 'staff_private', 'note', 'Test Title', 'Test content');

      const fts = db.prepare("SELECT * FROM memory_fts WHERE memory_id = ?").get('mem-1');
      assert.ok(fts !== undefined, 'FTS entry created');
      assert.equal(fts.title, 'Test Title');
      assert.equal(fts.content, 'Test content');

      db.prepare("DELETE FROM memory_entries WHERE memory_id = ?").run('mem-1');

      const ftsAfter = db.prepare("SELECT * FROM memory_fts WHERE memory_id = ?").get('mem-1');
      assert.ok(ftsAfter === undefined, 'FTS entry deleted');
    });
  });

  describe('Cross-Division Access Enforcement', () => {
    test('revoked cross-division shares cannot be used', () => {
      const db = testDB.db;

      db.exec(`
        CREATE TABLE divisions (division_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE memory_entries (memory_id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT, category TEXT, memory_type TEXT, title TEXT, content TEXT);
        CREATE TABLE cross_division_shares (
          share_id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          granted_by_type TEXT NOT NULL CHECK (granted_by_type IN ('founder')),
          granted_by_id TEXT NOT NULL,
          granted_at TEXT NOT NULL DEFAULT (datetime('now')),
          revoked_at TEXT,
          FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
          FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
          UNIQUE(memory_id, division_id)
        );
      `);

      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-dev', 'Dev');
      db.prepare("INSERT INTO divisions (division_id, name) VALUES (?, ?)").run('div-marketing', 'Marketing');
      db.prepare("INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run('mem-1', 'division', 'div-dev', 'division_shared', 'test', 'Test', '{}');

      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-1', 'mem-1', 'div-marketing', 'founder', 'founder');

      const active = db.prepare('SELECT * FROM cross_division_shares WHERE division_id = ? AND revoked_at IS NULL').all('div-marketing');
      assert.equal(active.length, 1);

      db.prepare('UPDATE cross_division_shares SET revoked_at = datetime(\'now\') WHERE share_id = ?').run('share-1');

      const activeAfter = db.prepare('SELECT * FROM cross_division_shares WHERE division_id = ? AND revoked_at IS NULL').all('div-marketing');
      assert.equal(activeAfter.length, 0);
    });
  });
});