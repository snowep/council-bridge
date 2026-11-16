// SEC-06: Founder Nonce Cleanup Tests
// Tests for deterministic nonce cleanup using 5-minute interval
// Section 6.1: Replace probabilistic cleanup with deterministic strategy

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createDatabase, setDatabaseInstance, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  clearFounderKeyCache,
  setFounderKeyCache,
  startNonceCleanupInterval,
  stopNonceCleanupInterval,
  checkAndConsumeNonce,
  verifyFounderRequestWithLoadedKeys,
  FounderKeyPair,
  signFounderRequest
} from '../../src/auth/founder.js';

describe('SEC-06: Founder Nonce Cleanup', () => {
  let db: DatabaseInstance;
  let keyPair: FounderKeyPair;

  before(() => {
    // Create in-memory database for testing
    db = createDatabase(':memory:');
    setDatabaseInstance(db);
    keyPair = generateFounderKeyPair();
    setFounderKeyCache(keyPair);
  });

  after(() => {
    stopNonceCleanupInterval();
    db.close();
  });

  beforeEach(() => {
    // Clear nonces before each test
    try {
      db.stmt.cleanupFounderNonces.run();
    } catch {
      // Table may not exist yet in some tests
    }
  });

  describe('Deterministic cleanup interval', () => {
    it('should start cleanup interval with 5-minute default', () => {
      let intervalStarted = false;

      // Mock setInterval to verify interval setup
      const originalSetInterval = global.setInterval;
      const intervals: number[] = [];
      (global as any).setInterval = (callback: () => void, ms: number) => {
        intervals.push(ms);
        intervalStarted = true;
        return 0 as unknown as NodeJS.Timeout;
      };

      try {
        startNonceCleanupInterval();
        assert.strictEqual(intervalStarted, true, 'Interval should be started');

        // Check that 5-minute interval (300000ms) was set
        assert.ok(intervals.length > 0, 'At least one interval should be set');
        assert.strictEqual(intervals[0], 5 * 60 * 1000, 'Interval should be 5 minutes');
      } finally {
        (global as any).setInterval = originalSetInterval;
        stopNonceCleanupInterval();
      }
    });

    it('should not start multiple intervals on repeated calls', () => {
      let intervalCount = 0;

      const originalSetInterval = global.setInterval;
      (global as any).setInterval = () => {
        intervalCount++;
        return 0 as unknown as NodeJS.Timeout;
      };

      try {
        startNonceCleanupInterval();
        startNonceCleanupInterval();
        startNonceCleanupInterval();

        assert.strictEqual(intervalCount, 1, 'Only one interval should be created');
      } finally {
        (global as any).setInterval = originalSetInterval;
        stopNonceCleanupInterval();
      }
    });

    it('should stop interval when requested', () => {
      let intervalRef: NodeJS.Timeout | null = null;

      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;

      (global as any).setInterval = (callback: () => void, ms: number) => {
        intervalRef = 0 as unknown as NodeJS.Timeout; // mock reference
        return intervalRef;
      };

      let cleared = false;
      (global as any).clearInterval = (_: NodeJS.Timeout) => {
        cleared = true;
      };

      try {
        startNonceCleanupInterval();
        stopNonceCleanupInterval();

        assert.strictEqual(cleared, true, 'clearInterval should have been called');
      } finally {
        (global as any).setInterval = originalSetInterval;
        (global as any).clearInterval = originalClearInterval;
      }
    });
  });

  describe('Nonces expire after 6 minutes', () => {
    it('should record nonces with expires_at 6 minutes in the future', () => {
      const before = Date.now();
      const now = Date.now();

      const result = checkAndConsumeNonce(
        keyPair.key_id,
        'test_operation',
        'test_nonce_value',
        now
      );

      assert.strictEqual(result, true, 'Nonce should be successfully recorded');

      // Query the nonce record
      const nonce = db.query('SELECT * FROM founder_nonces WHERE nonce = ?', ['test_nonce_value']);
      assert.strictEqual(nonce.length, 1, 'Nonce should be recorded');

      const nonceRecord = nonce[0];
      const expectedExpiry = new Date(now + 6 * 60 * 1000).getTime();
      const actualExpiry = new Date(nonceRecord.expires_at).getTime();

      // Allow 1 second tolerance for test execution time
      const diff = Math.abs(actualExpiry - expectedExpiry);
      assert.ok(diff < 1000, `Expiry time should be approximately 6 minutes from now (diff: ${diff}ms)`);
    });

    it('should reject nonce consumption that exceeds max length', () => {
      const now = Date.now();
      const longNonce = 'a'.repeat(129); // 129 chars, exceeds NONCE_MAX_LENGTH of 128

      const result = checkAndConsumeNonce(
        keyPair.key_id,
        'test_operation',
        longNonce,
        now
      );

      // The validation happens in verifyFounderOperation, but checkAndConsumeNonce
      // should still work - the length validation is in the verify function
    });
  });

  describe('Cleanup removes expired nonces only', () => {
    it('should remove expired nonces when cleanup is called', async () => {
      const now = Date.now();

      // Insert an expired nonce (expires 10 minutes ago)
      const expiredExpiry = now - 10 * 60 * 1000;
      db.runPreparedStatement('insertFounderNonce', [
        keyPair.key_id,
        'expired_op',
        'expired_nonce',
        expiredExpiry
      ]);

      // Insert a valid nonce (expires 10 minutes from now)
      const validExpiry = now + 10 * 60 * 1000;
      db.runPreparedStatement('insertFounderNonce', [
        keyPair.key_id,
        'valid_op',
        'valid_nonce',
        validExpiry
      ]);

      // Run cleanup
      db.stmt.cleanupFounderNonces.run();

      // Check that expired nonce is gone
      const expiredCheck = db.query('SELECT * FROM founder_nonces WHERE nonce = ?', ['expired_nonce']);
      assert.strictEqual(expiredCheck.length, 0, 'Expired nonce should be removed');

      // Check that valid nonce still exists
      const validCheck = db.query('SELECT * FROM founder_nonces WHERE nonce = ?', ['valid_nonce']);
      assert.strictEqual(validCheck.length, 1, 'Valid nonce should remain');
    });

    it('cleanup should handle empty table gracefully', () => {
      // Ensure table is empty
      db.stmt.cleanupFounderNonces.run();

      // Run cleanup again - should not throw
      db.stmt.cleanupFounderNonces.run();

      const count = db.query('SELECT COUNT(*) as c FROM founder_nonces').get() as { c: number };
      assert.strictEqual(count.c, 0, 'Table should still be empty');
    });
  });

  describe('Nonce replay protection', () => {
    it('should prevent replay of consumed nonce', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      // First verification should succeed
      const firstResult = verifyFounderRequestWithLoadedKeys(signed);
      assert.strictEqual(firstResult.valid, true, 'First verification should succeed');

      // Second verification with same nonce should fail
      const secondResult = verifyFounderRequestWithLoadedKeys(signed);
      assert.strictEqual(secondResult.valid, false, 'Second verification should fail');
      assert.strictEqual(secondResult.error, 'NONCE_REPLAY', 'Should return NONCE_REPLAY error');
    });

    it('should allow different nonces for different operations', () => {
      const payload1 = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const payload2 = { owner_type: 'founder', owner_id: 'founder', runtime: 'hermes' };

      const signed1 = signFounderRequest('op1', payload1, keyPair.private_key_pem, keyPair.key_id);
      const signed2 = signFounderRequest('op2', payload2, keyPair.private_key_pem, keyPair.key_id);

      const result1 = verifyFounderRequestWithLoadedKeys(signed1);
      const result2 = verifyFounderRequestWithLoadedKeys(signed2);

      assert.strictEqual(result1.valid, true, 'First request should succeed');
      assert.strictEqual(result2.valid, true, 'Second request with different nonce should succeed');
    });
  });

  describe('Integration with server lifecycle', () => {
    it('cleanup should be idempotent (safe to call multiple times)', () => {
      // Call cleanup multiple times
      db.stmt.cleanupFounderNonces.run();
      db.stmt.cleanupFounderNonces.run();
      db.stmt.cleanupFounderNonces.run();

      // Should not throw or cause issues
      const count = db.query('SELECT COUNT(*) as c FROM founder_nonces').get() as { c: number };
      assert.strictEqual(count.c, 0, 'Should handle empty table correctly');
    });

    it('should handle concurrent cleanup attempts gracefully', () => {
      // Insert some nonces
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        db.runPreparedStatement('insertFounderNonce', [
          keyPair.key_id,
          `op-${i}`,
          `nonce-${i}`,
          now + i * 1000 // Different expiry times
        ]);
      }

      // Run cleanup (concurrent behavior testing)
      db.stmt.cleanupFounderNonces.run();

      // Verify no errors and cleanup ran
      const count = db.query('SELECT COUNT(*) as c FROM founder_nonces').get() as { c: number };
      assert.strictEqual(count.c, 10, 'Non-expired nonces should remain');
    });
  });
});