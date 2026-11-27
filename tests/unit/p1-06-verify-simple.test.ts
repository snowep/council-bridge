// P1-06: Simple verification test that credential rotation preserves execution history

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import {
  provisionRuntimeCredential,
  insertRuntimeCredential,
  revokeRuntimeCredential,
  rotateRuntimeCredential
} from '../../src/auth/runtime-credentials.js';
import { randomUUID } from 'node:crypto';

describe('P1-06: Credential Rotation Preserves Execution History', () => {
  let db: DatabaseInstance;
  let lifecycle: RuntimeLifecycleManager;

  beforeEach(() => {
    db = createDatabase(':memory:');
    lifecycle = new RuntimeLifecycleManager(db);
  });

  afterEach(() => {
    try { db.close(); } catch {}
    resetRuntimeLifecycleManager();
  });

  it('should preserve execution history when credential is rotated', async () => {
    // Step 1: Create and connect Claude with credential
    const claudeCred = provisionRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: claudeCred.credentialId,
      runtimeId: 'claude',
      tokenHash: claudeCred.tokenHash,
      createdAt: claudeCred.createdAt,
      expiresAt: claudeCred.expiresAt
    });

    const connectResult = lifecycle.connect({ runtime: 'claude', clientIp: '127.0.0.1', credentialId: claudeCred.credentialId });
    assert.strictEqual(connectResult.success, true, 'Claude should connect');

    const sessionState = connectResult.state;
    assert.ok(sessionState?.sessionId, 'Session should have a session ID');
    const sessionId = sessionState.sessionId!;

    // Step 2: Create multiple execution records
    // Note: Only one active execution record per session is allowed by UNIQUE constraint
    // So we create one active and one completed record to test preservation
    const execId1 = 'exec-1-' + randomUUID().slice(0, 8);
    const execId2 = 'exec-2-' + randomUUID().slice(0, 8);
    const now = Date.now();

    // Insert first execution record (active)
    db.stmt.insertExecutionRecord.run(execId1, sessionId, 'claude', now, now + 60000, sessionId);
    // Complete it before inserting second (to allow unique constraint)
    db.stmt.completeExecutionRecord.run(execId1);

    // Insert second execution record (active)
    db.stmt.insertExecutionRecord.run(execId2, sessionId, 'claude', now, now + 60000, sessionId);

    // Verify execution records exist
    let execs = db.query('SELECT * FROM execution_records WHERE session_id = ?', [sessionId]);
    assert.strictEqual(execs.length, 2, 'Should have 2 execution records before rotation');

    // Step 3: Get session credential_id BEFORE rotation
    const sessionBefore = db.stmt.getRuntimeSessionBySession.get(sessionId) as any;
    const oldCredentialId = sessionBefore.credential_id;

    // Step 4: Rotate the credential
    const newCred = provisionRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: newCred.credentialId,
      runtimeId: 'claude',
      tokenHash: newCred.tokenHash,
      createdAt: newCred.createdAt,
      expiresAt: newCred.expiresAt
    });

    // Rotate the credential
    const rotationResult = rotateRuntimeCredential(db, oldCredentialId!, 'claude');
    assert.ok(rotationResult, 'Credential rotation should succeed');

    // Step 5: Verify execution records are preserved
    execs = db.query('SELECT * FROM execution_records WHERE session_id = ?', [sessionId]);
    assert.strictEqual(execs.length, 2, 'Both execution records should be preserved after credential rotation');

    // Step 6: Verify session still exists and has same session_id
    const sessionAfter = db.stmt.getRuntimeSessionBySession.get(sessionId) as any;
    assert.ok(sessionAfter, 'Session should still exist');
    assert.strictEqual(sessionAfter.session_id, sessionId, 'Session ID should be unchanged');
  });

  it('should preserve completed execution records across credential rotation', async () => {
    // Create and connect Claude with credential
    const claudeCred = provisionRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: claudeCred.credentialId,
      runtimeId: 'claude',
      tokenHash: claudeCred.tokenHash,
      createdAt: claudeCred.createdAt,
      expiresAt: claudeCred.expiresAt
    });

    const connectResult = lifecycle.connect({ runtime: 'claude', clientIp: '127.0.0.1', credentialId: claudeCred.credentialId });
    assert.strictEqual(connectResult.success, true);

    const sessionId = connectResult.state!.sessionId!;
    const now = Date.now();

    // Create an execution record and mark it as completed
    const execId = 'exec-completed-' + randomUUID().slice(0, 8);
    db.stmt.insertExecutionRecord.run(execId, sessionId, 'claude', now, now + 60000, sessionId);
    db.stmt.completeExecutionRecord.run(execId);

    // Verify it's completed
    let execs = db.query('SELECT completed FROM execution_records WHERE id = ?', [execId]);
    assert.strictEqual(execs.length, 1);
    assert.strictEqual(execs[0].completed, 1, 'Should be completed');

    // Get session credential_id
    const sessionBefore = db.stmt.getRuntimeSessionBySession.get(sessionId) as any;
    const oldCredentialId = sessionBefore.credential_id;

    // Rotate credential
    const newCred = provisionRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: newCred.credentialId,
      runtimeId: 'claude',
      tokenHash: newCred.tokenHash,
      createdAt: newCred.createdAt,
      expiresAt: newCred.expiresAt
    });
    rotateRuntimeCredential(db, oldCredentialId!, 'claude');

    // Verify completed execution record is preserved
    execs = db.query('SELECT completed FROM execution_records WHERE id = ?', [execId]);
    assert.strictEqual(execs.length, 1, 'Completed execution record should be preserved');
    assert.strictEqual(execs[0].completed, 1, 'Completed execution record should still be marked completed');
  });

  it('should preserve session with execution records during runtime switch', async () => {
    // Connect Claude
    const claudeResult = lifecycle.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claudeResult.success, true);
    const claudeSessionId = claudeResult.state!.sessionId!;

    // Get Claude session's credential
    const claudeSession = db.stmt.getRuntimeSessionBySession.get(claudeSessionId) as any;
    const claudeCredentialId = claudeSession.credential_id;

    // Create execution record for Claude
    const claudeExecId = 'exec-claude-' + randomUUID().slice(0, 8);
    const now = Date.now();
    db.stmt.insertExecutionRecord.run(claudeExecId, claudeSessionId, 'claude', now, now + 60000, claudeSessionId);

    // Verify 1 execution record before switch
    let execs = db.query('SELECT * FROM execution_records WHERE session_id = ?', [claudeSessionId]);
    assert.strictEqual(execs.length, 1, 'Should have 1 execution record before switch');

    // Complete the execution
    db.stmt.completeExecutionRecord.run(claudeExecId);

    // Switch to Hermes (this is a different runtime)
    const hermesSwitch = lifecycle.switch({
      newRuntime: 'hermes',
      sessionId: claudeSessionId,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(hermesSwitch.success, true, 'Switch should succeed after execution completed');

    // Verify original Claude session still exists with its execution record
    const claudeDbSession = db.stmt.getRuntimeSessionBySession.get(claudeSessionId) as any;
    assert.ok(claudeDbSession, 'Original Claude session should be preserved');
    assert.strictEqual(claudeDbSession.connection_status, 'disconnected', 'Claude session should be disconnected');

    // Verify ALL execution records are preserved (including the original one)
    execs = db.query('SELECT * FROM execution_records');
    console.log('Total execution records after switch:', execs.length);
    // Only the original Claude session's execution record is preserved
    // The new Hermes session doesn't have any execution records yet
    assert.strictEqual(execs.length, 1, 'Original execution record should be preserved');
  });
});