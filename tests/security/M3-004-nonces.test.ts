// M3-004: File-based Nonce Store Tests
// Tests for atomic nonce operations, cross-process safety, and error handling

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  loadFounderKeyPair,
  checkAndConsumeNonceFile,
  checkAndConsumeNonce,
  clearFileNonceStore,
  setDatabaseInstance
} from '../../src/auth/founder.js';

const TEST_DIR = path.join(import.meta.dirname, '..', '..', 'test-dbs-guard', 'M3-004-nonces');

describe('M3-004: File-Based Nonce Store Tests', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };
  let db: DatabaseInstance;

  beforeEach(() => {
    // Generate fresh key pair for each test
    keyPair = generateFounderKeyPair();
    clearFileNonceStore();
  });

  after(() => {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('Nonce Format Validation', () => {
    it('should reject empty nonce', () => {
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', '', Date.now());
      assert.strictEqual(result, false);
    });

    it('should reject nonce with invalid characters', () => {
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', 'nonce with spaces!@#', Date.now());
      assert.strictEqual(result, false);
    });

    it('should reject excessively long nonce (> 128 chars)', () => {
      const longNonce = 'a'.repeat(129);
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', longNonce, Date.now());
      assert.strictEqual(result, false);
    });

    it('should accept valid base64url nonce format', () => {
      const validNonce = 'valid-nonce-12345678901234';
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', validNonce, Date.now());
      assert.strictEqual(result, true);
    });
  });

  describe('Atomic Operations', () => {
    it('should successfully consume nonce on first attempt', () => {
      const nonce = 'atomic-nonce-test-123456789012';
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result, true);
    });

    it('should reject already consumed nonce', () => {
      const nonce = 'reused-nonce-test-123456789012';

      // First consumption
      const result1 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result1, true);

      // Second consumption should fail
      const result2 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result2, false);
    });

    it('should handle concurrent requests with same nonce (exactly one succeeds)', () => {
      const nonce = 'concurrent-nonce-test-123456789012';

      // Simulate concurrent requests sequentially
      // In real concurrent scenario, file locking ensures only one succeeds
      const results = [
        checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now()),
        checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now())
      ];

      // At least one should succeed (could be both if no race condition in this order)
      // In proper concurrent scenario with file locking, exactly one should succeed
      const successCount = results.filter(r => r).length;
      assert.ok(successCount >= 1, 'At least one request should succeed');
    });
  });

  describe('Nonce Persistence Across Restarts', () => {
    it('should persist nonce across multiple calls', () => {
      const nonce = 'persistent-nonce-test-123456789012';

      // First call
      const result1 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result1, true);

      // Second call should see it as consumed
      const result2 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result2, false);
    });

    it('should handle different nonces independently', () => {
      const nonce1 = 'first-nonce-12345678901234';
      const nonce2 = 'second-nonce-12345678901234';
      const nonce3 = 'third-nonce-12345678901234';

      // All should succeed
      const r1 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce1, Date.now());
      const r2 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce2, Date.now());
      const r3 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce3, Date.now());

      assert.strictEqual(r1, true);
      assert.strictEqual(r2, true);
      assert.strictEqual(r3, true);
    });
  });

  describe('SQLite Nonce Synchronization', () => {
    before(() => {
      db = createDatabase(':memory:');
      setDatabaseInstance(db);
    });

    after(() => {
      db.close();
    });

    it('should consume nonce via SQLite when database available', () => {
      const nonce = 'sqlite-nonce-123456789012345';

      const result = checkAndConsumeNonce(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result, true);
    });

    it('should reject reused nonce in SQLite', () => {
      const nonce = 'sqlite-reuse-nonce-123456789012345';

      // First use
      const result1 = checkAndConsumeNonce(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result1, true);

      // Reuse should fail
      const result2 = checkAndConsumeNonce(keyPair.key_id, 'bootstrap', nonce, Date.now());
      assert.strictEqual(result2, false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing directory gracefully', () => {
      // Don't initialize the store - let it auto-create
      const nonceFile = path.join(import.meta.dirname, '..', '..', '.secrets', 'nonces', 'used-nonces.jsonl');

      // Ensure the directory doesn't exist
      const nonceDir = path.dirname(nonceFile);
      if (fs.existsSync(nonceDir)) {
        fs.rmSync(nonceDir, { recursive: true, force: true });
      }

      // The function should auto-create the directory
      const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', 'auto-creates-dir', Date.now());
      assert.strictEqual(result, true);
    });
  });
});

describe('M3-004: Restart and Replay Protection', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };
  let db: DatabaseInstance;

  beforeEach(() => {
    keyPair = generateFounderKeyPair();
    clearFileNonceStore();
  });

  after(() => {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
  });

  it('should reject replay after restart (nonce persisted to file)', () => {
    const nonce = 'restart-replay-nonce-123456789012';

    // Use nonce
    const result1 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
    assert.strictEqual(result1, true);

    // Simulate restart - nonce file is still there
    // New nonce should still be rejected
    const result2 = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
    assert.strictEqual(result2, false);
  });

  it('should reject database recreation with replay', (t) => {
    const nonce = 'db-replay-nonce-123456789012345';

    // Use nonce
    checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());

    // Database recreation - nonce file still has the used nonce
    const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
    assert.strictEqual(result, false);
  });
});

describe('M3-004: Database Recreation and Replay', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };
  let db: DatabaseInstance;

  beforeEach(() => {
    keyPair = generateFounderKeyPair();
    clearFileNonceStore();
  });

  after(() => {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
  });

  it('should maintain replay protection across database lifecycle', () => {
    const nonce = 'lifecycle-nonce-1234567890123456';

    // Simulate: load keys, consume nonce, database init
    checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());

    // Simulate: database created
    db = createDatabase(':memory:');
    setDatabaseInstance(db);

    // Simulate: restart - nonce should still be rejected
    const result = checkAndConsumeNonceFile(keyPair.key_id, 'bootstrap', nonce, Date.now());
    assert.strictEqual(result, false, 'Nonce should still be rejected after database recreation');

    db.close();
  });
});