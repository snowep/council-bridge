// Identity Credential Validation
// SEC-04: Identity credential validation for staff, division, and seat session provisioning
// Prevents unauthorized session minting for existing identities

import crypto from 'crypto';
import { DatabaseInstance } from '../database.js';
import { RuntimeId } from './runtime-credentials.js';

// Credential types for different identity types
export interface IdentityCredential {
  credential_id: string;
  identity_type: 'staff' | 'division' | 'seat';
  identity_id: string;  // staff_id, division_id, or seat_id
  token_hash: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: number;     // Unix milliseconds
  expires_at: number;     // Unix milliseconds
  last_used_at: number | null;
  revoked_at: number | null;
  runtime_id: RuntimeId;  // The runtime this credential permits
}

// Credential configuration
const CREDENTIAL_BYTES = 32;  // 256 bits
const TOKEN_MAX_SIZE = 2048;

/**
 * Generate a secure identity credential for staff, division, or seat
 * Returns the plaintext secret (displayed once at provisioning time)
 * Caller must hash and store the hash - never store plaintext
 */
export function generateIdentityCredential(
  identityType: 'staff' | 'division' | 'seat',
  identityId: string,
  runtimeId: RuntimeId = 'claude'  // Default to claude, can be hermes for some use cases
): {
  credentialId: string;
  secret: string;  // Plaintext - display only at generation time
  createdAt: number;
  expiresAt: number;
  runtimeId: RuntimeId;
} {
  const credentialId = `cred_${identityType}_${identityId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const secretBytes = crypto.randomBytes(CREDENTIAL_BYTES);
  const secret = `council_${runtimeId}_${identityId}_${secretBytes.toString('base64url')}`;

  const createdAt = Date.now();
  const expiresAt = createdAt + (365 * 24 * 60 * 60 * 1000); // 1 year default

  return { credentialId, secret, createdAt, expiresAt, runtimeId };
}

/**
 * Hash a credential secret for storage
 */
export function hashIdentityCredential(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('base64url');
}

/**
 * Result of validating an identity credential
 */
export interface IdentityCredentialValidationResult {
  valid: boolean;
  principal?: {
    type: 'staff' | 'division' | 'seat';
    identityId: string;
    credentialId: string;
    runtimeId: RuntimeId;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate an identity credential token
 * Returns the verified identity principal or rejection reason
 *
 * SECURITY: This is the ONLY way to authenticate as staff/division/seat
 * The caller CANNOT choose their identity - it's determined by the credential
 */
export function validateIdentityCredential(
  db: DatabaseInstance,
  token: string,
  identityType: 'staff' | 'division' | 'seat'
): IdentityCredentialValidationResult {
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
    token = token.substring(7);
    if (!token) {
      return { valid: false, error: { code: 'TOKEN_EMPTY', message: 'Token is empty' } };
    }
  } else if (token.startsWith('Basic ') || token.startsWith('Digest ')) {
    return { valid: false, error: { code: 'UNSUPPORTED_AUTH_SCHEME', message: 'Unsupported authentication scheme. Use Bearer token.' } };
  } else {
    return { valid: false, error: { code: 'INVALID_SCHEME', message: 'Token must use Bearer scheme' } };
  }

  // 4. Hash the token for lookup
  const tokenHash = hashIdentityCredential(token);

  // 5. Look up credential by hash and identity type
  const credential = db.query(
    `SELECT credential_id, identity_type, identity_id, status, expires_at, revoked_at, last_used_at, runtime_id
     FROM identity_credentials
     WHERE token_hash = ? AND identity_type = ?`,
    [tokenHash, identityType]
  )[0] as IdentityCredential | undefined;

  // 6. Check if credential exists
  if (!credential) {
    return { valid: false, error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' } };
  }

  // 7. Check credential status
  if (credential.status === 'revoked') {
    return { valid: false, error: { code: 'TOKEN_REVOKED', message: 'Credential has been revoked' } };
  }

  // 8. Check expiry
  const now = Date.now();
  if (credential.expires_at <= now) {
    return { valid: false, error: { code: 'TOKEN_EXPIRED', message: 'Credential has expired' } };
  }

  // 9. If revoked_at is set (even if status not yet updated), reject
  if (credential.revoked_at !== null && credential.revoked_at <= now) {
    return { valid: false, error: { code: 'TOKEN_REVOKED', message: 'Credential has been revoked' } };
  }

  // 10. Verify the identity still exists and is active
  if (identityType === 'staff') {
    const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [credential.identity_id])[0] as any;
    if (!staff || staff.status !== 'active') {
      return { valid: false, error: { code: 'IDENTITY_INACTIVE', message: 'Staff identity is not active' } };
    }
  } else if (identityType === 'division') {
    const division = db.query('SELECT * FROM divisions WHERE division_id = ?', [credential.identity_id])[0] as any;
    if (!division) {
      return { valid: false, error: { code: 'IDENTITY_NOT_FOUND', message: 'Division identity not found' } };
    }
    // Divisions don't have a status column - all divisions are considered active by default
    // The division must simply exist for the credential to be valid
  } else if (identityType === 'seat') {
    const seat = db.query('SELECT * FROM council_seats WHERE seat_id = ?', [credential.identity_id])[0] as any;
    if (!seat) {
      return { valid: false, error: { code: 'IDENTITY_NOT_FOUND', message: 'Seat identity not found' } };
    }
    // Seat credentials are only valid for vacant or replaceable seats (not permanent)
    // A seat with a credential represents access to that seat's authority
    // Permanent seats are reserved and should not have active credentials
    if (seat.status === 'permanent') {
      return { valid: false, error: { code: 'IDENTITY_INACTIVE', message: 'Seat identity is not active' } };
    }
  }

  // 11. Update last_used_at (non-blocking, in a separate query)
  try {
    db.db.prepare(`
      UPDATE identity_credentials
      SET last_used_at = ?
      WHERE credential_id = ?
    `).run(now, credential.credential_id);
  } catch {
    // Non-critical - continue with auth
  }

  // 12. Return verified principal
  // SECURITY: Runtime ID comes from the credential, NOT from the caller's request
  return {
    valid: true,
    principal: {
      type: identityType,
      identityId: credential.identity_id,
      credentialId: credential.credential_id,
      runtimeId: credential.runtime_id as RuntimeId
    }
  };
}

/**
 * Insert an identity credential into the database
 * Returns true if successful, false if credential already exists
 */
export function insertIdentityCredential(
  db: DatabaseInstance,
  credential: {
    credentialId: string;
    identityType: 'staff' | 'division' | 'seat';
    identityId: string;
    tokenHash: string;
    runtimeId: RuntimeId;
    createdAt: number;
    expiresAt: number;
  }
): boolean {
  try {
    db.db.prepare(`
      INSERT INTO identity_credentials
      (credential_id, identity_type, identity_id, token_hash, runtime_id, status, created_at, expires_at, last_used_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)
    `).run(
      credential.credentialId,
      credential.identityType,
      credential.identityId,
      credential.tokenHash,
      credential.runtimeId,
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
 * Rotate an identity credential - revoke old and create new atomically
 * Returns new credential details or null if failed
 *
 * SECURITY PROPERTIES:
 * - Verifies old credential exists and is active before rotation
 * - Checks identity type and ID match
 * - Checks runtime matches the credential's runtime
 * - All operations in single transaction
 * - Returns null on any failure - old credential remains unchanged
 * - No plaintext credentials logged before successful commit
 */
export function rotateIdentityCredential(
  db: DatabaseInstance,
  oldCredentialId: string,
  identityType: 'staff' | 'division' | 'seat',
  identityId: string,
  runtimeId: RuntimeId
): {
  credentialId: string;
  secret: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  runtimeId: RuntimeId;
} | null {
  const now = Date.now();
  const maxRetries = 10;

  // Verify old credential exists and check its properties
  const oldCred = db.query(
    `SELECT credential_id, status, revoked_at, expires_at, identity_type, identity_id, runtime_id
     FROM identity_credentials
     WHERE credential_id = ?`,
    [oldCredentialId]
  )[0] as IdentityCredential | undefined;

  if (!oldCred) {
    return null; // Unknown credential
  }

  if (oldCred.status === 'revoked') {
    return null; // Already revoked
  }

  if (oldCred.expires_at <= now) {
    return null; // Expired
  }

  if (oldCred.revoked_at !== null && oldCred.revoked_at <= now) {
    return null; // Marked for revocation
  }

  // Verify identity type matches
  if (oldCred.identity_type !== identityType) {
    return null; // Wrong identity type
  }

  // Verify identity ID matches
  if (oldCred.identity_id !== identityId) {
    return null; // Wrong identity ID
  }

  // Verify the credential's runtime matches
  if (oldCred.runtime_id !== runtimeId) {
    return null; // Wrong runtime
  }

  // Attempt rotation with bounded retry loop
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      db.db.exec('BEGIN IMMEDIATE');

      // Generate new credential (inside transaction to ensure uniqueness)
      const newCred = generateIdentityCredential(identityType, identityId, runtimeId);
      const tokenHash = hashIdentityCredential(newCred.secret);

      // Insert new credential
      const insertResult = db.db.prepare(`
        INSERT INTO identity_credentials
        (credential_id, identity_type, identity_id, token_hash, runtime_id, status, created_at, expires_at, last_used_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)
      `).run(
        newCred.credentialId,
        identityType,
        identityId,
        tokenHash,
        runtimeId,
        newCred.createdAt,
        newCred.expiresAt
      );

      if ((insertResult as any).changes !== 1) {
        // Unique constraint violation - retry with new ID
        db.db.exec('ROLLBACK');
        continue;
      }

      // Revoke old credential (only if still active)
      const revokeResult = db.db.prepare(`
        UPDATE identity_credentials
        SET revoked_at = ?, status = 'revoked'
        WHERE credential_id = ? AND status = 'active'
      `).run(now, oldCredentialId);

      if ((revokeResult as any).changes !== 1) {
        // Old credential was modified or already revoked by another process
        // Rollback and try again (the old credential might still be valid)
        db.db.exec('ROLLBACK');
        continue;
      }

      // Success - commit transaction
      db.db.exec('COMMIT');

      // Only return the new credential after successful commit
      return {
        credentialId: newCred.credentialId,
        secret: newCred.secret,
        tokenHash,
        createdAt: newCred.createdAt,
        expiresAt: newCred.expiresAt,
        runtimeId: newCred.runtimeId
      };

    } catch (error) {
      try {
        db.db.exec('ROLLBACK');
      } catch {
        // Ignore rollback errors
      }

      // Check for unique constraint violation and retry
      if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
        continue;
      }

      // Other error - stop retrying
      return null;
    }
  }

  // Failed after max retries
  return null;
}

/**
 * Revoke an identity credential immediately
 * Sets status to 'revoked' and records revoked_at timestamp
 * Used for security incident response and credential lifecycle management
 */
export function revokeIdentityCredential(
  db: DatabaseInstance,
  credentialId: string
): boolean {
  const now = Date.now();

  const result = db.db.prepare(`
    UPDATE identity_credentials
    SET revoked_at = ?, status = 'revoked'
    WHERE credential_id = ? AND status = 'active'
  `).run(now, credentialId);

  return (result as any).changes === 1;
}