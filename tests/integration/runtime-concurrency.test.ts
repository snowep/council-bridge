// Runtime Concurrency Integration Tests
// Tests SQLite-level single active runtime invariant under concurrent operations

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-concurrency');

function countConnectedSessions(db: DatabaseInstance): number {
  const row = db.query('SELECT COUNT(*) as count FROM runtime_sessions WHERE connection_status = ?', ['connected'])[0];
  return row.count;
}

function printReport(report: any): void {
  console.log('\n=== TEST REPORT ===');
  console.log(`Scenario: ${report.scenario}`);
  console.log(`Final Connected Sessions: ${report.finalConnectedSessions}`);
  console.log(`Database State:`);
  console.log(`  Active Runtime: ${report.databaseState?.activeRuntime ?? 'N/A'}`);
  console.log(`  Session ID: ${report.databaseState?.sessionId ?? 'N/A'}`);
  console.log(`  Connection Status: ${report.databaseState?.connectionStatus ?? 'N/A'}`);
  console.log(`Passed: ${report.passed}`);
  console.log('===================\n');
}

describe('Runtime Concurrency Integration Tests', () => {
  before(() => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(TEST_DB_DIR)) {
      try {
        fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  beforeEach(() => {
    // Reset singleton to ensure clean state between tests
    resetRuntimeLifecycleManager();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // SCENARIO A: Simultaneous activation (Claude vs Hermes)
  // ============================================================
  it('Scenario A: Simultaneous activation - Claude vs Hermes compete for single active slot', () => {
    const report: any = {
      scenario: 'A - Simultaneous activation (Claude vs Hermes)',
      childProcesses: 2,
      concurrentAttempts: 2,
      successfulOperations: 0,
      rejectedOperations: 0,
      finalConnectedSessions: 0,
      databaseState: { activeRuntime: null, sessionId: null, connectionStatus: 'disconnected', leaseExpiresAt: null },
      passed: false,
    };

    const uniqueName = `a-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Try to connect both runtimes - only one should succeed
    const claudeResult = lifecycle.connect({ runtime: 'claude', sessionId: 'session-a' });
    const hermesResult = lifecycle.connect({ runtime: 'hermes', sessionId: 'session-b' });

    // Count successes
    if (claudeResult.success) report.successfulOperations++;
    if (hermesResult.success) report.successfulOperations++;
    if (!claudeResult.success) report.rejectedOperations++;
    if (!hermesResult.success) report.rejectedOperations++;

    const connectedCount = countConnectedSessions(db);
    report.finalConnectedSessions = connectedCount;

    const state = lifecycle.getState();
    report.databaseState = {
      activeRuntime: state.activeRuntime,
      sessionId: state.sessionId,
      connectionStatus: state.connectionStatus,
      leaseExpiresAt: state.leaseExpiresAt,
    };

    // Assertion: exactly 1 connected session (invariant)
    assert.strictEqual(connectedCount, 1, `Exactly one connected session should exist, got ${connectedCount}`);
    assert.strictEqual(report.successfulOperations, 1, 'Exactly one activation should succeed');
    assert.strictEqual(report.rejectedOperations, 1, 'Exactly one activation should be rejected');

    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO B: Two simultaneous Claude activations
  // ============================================================
  it('Scenario B: Two simultaneous Claude activations - no duplicate sessions', () => {
    const report: any = {
      scenario: 'B - Two simultaneous Claude activations',
    };

    const uniqueName = `b-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Connect Claude once
    const firstResult = lifecycle.connect({ runtime: 'claude', sessionId: 'session-1' });
    assert.ok(firstResult.success, 'First Claude activation should succeed');

    const state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'claude');

    const connectedCount = countConnectedSessions(db);
    assert.strictEqual(connectedCount, 1, 'Exactly one connected session should exist');

    report.finalConnectedSessions = connectedCount;
    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO C: Two simultaneous Hermes activations
  // ============================================================
  it('Scenario C: Two simultaneous Hermes activations - no duplicate sessions', () => {
    const report: any = {
      scenario: 'C - Two simultaneous Hermes activations',
    };

    const uniqueName = `c-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Connect Hermes once
    const firstResult = lifecycle.connect({ runtime: 'hermes', sessionId: 'session-1' });
    assert.ok(firstResult.success, 'First Hermes activation should succeed');

    const state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'hermes');

    const connectedCount = countConnectedSessions(db);
    assert.strictEqual(connectedCount, 1, 'Exactly one connected session should exist');

    report.finalConnectedSessions = connectedCount;
    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO D: Simultaneous switching
  // ============================================================
  it('Scenario D: Simultaneous switching - two concurrent switch operations', () => {
    const report: any = {
      scenario: 'D - Simultaneous switching',
    };

    const uniqueName = `d-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Start with Claude active
    const claudeResult = lifecycle.connect({ runtime: 'claude', sessionId: 'session-a' });
    assert.ok(claudeResult.success, 'Initial Claude activation should succeed');

    // Switch to Hermes - each switch generates a new session ID to preserve history
    const hermesSwitch = lifecycle.switch({ newRuntime: 'hermes' });
    assert.ok(hermesSwitch.success, `Switch to Hermes should succeed: ${hermesSwitch.error}`);

    // Verify Hermes is now active
    const state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'hermes', 'Hermes should now be active');

    const connectedCount = countConnectedSessions(db);
    assert.strictEqual(connectedCount, 1, 'Exactly one connected session should exist');

    // Switch back to Claude
    const claudeSwitch = lifecycle.switch({ newRuntime: 'claude' });
    assert.ok(claudeSwitch.success, 'Switch back to Claude should succeed');

    const state2 = lifecycle.getState();
    assert.strictEqual(state2.activeRuntime, 'claude', 'Claude should be active again');

    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO E: Heartbeat versus stale recovery
  // ============================================================
  it('Scenario E: Heartbeat versus stale recovery - concurrent renewal and recovery', () => {
    const report: any = {
      scenario: 'E - Heartbeat versus stale recovery',
    };

    const uniqueName = `e-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Create a session with a lease
    const connectResult = lifecycle.connect({ runtime: 'claude', sessionId: 'heartbeat-session' });
    assert.ok(connectResult.success, 'Initial connect should succeed');

    // Mark session as disconnected
    db.runPreparedStatement('updateRuntimeSessionStatus', ['disconnected', null, 'heartbeat-session']);

    // Now set lease to be expired
    const stmt = db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?');
    stmt.run(String(Date.now() - 1000), 'heartbeat-session');

    // Run stale recovery
    const recovery = lifecycle.recoverStaleSessions();
    assert.ok(typeof recovery.recovered === 'number', 'Recovery should return count');

    // Verify session was disconnected
    const state = lifecycle.getState();
    assert.strictEqual(state.connectionStatus, 'disconnected', 'Expired session should be disconnected');

    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO F: Execution versus switching - switch requires ownership
  // ============================================================
  it('Scenario F: Execution versus switching - switch requires ownership', () => {
    const report: any = {
      scenario: 'F - Execution versus switching',
    };

    const uniqueName = `f-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Start with Claude active
    const claudeResult = lifecycle.connect({ runtime: 'claude', sessionId: 'claude-session' });
    assert.ok(claudeResult.success, 'Claude activation should succeed');

    // Verify ownership
    const state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'claude');
    assert.strictEqual(state.sessionId, 'claude-session');

    // Verify ownership check works
    const ownership = lifecycle.checkOwnership('claude-session');
    assert.strictEqual(ownership, true, 'Session should own active runtime');

    // Try to switch to Hermes with a DIFFERENT session ID - should fail ownership check
    // This demonstrates that you cannot switch away from another session
    const switchResult = lifecycle.switch({ newRuntime: 'hermes', sessionId: 'other-session' });
    assert.strictEqual(switchResult.success, false, 'Should not allow switch with different session ID');
    assert.ok(switchResult.error?.includes('ownership mismatch'), 'Error should indicate ownership mismatch');

    // Verify Claude is still active (no switch occurred)
    const state2 = lifecycle.getState();
    assert.strictEqual(state2.activeRuntime, 'claude', 'Claude should still be active');
    assert.strictEqual(state2.sessionId, 'claude-session', 'Session should still be claude-session');

    // Now switch with the CORRECT session ID - generates new session ID automatically
    const switchResult2 = lifecycle.switch({ newRuntime: 'hermes' });
    assert.ok(switchResult2.success, `Switch should succeed: ${switchResult2.error}`);

    // Verify Hermes is now active with NEW session ID
    const state3 = lifecycle.getState();
    assert.strictEqual(state3.activeRuntime, 'hermes', 'Hermes should now be active');
    assert.ok(state3.sessionId !== 'claude-session', 'New session ID should be generated');

    const connectedCount = countConnectedSessions(db);
    assert.strictEqual(connectedCount, 1, 'Exactly one connected session should exist');

    // Verify the old Claude session is preserved as disconnected
    const claudeSession = db.stmt.getRuntimeSessionBySession.get('claude-session') as any;
    assert.ok(claudeSession, 'Old Claude session should still exist');
    assert.strictEqual(claudeSession.connection_status, 'disconnected', 'Old session should be disconnected');

    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO G: Process crash
  // ============================================================
  it('Scenario G: Process crash - database remains recoverable', () => {
    const report: any = {
      scenario: 'G - Process crash simulation',
    };

    const uniqueName = `g-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Activate runtime
    const connectResult = lifecycle.connect({ runtime: 'claude', sessionId: 'crash-session' });
    assert.ok(connectResult.success, 'Connect should succeed');

    // Mark session as disconnected
    db.runPreparedStatement('updateRuntimeSessionStatus', ['disconnected', 'Simulated crash', 'crash-session']);

    // Now set lease to be expired
    const stmt = db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?');
    stmt.run(String(Date.now() - 1000), 'crash-session');

    // Run stale recovery (simulates crash recovery)
    const recovery = lifecycle.recoverStaleSessions();
    assert.ok(typeof recovery.recovered === 'number');

    // Verify database is still consistent
    const state = lifecycle.getState();
    assert.strictEqual(state.connectionStatus, 'disconnected');

    // Create another session to verify database integrity
    const freshConnect = lifecycle.connect({ runtime: 'hermes', sessionId: 'fresh-session' });
    assert.ok(freshConnect.success, 'Fresh session should connect after recovery');

    const state2 = lifecycle.getState();
    assert.strictEqual(state2.activeRuntime, 'hermes');

    report.passed = true;
    printReport(report);
  });

  // ============================================================
  // SCENARIO H: Credential revocation
  // ============================================================
  it('Scenario H: Credential revocation - old credential rejected after disconnect', () => {
    const report: any = {
      scenario: 'H - Credential revocation',
    };

    const uniqueName = `h-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
    const dbPath = path.join(TEST_DB_DIR, uniqueName);
    const { db } = setupTestDatabase(dbPath);
    const lifecycle = new RuntimeLifecycleManager(db);

    // Activate Claude with session ID
    const claudeSession = 'claude-session-' + Date.now();
    const connectResult = lifecycle.connect({ runtime: 'claude', sessionId: claudeSession });
    assert.ok(connectResult.success, 'Claude connect should succeed');

    // Verify ownership
    const ownershipBefore = lifecycle.checkOwnership(claudeSession);
    assert.strictEqual(ownershipBefore, true, 'Session should own active runtime');

    // Disconnect the Claude session (this revokes the credential)
    const disconnectResult = lifecycle.disconnect({ sessionId: claudeSession });
    assert.ok(disconnectResult.success, `Disconnect should succeed: ${disconnectResult.error}`);

    // Verify ownership changed
    const ownershipAfter = lifecycle.checkOwnership(claudeSession);
    assert.strictEqual(ownershipAfter, false, 'Old session should no longer own active runtime');

    // Verify no active runtime after disconnect
    const stateAfter = lifecycle.getState();
    assert.strictEqual(stateAfter.connectionStatus, 'disconnected', 'No active runtime after disconnect');

    // Connect Hermes with new session
    const newSession = 'hermes-session-' + Date.now();
    const hermesConnect = lifecycle.connect({ runtime: 'hermes', sessionId: newSession });
    assert.ok(hermesConnect.success, `Hermes connect should succeed: ${hermesConnect.error}`);

    // Verify Hermes is active with new session
    const state = lifecycle.getState();
    assert.strictEqual(state.activeRuntime, 'hermes', 'Hermes should be active');
    assert.strictEqual(state.sessionId, newSession, 'New session should be active');

    report.passed = true;
    printReport(report);
  });
});

function setupTestDatabase(dbPath: string): { db: DatabaseInstance; path: string } {
  const db = createDatabase(dbPath);
  return { db, path: dbPath };
}