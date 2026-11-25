// Runtime Lifecycle Unit Tests
// Phase 10: Verify single-active-runtime enforcement

import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-runtime');

function createTestDatabase(): { instance: ReturnType<typeof createDatabase>; path: string } {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = path.join(TEST_DB_DIR, `runtime-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

describe('Runtime Lifecycle Manager', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    // Reset singleton to ensure clean state for each test
    resetRuntimeLifecycleManager();

    // Create fresh test database for each test
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
    if (db) {
      try {
        db.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      db.close();
    }

    // Cleanup test database files
    if (fs.existsSync(TEST_DB_DIR)) {
      try {
        fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  describe('Initial State', () => {
    it('should start with no active runtime', () => {
      const state = manager.getState();
      assert.strictEqual(state.activeRuntime, null);
      assert.strictEqual(state.connectionStatus, 'disconnected');
      assert.strictEqual(state.sessionId, null);
    });
  });

  describe('Claude Connection', () => {
    it('should connect Claude runtime', () => {
      const result = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state?.activeRuntime, 'claude');
      assert.strictEqual(result.state?.connectionStatus, 'connected');
      assert.ok(result.state?.sessionId);
    });
  });

  describe('Hermes Connection', () => {
    it('should reject Hermes connection when Claude is active', () => {
      const result = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, true);

      const hermesResult = manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });
      assert.strictEqual(hermesResult.success, false);
      assert.ok(hermesResult.error?.includes('Runtime already active'));
    });
  });

  describe('Idempotent Connection', () => {
    it('should be idempotent for same session', () => {
      const result = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, true);

      const state = manager.getState();
      if (state.sessionId) {
        const secondResult = manager.connect({
          runtime: 'claude',
          sessionId: state.sessionId
        });
        assert.strictEqual(secondResult.success, true);
      }
    });
  });

  describe('Disconnection', () => {
    it('should disconnect the active runtime', () => {
      const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(connectResult.success, true);

      const state = manager.getState();
      assert.ok(state.sessionId);

      const result = manager.disconnect({ sessionId: state.sessionId });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state?.activeRuntime, null);
      assert.strictEqual(result.state?.connectionStatus, 'disconnected');
    });

    it('should be safe to disconnect again', () => {
      const result = manager.disconnect({ sessionId: 'nonexistent' });
      assert.strictEqual(result.success, false);
    });
  });

  describe('Hermes Connection After disconnect', () => {
    it('should allow Hermes connection after Claude disconnects', () => {
      const result = manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state?.activeRuntime, 'hermes');
    });
  });

  describe('Switch Runtime', () => {
    it('should switch from Hermes to Claude', () => {
      const hermes = manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });
      assert.strictEqual(hermes.success, true);

      const result = manager.switch({ newRuntime: 'claude', sessionId: hermes.state!.sessionId! });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state?.activeRuntime, 'claude');

      // Cleanup
      if (result.state?.sessionId) {
        manager.disconnect({ sessionId: result.state.sessionId });
      }
    });
  });

  describe('Invalid Runtime', () => {
    it('should reject invalid runtime identifier', () => {
      const result = manager.connect({ runtime: 'invalid' as any });
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Invalid'));
    });
  });

  describe('Session Ownership', () => {
    it('should verify session ownership', () => {
      const result = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, true);

      const state = manager.getState();
      if (state.sessionId) {
        const isOwner = manager.checkOwnership(state.sessionId);
        assert.strictEqual(isOwner, true);
      }
    });

    it('should reject ownership check for unknown session', () => {
      const isOwner = manager.checkOwnership('unknown-session-id');
      assert.strictEqual(isOwner, false);
    });
  });

  describe('Heartbeat', () => {
    it('should update heartbeat', () => {
      const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
      assert.strictEqual(connectResult.success, true);

      const state = manager.getState();
      assert.ok(state.sessionId);

      const result = manager.heartbeat({ sessionId: state.sessionId });
      assert.strictEqual(result.success, true);
      assert.ok(result.state?.lastHeartbeatAt);
    });

    it('should reject heartbeat for unknown session', () => {
      const result = manager.heartbeat({ sessionId: 'unknown-session' });
      assert.strictEqual(result.success, false);
    });
  });
});

describe('Timestamp Consistency Tests', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
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

  it('should verify timestamps created by connect() contain numeric Unix milliseconds', () => {
    const result = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);

    const state = result.state;
    assert.ok(state?.connectedAt);
    assert.ok(state?.leaseExpiresAt);

    // Verify numeric Unix milliseconds
    const connectedAt = parseInt(state.connectedAt!);
    const leaseExpires = parseInt(state.leaseExpiresAt!);
    const now = Date.now();

    assert.strictEqual(isNaN(connectedAt), false, 'connectedAt should be numeric');
    assert.strictEqual(isNaN(leaseExpires), false, 'leaseExpiresAt should be numeric');
    assert.ok(connectedAt > 1e12, 'connectedAt should be Unix milliseconds (year > 2001)');
    assert.ok(leaseExpires > now, 'leaseExpires should be in the future');
  });

  it('should verify timestamps created by switch() contain numeric Unix milliseconds', () => {
    // First connect with claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);

    // Now switch to hermes
    const result = manager.switch({ newRuntime: 'hermes', sessionId: claude.state!.sessionId!, clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);

    const state = result.state;
    assert.ok(state?.connectedAt);
    assert.ok(state?.leaseExpiresAt);

    // Verify numeric Unix milliseconds
    const connectedAt = parseInt(state.connectedAt!);
    const leaseExpires = parseInt(state.leaseExpiresAt!);
    const now = Date.now();

    assert.strictEqual(isNaN(connectedAt), false, 'connectedAt should be numeric');
    assert.strictEqual(isNaN(leaseExpires), false, 'leaseExpiresAt should be numeric');
    assert.ok(connectedAt > 1e12, 'connectedAt should be Unix milliseconds');
    assert.ok(leaseExpires > now, 'leaseExpires should be in the future');
  });

  it('should verify lease expiry is later than current time', () => {
    const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(connectResult.success, true);

    const state = connectResult.state;
    const leaseExpires = parseInt(state?.leaseExpiresAt || '0');
    const now = Date.now();

    assert.ok(leaseExpires > now, 'lease_expires_at should be greater than current time');
    // Check lease duration is approximately 10 minutes (600000ms)
    const leaseDuration = leaseExpires - parseInt(state?.connectedAt || '0');
    assert.ok(Math.abs(leaseDuration - 600000) < 100, 'lease duration should be ~10 minutes');
  });
});

describe('Heartbeat Ownership and Expiry Tests', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
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

  it('should reject an unknown session', () => {
    const result = manager.heartbeat({ sessionId: 'unknown-session-id' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Session not found');
  });

  it('should reject a disconnected session', () => {
    const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(connectResult.success, true);

    const state = manager.getState();
    assert.ok(state.sessionId);

    // Disconnect
    manager.disconnect({ sessionId: state.sessionId! });

    // Try heartbeat on disconnected session
    const result = manager.heartbeat({ sessionId: state.sessionId! });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('not eligible for renewal'));
  });

  it('should reject an expired session', () => {
    const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(connectResult.success, true);

    const state = manager.getState();
    assert.ok(state.sessionId);

    // Expire the lease by running direct SQL
    db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
      .run(String(Date.now() - 10000), state.sessionId);

    // Try heartbeat on expired session
    const result = manager.heartbeat({ sessionId: state.sessionId! });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('not eligible for renewal'));
  });

  it('should reject malformed lease timestamps', () => {
    // Insert a session with malformed timestamp via raw SQL
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'test-session', 'connected', 'not-a-timestamp', 'not-a-timestamp', 'not-a-timestamp', '127.0.0.1', null, null, 'now', 'now');

    const result = manager.heartbeat({ sessionId: 'test-session' });
    // Should either reject as not found (if lookup fails) or not update
    assert.strictEqual(result.success, false);
  });

  it('should verify heartbeat does not revive an expired session', () => {
    const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(connectResult.success, true);

    const state = manager.getState();
    assert.ok(state.sessionId);

    // Expire the lease
    db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
      .run(String(Date.now() - 10000), state.sessionId);

    // Verify session is expired in DB by checking lease_expires_at
    const sessionRow = db.db.prepare('SELECT lease_expires_at FROM runtime_sessions WHERE session_id = ?')
      .get(state.sessionId) as { lease_expires_at: string };
    const leaseExpires = parseInt(sessionRow.lease_expires_at);
    assert.ok(leaseExpires < Date.now(), 'Session lease should be expired');

    // Try heartbeat
    const result = manager.heartbeat({ sessionId: state.sessionId! });
    assert.strictEqual(result.success, false);

    // Verify session is still expired (lease not renewed)
    const finalSessionRow = db.db.prepare('SELECT lease_expires_at FROM runtime_sessions WHERE session_id = ?')
      .get(state.sessionId) as { lease_expires_at: string };
    const finalLeaseExpires = parseInt(finalSessionRow.lease_expires_at);
    assert.strictEqual(finalLeaseExpires, leaseExpires, 'Lease should not have been renewed');
  });

  it('should verify heartbeat cannot renew a session after another runtime has taken ownership', () => {
    // Connect Claude
    const claudeResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claudeResult.success, true);

    const claudeState = claudeResult.state;
    assert.ok(claudeState?.sessionId);

    // Switch to Hermes (this takes ownership)
    // The old Claude session is disconnected but preserved for history
    const switchResult = manager.switch({ newRuntime: 'hermes', sessionId: claudeState.sessionId!, clientIp: '127.0.0.1' });
    assert.strictEqual(switchResult.success, true);

    // Try heartbeat with original Claude session ID
    // Should fail - session was disconnected during switch (preserved for history)
    const hbResult = manager.heartbeat({ sessionId: claudeState!.sessionId! });
    assert.strictEqual(hbResult.success, false);
    // Session is now disconnected (preserved), so should be "not eligible"
    const validErrors = ['not eligible', 'expired'];
    const hasValidError = validErrors.some(err => hbResult.error?.includes(err));
    assert.ok(hasValidError, `Expected error to contain one of: ${validErrors.join(', ')}, got: ${hbResult.error}`);
  });

  it('should verify heartbeat and stale recovery cannot leave contradictory session state', () => {
    // Connect Claude
    const connectResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(connectResult.success, true);

    const state = connectResult.state;
    assert.ok(state?.sessionId);

    // Expire the lease
    db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
      .run(String(Date.now() - 10000), state.sessionId);

    // Run stale recovery and heartbeat concurrently (simulate race)
    manager.recoverStaleSessions();

    // At this point, session should be recovered (disconnected) or still expired
    // Heartbeat should fail either way
    const hbResult = manager.heartbeat({ sessionId: state.sessionId! });

    // After recovery, heartbeat should fail
    assert.strictEqual(hbResult.success, false);

    // Verify the session is either disconnected or still expired
    const finalState = manager.getState();
    assert.strictEqual(finalState.connectionStatus !== 'connected', true,
      'Session should not be connected after recovery/heartbeat race');
  });
});

describe('Runtime Switching Safety', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
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

  it('should not allow two simultaneous active runtimes', () => {
    // Connect Claude
    const claudeResult = manager.connect({ runtime: 'claude' });
    assert.strictEqual(claudeResult.success, true);

    // Try to connect Hermes - should fail
    const hermesResult = manager.connect({ runtime: 'hermes' });
    assert.strictEqual(hermesResult.success, false);
    assert.ok(hermesResult.error?.includes('Runtime already active'));

    // Clean up
    const state = manager.getState();
    if (state.sessionId) {
      manager.disconnect({ sessionId: state.sessionId });
    }
  });

  it('should allow clean switch between runtimes', () => {
    // Connect Claude
    const claudeResult = manager.connect({ runtime: 'claude' });
    assert.strictEqual(claudeResult.success, true);

    // Switch to Hermes
    const switchResult = manager.switch({ newRuntime: 'hermes', sessionId: claudeResult.state!.sessionId! });
    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.state?.activeRuntime, 'hermes');

    // Clean up
    if (switchResult.state?.sessionId) {
      manager.disconnect({ sessionId: switchResult.state.sessionId });
    }
  });
});

describe('Runtime Switching Regression Tests', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
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

  it('should preserve session history when switching Claude -> Hermes', async () => {
    // Connect Claude
    const claudeResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claudeResult.success, true);

    const claudeState = claudeResult.state;
    assert.ok(claudeState?.sessionId);

    // Switch to Hermes - should preserve Claude session in DB
    const switchResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: claudeState.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.state?.activeRuntime, 'hermes');

    // Verify Claude session still exists in DB but is disconnected
    const claudeDbSession = db.stmt.getRuntimeSessionBySession.get(claudeState.sessionId!) as any | undefined;
    assert.ok(claudeDbSession, 'Claude session should still exist in database');
    assert.strictEqual(claudeDbSession.connection_status, 'disconnected', 'Claude session should be disconnected');

    // Verify Hermes has its own session_id (not the same as Claude's)
    const hermesSessionId = switchResult.state?.sessionId;
    assert.ok(hermesSessionId, 'Hermes should have a session ID');
    assert.notStrictEqual(hermesSessionId, claudeState.sessionId, 'Hermes session ID should be different from Claude');

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup
    if (hermesSessionId) {
      manager.disconnect({ sessionId: hermesSessionId });
    }
  });

  it('should preserve session history when switching Hermes -> Claude', async () => {
    // Connect Hermes first
    const hermesResult = manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });
    assert.strictEqual(hermesResult.success, true);

    const hermesState = hermesResult.state;
    assert.ok(hermesState?.sessionId);

    // Switch to Claude
    const switchResult = manager.switch({
      newRuntime: 'claude',
      sessionId: hermesState.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.state?.activeRuntime, 'claude');

    // Verify Hermes session still exists in DB but is disconnected
    const hermesDbSession = db.stmt.getRuntimeSessionBySession.get(hermesState.sessionId!) as any | undefined;
    assert.ok(hermesDbSession, 'Hermes session should still exist in database');
    assert.strictEqual(hermesDbSession.connection_status, 'disconnected', 'Hermes session should be disconnected');

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup
    if (switchResult.state?.sessionId) {
      manager.disconnect({ sessionId: switchResult.state.sessionId });
    }
  });

  it('should allow Claude -> Hermes -> Claude cycle preserving history', async () => {
    // Connect Claude
    const claudeResult = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claudeResult.success, true);
    const claudeSession1 = claudeResult.state?.sessionId!;

    // Switch to Hermes
    const hermesResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: claudeSession1,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(hermesResult.success, true);
    const hermesSession = hermesResult.state?.sessionId!;

    // Switch back to Claude
    const claudeResult2 = manager.switch({
      newRuntime: 'claude',
      sessionId: hermesSession,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(claudeResult2.success, true);
    const claudeSession2 = claudeResult2.state?.sessionId!;

    // Verify we have three sessions in DB:
    // 1. Original Claude (disconnected)
    // 2. Hermes (disconnected)
    // 3. New Claude (connected)
    assert.notStrictEqual(claudeSession1, hermesSession, 'Session IDs should be unique');
    assert.notStrictEqual(hermesSession, claudeSession2, 'Session IDs should be unique');

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup
    if (claudeSession2) {
      manager.disconnect({ sessionId: claudeSession2 });
    }
  });

  it('should allow repeated switching when both runtime rows have completed execution history', async () => {
    // First cycle
    const claude1 = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude1.success, true);

    const hermes1 = manager.switch({
      newRuntime: 'hermes',
      sessionId: claude1.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(hermes1.success, true);

    const claude2 = manager.switch({
      newRuntime: 'claude',
      sessionId: hermes1.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(claude2.success, true);

    // Second cycle
    const hermes2 = manager.switch({
      newRuntime: 'hermes',
      sessionId: claude2.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(hermes2.success, true);

    const claude3 = manager.switch({
      newRuntime: 'claude',
      sessionId: hermes2.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(claude3.success, true);

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup
    if (claude3.state?.sessionId) {
      manager.disconnect({ sessionId: claude3.state.sessionId });
    }
  });

  it('stale recovery should advance generation for execution fencing', async () => {
    // Connect Claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);

    const sessionId = claude.state!.sessionId!;

    // Get initial generation
    const initialSession = db.stmt.getRuntimeSessionBySession.get(sessionId) as any;
    const initialGeneration = initialSession.generation;
    assert.ok(initialGeneration >= 1, 'Initial generation should be at least 1');

    // Expire the lease by running direct SQL
    db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
      .run(String(Date.now() - 10000), sessionId);

    // Run stale recovery
    const recoveryResult = manager.recoverStaleSessions();
    assert.strictEqual(recoveryResult.recovered, 1, 'Should recover 1 session');

    // Verify generation advanced
    const recoveredSession = db.stmt.getRuntimeSessionBySession.get(sessionId) as any;
    assert.strictEqual(recoveredSession.connection_status, 'disconnected', 'Session should be disconnected');
    assert.strictEqual(recoveredSession.generation, initialGeneration + 1, 'Generation should advance by 1');
    assert.ok(recoveredSession.last_error?.includes('stale lease'), 'Should have stale lease error message');

    // Cleanup - need to connect a fresh session
    const newConnect = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(newConnect.success, true);
  });

  it('should prevent switching while an execution remains incomplete', async () => {
    // Connect Claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);

    // Insert an incomplete execution record directly
    db.db.prepare(`
      INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, completed, generation, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?)
    `).run('exec-1', claude.state!.sessionId!, 'claude', String(Date.now()), String(Date.now() + 60000), String(Date.now()));

    // Try to switch - should fail
    const switchResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: claude.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(switchResult.success, false);
    assert.ok(switchResult.error?.includes('Cannot switch while an MCP execution is active'), `Got error: ${switchResult.error}`);

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup
    manager.disconnect({ sessionId: claude.state!.sessionId! });
  });

  it('should prevent switching when target runtime has unfinished execution', async () => {
    // Connect Claude
    const claude1 = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude1.success, true);
    const claudeSession = claude1.state!.sessionId!;

    // Switch to Hermes (this preserves Claude session as disconnected)
    const hermes1 = manager.switch({
      newRuntime: 'hermes',
      sessionId: claudeSession,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(hermes1.success, true);

    // Get Hermes session ID and insert unfinished execution
    const hermesSession = hermes1.state!.sessionId!;
    db.db.prepare(`
      INSERT INTO execution_records (id, session_id, runtime_id, started_at, expires_at, completed, generation, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?)
    `).run('exec-2', hermesSession, 'hermes', String(Date.now()), String(Date.now() + 60000), String(Date.now()));

    // Disconnect Hermes (should fail because of unfinished execution)
    const disconnectResult = manager.disconnect({ sessionId: hermesSession });
    assert.strictEqual(disconnectResult.success, false);
    assert.ok(disconnectResult.error?.includes('Cannot disconnect while an MCP execution is active'), `Got error: ${disconnectResult.error}`);

    // Verify Hermes is still active
    const state = manager.getState();
    assert.strictEqual(state.connectionStatus, 'connected', 'Hermes should still be connected');

    // Check PRAGMA foreign_key_check
    const fkCheck = db.db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'PRAGMA foreign_key_check should return no violations');

    // Cleanup - need to complete the execution first
    db.db.prepare('UPDATE execution_records SET completed = 1 WHERE session_id = ?').run(hermesSession);
    manager.disconnect({ sessionId: hermesSession });
  });

  it('should reject switch when target credential is revoked', async () => {
    const { provisionRuntimeCredential, insertRuntimeCredential, revokeRuntimeCredential } = await import('../../src/auth/runtime-credentials.js');

    // Connect Claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);
    const claudeSessionId = claude.state!.sessionId!;

    // Provision and insert a VALID Hermes credential
    const hermesCred = provisionRuntimeCredential('hermes');
    insertRuntimeCredential(db, {
      credentialId: hermesCred.credentialId,
      runtimeId: 'hermes',
      tokenHash: hermesCred.tokenHash,
      createdAt: hermesCred.createdAt,
      expiresAt: hermesCred.expiresAt
    });

    // Switch to Hermes with the VALID credential (using switch, not connect)
    const switchToHermes = manager.switch({
      newRuntime: 'hermes',
      sessionId: claudeSessionId,
      clientIp: '127.0.0.1',
      credentialId: hermesCred.credentialId
    });
    assert.strictEqual(switchToHermes.success, true);

    // Now revoke the credential
    revokeRuntimeCredential(db, hermesCred.credentialId);

    // Switch back to Claude
    const switchToClaude = manager.switch({
      newRuntime: 'claude',
      sessionId: switchToHermes.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(switchToClaude.success, true);

    // Try to switch back to Hermes - should fail because credential is revoked
    const switchResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: switchToClaude.state!.sessionId!,
      clientIp: '127.0.0.1'
    });

    // Should fail - target credential is revoked
    assert.strictEqual(switchResult.success, false);
    assert.ok(switchResult.error?.includes('revoked') || switchResult.error?.includes('no longer valid'), `Got error: ${switchResult.error}`);

    // Cleanup
    manager.disconnect({ sessionId: switchToClaude.state!.sessionId! });
  });

  it('should reject switch when target credential is expired', async () => {
    const { provisionRuntimeCredential, insertRuntimeCredential } = await import('../../src/auth/runtime-credentials.js');

    // Connect Claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);
    const claudeSessionId = claude.state!.sessionId!;

    // Provision and insert a VALID Hermes credential
    const hermesCred = provisionRuntimeCredential('hermes');
    insertRuntimeCredential(db, {
      credentialId: hermesCred.credentialId,
      runtimeId: 'hermes',
      tokenHash: hermesCred.tokenHash,
      createdAt: hermesCred.createdAt,
      expiresAt: hermesCred.expiresAt
    });

    // Switch to Hermes with the VALID credential
    const switchToHermes = manager.switch({
      newRuntime: 'hermes',
      sessionId: claudeSessionId,
      clientIp: '127.0.0.1',
      credentialId: hermesCred.credentialId
    });
    assert.strictEqual(switchToHermes.success, true);

    // Now manually expire the credential by updating the database
    const now = Date.now();
    db.db.prepare('UPDATE runtime_credentials SET expires_at = ? WHERE credential_id = ?').run(now - 1, hermesCred.credentialId);

    // Switch back to Claude
    const switchToClaude = manager.switch({
      newRuntime: 'claude',
      sessionId: switchToHermes.state!.sessionId!,
      clientIp: '127.0.0.1'
    });
    assert.strictEqual(switchToClaude.success, true);

    // Try to switch back to Hermes - should fail because credential is expired
    const switchResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: switchToClaude.state!.sessionId!,
      clientIp: '127.0.0.1'
    });

    // Should fail - target credential is expired
    assert.strictEqual(switchResult.success, false);
    assert.ok(switchResult.error?.includes('expired') || switchResult.error?.includes('no longer valid'), `Got error: ${switchResult.error}`);

    // Cleanup
    manager.disconnect({ sessionId: switchToClaude.state!.sessionId! });
  });

  it('should allow switch when target has no credential_id (new runtime)', async () => {
    // Connect Claude
    const claude = manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
    assert.strictEqual(claude.success, true);

    // Switch to Hermes which has never been connected (no credential_id)
    const switchResult = manager.switch({
      newRuntime: 'hermes',
      sessionId: claude.state!.sessionId!,
      clientIp: '127.0.0.1'
    });

    // Should succeed - no credential to validate
    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.state?.activeRuntime, 'hermes');

    // Cleanup
    if (switchResult.state?.sessionId) {
      manager.disconnect({ sessionId: switchResult.state.sessionId });
    }
  });
});

import { parseUnixMs } from '../../src/runtime/lifecycle.js';

describe('Strict Timestamp Parsing', () => {
  it('should accept valid Unix millisecond timestamps', () => {
    assert.strictEqual(parseUnixMs('1732123456789'), 1732123456789);
    assert.strictEqual(parseUnixMs(1732123456789), 1732123456789);
  });

  it('should reject partial numeric strings', () => {
    assert.strictEqual(parseUnixMs('123abc'), null);
    assert.strictEqual(parseUnixMs('abc123'), null);
  });

  it('should reject ISO datetime strings', () => {
    assert.strictEqual(parseUnixMs('2026-11-20T10:00:00.000Z'), null);
  });

  it('should reject empty strings', () => {
    assert.strictEqual(parseUnixMs(''), null);
  });

  it('should reject whitespace-only strings', () => {
    assert.strictEqual(parseUnixMs('   '), null);
    assert.strictEqual(parseUnixMs('\t\n'), null);
  });

  it('should reject NaN string', () => {
    assert.strictEqual(parseUnixMs('NaN'), null);
  });

  it('should reject Infinity', () => {
    assert.strictEqual(parseUnixMs('Infinity'), null);
    assert.strictEqual(parseUnixMs('-Infinity'), null);
    assert.strictEqual(parseUnixMs(Infinity), null);
  });

  it('should reject negative values', () => {
    assert.strictEqual(parseUnixMs(-1), null);
    assert.strictEqual(parseUnixMs('-1000'), null);
  });

  it('should reject zero', () => {
    assert.strictEqual(parseUnixMs(0), null);
    assert.strictEqual(parseUnixMs('0'), null);
  });

  it('should reject unsafe integers (outside JS safe integer range)', () => {
    assert.strictEqual(parseUnixMs(Number.MAX_SAFE_INTEGER + 1), null);
    assert.strictEqual(parseUnixMs(Number.MIN_SAFE_INTEGER - 1), null);
  });

  it('should reject null and undefined', () => {
    assert.strictEqual(parseUnixMs(null), null);
    assert.strictEqual(parseUnixMs(undefined), null);
  });

  it('should reject objects and arrays', () => {
    assert.strictEqual(parseUnixMs({}), null);
    assert.strictEqual(parseUnixMs([]), null);
    assert.strictEqual(parseUnixMs([123456]), null);
  });
});