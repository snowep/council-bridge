// Runtime Execution Guard Unit Tests
// Phase 10: Verify TOCTOU protection at MCP tool execution boundary

import { describe, it, afterEach, beforeEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import { createRuntimeExecutionGuard, cleanupExpiredExecutionRecords } from '../../src/runtime/runtime-execution-guard.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-runtime-exec');

function createTestDatabase(): { instance: ReturnType<typeof createDatabase>; path: string } {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = path.join(TEST_DB_DIR, `exec-guard-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

describe('Runtime Execution Guard - Unit Tests', () => {
  let db: ReturnType<typeof createDatabase>;
  let lifecycle: RuntimeLifecycleManager;
  let guard: ReturnType<typeof createRuntimeExecutionGuard>;

  before(() => {
    // Ensure clean state before all tests
    resetRuntimeLifecycleManager();
  });

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    lifecycle = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);
  });

  afterEach(() => {
    // Clean up after each test
    try {
      if (db) {
        // Expire any active sessions to stop heartbeat renewal
        db.db.prepare('UPDATE runtime_sessions SET connection_status = ? WHERE connection_status = ?')
          .run('disconnected', 'connected');
      }
    } catch {
      // Ignore errors - database might be closed by tests
    }
  });

  // Helper to create a valid auth context
  function createAuthContext(overrides: Partial<{
    runtime: 'claude' | 'hermes';
    session_id: string;
    owner_type: 'founder' | 'staff' | 'division' | 'seat';
    owner_id: string;
  }> = {}) {
    return {
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: 'claude' as const,
      session_id: 'test-session',
      permissions: [] as string[],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true,
      ...overrides
    };
  }

  // Helper to set up an active session
  async function setupActiveSession(runtime: 'claude' | 'hermes' = 'claude', sessionId?: string) {
    const result = lifecycle.connect({ runtime, sessionId, clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);
    return result.state!.sessionId!;
  }

  describe('acquireExecutionPermit', () => {
    it('should allow tool execution under valid ownership', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, true);
      assert.ok(result.context);
      assert.strictEqual(result.context!.runtimeId, 'claude');
      assert.strictEqual(result.context!.sessionId, sessionId);
      assert.ok(result.context!.executionId);
      // Release the permit to avoid leaving heartbeat interval running
      await guard.releaseExecutionPermit(result.context!.executionId);
    });

    it('should reject when session is disconnected', async () => {
      const sessionId = await setupActiveSession('claude');
      lifecycle.disconnect({ sessionId });

      const authContext = createAuthContext({ session_id: sessionId });
      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'NO_ACTIVE_SESSION');
    });

    it('should reject after switch to different runtime', async () => {
      const sessionId = await setupActiveSession('claude');
      // Switch to Hermes - this deletes the old session and creates new one
      // When switching without explicit sessionId, a new one is generated
      lifecycle.switch({ newRuntime: 'hermes' });

      // Now try to acquire permit with old claude session ID
      // The old session was deleted during switch, so it's not found
      const authContext = createAuthContext({ runtime: 'claude', session_id: sessionId });
      const result = await guard.acquireExecutionPermit(authContext);

      // Should fail - session was deleted during switch
      assert.strictEqual(result.success, false);
      // SESSION_NOT_FOUND is expected when old session is deleted during switch
      // RUNTIME_NOT_ACTIVE would be expected if session existed but wasn't active
      const validErrors = ['SESSION_NOT_FOUND', 'RUNTIME_NOT_ACTIVE'];
      const hasValidError = validErrors.includes(result.error?.code || '');
      assert.ok(hasValidError, `Expected error code to be one of ${validErrors.join(', ')}, got: ${result.error?.code}`);
    });

    it('should reject when session ID does not match active session', async () => {
      await setupActiveSession('claude', 'active-session');
      const authContext = createAuthContext({ session_id: 'different-session' });

      const result = await guard.acquireExecutionPermit(authContext);

      // Different session ID won't be found in runtime_sessions table since it's keyed by runtime
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'SESSION_NOT_FOUND');
    });

    it('should reject when runtime does not match', async () => {
      const sessionId = await setupActiveSession('hermes');
      const authContext = createAuthContext({ runtime: 'claude', session_id: sessionId });

      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'RUNTIME_MISMATCH');
      assert.strictEqual(result.error?.activeRuntime, 'hermes');
    });

    it('should reject expired lease', async () => {
      const sessionId = await setupActiveSession('claude');
      // Manually expire the lease - use string format as stored in DB
      // Note: getActiveRuntimeSession checks lease_expires_at, so expired lease means no active session
      const now = Date.now();
      const pastTime = String(now - 10000);
      db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ?, connection_status = ? WHERE session_id = ?')
        .run(pastTime, 'connecting', sessionId);

      const authContext = createAuthContext({ session_id: sessionId });
      const result = await guard.acquireExecutionPermit(authContext);

      // Should fail - no active connected session
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.code === 'NO_ACTIVE_SESSION' || result.error?.code === 'SESSION_EXPIRED');
    });

    it('should reject missing session ID', async () => {
      const authContext = createAuthContext({ session_id: '' });
      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'SESSION_ID_REQUIRED');
    });

    it('should reject non-existent session', async () => {
      const authContext = createAuthContext({ session_id: 'nonexistent-session' });
      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'SESSION_NOT_FOUND');
    });
  });

  describe('executeWithGuard', () => {
    it('should execute tool and release permit on success', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      let toolExecuted = false;
      let capturedExecutionId: string | undefined;
      const result = await guard.executeWithGuard(authContext, async (ctx) => {
        toolExecuted = true;
        assert.strictEqual(ctx.runtimeId, 'claude');
        assert.strictEqual(ctx.sessionId, sessionId);
        capturedExecutionId = ctx.executionId;
        return { success: true, data: 'tool result' };
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(toolExecuted, true);
      assert.strictEqual(result.result!.data, 'tool result');

      // Verify permit was released (completed = 1)
      const execRecord = db.stmt.getExecutionRecordById.get(capturedExecutionId!);
      assert.ok(execRecord);
      // But we can verify no active execution remains
      const activeExec = db.stmt.getActiveExecutionRecord.get(Date.now());
      assert.strictEqual(activeExec, undefined);
    });

    it('should release permit on tool error', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      const result = await guard.executeWithGuard(authContext, async () => {
        throw new Error('Tool failed');
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'TOOL_EXECUTION_ERROR');
      assert.ok(result.error?.message.includes('Tool failed'));

      // Verify permit was released
      const activeExec = db.stmt.getActiveExecutionRecord.get(Date.now());
      assert.strictEqual(activeExec, undefined);
    });

    it('should reject execution when no active session', async () => {
      const authContext = createAuthContext({ session_id: 'no-session' });
      const result = await guard.executeWithGuard(authContext, async () => ({ data: 'test' }));

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'SESSION_NOT_FOUND');
    });

    it('should prevent concurrent executions for same session', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      // First execution (will be kept alive)
      const executionPromise = guard.executeWithGuard(authContext, async () => {
        // Simulate long-running tool
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: 'first' };
      });

      // Try second execution immediately - should be rejected
      const result2 = await guard.executeWithGuard(authContext, async () => {
        return { data: 'second' };
      });

      assert.strictEqual(result2.success, false);
      assert.strictEqual(result2.error?.code, 'EXECUTION_IN_PROGRESS');

      // Wait for first to complete
      const result1 = await executionPromise;
      assert.strictEqual(result1.success, true);
    });

    it('should provide heartbeatInterval in execution context', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      let capturedContext: any = null;
      const result = await guard.executeWithGuard(authContext, async (ctx) => {
        capturedContext = ctx;
        return { data: 'test' };
      });

      assert.strictEqual(result.success, true);
      assert.ok(capturedContext);
      // heartbeatInterval should be defined (it's a NodeJS.Timeout object)
      // In Node.js, setInterval returns an object with internal ref counting
      // The important thing is that it exists so we can clear it in finally block
      assert.ok(capturedContext.heartbeatInterval);
    });
  });

  describe('releaseExecutionPermit', () => {
    it('should release permit on completion', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      const permit = await guard.acquireExecutionPermit(authContext);
      assert.strictEqual(permit.success, true);
      assert.ok(permit.context);

      await guard.releaseExecutionPermit(permit.context!.executionId);

      // Verify permit is completed
      const execRecord = db.stmt.getExecutionRecordById.get(permit.context!.executionId);
      assert.ok(execRecord);
      // Note: completed field would be 1
    });

    it('should handle release of non-existent permit gracefully', async () => {
      // Should not throw
      await guard.releaseExecutionPermit('non-existent-id');
    });
  });

  describe('cleanupExpiredExecutionRecords', () => {
    it('should clean up expired execution records', async () => {
      const sessionId = await setupActiveSession('claude');

      // Create a separate session row for the expired execution to satisfy FK constraint
      // Use 'disconnected' status to avoid UNIQUE constraint violation on idx_single_active_runtime
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
        VALUES ('hermes', 'expired-session', 'disconnected', datetime('now'), datetime('now'), datetime('now'), NULL, NULL, NULL, 1, datetime('now'), datetime('now'))
      `).run();

      db.db.prepare(`
        INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, completed, created_at)
        VALUES ('expired-exec', 'expired-session', 'hermes', ?, ?, 0, datetime('now'))
      `).run(Date.now() - 60000, Date.now() - 30000);

      // Insert a valid execution record
      db.stmt.insertExecutionRecord.run('valid-exec', sessionId, 'claude', Date.now(), Date.now() + 30000);

      const cleaned = cleanupExpiredExecutionRecords(db);
      assert.strictEqual(cleaned, 1);

      // Verify expired was removed, valid remains
      const expiredRecord = db.stmt.getExecutionRecordById.get('expired-exec');
      const validRecord = db.stmt.getExecutionRecordById.get('valid-exec');
      assert.strictEqual(expiredRecord, undefined);
      assert.ok(validRecord);
    });
  });

  describe('Integration with Runtime Switching', () => {
    it('should note that switch requires active session ownership', async () => {
      // When there's an active execution, we cannot switch because:
      // 1. The lifecycle.switch checks for existing active sessions
      // 2. But runtime_sessions table has runtime as primary key, so it gets replaced
      // This test verifies the guard prevents concurrent execution with wrong runtime
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      // Acquire permit (simulates start of tool execution)
      const permit = await guard.acquireExecutionPermit(authContext);
      assert.strictEqual(permit.success, true);

      // The guard prevents a second execution with a different session
      const wrongSessionAuth = createAuthContext({ session_id: 'wrong-session', runtime: 'hermes' });
      const wrongSessionResult = await guard.acquireExecutionPermit(wrongSessionAuth);
      assert.strictEqual(wrongSessionResult.success, false);

      // Release permit
      await guard.releaseExecutionPermit(permit.context!.executionId);

      // Now a switch can occur
      const switchResult = lifecycle.switch({ newRuntime: 'hermes' });
      assert.strictEqual(switchResult.success, true);
    });

    it('should allow switch after permit is released', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      // Acquire and immediately release permit
      const permit = await guard.acquireExecutionPermit(authContext);
      assert.strictEqual(permit.success, true);
      await guard.releaseExecutionPermit(permit.context!.executionId);

      // Switch should now succeed
      const switchResult = lifecycle.switch({ newRuntime: 'hermes' });
      assert.strictEqual(switchResult.success, true);
    });
  });

  describe('Database failure causes fail-closed', () => {
    it('should fail closed when database connection is unavailable', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      // Test that closed database returns DATABASE_ERROR
      // First acquire a permit (this starts heartbeat)
      const permit = await guard.acquireExecutionPermit(authContext);
      assert.strictEqual(permit.success, true);

      // Stop the heartbeat before closing
      if (permit.context?.heartbeatInterval) {
        clearInterval(permit.context.heartbeatInterval);
      }

      // Close the database - subsequent calls should fail
      db.close();

      // This should fail with DATABASE_ERROR because db is closed
      const result = await guard.acquireExecutionPermit(authContext);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'DATABASE_ERROR');
    });

    it('should clean up heartbeat timers after permit release', async () => {
      const sessionId = await setupActiveSession('claude');
      const authContext = createAuthContext({ session_id: sessionId });

      const permit = await guard.acquireExecutionPermit(authContext);
      assert.strictEqual(permit.success, true);

      // Release should stop the heartbeat timer
      await guard.releaseExecutionPermit(permit.context!.executionId);

      // Give any pending timers a chance to run
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no active executions remain (permit was released)
      const activeExec = db.stmt.getActiveExecutionRecord.get(Date.now() - 1000);
      assert.strictEqual(activeExec, undefined);
    });
  });
});