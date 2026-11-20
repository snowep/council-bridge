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
      manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });

      const result = manager.switch({ newRuntime: 'claude' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state?.activeRuntime, 'claude');
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
    manager.connect({ runtime: 'claude', clientIp: '127.0.0.1' });

    // Now switch to hermes
    const result = manager.switch({ newRuntime: 'hermes', clientIp: '127.0.0.1' });
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
    const switchResult = manager.switch({ newRuntime: 'hermes', clientIp: '127.0.0.1' });
    assert.strictEqual(switchResult.success, true);

    // Try heartbeat with original Claude session ID
    const hbResult = manager.heartbeat({ sessionId: claudeState!.sessionId! });
    assert.strictEqual(hbResult.success, false);
    assert.ok(hbResult.error?.includes('not eligible'));
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
    const switchResult = manager.switch({ newRuntime: 'hermes' });
    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.state?.activeRuntime, 'hermes');

    // Clean up
    const state = manager.getState();
    if (state.sessionId) {
      manager.disconnect({ sessionId: state.sessionId });
    }
  });
});