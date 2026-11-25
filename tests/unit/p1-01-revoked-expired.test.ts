// P1-01: Test that revoked and expired credentials are rejected
// Regression test for Phase 1 security requirements

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import {
  generateRuntimeCredential,
  hashCredential,
  validateRuntimeCredential,
  insertRuntimeCredential,
  revokeRuntimeCredential
} from '../../src/auth/runtime-credentials.js';

describe('P1-01: Revoked and Expired Credentials', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_credentials (
        credential_id TEXT NOT NULL PRIMARY KEY,
        runtime_id TEXT NOT NULL CHECK (runtime_id IN ('claude', 'hermes')),
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_used_at INTEGER,
        revoked_at INTEGER
      );
    `);
  });

  afterEach(() => {
    try { db.close(); } catch {}
  });

  it('should reject expired credential', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-expired-test';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now() - 100000,
      expiresAt: Date.now() - 1  // Already expired
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_EXPIRED');
  });

  it('should reject revoked credential', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-revoked-test';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now() - 10000,
      expiresAt: Date.now() + 86400000
    });

    // Revoke the credential
    revokeRuntimeCredential(db, credId);

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
  });

  it('should reject credential with revoked_at timestamp in the past', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-revoked-time-test';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now() - 10000,
      expiresAt: Date.now() + 86400000
    });

    // Manually set revoked_at in the past but keep status as 'active'
    db.db.prepare(`
      UPDATE runtime_credentials
      SET revoked_at = ?, status = 'active'
      WHERE credential_id = ?
    `).run(Date.now() - 5000, credId);

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
  });

  it('should validate valid credential before expiry', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-valid-test';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.principal?.type, 'runtime');
    assert.strictEqual(result.principal?.runtimeId, 'claude');
  });

  it('should reject hermes credential after revocation', () => {
    const cred = generateRuntimeCredential('hermes');
    const credId = 'cred-hermes-revoked-test';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'hermes',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    revokeRuntimeCredential(db, credId);

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
    // Ensure runtime ID is still hermes in the error response context
    assert.strictEqual(result.principal?.runtimeId, undefined, 'Revoked credential should not expose principal');
  });

  it('should reject expired hermes credential', () => {
    const cred = generateRuntimeCredential('hermes');

    insertRuntimeCredential(db, {
      credentialId: 'cred-hermes-expired',
      runtimeId: 'hermes',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now() - 100000,
      expiresAt: Date.now() - 1000  // Expired 1 second ago
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_EXPIRED');
  });

  it('should validate claude credential that expires in the future', () => {
    const cred = generateRuntimeCredential('claude');

    insertRuntimeCredential(db, {
      credentialId: 'cred-claude-future',
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24  // 24 hours from now
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.principal?.runtimeId, 'claude');
  });

  it('should reject credential when expires_at equals current time (edge case)', () => {
    const cred = generateRuntimeCredential('claude');
    const exactNow = Date.now();

    insertRuntimeCredential(db, {
      credentialId: 'cred-expiring-now',
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: exactNow - 100000,
      expiresAt: exactNow  // expires_at == now (expired)
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, false, 'Credential expiring exactly now should be rejected');
    assert.strictEqual(result.error?.code, 'TOKEN_EXPIRED');
  });
});