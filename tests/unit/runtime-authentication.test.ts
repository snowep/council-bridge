// Runtime Authentication Unit Tests
// LOOP 1: Independent Claude/Hermes credential-based authentication

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import {
  generateRuntimeCredential,
  hashCredential,
  validateRuntimeCredential,
  provisionRuntimeCredential,
  insertRuntimeCredential,
  revokeRuntimeCredential,
  hasActiveCredential
} from '../../src/auth/runtime-credentials.js';

describe('Runtime Credential Generation', () => {
  it('should generate valid 256-bit credential for claude', () => {
    const cred = generateRuntimeCredential('claude');

    assert.ok(cred.credentialId.startsWith('cred_claude_'));
    assert.ok(cred.secret.startsWith('council_claude_'));
    assert.strictEqual(typeof cred.createdAt, 'number');
    assert.strictEqual(typeof cred.expiresAt, 'number');
    assert.ok(cred.expiresAt > cred.createdAt);
  });

  it('should generate valid 256-bit credential for hermes', () => {
    const cred = generateRuntimeCredential('hermes');

    assert.ok(cred.credentialId.startsWith('cred_hermes_'));
    assert.ok(cred.secret.startsWith('council_hermes_'));
    assert.strictEqual(typeof cred.createdAt, 'number');
    assert.strictEqual(typeof cred.expiresAt, 'number');
    assert.ok(cred.expiresAt > cred.createdAt);
  });

  it('should generate different secrets each time', () => {
    const cred1 = generateRuntimeCredential('claude');
    const cred2 = generateRuntimeCredential('claude');

    assert.notStrictEqual(cred1.secret, cred2.secret);
  });
});

describe('Credential Hashing', () => {
  it('should produce consistent hash for same secret', () => {
    const secret = 'test-secret';
    const hash1 = hashCredential(secret);
    const hash2 = hashCredential(secret);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 43); // base64url of 32 bytes = 43 chars
  });

  it('should produce different hashes for different secrets', () => {
    const hash1 = hashCredential('secret1');
    const hash2 = hashCredential('secret2');

    assert.notStrictEqual(hash1, hash2);
  });
});

