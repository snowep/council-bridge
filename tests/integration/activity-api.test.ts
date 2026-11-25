// Activity API Integration Tests
// Tests the GET /api/activity endpoint with different auth contexts

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { generateSessionToken } from '../../src/auth/session.js';
import { initializeFounderKeys } from '../../src/auth/founder.js';
import { authMiddleware, getAuthContext } from '../../src/auth/index.js';
import { listActivity } from '../../src/council/memory.js';
import { createTask } from '../../src/council/divisions.js';
import { randomUUID } from 'node:crypto';

interface PaginatedActivityResult<T> {
  items: T[];
  total_count: number;
}

let db: DatabaseInstance;
let testDbPath: string;
let founderToken: string;
let divisionToken: string;
let staffToken: string;
let staffMultiDivisionToken: string;
let keysDir: string;

function setupTestApp(authMode: 'local' | 'development' | 'production'): express.Express {
  const testApp = express();
  testApp.use(express.json());

  // Initialize founder keys for production mode
  if (authMode === 'production') {
    process.env.AUTH_MODE = 'production';
    process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length';
    keysDir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-test-keys-'));
    process.env.FOUNDER_KEYS_DIR = keysDir;
    initializeFounderKeys();
  } else if (authMode === 'local') {
    process.env.AUTH_MODE = 'development';
    process.env.LOCAL_SINGLE_USER_MODE = 'true';
    process.env.LOCAL_SINGLE_USER_BIND_ADDRESS = '127.0.0.1';
  } else {
    process.env.AUTH_MODE = 'development';
    process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length';
    process.env.LOCAL_SINGLE_USER_MODE = 'false';
  }

  // Apply auth middleware to all routes
  testApp.use((req, res, next) => authMiddleware(req, res, next));

  // Activity endpoint
  testApp.get('/api/activity', (req, res) => {
    const ctx = getAuthContext(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    try {
      const result = listActivity(db, ctx, { limit, offset });
      res.set('X-Total-Count', String(result.total_count));
      res.json({ activity: result.items, total_count: result.total_count, limit, offset });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return testApp;
}

describe('Activity API Integration Tests', () => {
  let server: any;

  before(async () => {
    // Create test database - use in-memory for speed and to avoid migration issues
    db = createDatabase(':memory:');

    // Register test agents
    const agentService = (await import('../../src/communication/agents.js')).createAgentService(db);
    agentService.registerAgent({ agent_id: 'staff-001', display_name: 'Staff Agent', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'div-001', display_name: 'Division Agent', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'founder', display_name: 'Founder', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'staff-multi-001', display_name: 'Multi-Division Staff', runtime: 'claude' });

    // Setup division and members - directly insert to avoid legacy wrapper
    // First create divisions
    db.db.prepare(`
      INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('div-001', 'Engineering', 'Engineering Division', 'div-head-001', 0, '[]', '[]');
    db.db.prepare(`
      INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('div-002', 'Product', 'Product Division', 'div-head-002', 0, '[]', '[]');

    // Then insert into staff_agents for FK constraints on division_members
    db.db.prepare(`
      INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('staff-001', 'Staff Agent', 'engineer', 'div-001', '["claude"]', '[]', 'active');
    db.db.prepare(`
      INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('staff-multi-001', 'Multi-Division Staff', 'engineer', 'div-001', '["claude"]', '[]', 'active');
    db.db.prepare(`
      INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('div-head-001', 'Division Head 1', 'head', 'div-001', '["claude"]', '[]', 'active');
    db.db.prepare(`
      INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('div-head-002', 'Division Head 2', 'head', 'div-002', '["claude"]', '[]', 'active');

    // Add staff members to divisions
    db.db.prepare(`
      INSERT INTO division_members (division_id, staff_id, role, joined_at)
      VALUES (?, ?, 'member', datetime('now'))
    `).run('div-001', 'staff-001');
    db.db.prepare(`
      INSERT INTO division_members (division_id, staff_id, role, joined_at)
      VALUES (?, ?, 'member', datetime('now'))
    `).run('div-001', 'staff-multi-001');
    db.db.prepare(`
      INSERT INTO division_members (division_id, staff_id, role, joined_at)
      VALUES (?, ?, 'member', datetime('now'))
    `).run('div-002', 'staff-multi-001');

    // Create test data
    await setupTestData();
  });

  after(() => {
    closeDatabase();
    if (keysDir && fs.existsSync(keysDir)) {
      fs.rmSync(keysDir, { recursive: true, force: true });
    }
  });

  async function setupTestData() {
    // Create tasks for different owners
    const task1 = createTask(db, {
      title: 'Founder Task',
      description: 'Task created by founder',
      assigned_to_type: 'staff',
      assigned_to_id: 'staff-001',
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending',
      priority: 'high'
    }, { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

    const task2 = createTask(db, {
      title: 'Division Task',
      description: 'Task created by division head',
      assigned_to_type: 'staff',
      assigned_to_id: 'staff-001',
      created_by_type: 'division_head',
      created_by_id: 'div-001',
      status: 'in_progress',
      priority: 'medium'
    }, { owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

    const task3 = createTask(db, {
      title: 'Staff Task',
      description: 'Task assigned to staff',
      assigned_to_type: 'staff',
      assigned_to_id: 'staff-001',
      created_by_type: 'division_head',
      created_by_id: 'div-001',
      status: 'completed',
      priority: 'low'
    }, { owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

    const task4 = createTask(db, {
      title: 'Multi Division Task',
      description: 'Task for multi-division staff',
      assigned_to_type: 'staff',
      assigned_to_id: 'staff-multi-001',
      created_by_type: 'division_head',
      created_by_id: 'div-002',
      status: 'pending',
      priority: 'high'
    }, { owner_type: 'division', owner_id: 'div-002', runtime: 'claude' });

    // Create audit entries using actual task IDs
    db.db.prepare(`
      INSERT INTO task_audit (audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('audit-1', task1.task_id, 'create', '{}', 'founder', 'founder', 'claude');
    db.db.prepare(`
      INSERT INTO task_audit (audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('audit-2', task2.task_id, 'create', '{}', 'division_head', 'div-001', 'claude');
    db.db.prepare(`
      INSERT INTO task_audit (audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('audit-3', task3.task_id, 'complete', '{}', 'staff', 'staff-001', 'claude');
    db.db.prepare(`
      INSERT INTO task_audit (audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('audit-4', task4.task_id, 'create', '{}', 'division_head', 'div-002', 'claude');

    // Create memory entries
    const createMemory = (await import('../../src/council/memory.js')).createMemory;
    const logMemoryAccess = (await import('../../src/council/memory.js')).logMemoryAccess;

    // Founder memory (council_shared)
    const mem1 = createMemory(db, {
      memory_id: 'mem-founder-001',
      owner_type: 'founder',
      owner_id: 'founder',
      category: 'council_shared',
      memory_type: 'decision_record',
      title: 'Founder Decision',
      content: '{}',
      tags: ['founder'],
      confidence: 1.0
    });
    logMemoryAccess(db, { access_id: 'acc-1', memory_id: mem1.memory_id, version_accessed: null, accessor_type: 'founder', accessor_id: 'founder', accessor_runtime: 'claude', access_type: 'create' });

    // Division shared memory
    const mem2 = createMemory(db, {
      memory_id: 'mem-division-001',
      owner_type: 'division',
      owner_id: 'div-001',
      category: 'division_shared',
      memory_type: 'division_shared',
      title: 'Division Note',
      content: '{}',
      tags: ['division'],
      confidence: 1.0,
      division_id: 'div-001'
    });
    logMemoryAccess(db, { access_id: 'acc-2', memory_id: mem2.memory_id, version_accessed: null, accessor_type: 'division', accessor_id: 'div-001', accessor_runtime: 'claude', access_type: 'create' });

    // Staff private memory
    const mem3 = createMemory(db, {
      memory_id: 'mem-staff-001',
      owner_type: 'staff',
      owner_id: 'staff-001',
      category: 'staff_private',
      memory_type: 'personal_note',
      title: 'Staff Private Note',
      content: '{}',
      tags: ['private'],
      confidence: 1.0
    });
    logMemoryAccess(db, { access_id: 'acc-3', memory_id: mem3.memory_id, version_accessed: null, accessor_type: 'staff', accessor_id: 'staff-001', accessor_runtime: 'claude', access_type: 'create' });

    // Cross-division shared memory
    const mem4 = createMemory(db, {
      memory_id: 'mem-cross-001',
      owner_type: 'staff',
      owner_id: 'staff-multi-001',
      category: 'cross_division',
      memory_type: 'cross_division',
      title: 'Cross Division Share',
      content: '{}',
      tags: ['cross'],
      confidence: 1.0,
      division_id: 'div-002'
    });
    logMemoryAccess(db, { access_id: 'acc-4', memory_id: mem4.memory_id, version_accessed: null, accessor_type: 'staff', accessor_id: 'staff-multi-001', accessor_runtime: 'claude', access_type: 'create' });

    // Create cross division share
    db.db.prepare(`
      INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, status)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 'approved')
    `).run('share-1', 'mem-cross-001', 'div-001', 'founder', 'founder');

    // Create messages
    db.db.prepare(`
      INSERT INTO messages (id, sender_id, recipient_id, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run('msg-1', 'founder', 'staff-001', 'Message from founder to staff');
    db.db.prepare(`
      INSERT INTO messages (id, sender_id, recipient_id, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run('msg-2', 'div-001', 'staff-001', 'Message from division to staff');
    db.db.prepare(`
      INSERT INTO messages (id, sender_id, recipient_id, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run('msg-3', 'staff-001', 'founder', 'Message from staff to founder');
  }

  describe('Production Mode - Role-based Activity Visibility', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length';
      process.env.LOCAL_SINGLE_USER_MODE = 'false';
      keysDir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-test-keys-'));
      process.env.FOUNDER_KEYS_DIR = keysDir;
      initializeFounderKeys();

      // Generate test tokens
      founderToken = generateSessionToken({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
      divisionToken = generateSessionToken({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });
      staffToken = generateSessionToken({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });
      staffMultiDivisionToken = generateSessionToken({ owner_type: 'staff', owner_id: 'staff-multi-001', runtime: 'claude' });

      const app = setupTestApp('production');
      server = app.listen(0);
    });

    afterEach(() => {
      server.close();
      if (keysDir && fs.existsSync(keysDir)) {
        fs.rmSync(keysDir, { recursive: true, force: true });
      }
    });

    it('should return all activity for Founder (no filtering)', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.strictEqual(response.body.limit, 50);
      assert.strictEqual(response.body.offset, 0);
      assert.ok(Array.isArray(response.body.activity));
      // Founder should see: 4 task audits, 4 memories, 3 messages = at least 11 items
      // Verify we have activities
      const activity = response.body.activity;
      assert.ok(Array.isArray(activity), 'Activity should be an array');
      assert.ok(activity.length >= 8, `Founder should see at least 8 items, got ${activity.length}`);

      // Verify all task audits are visible
      const taskItems = activity.filter((a: any) => a.type === 'task');
      assert.ok(taskItems.length >= 4, `Founder should see all 4 task audits, got ${taskItems.length}`);

      // Verify all messages are visible
      const messageItems = response.body.activity.filter((a: any) => a.type === 'message');
      assert.ok(messageItems.length >= 3, `Founder should see all 3 messages, got ${messageItems.length}`);
    });

    it('should return division-scoped activity for Division Head', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${divisionToken}`)
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      // Division should see: their task audits (task-division-001, task-staff-001),
      // division_shared memories, cross_division shared with their division,
      // messages sent to/from division
      const activity = response.body.activity;

      // Should see task audits for their division tasks
      const taskItems = activity.filter((a: any) => a.type === 'task');
      assert.ok(taskItems.length >= 2, `Division should see division task audits, got ${taskItems.length}`);

      // Should see division_shared memory
      const divSharedMemory = activity.find((a: any) => a.metadata?.category === 'division_shared');
      assert.ok(divSharedMemory, 'Division should see division_shared memory');

      // Should see cross_division shared with their division
      const crossDivMemory = activity.find((a: any) => a.metadata?.category === 'cross_division');
      assert.ok(crossDivMemory, 'Division should see cross_division memory shared with them');

      // Should see messages to/from division
      const messageItems = activity.filter((a: any) => a.type === 'message');
      assert.ok(messageItems.length >= 1, `Division should see at least 1 relevant message, got ${messageItems.length}`);
    });

    it('should return staff-scoped activity for Staff with one division', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      const activity = response.body.activity;

      // Staff should see: their assigned task audits, their private memories,
      // division_shared from their division, cross_division shared with their division,
      // messages sent to/from staff

      // Should see task audits for tasks assigned to them
      const taskItems = activity.filter((a: any) => a.type === 'task');
      assert.ok(taskItems.length >= 1, `Staff should see at least 1 task audit, got ${taskItems.length}`);

      // Should see division_shared from their division
      const divSharedMemory = activity.find((a: any) => a.metadata?.category === 'division_shared');
      assert.ok(divSharedMemory, 'Staff should see division_shared from their division');

      // Should see messages to/from staff
      const messageItems = activity.filter((a: any) => a.type === 'message');
      assert.ok(messageItems.length >= 2, `Staff should see relevant messages, got ${messageItems.length}`);
    });

    it('should return activity from all divisions for Staff with multiple divisions', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${staffMultiDivisionToken}`)
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      const activity = response.body.activity;

      // Multi-division staff should see: tasks from both divisions,
      // division_shared from both divisions, cross_division from both divisions

      // Should see task audits for tasks in both divisions
      const taskItems = activity.filter((a: any) => a.type === 'task');
      // Should see task-multi-001 (div-002) and possibly others
      assert.ok(taskItems.length >= 1, `Multi-division staff should see task audits, got ${taskItems.length}`);

      // Should see division_shared from both divisions
      const divSharedMemories = activity.filter((a: any) => a.metadata?.category === 'division_shared');
      // At minimum should see division_shared from div-001 (they are member)
      // Note: staff-multi-001 is in both div-001 and div-002
      assert.ok(divSharedMemories.length >= 1, `Multi-division staff should see division_shared memories, got ${divSharedMemories.length}`);

      // Should see cross_division shared with either division
      const crossDivMemories = activity.filter((a: any) => a.metadata?.category === 'cross_division');
      assert.ok(crossDivMemories.length >= 1, `Multi-division staff should see cross_division memories, got ${crossDivMemories.length}`);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(server)
        .get('/api/activity?limit=5&offset=2')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.strictEqual(response.body.limit, 5);
      assert.strictEqual(response.body.offset, 2);
      assert.ok(response.body.activity.length <= 5);
    });

    it('should return 401 without valid token in production mode', async () => {
      const response = await request(server)
        .get('/api/activity')
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });
  });

  describe('Development Mode - Activity Visibility', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'development';
      process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length';
      process.env.LOCAL_SINGLE_USER_MODE = 'false';

      // Generate test tokens
      staffToken = generateSessionToken({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const app = setupTestApp('development');
      server = app.listen(0);
    });

    afterEach(() => {
      server.close();
    });

    it('should accept valid session token and return activity', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      assert.ok(response.body.activity.length > 0);
    });

    it('should reject invalid token', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      assert.strictEqual(response.body.code, 'INVALID_SESSION');
    });
  });

  describe('Local Single-User Mode - Activity Visibility', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'development';
      process.env.LOCAL_SINGLE_USER_MODE = 'true';
      process.env.LOCAL_SINGLE_USER_BIND_ADDRESS = '127.0.0.1';

      // Generate test tokens
      staffToken = generateSessionToken({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const app = setupTestApp('local');
      server = app.listen(0);
    });

    afterEach(() => {
      server.close();
      delete process.env.LOCAL_SINGLE_USER_MODE;
      delete process.env.LOCAL_SINGLE_USER_BIND_ADDRESS;
    });

    it('should auto-authenticate loopback requests as Founder', async () => {
      const response = await request(server)
        .get('/api/activity')
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      // In local mode, loopback requests auto-auth as Founder
      // So should see all activity like Founder
      assert.ok(response.body.activity.length >= 11);
    });

    it('should validate provided token over auto-auth', async () => {
      const response = await request(server)
        .get('/api/activity')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.ok(Array.isArray(response.body.activity));
      // Staff token should provide staff-scoped activity (fewer items than Founder)
      assert.ok(response.body.activity.length > 0);
    });
  });

  describe('Direct function tests - listActivity with different contexts', () => {
    it('should return all activity for Founder context directly', () => {
      const result = listActivity(db, { owner_type: 'founder', owner_id: 'founder' }, { limit: 50, offset: 0 });
      const activity = result.items;
      assert.ok(Array.isArray(activity));
      assert.ok(activity.length >= 11);
      assert.strictEqual(result.total_count, activity.length);
    });

    it('should return division-scoped activity for Division context', () => {
      const result = listActivity(db, { owner_type: 'division', owner_id: 'div-001' }, { limit: 50, offset: 0 });
      const activity = result.items;
      assert.ok(Array.isArray(activity));
      // Division sees their task audits, division_shared, cross_division for their division
      assert.ok(activity.length >= 3);
      assert.strictEqual(result.total_count, activity.length);
    });

    it('should return staff-scoped activity for Staff context', () => {
      const result = listActivity(db, { owner_type: 'staff', owner_id: 'staff-001' }, { limit: 50, offset: 0 });
      const activity = result.items;
      assert.ok(Array.isArray(activity));
      // Staff sees their task audits, division_shared from their division
      assert.ok(activity.length >= 3);
      assert.strictEqual(result.total_count, activity.length);
    });

    it('should return multi-division activity for Staff in multiple divisions', () => {
      const result = listActivity(db, { owner_type: 'staff', owner_id: 'staff-multi-001' }, { limit: 50, offset: 0 });
      const activity = result.items;
      assert.ok(Array.isArray(activity));
      // Multi-division staff sees from all their divisions
      assert.ok(activity.length >= 2);
      assert.strictEqual(result.total_count, activity.length);
    });

    it('should throw for unsupported owner type', () => {
      assert.throws(
        () => listActivity(db, { owner_type: 'invalid', owner_id: 'test' }, { limit: 50, offset: 0 }),
        /Unsupported owner type/
      );
    });
  });
});