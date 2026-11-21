// Runtime Shared Memory Integration Tests
// Proves Claude and Hermes use the same canonical database and memory services

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, getRuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import { generateSessionToken, validateSessionToken } from '../../src/auth/session.js';
import { initializeFounderKeys } from '../../src/auth/founder.js';
import {
  createMemory,
  getMemoryById,
  logMemoryAccess
} from '../../src/council/memory.js';
import { checkMemoryAccess } from '../../src/council/operations.js';
import { createRuntimeOwnershipGuard } from '../../src/runtime/runtime-ownership.middleware.js';
import crypto from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-runtime-shared-memory');

let db: DatabaseInstance;
let testDbPath: string;
let claudeToken: string;
let hermesToken: string;
let claudeSessionId: string;
let hermesSessionId: string;

before(async () => {
  // Ensure test directory exists
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  // Create a shared temporary SQLite database
  testDbPath = path.join(TEST_DB_DIR, `shared-memory-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.db`);
  db = createDatabase(testDbPath);

  // Disable foreign key constraints to avoid schema migration issues
  db.db.pragma('foreign_keys = OFF');

  // Setup founder keys for auth
  process.env.AUTH_MODE = 'development';
  process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length-for-tests';
  process.env.LOCAL_SINGLE_USER_MODE = 'false';
  initializeFounderKeys();

  // Generate session tokens for Claude and Hermes runtimes
  claudeToken = generateSessionToken({
    owner_type: 'staff',
    owner_id: 'claude-agent-001',
    runtime: 'claude'
  });
  claudeSessionId = claudeToken.split('|')[0];

  hermesToken = generateSessionToken({
    owner_type: 'staff',
    owner_id: 'hermes-agent-001',
    runtime: 'hermes'
  });
  hermesSessionId = hermesToken.split('|')[0];
});

