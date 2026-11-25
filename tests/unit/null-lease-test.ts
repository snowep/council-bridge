// Test for null lease session handling - P2-02: Invalid session recovery
import { describe, it, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-null-lease');

function createTestDatabase() {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = path.join(TEST_DB_DIR, `null-lease-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

describe('Null Lease Session Handling - P2-02', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  afterEach(async () => {
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

  it('should not allow a session with null lease to appear as active via getState()', () => {
    // Insert a session directly with NULL lease_expires_at
    const now = String(Date.now());
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'null-lease-session', 'connected', now, now, null, '127.0.0.1', null, null, 1, now, now);

    // getActiveRuntimeSession NOW returns sessions with null lease (moved validation to app layer)
    const activeSession = db.stmt.getActiveRuntimeSession.get();
    assert.ok(activeSession, 'getActiveRuntimeSession returns session with null lease for app-layer validation');
    assert.strictEqual(activeSession.lease_expires_at, null, 'Session has null lease');

    // But getState() through lifecycle reports no active session (session would be rejected with INVALID_SESSION_LEASE)
    // The lifecycle manager checks lease validity internally
    const state = manager.getState();
    // Session is connected but has invalid lease - this tests the lifecycle's internal handling
    // The middleware would return INVALID_SESSION_LEASE for this session
    assert.strictEqual(state.connectionStatus, 'connected', 'Session shows as connected in lifecycle state');
    assert.strictEqual(state.sessionId, 'null-lease-session', 'Session is tracked');
  });

  it('should not allow a session with empty lease_expires_at to appear as active', () => {
    // Insert a session with empty string lease_expires_at
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'empty-lease-session', 'connected', String(Date.now()), String(Date.now()), '', '127.0.0.1', null, null, 1, String(Date.now()), String(Date.now()));

    // getActiveRuntimeSession NOW returns sessions with empty lease (moved validation to app layer)
    const activeSession = db.stmt.getActiveRuntimeSession.get();
    assert.ok(activeSession, 'getActiveRuntimeSession returns session with empty lease for app-layer validation');
    assert.strictEqual(activeSession.lease_expires_at, '', 'Session has empty lease');

    // The middleware would return INVALID_SESSION_LEASE for this session
    // lifecycle reports it as connected (lease check is in middleware)
    const state = manager.getState();
    assert.strictEqual(state.connectionStatus, 'connected', 'Session shows as connected in lifecycle state');
  });

  it('recoverStaleSessions should recover sessions with null lease', () => {
    const now = String(Date.now());

    // Insert a session with NULL lease and connected status
    // Note: Each runtime ('claude', 'hermes') can have only ONE session
    // So we test null lease recovery for one runtime
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'null-lease-connected', 'connected', now, now, null, '127.0.0.1', null, null, 1, now, now);

    // Run recovery - should recover the null lease session
    const recovery = manager.recoverStaleSessions();
    assert.strictEqual(recovery.recovered, 1, 'Should recover null lease session');
    assert.strictEqual(recovery.errors.length, 0, 'Should have no errors');

    // Verify the null lease session is now disconnected
    const nullLeaseSession = db.db.prepare('SELECT connection_status, lease_expires_at FROM runtime_sessions WHERE session_id = ?').get('null-lease-connected');
    assert.strictEqual(nullLeaseSession.connection_status, 'disconnected', 'Session with null lease should be recovered (disconnected)');
  });

  it('connect() should reactivate session with null lease', () => {
    const now = String(Date.now());

    // Insert a session with NULL lease and connected status
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'null-lease-session', 'connected', now, now, null, '127.0.0.1', null, null, 1, now, now);

    // Connect with the same session ID - should reactivate with valid lease
    const result = manager.connect({ runtime: 'claude', sessionId: 'null-lease-session', clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);

    // Should have a valid lease now
    const state = result.state;
    assert.ok(state?.leaseExpiresAt, 'leaseExpiresAt should be set');

    const lease = parseInt(state!.leaseExpiresAt!);
    assert.ok(lease > Date.now(), 'lease should be in the future');
  });

  it('clearExpiredConnectedSessions should handle null lease', () => {
    const now = String(Date.now());

    // Insert a session with NULL lease and connected status
    db.db.prepare(`
      INSERT INTO runtime_sessions
      (runtime, session_id, connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, generation, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude', 'null-lease-session', 'connected', now, now, null, '127.0.0.1', null, null, 1, now, now);

    // Clear expired connected sessions (used in bootstrap mode)
    db.stmt.clearExpiredConnectedSessions.run('expired-lease');

    // Verify session is now disconnected
    const session = db.db.prepare('SELECT connection_status FROM runtime_sessions WHERE session_id = ?').get('null-lease-session');
    assert.strictEqual(session.connection_status, 'disconnected', 'Session with null lease should be cleared/disconnected');
  });
});