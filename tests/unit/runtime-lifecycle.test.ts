// Runtime Lifecycle Unit Tests
// Phase 10: Verify single-active-runtime enforcement

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
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

  before(() => {
    // Create test database
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
      const result = manager.connect({ runtime: 'hermes', clientIp: '127.0.0.1' });
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Runtime already active'));
    });
  });

  describe('Idempotent Connection', () => {
    it('should be idempotent for same session', () => {
      // Get current session
      const state = manager.getState();
      if (state.sessionId) {
        const result = manager.connect({
          runtime: 'claude',
          sessionId: state.sessionId
        });
        assert.strictEqual(result.success, true);
      }
    });
  });

  describe('Disconnection', () => {
    it('should disconnect the active runtime', () => {
      const state = manager.getState();
      if (state.sessionId) {
        const result = manager.disconnect({ sessionId: state.sessionId });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.state?.activeRuntime, null);
        assert.strictEqual(result.state?.connectionStatus, 'disconnected');
      }
    });

    it('should be safe to disconnect again', () => {
      const state = manager.getState();
      if (!state.sessionId) {
        // No session to disconnect
        const result = manager.disconnect({ sessionId: 'nonexistent' });
        assert.strictEqual(result.success, false);
      }
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
      const state = manager.getState();
      if (state.sessionId) {
        const result = manager.heartbeat({ sessionId: state.sessionId });
        assert.strictEqual(result.success, true);
        // Heartbeat time should be updated
        assert.ok(result.state?.lastHeartbeatAt);
      }
    });

    it('should reject heartbeat for unknown session', () => {
      const result = manager.heartbeat({ sessionId: 'unknown-session' });
      assert.strictEqual(result.success, false);
    });
  });
});

describe('Runtime Switching Safety', () => {
  let db: ReturnType<typeof createDatabase>;
  let manager: RuntimeLifecycleManager;

  before(() => {
    const testDb = createTestDatabase();
    db = testDb.instance;
    manager = new RuntimeLifecycleManager(db);
  });

  after(async () => {
    try {
      db.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    db.close();
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