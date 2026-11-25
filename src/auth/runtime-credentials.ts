// Runtime Credential Generation and Validation
// LOOP 1: Independent Claude/Hermes authentication via credentials

import crypto from 'crypto';
import { DatabaseInstance } from '../database.js';

// Runtime Authentication Types (copied from types.ts for runtime availability)
export type RuntimeId = 'claude' | 'hermes';

export interface RuntimeCredentialRecord {
  credential_id: string;
  runtime_id: RuntimeId;
  token_hash: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: number;           // Unix milliseconds
  expires_at: number;           // Unix milliseconds
  last_used_at: number | null;  // Unix milliseconds
  revoked_at: number | null;    // Unix milliseconds
}

// Credential configuration
const CREDENTIAL_BYTES = 32;  // 256 bits
const TOKEN_MAX_SIZE = 2048;  // Reject oversized tokens

/**
 * Generate a secure runtime credential
 * Returns the plaintext secret (displayed once at provisioning time)
 * Caller must hash and store the hash - never store plaintext
 */
export function generateRuntimeCredential(runtimeId: RuntimeId): {
  credentialId: string;
  secret: string;  // Plaintext - display only at generation time
  createdAt: number;
  expiresAt: number;
} {
  // Generate credential ID (for logging/tracking)
  const credentialId = `cred_${runtimeId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Generate 256-bit secret (32 bytes = 256 bits)
  const secretBytes = crypto.randomBytes(CREDENTIAL_BYTES);
  const secret = `council_${runtimeId}_${secretBytes.toString('base64url')}`;

  const createdAt = Date.now();
  const expiresAt = createdAt + (365 * 24 * 60 * 60 * 1000); // 1 year default

  return { credentialId, secret, createdAt, expiresAt };
}

/**
 * Hash a credential secret for storage
 * Uses SHA-256 for efficient lookup with uniqueness constraint
 */
export function hashCredential(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('base64url');
}

/**
 * Credential validation result
 */
export interface CredentialValidationResult {
  valid: boolean;
  principal?: {
    type: 'runtime';
    runtimeId: RuntimeId;
    credentialId: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate a credential token against the database
 * Returns the verified runtime principal or rejection reason
 *
 * SECURITY: This is the ONLY way to authenticate as Claude or Hermes
 * The caller CANNOT choose their runtime identity - it's determined by the credential
 */
export function validateRuntimeCredential(
  db: DatabaseInstance,
  token: string
): CredentialValidationResult {
  // 1. Reject empty or malformed tokens
  if (!token || typeof token !== 'string') {
    return { valid: false, error: { code: 'TOKEN_MISSING', message: 'Authentication token is required' } };
  }

  // 2. Reject oversized tokens (DoS prevention)
  if (token.length > TOKEN_MAX_SIZE) {
    return { valid: false, error: { code: 'TOKEN_TOO_LARGE', message: 'Token exceeds maximum size' } };
  }

  // 3. Check authentication scheme
  if (token.startsWith('Bearer ')) {
    // 4. Extract the actual token
    token = token.substring(7);
    if (!token) {
      return { valid: false, error: { code: 'TOKEN_EMPTY', message: 'Token is empty' } };
    }
  } else if (token.startsWith('Basic ') || token.startsWith('Digest ')) {
    return { valid: false, error: { code: 'UNSUPPORTED_AUTH_SCHEME', message: 'Unsupported authentication scheme. Use Bearer token.' } };
  } else {
    return { valid: false, error: { code: 'INVALID_SCHEME', message: 'Token must use Bearer scheme' } };
  }

  // 5. Hash the token for lookup
  const tokenHash = hashCredential(token);

  // 6. Look up credential by hash (constant-time would be ideal but SQLite doesn't support it directly)
  const credential = db.query(
    'SELECT credential_id, runtime_id, status, expires_at, revoked_at, last_used_at FROM runtime_credentials WHERE token_hash = ?',
    [tokenHash]
  )[0] as RuntimeCredentialRecord | undefined;

  // 7. Check if credential exists
  if (!credential) {
    return { valid: false, error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' } };
  }

  // 8. Check credential status
  if (credential.status === 'revoked') {
    return { valid: false, error: { code: 'TOKEN_REVOKED', message: 'Credential has been revoked' } };
  }

  // 9. Check expiry
  const now = Date.now();
  if (credential.expires_at <= now) {
    return { valid: false, error: { code: 'TOKEN_EXPIRED', message: 'Credential has expired' } };
  }

  // 10. If revoked_at is set (even if status not yet updated), reject
  if (credential.revoked_at !== null && credential.revoked_at <= now) {
    return { valid: false, error: { code: 'TOKEN_REVOKED', message: 'Credential has been revoked' } };
  }

  // 11. Update last_used_at (non-blocking, in a separate query)
  try {
    db.db.prepare(`
      UPDATE runtime_credentials
      SET last_used_at = ?
      WHERE credential_id = ?
    `).run(now, credential.credential_id);
  } catch {
    // Non-critical - continue with auth
  }

  // 12. Return verified principal
  // SECURITY: Runtime ID comes from the credential, NOT from the caller
  return {
    valid: true,
    principal: {
      type: 'runtime',
      runtimeId: credential.runtime_id as RuntimeId,
      credentialId: credential.credential_id
    }
  };
}

/**
 * Provision a new runtime credential
 * Requires Founder authorization
 * Returns the plaintext secret (displayed once at provisioning time)
 * Caller must persist the credential record to the database
 */
export function provisionRuntimeCredential(
  runtimeId: RuntimeId,
  options?: {
    expiresAt?: number;
    credentialId?: string;
  }
): {
  credentialId: string;
  secret: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
} {
  const generated = generateRuntimeCredential(runtimeId);
  const credentialId = options?.credentialId || generated.credentialId;
  const createdAt = generated.createdAt;
  const expiresAt = options?.expiresAt || generated.expiresAt;
  const tokenHash = hashCredential(generated.secret);

  return {
    credentialId,
    secret: generated.secret,
    tokenHash,
    createdAt,
    expiresAt
  };
}

/**
 * Insert a runtime credential into the database
 * Returns true if successful, false if credential already exists
 */
export function insertRuntimeCredential(
  db: DatabaseInstance,
  credential: {
    credentialId: string;
    runtimeId: RuntimeId;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
  }
): boolean {
  try {
    db.db.prepare(`
      INSERT INTO runtime_credentials (credential_id, runtime_id, token_hash, status, created_at, expires_at, last_used_at, revoked_at)
      VALUES (?, ?, ?, 'active', ?, ?, NULL, NULL)
    `).run(
      credential.credentialId,
      credential.runtimeId,
      credential.tokenHash,
      credential.createdAt,
      credential.expiresAt
    );
    return true;
  } catch (error) {
    // UNIQUE constraint violation - credential already exists
    if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
      return false;
    }
    throw error;
  }
}

/**
 * Revoke a credential by ID
 * Sets revoked_at to now and status to 'revoked'
 */
export function revokeRuntimeCredential(
  db: DatabaseInstance,
  credentialId: string
): boolean {
  const now = Date.now();
  try {
    db.db.exec('BEGIN IMMEDIATE');
    const result = db.db.prepare(`
      UPDATE runtime_credentials
      SET revoked_at = ?, status = 'revoked'
      WHERE credential_id = ?
    `).run(now, credentialId);
    db.db.exec('COMMIT');
    return (result as any).changes > 0;
  } catch {
    db.db.exec('ROLLBACK');
    return false;
  }
}

/**
 * Rotate a credential - revoke old and create new
 * Returns new credential details or null if failed
 */
export function rotateRuntimeCredential(
  db: DatabaseInstance,
  oldCredentialId: string,
  runtimeId: RuntimeId
): {
  credentialId: string;
  secret: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
} | null {
  // Revoke old credential
  revokeRuntimeCredential(db, oldCredentialId);

  // Generate new
  const newCred = provisionRuntimeCredential(runtimeId);

  // Insert new
  if (insertRuntimeCredential(db, {
    credentialId: newCred.credentialId,
    runtimeId: runtimeId,  // Use the parameter, not from newCred (which doesn't include it)
    tokenHash: newCred.tokenHash,
    createdAt: newCred.createdAt,
    expiresAt: newCred.expiresAt
  })) {
    return newCred;
  }

  // If insert failed (duplicate), try again with a new ID
  return rotateRuntimeCredential(db, oldCredentialId, runtimeId);
}

/**
 * Check if a runtime has an active credential
 */
export function hasActiveCredential(
  db: DatabaseInstance,
  runtimeId: RuntimeId
): boolean {
  const now = Date.now();
  const row = db.query(
    `SELECT COUNT(*) as count FROM runtime_credentials
     WHERE runtime_id = ? AND status = 'active' AND expires_at > ? AND revoked_at IS NULL`,
    [runtimeId, now]
  )[0];

  return (row as { count: number }).count > 0;
}

/**
 * Validate a credential by ID (not token)
 * Checks if the credential exists, is active, not expired, and not revoked
 * Used for credential binding validation during runtime switch
 */
export function validateRuntimeCredentialById(
  db: DatabaseInstance,
  credentialId: string
): boolean {
  if (!credentialId) return false;

  const now = Date.now();
  const credential = db.query(
    `SELECT credential_id, status, expires_at, revoked_at FROM runtime_credentials WHERE credential_id = ?`,
    [credentialId]
  )[0] as RuntimeCredentialRecord | undefined;

  if (!credential) return false;
  if (credential.status === 'revoked') return false;
  if (credential.expires_at <= now) return false;
  if (credential.revoked_at !== null && credential.revoked_at <= now) return false;

  return true;
}