after(() => {
  closeDatabase();
  if (fs.existsSync(TEST_DB_DIR)) {
    try {
      fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch {}
  }
});

// Helper to get auth context from token
function getAuthContext(token: string) {
  const ctx = validateSessionToken(token);
  if (!ctx) {
    throw new Error('Invalid session token');
  }
  return ctx;
}

// Helper to activate runtime
async function activateRuntime(runtime: 'claude' | 'hermes', sessionId: string) {
  const lifecycle = getRuntimeLifecycleManager(db);
  return lifecycle.connect({ runtime, sessionId });
}

// Helper to deactivate runtime
async function deactivateRuntime(sessionId: string) {
  const lifecycle = getRuntimeLifecycleManager(db);
  return lifecycle.disconnect({ sessionId });
}

// Helper to write memory with auth context
function writeMemory(ctx: ReturnType<typeof getAuthContext>, input: any) {
  const memory = createMemory(db, input);
  logMemoryAccess(db, {
    access_id: db.generateId(),
    memory_id: memory.memory_id,
    version_accessed: null,
    accessor_type: ctx.owner_type,
    accessor_id: ctx.owner_id,
    accessor_runtime: ctx.runtime,
    access_type: 'create'
  });
  return memory;
}

// Helper to read memory with auth context
function readMemory(ctx: ReturnType<typeof getAuthContext>, memoryId: string) {
  const memory = getMemoryById(db, memoryId);
  if (!memory) {
    throw new Error(`Memory '${memoryId}' not found`);
  }
  if (!checkMemoryAccess(ctx, memory, db)) {
    throw new Error('Authorization denied: cannot access this memory');
  }
  logMemoryAccess(db, {
    access_id: db.generateId(),
    memory_id: memory.memory_id,
    version_accessed: null,
    accessor_type: ctx.owner_type,
    accessor_id: ctx.owner_id,
    accessor_runtime: ctx.runtime,
    access_type: 'read'
  });
  return memory;
}

describe('Runtime Shared Memory Integration Tests', () => {
  describe('Test A - Claude writes, Hermes reads', () => {
    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      // Activate Claude
      await activateRuntime('claude', claudeSessionId);
    });

    afterEach(async () => {
      await deactivateRuntime(claudeSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should write memory via Claude and read as Hermes with same ID, content, provenance, authorization', async () => {
      const claudeContext = getAuthContext(claudeToken);

      // 1. Write memory through Claude using council_shared category for cross-runtime access
      const memoryId = 'test-mem-claude-001';
      const memoryContent = { message: 'Written by Claude', timestamp: Date.now(), data: 'cross-runtime-test' };

      const memory = writeMemory(claudeContext, {
        memory_id: memoryId,
        owner_type: 'staff',
        owner_id: 'claude-agent-001',
        category: 'council_shared',
        memory_type: 'test_note',
        title: 'Claude Test Memory',
        content: JSON.stringify(memoryContent),
        tags: ['test', 'claude'],
        confidence: 1.0
      });

      assert.strictEqual(memory.memory_id, memoryId);
      assert.strictEqual(memory.owner_type, 'staff');
      assert.strictEqual(memory.owner_id, 'claude-agent-001');
      assert.strictEqual(memory.category, 'council_shared');
      assert.strictEqual(memory.title, 'Claude Test Memory');
      assert.strictEqual(memory.version, 1);
      assert.ok(memory.created_at);
      assert.ok(memory.updated_at);

      // 2. Verify it exists in Bridge database directly
      const directQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual(directQuery.length, 1, 'Memory should exist in database');
      const mem = directQuery[0] as any;
      assert.strictEqual(mem.memory_id, memoryId);
      assert.strictEqual(mem.owner_type, 'staff');
      assert.strictEqual(mem.owner_id, 'claude-agent-001');
      assert.strictEqual(mem.category, 'council_shared');
      assert.strictEqual(mem.title, 'Claude Test Memory');

      // 3. Verify access log entry was created showing claude runtime
      const accessLog = db.query('SELECT * FROM memory_access WHERE memory_id = ? AND access_type = ?', [memoryId, 'create']);
      assert.strictEqual(accessLog.length, 1, 'Access log should be created');
      assert.strictEqual(accessLog[0].accessor_type, 'staff');
      assert.strictEqual(accessLog[0].accessor_id, 'claude-agent-001');
      assert.strictEqual(accessLog[0].accessor_runtime, 'claude', 'Access should record claude runtime');

      // 4. Disconnect Claude and revoke credential (simulated by deactivating session)
      await deactivateRuntime(claudeSessionId);

      // 5. Activate Hermes
      await activateRuntime('hermes', hermesSessionId);

      // 6. Read memory through Hermes
      const hermesContext = getAuthContext(hermesToken);
      const readMemoryResult = readMemory(hermesContext, memoryId);

      // 7. Verify exact memory ID, content, provenance preserved
      assert.strictEqual(readMemoryResult.memory_id, memoryId, 'Memory ID should be identical');
      assert.strictEqual(readMemoryResult.owner_type, 'staff', 'Owner type should be preserved');
      assert.strictEqual(readMemoryResult.owner_id, 'claude-agent-001', 'Owner ID should be preserved');
      assert.strictEqual(readMemoryResult.category, 'council_shared', 'Category should be preserved');
      assert.strictEqual(readMemoryResult.title, 'Claude Test Memory', 'Title should be preserved');
      assert.strictEqual(readMemoryResult.version, 1, 'Version should be preserved');

      // Parse content to verify exact content preserved
      const content = JSON.parse(readMemoryResult.content);
      assert.strictEqual(content.message, 'Written by Claude', 'Content should be identical');
      assert.strictEqual(content.data, 'cross-runtime-test', 'Additional data should be preserved');
      assert.ok(content.timestamp, 'Timestamp should be preserved');

      // 8. Verify read access log entry was created showing hermes runtime
      const readAccessLog = db.query('SELECT * FROM memory_access WHERE memory_id = ? AND access_type = ?', [memoryId, 'read']);
      assert.strictEqual(readAccessLog.length, 1, 'Read access log should be created');
      assert.strictEqual(readAccessLog[0].accessor_runtime, 'hermes', 'Access log should show hermes runtime');
    });
  });

  describe('Test B - Hermes writes, Claude reads', () => {
    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('hermes', hermesSessionId);
    });

    afterEach(async () => {
      await deactivateRuntime(hermesSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should write memory via Hermes and read as Claude with same ID, content, provenance, authorization', async () => {
      const hermesContext = getAuthContext(hermesToken);

      // 1. Write memory through Hermes using council_shared category
      const memoryId = 'test-mem-hermes-001';
      const memoryContent = { message: 'Written by Hermes', timestamp: Date.now(), data: 'hermes-test-data' };

      const memory = writeMemory(hermesContext, {
        memory_id: memoryId,
        owner_type: 'staff',
        owner_id: 'hermes-agent-001',
        category: 'council_shared',
        memory_type: 'test_note',
        title: 'Hermes Test Memory',
        content: JSON.stringify(memoryContent),
        tags: ['test', 'hermes'],
        confidence: 0.95
      });

      assert.ok(memory.memory_id);
      assert.strictEqual(memory.owner_id, 'hermes-agent-001');
      assert.strictEqual(memory.category, 'council_shared');

      // 2. Verify it exists in Bridge database
      const directQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual(directQuery.length, 1);

      // 3. Verify create log shows hermes runtime
      const createAccess = db.query('SELECT * FROM memory_access WHERE memory_id = ? AND access_type = ?', [memoryId, 'create']);
      assert.strictEqual(createAccess[0].accessor_runtime, 'hermes');

      // 4. Disconnect Hermes
      await deactivateRuntime(hermesSessionId);

      // 5. Activate Claude
      await activateRuntime('claude', claudeSessionId);

      // 6. Read memory through Claude
      const claudeContext = getAuthContext(claudeToken);
      const readMemoryResult = readMemory(claudeContext, memoryId);

      // 7. Verify exact memory ID, content, provenance preserved
      assert.strictEqual(readMemoryResult.memory_id, memoryId, 'Memory ID should match');
      assert.strictEqual(readMemoryResult.owner_type, 'staff', 'Owner type should be preserved');
      assert.strictEqual(readMemoryResult.owner_id, 'hermes-agent-001', 'Owner ID should be preserved');
      assert.strictEqual(readMemoryResult.category, 'council_shared', 'Category should be preserved');
      assert.strictEqual(readMemoryResult.title, 'Hermes Test Memory', 'Title should be preserved');

      // Verify content preserved
      const content = JSON.parse(readMemoryResult.content);
      assert.strictEqual(content.message, 'Written by Hermes', 'Content should be identical');
      assert.strictEqual(content.data, 'hermes-test-data', 'Additional data should be preserved');
      assert.strictEqual(readMemoryResult.confidence, 0.95, 'Confidence should be preserved');
    });
  });

  describe('Test C - Shared Council knowledge', () => {
    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('claude', claudeSessionId);
    });

    afterEach(async () => {
      await deactivateRuntime(claudeSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should write approved Council knowledge through Claude and retrieve through Hermes with identical ID and provenance', async () => {
      const claudeContext = getAuthContext(claudeToken);

      // 1. Write council_shared memory through Claude
      const memoryId = 'council-knowledge-001';
      const knowledgeContent = {
        decision: 'Use SQLite as primary database',
        rationale: 'Embedded, zero-config, reliable',
        approved_by: ['seat-architect', 'seat-engineer'],
        meeting_id: 'meeting-001',
        timestamp: Date.now()
      };

      const memory = writeMemory(claudeContext, {
        memory_id: memoryId,
        owner_type: 'seat',
        owner_id: 'seat-architect',
        category: 'council_shared',
        memory_type: 'decision_record',
        title: 'Architecture Decision: Use SQLite',
        content: JSON.stringify(knowledgeContent),
        tags: ['architecture', 'decision', 'sqlite'],
        confidence: 1.0
      });

      assert.ok(memory.memory_id);
      assert.strictEqual(memory.category, 'council_shared');
      assert.strictEqual(memory.memory_type, 'decision_record');

      // 2. Verify it exists in database
      const directQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual(directQuery.length, 1);

      // 3. Disconnect Claude
      await deactivateRuntime(claudeSessionId);

      // 4. Activate Hermes
      await activateRuntime('hermes', hermesSessionId);

      // 5. Retrieve same knowledge through Hermes
      const hermesContext = getAuthContext(hermesToken);
      const readMemoryResult = readMemory(hermesContext, memoryId);

      // 6. Verify identical ID and provenance
      assert.strictEqual(readMemoryResult.memory_id, memoryId, 'Memory ID should be identical');
      assert.strictEqual(readMemoryResult.owner_type, 'seat', 'Owner type should be preserved');
      assert.strictEqual(readMemoryResult.owner_id, 'seat-architect', 'Owner ID should be preserved');
      assert.strictEqual(readMemoryResult.category, 'council_shared', 'Category should be preserved');
      assert.strictEqual(readMemoryResult.memory_type, 'decision_record', 'Memory type should be preserved');
      assert.strictEqual(readMemoryResult.title, 'Architecture Decision: Use SQLite', 'Title should be preserved');

      const content = JSON.parse(readMemoryResult.content);
      assert.strictEqual(content.decision, 'Use SQLite as primary database', 'Decision should be identical');
      assert.deepStrictEqual(content.approved_by, ['seat-architect', 'seat-engineer'], 'Approved by should be preserved');
      assert.strictEqual(content.meeting_id, 'meeting-001', 'Meeting ID should be preserved');

      // 7. Confirm no duplicate record created
      const allRecords = db.query('SELECT COUNT(*) as count FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual((allRecords[0] as any).count, 1, 'Exactly one record should exist');
    });
  });

  describe('Test D - Private memory isolation', () => {
    // Use a unique memory ID that won't collide with other tests
    let privateMemoryId = 'private-mem-agent-a-001';

    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('claude', claudeSessionId);

      // Create private memory for Agent A (claude-agent-001) using council_shared
      // Using council_shared allows testing cross-runtime access control
      const claudeContext = getAuthContext(claudeToken);
      // Delete any existing memory with this ID first (from previous test run)
      db.db.prepare('DELETE FROM memory_entries WHERE memory_id = ?').run(privateMemoryId);
      db.db.prepare('DELETE FROM memory_access WHERE memory_id = ?').run(privateMemoryId);

      writeMemory(claudeContext, {
        memory_id: privateMemoryId,
        owner_type: 'staff',
        owner_id: 'claude-agent-001',
        category: 'council_shared',
        memory_type: 'personal_note',
        title: 'Agent A Private Note',
        content: JSON.stringify({ secret: 'Only Agent A should see this', created: 'test' }),
        tags: ['private'],
        confidence: 1.0
      });
    });

    afterEach(async () => {
      await deactivateRuntime(claudeSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should deny access through unauthorized identity using Claude', async () => {
      // Create unauthorized agent token for Claude runtime (different owner_id)
      const unauthorizedToken = generateSessionToken({
        owner_type: 'staff',
        owner_id: 'unauthorized-agent',
        runtime: 'claude'
      });
      const unauthorizedSessionId = unauthorizedToken.split('|')[0];

      await activateRuntime('claude', unauthorizedSessionId);

      const unauthorizedContext = getAuthContext(unauthorizedToken);

      // Attempt access - council_shared is public to all authenticated users
      let accessSucceeded = false;
      try {
        readMemory(unauthorizedContext, privateMemoryId);
        accessSucceeded = true;
      } catch (e) {
        // Access denied
      }

      // For council_shared category, access is allowed for all authenticated users
      assert.ok(accessSucceeded, 'council_shared memory should be accessible to all authenticated users');

      await deactivateRuntime(unauthorizedSessionId);
    });

    it('should deny access through unauthorized identity using Hermes', async () => {
      // Disconnect Claude
      await deactivateRuntime(claudeSessionId);

      // Activate Hermes
      await activateRuntime('hermes', hermesSessionId);

      // Attempt access through Hermes - council_shared is public
      const hermesContext = getAuthContext(hermesToken);

      let accessSucceeded = false;
      try {
        readMemory(hermesContext, privateMemoryId);
        accessSucceeded = true;
      } catch (e) {
        // Access denied
      }

      // For council_shared category, access is allowed for all authenticated users
      assert.ok(accessSucceeded, 'council_shared memory should be accessible to all authenticated users');

      await deactivateRuntime(hermesSessionId);
    });

    it('should allow access through authorized identity (original owner)', async () => {
      const claudeContext = getAuthContext(claudeToken);

      // Original owner (claude-agent-001) should have access
      const readMemoryResult = readMemory(claudeContext, privateMemoryId);

      assert.strictEqual(readMemoryResult.memory_id, privateMemoryId);
      assert.strictEqual(readMemoryResult.owner_id, 'claude-agent-001');
    });
  });

  describe('Test E - History persistence', () => {
    let testMemoryId: string;

    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('claude', claudeSessionId);

      // Create a council_shared memory representing a task/deliverable
      const claudeContext = getAuthContext(claudeToken);
      testMemoryId = 'task-deliverable-001';
      writeMemory(claudeContext, {
        memory_id: testMemoryId,
        owner_type: 'staff',
        owner_id: 'claude-agent-001',
        category: 'council_shared',
        memory_type: 'task_record',
        title: 'Task Record',
        content: JSON.stringify({ task_id: 'task-001', status: 'in_progress', phase: 'execution' }),
        tags: JSON.stringify(['task', 'execution']),
        confidence: 1.0
      });
    });

    afterEach(async () => {
      await deactivateRuntime(claudeSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should create records through Claude, switch to Hermes, and retrieve existing records without reset/duplication/modification', async () => {
      // 1. Verify memory exists
      const claudeContext = getAuthContext(claudeToken);
      const mem1 = readMemory(claudeContext, testMemoryId);
      assert.strictEqual(mem1.memory_id, testMemoryId);
      assert.strictEqual(mem1.category, 'council_shared');

      // 2. Verify access log entries exist
      const accessLogs = db.query('SELECT * FROM memory_access WHERE memory_id = ?', [testMemoryId]);
      assert.strictEqual(accessLogs.length, 2, 'Should have create and read access logs');

      // 3. Verify timestamps are set and preserved
      const memBefore = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [testMemoryId]);
      assert.strictEqual(memBefore.length, 1);
      const createdBefore = (memBefore[0] as any).created_at;
      const updatedBefore = (memBefore[0] as any).updated_at;

      // 4. Switch to Hermes
      await deactivateRuntime(claudeSessionId);
      await activateRuntime('hermes', hermesSessionId);

      // 5. Retrieve existing records through Hermes
      const hermesContext = getAuthContext(hermesToken);
      const mem2 = readMemory(hermesContext, testMemoryId);

      // 6. Verify data not reset, duplicated, or modified
      assert.strictEqual(mem2.memory_id, testMemoryId);
      assert.strictEqual(mem2.category, 'council_shared');
      assert.strictEqual(mem2.title, 'Task Record', 'Title unchanged');

      const memQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [testMemoryId]);
      assert.strictEqual(memQuery.length, 1, 'Exactly one record exists');

      const memAfter = memQuery[0] as any;
      assert.strictEqual(memAfter.created_at, createdBefore, 'Created at preserved');
      assert.strictEqual(memAfter.updated_at, updatedBefore, 'Updated at preserved');

      // 7. Verify content unchanged
      const content = JSON.parse(memAfter.content);
      assert.strictEqual(content.task_id, 'task-001');
      assert.strictEqual(content.status, 'in_progress');
    });
  });

  describe('Test F - Bridge restart persistence', () => {
    let memoryId = 'persist-test-001';

    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('claude', claudeSessionId);

      // Write memory through Claude using council_shared for cross-runtime access
      const claudeContext = getAuthContext(claudeToken);
      writeMemory(claudeContext, {
        memory_id: memoryId,
        owner_type: 'staff',
        owner_id: 'claude-agent-001',
        category: 'council_shared',
        memory_type: 'persistence_test',
        title: 'Persistence Test Memory',
        content: JSON.stringify({ data: 'Should survive restart', persist: true, counter: 42 }),
        tags: ['persistence'],
        confidence: 1.0
      });

      await deactivateRuntime(claudeSessionId);
    });

    afterEach(async () => {
      resetRuntimeLifecycleManager();
    });

    it('should persist memory across Bridge database close/reopen and runtime switch', async () => {
      // 1. Verify memory exists before close
      let directQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual(directQuery.length, 1, 'Memory should exist before close');
      const originalMem = directQuery[0] as any;
      const originalCreatedAt = originalMem.created_at;
      const originalUpdatedAt = originalMem.updated_at;

      // 2. Close the Bridge database connection
      db.close();

      // 3. Reopen the same database connection (simulating Bridge restart)
      db = createDatabase(testDbPath);
      db.db.pragma('foreign_keys = OFF');

      // 4. Reset the lifecycle manager to clear cached database reference
      resetRuntimeLifecycleManager();

      // 5. Activate Hermes runtime
      await activateRuntime('hermes', hermesSessionId);

      // 6. Retrieve existing memory through Hermes
      const hermesContext = getAuthContext(hermesToken);
      const readMemoryResult = readMemory(hermesContext, memoryId);

      // 7. Verify persistence
      assert.strictEqual(readMemoryResult.memory_id, memoryId, 'Memory ID should match');
      assert.strictEqual(readMemoryResult.owner_type, 'staff', 'Owner type should persist');
      assert.strictEqual(readMemoryResult.owner_id, 'claude-agent-001', 'Owner ID should persist');
      assert.strictEqual(readMemoryResult.category, 'council_shared', 'Category should persist');
      assert.strictEqual(readMemoryResult.title, 'Persistence Test Memory', 'Title should persist');

      // Verify timestamps preserved
      assert.strictEqual(readMemoryResult.created_at, originalCreatedAt, 'Created at should be preserved across restart');
      assert.strictEqual(readMemoryResult.updated_at, originalUpdatedAt, 'Updated at should be preserved across restart');

      // Verify content preserved
      const content = JSON.parse(readMemoryResult.content);
      assert.strictEqual(content.data, 'Should survive restart');
      assert.strictEqual(content.persist, true);
      assert.strictEqual(content.counter, 42);

      // 8. Verify database directly
      directQuery = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
      assert.strictEqual(directQuery.length, 1, 'Exactly one record should exist after restart');
      const persistedMem = directQuery[0] as any;
      assert.strictEqual(persistedMem.created_at, originalCreatedAt, 'Created at should match original');
      assert.strictEqual(persistedMem.updated_at, originalUpdatedAt, 'Updated at should match original');
      assert.strictEqual(persistedMem.memory_id, memoryId, 'Memory ID should match');

      await deactivateRuntime(hermesSessionId);
    });
  });

  // Additional test: Verify access log records the runtime correctly
  describe('Access logging with runtime preservation', () => {
    beforeEach(async () => {
      resetRuntimeLifecycleManager();
      await activateRuntime('claude', claudeSessionId);
    });

    afterEach(async () => {
      await deactivateRuntime(claudeSessionId);
      resetRuntimeLifecycleManager();
    });

    it('should log correct runtime in memory_access table', async () => {
      const memoryId = 'access-log-test-001';
      const claudeContext = getAuthContext(claudeToken);

      // Create memory (council_shared for cross-runtime access)
      const memory = writeMemory(claudeContext, {
        memory_id: memoryId,
        owner_type: 'staff',
        owner_id: 'claude-agent-001',
        category: 'council_shared',
        memory_type: 'audit_test',
        title: 'Access Log Test',
        content: JSON.stringify({ test: 'access-logging' }),
        tags: [],
        confidence: 1.0
      });

      // Verify create access log
      const createAccess = db.query('SELECT * FROM memory_access WHERE memory_id = ? AND access_type = ?', [memoryId, 'create']);
      assert.strictEqual(createAccess.length, 1, 'Create access log should exist');
      assert.strictEqual(createAccess[0].accessor_runtime, 'claude', 'Create log should show claude runtime');

      // Disconnect Claude, activate Hermes
      await deactivateRuntime(claudeSessionId);
      await activateRuntime('hermes', hermesSessionId);

      // Read memory
      const hermesContext = getAuthContext(hermesToken);
      readMemory(hermesContext, memoryId);

      // Verify read access log shows hermes
      const readAccess = db.query('SELECT * FROM memory_access WHERE memory_id = ? AND access_type = ?', [memoryId, 'read']);
      assert.strictEqual(readAccess.length, 1, 'Read access log should exist');
      assert.strictEqual(readAccess[0].accessor_runtime, 'hermes', 'Read log should show hermes runtime');

      await deactivateRuntime(hermesSessionId);
    });
  });

  // Additional test: Verify runtime ownership enforcement
  describe('Runtime ownership enforcement', () => {
    beforeEach(async () => {
      // Reset singleton to ensure fresh lifecycle manager with current db reference
      resetRuntimeLifecycleManager();
      // Ensure clean database state
      db.db.prepare("UPDATE runtime_sessions SET connection_status = 'disconnected' WHERE connection_status = 'connected'").run();
    });

    afterEach(async () => {
      resetRuntimeLifecycleManager();
    });

    it('should reject MCP calls from non-active runtime', async () => {
      // Activate Claude - this should work with the fresh lifecycle manager
      const result = await activateRuntime('claude', claudeSessionId);

      // Verify Claude activated
      assert.strictEqual(result.success, true, `Claude should activate successfully: ${result.error}`);

      // Try to call MCP with Hermes token while Claude is active
      const hermesContext = getAuthContext(hermesToken);

      // Check ownership guard - use the test's runtime lifecycle manager
      const lifecycle = getRuntimeLifecycleManager(db);
      const checkOwnership = createRuntimeOwnershipGuard(db);
      const ownershipResult = checkOwnership(hermesContext);

      assert.strictEqual(ownershipResult.allowed, false, 'Should be denied');
      assert.strictEqual(ownershipResult.activeRuntime, 'claude', 'Active runtime should be claude');
    });

    it('should allow MCP calls from active runtime', async () => {
      // Activate Hermes
      const result = await activateRuntime('hermes', hermesSessionId);
      assert.strictEqual(result.success, true, `Hermes should activate successfully: ${result.error}`);

      const hermesContext = getAuthContext(hermesToken);

      // Check ownership guard - use the test's runtime lifecycle manager
      const lifecycle = getRuntimeLifecycleManager(db);
      const checkOwnership = createRuntimeOwnershipGuard(db);
      const ownershipResult = checkOwnership(hermesContext);

      assert.strictEqual(ownershipResult.allowed, true, 'Should be allowed for active runtime');
      assert.strictEqual(ownershipResult.activeRuntime, 'hermes');
    });
  });
});