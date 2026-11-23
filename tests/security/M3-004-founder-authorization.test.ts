// M3-004: Database Seeding Security Tests
// Tests for Founder signature verification, nonce replay protection, and secure database operations

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { createDatabase, setDatabaseInstance, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  signFounderRequest,
  verifyFounderOperation,
  checkAndConsumeNonce,
  clearFounderKeyCache
} from '../../src/auth/founder.js';

describe('M3-004: Founder Authorization Tests', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };
  let db: DatabaseInstance;

  beforeEach(() => {
    // Generate fresh key pair for each test
    keyPair = generateFounderKeyPair();
    clearFounderKeyCache();
  });

  after(() => {
    try {
      if (db) db.close();
    } catch {
      // ignore
    }
  });

  describe('2.1: Valid external signature', () => {
    it('should accept valid external signature', () => {
      const operation = 'bootstrap_database';
      const payload = { database_path: ':memory:' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, true, 'Valid signature should be accepted');
      assert.strictEqual(result.owner_type, undefined, 'owner_type should match payload');
    });

    it('should reject tampered signature', () => {
      const operation = 'bootstrap_database';
      const payload = { database_path: ':memory:' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        { ...payload, database_path: '/other/path' }, // tampered payload
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, false, 'Tampered payload should be rejected');
    });

    it('should reject signature without nonce', () => {
      const operation = 'bootstrap_database';
      const payload = { database_path: ':memory:' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        '', // empty nonce
        signed.key_id
      );

      assert.strictEqual(result.valid, false, 'Empty nonce should be rejected');
    });

    it('should accept valid signature with founder owner_type', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, true, 'Founder signature should be valid');
      assert.strictEqual(result.owner_type, 'founder');
      assert.strictEqual(result.owner_id, 'founder');
      assert.strictEqual(result.runtime, 'claude');
    });
  });

  describe('2.2: Nonce replay protection', () => {
    it('should prevent replay of consumed nonce', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      // First request
      const first = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );
      assert.strictEqual(first.valid, true, 'First request should succeed');

      // Second request with same nonce
      const second = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );
      assert.strictEqual(second.valid, false, 'Replay should be rejected');
      assert.strictEqual(second.error, 'NONCE_REPLAY');
    });
  });

  describe('2.3: Production environment guards', () => {
    it('should verify signature without database dependency', () => {
      const dbTest = createDatabase(':memory:');
      setDatabaseInstance(dbTest);

      const operation = 'test_operation';
      const payload = { test: true };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, true, 'Signature verification works without database');

      dbTest.close();
    });
  });

  describe('2.4: File-based nonce store fallback', () => {
    it('should use in-memory store when :memory: database is available', () => {
      const dbTest = createDatabase(':memory:');
      setDatabaseInstance(dbTest);

      const result = checkAndConsumeNonce(
        keyPair.key_id,
        'test_operation',
        'unique-nonce-value',
        Date.now()
      );

      assert.strictEqual(result, true, 'Nonce should be recorded in memory store');

      dbTest.close();
    });

    it('should reject duplicate nonce via memory store', () => {
      const dbTest = createDatabase(':memory:');
      setDatabaseInstance(dbTest);

      const now = Date.now();
      const result1 = checkAndConsumeNonce(keyPair.key_id, 'op', 'dup-nonce', now);
      assert.strictEqual(result1, true, 'First nonce should be accepted');

      const result2 = checkAndConsumeNonce(keyPair.key_id, 'op', 'dup-nonce', now);
      assert.strictEqual(result2, false, 'Duplicate nonce should be rejected');

      dbTest.close();
    });
  });
});