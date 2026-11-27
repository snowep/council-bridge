// P1-06: Integration tests for expired session generation fencing
// Tests that expired sessions with invalid leases increment generation
// and that old execution permits cannot renew after generation change

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import { createRuntimeExecutionGuard } from '../../src/runtime/runtime-execution-guard.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-p1-06');

function createTestDatabase() {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = path.join(TEST_DB_DIR, `runtime-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

// Helper function to create auth context for testing
function createAuthContext(overrides: Partial<{
  session_id: string;
  runtime: 'claude' | 'hermes';
  generation: number;
}>) {
  const now = Date.now();
  return {
    session_id: overrides.session_id ?? 'test-session',
    runtime: overrides.runtime ?? 'claude',
    generation: overrides.generation ?? 1,
    owner_type: 'runtime' as const,
    owner_id: 'runtime-test-owner',
    permissions: ['execution:permit'],
    expires_at: now + 3600000, // 1 hour
    issued_at: now,
  };
}

describe('P1-06: Expired Session Generation Fencing', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;
  let guard: ReturnType<typeof createRuntimeExecutionGuard>;

  after(() => {
    if (db) {
      try {
        db.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      db.close();
    }

    if (fs.existsSync(TEST_DB_DIR)) {
      try {
        fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  it('should increment generation when reactivating expired connected session', async () => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);

    // Connect with credential A
    const resultA = manager.connect({ runtime: 'claude', credentialId: 'cred-A' });
    assert.strictEqual(resultA.success, true, `First connection should succeed: ${resultA.error}`);
    const sessionIdA = (resultA.state?.sessionId as string)!;

    // Get initial session to read generation
    const sessionBefore = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    const initialGeneration = (sessionBefore as any).generation;

    // Manually expire the lease by setting it to the past
    const pastTime = String(Date.now() - 10000);
    db.db.prepare(`
      UPDATE runtime_sessions
      SET lease_expires_at = ?
      WHERE session_id = ?
    `).run(pastTime, sessionIdA);

    // Connect again with the same session (simulating reconnection with expired lease)
    const resultB = manager.connect({ runtime: 'claude', sessionId: sessionIdA, credentialId: 'cred-A' });
    assert.strictEqual(resultB.success, true, `Reconnect with expired session should succeed: ${resultB.error}`);

    // Verify generation was incremented
    const sessionAfter = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    assert.strictEqual((sessionAfter as any).generation, initialGeneration + 1, 'Generation should be incremented');
  });

  it('should reject execution renewal after expired session generation increment', async () => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);

    // Connect with credential A
    const resultA = manager.connect({ runtime: 'claude', credentialId: 'cred-A' });
    assert.strictEqual(resultA.success, true, `First connection should succeed: ${resultA.error}`);
    const sessionIdA = (resultA.state?.sessionId as string)!;

    // Get initial session to read generation
    const sessionBefore = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    const initialGeneration = (sessionBefore as any).generation;

    // Create an execution record with the current generation and mark as completed
    const executionId = 'exec-test-1';
    const now = Date.now();
    db.db.prepare(`
      INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, generation, completed)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(executionId, sessionIdA, 'claude', now, now + 60000, initialGeneration);

    // Verify execution record is completed
    const recordBefore = db.db.prepare('SELECT * FROM execution_records WHERE id = ?').get(executionId);
    assert.strictEqual((recordBefore as any).completed, 1, 'Execution record should be completed');

    // Manually expire the lease
    const pastTime = String(Date.now() - 10000);
    db.db.prepare(`
      UPDATE runtime_sessions
      SET lease_expires_at = ?
      WHERE session_id = ?
    `).run(pastTime, sessionIdA);

    // Connect again - this should increment generation (expired session reactivation)
    const resultB = manager.connect({ runtime: 'claude', sessionId: sessionIdA, credentialId: 'cred-A' });
    assert.strictEqual(resultB.success, true, `Reconnect should succeed: ${resultB.error}`);

    // Verify generation was incremented
    const sessionAfter = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    assert.strictEqual((sessionAfter as any).generation, initialGeneration + 1, 'Generation should be incremented');

    // Now try to acquire execution permit with the old generation
    // The generation check should fail because session generation has changed
    const authContext = createAuthContext({ runtime: 'claude', session_id: sessionIdA, generation: initialGeneration });
    const permitResult = await guard.acquireExecutionPermit(authContext);

    assert.strictEqual(permitResult.success, false, 'Permit should be rejected after generation change');
    assert.strictEqual(permitResult.error?.code, 'GENERATION_MISMATCH', 'Error should be GENERATION_MISMATCH');
  });

  it('should reject reactivation when session has active unfinished execution', async () => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);

    // Connect with credential A
    const resultA = manager.connect({ runtime: 'claude', credentialId: 'cred-A' });
    assert.strictEqual(resultA.success, true, `First connection should succeed: ${resultA.error}`);
    const sessionIdA = (resultA.state?.sessionId as string)!;

    // Create an unfinished execution record
    const executionId = 'exec-unfinished-1';
    const now = Date.now();
    db.db.prepare(`
      INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, generation, completed)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(executionId, sessionIdA, 'claude', now, now + 60000, 1);

    // Manually expire the lease
    const pastTime = String(Date.now() - 10000);
    db.db.prepare(`
      UPDATE runtime_sessions
      SET lease_expires_at = ?
      WHERE session_id = ?
    `).run(pastTime, sessionIdA);

    // Try to reconnect with the same session ID - should fail due to unfinished execution
    const resultB = manager.connect({ runtime: 'claude', sessionId: sessionIdA, credentialId: 'cred-A' });
    assert.strictEqual(resultB.success, false, 'Reconnect should fail with active execution');
    assert.ok(resultB.error?.includes('active execution') || resultB.error?.includes('execution'),
      `Error should mention active execution, got: ${resultB.error}`);
  });

  it('should allow disconnected session reconnect with generation increment', async () => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);

    // Connect with credential A
    const resultA = manager.connect({ runtime: 'claude', credentialId: 'cred-A' });
    assert.strictEqual(resultA.success, true, `First connection should succeed: ${resultA.error}`);
    const sessionIdA = (resultA.state?.sessionId as string)!;

    // Get initial session to read generation
    const sessionBefore = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    const initialGeneration = (sessionBefore as any).generation;

    // Disconnect the session
    manager.disconnect({ sessionId: sessionIdA });

    // Reconnect with the same session ID - generation should increment for stale session recovery
    const resultB = manager.connect({ runtime: 'claude', sessionId: sessionIdA, credentialId: 'cred-A' });
    assert.strictEqual(resultB.success, true, `Reconnect should succeed: ${resultB.error}`);

    // For disconnected sessions, generation should increment when reconnecting
    const sessionAfter = db.db.prepare('SELECT session_id, generation FROM runtime_sessions WHERE runtime = ?').get('claude');
    assert.strictEqual((sessionAfter as any).generation, initialGeneration + 1, 'Generation should increment on reconnect');
  });
});