describe('Runtime Credential Table Setup', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createDatabase(':memory:');
    // Run migration 019 equivalent
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
      CREATE INDEX IF NOT EXISTS idx_runtime_credentials_runtime ON runtime_credentials(runtime_id, status) WHERE status = 'active';
    `);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
  });

  it('should validate a valid claude credential', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = `cred-claude-${Date.now()}`;

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
    assert.strictEqual(result.principal?.credentialId, credId);
  });

  it('should validate a valid hermes credential', () => {
    const cred = generateRuntimeCredential('hermes');
    const credId = `cred-hermes-${Date.now()}`;

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'hermes',
      tokenHash: hashCredential(cred.secret),
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.principal?.runtimeId, 'hermes');
  });

  it('should reject missing token', () => {
    const result = validateRuntimeCredential(db, '');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_MISSING');
  });

  it('should reject invalid token', () => {
    const result = validateRuntimeCredential(db, 'Bearer invalid-token');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_INVALID');
  });

  it('should reject expired credential', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-expired';

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
    const credId = 'cred-revoked';

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

  it('should reject oversized token', () => {
    const largeToken = 'Bearer ' + 'a'.repeat(5000);

    const result = validateRuntimeCredential(db, largeToken);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_TOO_LARGE');
  });

  it('should reject non-Bearer scheme', () => {
    const result = validateRuntimeCredential(db, 'Basic dXNlcjpwYXNz');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'UNSUPPORTED_AUTH_SCHEME');
  });

  it('should update last_used_at on successful validation', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-used';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt
    });

    // Initially null
    const before = db.query('SELECT last_used_at FROM runtime_credentials WHERE credential_id = ?', [credId])[0];
    assert.strictEqual((before as any).last_used_at, null);

    // Validate
    validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    // Should be set now
    const after = db.query('SELECT last_used_at FROM runtime_credentials WHERE credential_id = ?', [credId])[0];
    assert.ok((after as any).last_used_at !== null);
    assert.strictEqual(typeof (after as any).last_used_at, 'number');
  });

  it('claude credential identifies as claude, not hermes', () => {
    const cred = generateRuntimeCredential('claude');
    const credId = 'cred-claude-only';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, true);
    // Runtime is determined by the credential, NOT by caller choice
    assert.strictEqual(result.principal!.runtimeId, 'claude');
  });

  it('hermes credential identifies as hermes, not claude', () => {
    const cred = generateRuntimeCredential('hermes');
    const credId = 'cred-hermes-only';

    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'hermes',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    const result = validateRuntimeCredential(db, `Bearer ${cred.secret}`);

    assert.strictEqual(result.valid, true);
    // Runtime is determined by the credential, NOT by caller choice
    assert.strictEqual(result.principal!.runtimeId, 'hermes');
  });
});

describe('Credential Provisioning', () => {
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
    try {
      db.close();
    } catch {}
  });

  it('should provision claude credential successfully', () => {
    const result = provisionRuntimeCredential('claude');

    assert.ok(result.credentialId);
    assert.ok(result.secret);
    assert.ok(result.tokenHash);
    assert.strictEqual(result.createdAt, result.expiresAt - 365 * 24 * 60 * 60 * 1000); // ~1 year
  });

  it('should provision hermes credential successfully', () => {
    const result = provisionRuntimeCredential('hermes');

    assert.ok(result.credentialId);
    assert.ok(result.secret);
    assert.strictEqual(result.secret.includes('hermes'), true);
  });

  it('should not create duplicate active credentials with same token hash', () => {
    // First credential
    const result1 = provisionRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: result1.credentialId,
      runtimeId: 'claude',
      tokenHash: result1.tokenHash,
      createdAt: result1.createdAt,
      expiresAt: result1.expiresAt
    });

    // Try to insert with the SAME hash - should fail due to UNIQUE constraint
    const inserted = insertRuntimeCredential(db, {
      credentialId: 'different-credential-id',
      runtimeId: 'claude',
      tokenHash: result1.tokenHash,  // Same hash as result1
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    assert.strictEqual(inserted, false); // Should fail due to UNIQUE constraint on token_hash
  });
});

describe('Credential Revocation', () => {
  let db: DatabaseInstance;
  let credId: string;
  let credSecret: string;

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

    const cred = generateRuntimeCredential('claude');
    credId = 'test-cred';
    credSecret = cred.secret;
    insertRuntimeCredential(db, {
      credentialId: credId,
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
  });

  it('should revoke credential successfully', () => {
    const result = revokeRuntimeCredential(db, credId);
    assert.strictEqual(result, true);

    // Verify it's revoked
    const row = db.query('SELECT status, revoked_at FROM runtime_credentials WHERE credential_id = ?', [credId])[0];
    assert.strictEqual(row.status, 'revoked');
    assert.ok(row.revoked_at !== null);
  });

  it('should reject credential after revocation', () => {
    // Use the credential from beforeEach (stored in credsSecret)
    // Revoke it first
    revokeRuntimeCredential(db, credId);

    // Try to validate
    const result = validateRuntimeCredential(db, `Bearer ${credSecret}`);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
  });
});

describe('Has Active Credential', () => {
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
    try {
      db.close();
    } catch {}
  });

  it('should return true when active credential exists', () => {
    const cred = generateRuntimeCredential('claude');
    insertRuntimeCredential(db, {
      credentialId: 'test-cred',
      runtimeId: 'claude',
      tokenHash: hashCredential(cred.secret),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    assert.strictEqual(hasActiveCredential(db, 'claude'), true);
  });

  it('should return false when no credential exists', () => {
    assert.strictEqual(hasActiveCredential(db, 'claude'), false);
    assert.strictEqual(hasActiveCredential(db, 'hermes'), false);
  });
});