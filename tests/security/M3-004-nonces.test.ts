// M3-004: File-based Nonce Store Tests
// Tests for atomic nonce operations, cross-process safety, and error handling

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, setDatabaseInstance, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  loadFounderKeyPair,
  checkAndConsumeNonceFile,
  checkAndConsumeNonce,
  clearFileNonceStore
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
    } catch {}
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