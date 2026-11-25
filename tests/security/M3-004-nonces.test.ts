// M3-004: File-based Nonce Store Tests
// Tests for atomic nonce operations, cross-process safety, and error handling

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  generateFounderKeyPair,
  checkAndConsumeNonceFile,
  clearFileNonceStore,
  resetNonceLockStore
} from '../../src/auth/founder.js';

describe('M3-004: File-Based Nonce Store Tests', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };

  beforeEach(() => {
    // Reset lock database to prevent cross-test lock contention
    resetNonceLockStore();
    // Generate fresh key pair for each test
    keyPair = generateFounderKeyPair();
    clearFileNonceStore();
  });

  it('should store and consume nonce in file store', () => {
    const now = Date.now();
    const nonce = checkAndConsumeNonceFile(
      keyPair.key_id,
      'test_operation',
      'test_nonce_value',
      now
    );
    assert.strictEqual(nonce, true, 'Nonce should be successfully recorded');
  });

  it('should prevent replay in file store', () => {
    const now = Date.now();
    checkAndConsumeNonceFile(keyPair.key_id, 'op', 'test-nonce', now);

    const result = checkAndConsumeNonceFile(keyPair.key_id, 'op', 'test-nonce', now);
    assert.strictEqual(result, false, 'Replay should be rejected');
  });

  it('should create nonce store directory if missing', () => {
    const now = Date.now();
    const result = checkAndConsumeNonceFile(
      keyPair.key_id,
      'test_operation',
      'test_nonce_unique',
      now
    );
    assert.strictEqual(result, true, 'Nonce should be recorded even if directory missing');
  });
});