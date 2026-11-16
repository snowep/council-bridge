// SEC-06: Founder Signature Ownership and Replay Protection Tests
// Tests for ownership verification and concurrent replay attack protection

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  loadFounderKeyPair,
  initializeFounderKeys,
  signFounderRequest,
  verifyFounderOperation,
  verifyFounderRequestWithLoadedKeys,
  canonicalizeForSigning,
  setDatabaseInstance,
  clearFounderKeyCache,
  setFounderKeyCache
} from '../../src/auth/founder.js';
import crypto from 'crypto';

let db: DatabaseInstance;

describe('SEC-06: Founder Signature Ownership and Replay Protection', () => {
  before(() => {
    db = createDatabase(':memory:');
    setDatabaseInstance(db);
  });

  beforeEach(() => {
    // Clear founder nonce cache between tests
    clearFounderKeyCache();
    // Clear nonces from database
    try {
      db.stmt.cleanupFounderNonces.run();
    } catch {
      // Table may not exist yet
    }
  });

  after(() => {
    db.close();
  });

  describe('Ownership verification', () => {
    let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };

    beforeEach(() => {
      // Ensure fresh keys for each test
      keyPair = generateFounderKeyPair();
      setFounderKeyCache(keyPair);
    });

    it('should verify ownership: founder signature with founder owner_type should succeed', () => {
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

      assert.strictEqual(result.valid, true, 'Founder signature with founder owner should be valid');
      assert.strictEqual(result.owner_type, 'founder', 'owner_type should be founder');
      assert.strictEqual(result.owner_id, 'founder', 'owner_id should be founder');
    });

    it('should allow: founder signature with staff owner_type (founder can authorize staff sessions)', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, true, 'Founder can authorize staff sessions');
      assert.strictEqual(result.owner_type, 'staff', 'owner_type should be staff from signature');
      assert.strictEqual(result.owner_id, 'staff-001', 'owner_id should be staff-001 from signature');
    });

    it('should verify: runtime field is captured correctly', () => {
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

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.runtime, 'claude', 'runtime should be claude');
    });

    it('should reject: runtime field with invalid value', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'invalid' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, false, 'Invalid runtime should be rejected');
    });

    it('should reject: owner_type with invalid value', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'invalid', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      const result = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(result.valid, false, 'Invalid owner_type should be rejected');
      assert.strictEqual(result.error, 'INVALID_OWNER_TYPE', 'Should return INVALID_OWNER_TYPE error');
    });
  });

  describe('Replay protection - concurrent requests with same nonce', () => {
    let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };

    before(() => {
      keyPair = generateFounderKeyPair();
    });

    it('should verify exactly one request succeeds and subsequent requests receive replay error when using same nonce', async () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      // First request should succeed
      const firstResult = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(firstResult.valid, true, 'First request with nonce should succeed');
      assert.strictEqual(firstResult.error, undefined, 'First request should have no error');

      // Second request with same nonce should fail with replay error
      const secondResult = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );

      assert.strictEqual(secondResult.valid, false, 'Second request with same nonce should fail');
      assert.strictEqual(secondResult.error, 'NONCE_REPLAY', 'Second request should return NONCE_REPLAY error');
    });

    it('should allow subsequent requests with different nonce after first consumption', () => {
      const operation = 'create_session';

      // First request - sign with first nonce
      const firstPayload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const firstSigned = signFounderRequest(operation, firstPayload, keyPair.private_key_pem, keyPair.key_id);

      // Second request - sign with a fresh nonce (different operation payload to get different nonce)
      const secondPayload = { owner_type: 'founder', owner_id: 'founder', runtime: 'hermes' };
      const secondSigned = signFounderRequest(operation, secondPayload, keyPair.private_key_pem, keyPair.key_id);

      // First request should succeed
      const firstResult = verifyFounderOperation(
        operation,
        firstPayload,
        firstSigned.signature,
        firstSigned.timestamp,
        firstSigned.nonce,
        firstSigned.key_id
      );

      assert.strictEqual(firstResult.valid, true, 'First request should succeed');

      // Second request with different nonce should succeed
      const secondResult = verifyFounderOperation(
        operation,
        secondPayload,
        secondSigned.signature,
        secondSigned.timestamp,
        secondSigned.nonce,
        secondSigned.key_id
      );

      assert.strictEqual(secondResult.valid, true, 'Second request with different nonce should succeed');
    });

    it('should verify nonce replay error code is returned correctly', () => {
      const operation = 'create_session';
      const payload = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
      const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

      // First request should succeed
      const firstResult = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );
      assert.strictEqual(firstResult.valid, true);

      // Second request with same nonce - should get NONCE_REPLAY
      const secondResult = verifyFounderOperation(
        operation,
        payload,
        signed.signature,
        signed.timestamp,
        signed.nonce,
        signed.key_id
      );
      assert.strictEqual(secondResult.valid, false);
      assert.strictEqual(secondResult.error, 'NONCE_REPLAY');
    });
  });
});