import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { createRuntimeExecutionGuard } from '../../src/runtime/runtime-execution-guard.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';

describe('Local Founder Bootstrap Session', () => {
  let db: ReturnType<typeof createDatabase>;
  let lifecycle: RuntimeLifecycleManager;
  let guard: ReturnType<typeof createRuntimeExecutionGuard>;

  beforeEach(() => {
    // Enable local single-user mode for these tests
    process.env.LOCAL_SINGLE_USER_MODE = 'true';
    resetRuntimeLifecycleManager();
    db = createDatabase(':memory:');
    lifecycle = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
    delete process.env.LOCAL_SINGLE_USER_MODE;
  });

  it('should allow local-founder bootstrap session when no active session exists', async () => {
    const authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'local-founder',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true
    } as any;

    const result = await guard.acquireExecutionPermit(authContext);

    assert.strictEqual(result.success, true);
    assert.ok(result.context);
    assert.strictEqual(result.context!.sessionId, 'local-founder');
    assert.strictEqual(result.context!.runtimeId, 'claude');

    // Verify session was created in database
    const sessionRow = db.stmt.getRuntimeSessionBySession.get('local-founder') as any;
    assert.ok(sessionRow, 'Bootstrap session should be created');
    assert.strictEqual(sessionRow.runtime, 'claude');
    assert.strictEqual(sessionRow.connection_status, 'connected');
  });

  it('should allow local-founder bootstrap session with hermes runtime', async () => {
    const authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'hermes',
      session_id: 'local-founder',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true
    } as any;

    const result = await guard.acquireExecutionPermit(authContext);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.context!.runtimeId, 'hermes');
  });

  it('should hand off from existing connected session to local-founder bootstrap', async () => {
    // First, create and connect a hermes session (simulating existing active session)
    const connectResult = lifecycle.connect({ runtime: 'hermes', sessionId: 'existing-hermes-session' });
    assert.strictEqual(connectResult.success, true, 'Initial Hermes connect should succeed');

    // Verify hermes is connected
    let state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'hermes');
    assert.strictEqual(state.connectionStatus, 'connected');

    // Now try to acquire permit with local-founder for claude
    const authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'local-founder',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true
    } as any;

    const result = await guard.acquireExecutionPermit(authContext);

    assert.strictEqual(result.success, true, `Should succeed: ${JSON.stringify(result)}`);
    assert.strictEqual(result.context!.sessionId, 'local-founder');
    assert.strictEqual(result.context!.runtimeId, 'claude');

    // Verify hermes session was disconnected but session moved to local-founder
    state = lifecycle.getState();
    assert.strictEqual(state.connectionStatus, 'connected');
    assert.strictEqual(state.sessionId, 'local-founder', 'Session should be transferred');

    // Verify the new bootstrap session is connected
    const bootstrapSession = db.stmt.getRuntimeSessionBySession.get('local-founder') as any;
    assert.ok(bootstrapSession, 'Bootstrap session should exist');
    assert.strictEqual(bootstrapSession.runtime, 'claude');
    assert.strictEqual(bootstrapSession.connection_status, 'connected');
  });
});
