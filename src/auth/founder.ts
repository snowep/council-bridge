// Founder Authentication - Production Hardened
// Phase 8: RSA-2048 signatures with operation binding and replay protection

import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, chmodSync } from 'fs';
import { join } from 'path';
import { DatabaseInstance } from '../database.js';

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export interface FounderKeyPair {
  public_key: string;
  private_key_pem: string;
  created_at: string;
  key_id: string; // For key rotation
}

export interface FounderSignedRequest {
  operation: string;
  payload: any;
  timestamp: number;
  nonce: string;
  signature: string;
  key_id: string;
}

export interface FounderVerificationResult {
  valid: boolean;
  error?: string;
  owner_type?: 'founder' | 'staff';
  owner_id?: string;
  runtime?: 'claude' | 'hermes';
}

export const KEYS_DIR = join(process.cwd(), '.secrets');
export const KEY_FILE = join(KEYS_DIR, 'founder-keys.json');
const KEY_ID_LENGTH = 16;
const NONCE_LENGTH = 32;
const REQUEST_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_MAX_LENGTH = 128; // Prevent excessive nonce length
const NONCE_EXPIRY_MS = REQUEST_TIMESTAMP_TOLERANCE_MS + 60 * 1000; // 6 minutes (1 min buffer)

let cachedKeyPair: FounderKeyPair | null = null;
let cachedKeyPairMtime: number = 0;

// Clear cache - for testing only
export function clearFounderKeyCache(): void {
  cachedKeyPair = null;
  cachedKeyPairMtime = 0;
}

// Set cache directly - for testing only
export function setFounderKeyCache(keyPair: FounderKeyPair): void {
  cachedKeyPair = keyPair;
  cachedKeyPairMtime = getKeyFileMtime();
}

let dbInstance: DatabaseInstance | null = null;

export function setDatabaseInstance(db: DatabaseInstance): void {
  dbInstance = db;
}

function getKeyFileMtime(): number {
  try {
    return statSync(KEY_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

function getDb(): DatabaseInstance {
  if (!dbInstance) {
    throw new Error('Database instance not initialized for founder nonce store');
  }
  return dbInstance;
}

function checkAndConsumeNonce(keyId: string, operation: string, nonce: string, now: number): boolean {
  const db = getDb();
  const expiresAt = now + NONCE_EXPIRY_MS;

  // Try to insert the nonce - will fail if unique constraint violated (already consumed)
  try {
    db.stmt.insertFounderNonce.run(keyId, operation, nonce, expiresAt);
    return true; // Successfully inserted (not previously consumed)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return false; // Nonce already consumed
    }
    throw error; // Re-throw other database errors
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startNonceCleanupInterval(): void {
  // Deterministic cleanup every 5 minutes
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    try {
      const db = getDb();
      db.stmt.cleanupFounderNonces.run();
    } catch (error) {
      // Log but don't fail - cleanup is best effort
      console.error('[Founder Nonce] Cleanup failed:', error);
    }
  }, 5 * 60 * 1000);
}

export function stopNonceCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Cleanup expired nonces - called deterministically via scheduled interval
 * This function is no longer called on every verification (was probabilistic)
 */
export function cleanupExpiredNonces(): void {
  // No-op - cleanup is now handled by startNonceCleanupInterval()
  // This function is kept for backward compatibility
  // The scheduled interval at 5-minute intervals is the deterministic cleanup strategy
}

export function generateFounderKeyPair(): FounderKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const key_id = crypto.randomBytes(KEY_ID_LENGTH).toString('hex');
  const keyPair: FounderKeyPair = {
    public_key: publicKey,
    private_key_pem: privateKey,
    created_at: new Date().toISOString(),
    key_id
  };

  // Ensure keys directory exists with restrictive permissions (0o700)
  try {
    mkdirSync(KEYS_DIR, { recursive: true, mode: DIR_MODE });
    // Verify directory permissions on supported platforms
    if (process.platform !== 'win32') {
      try {
        const dirStat = statSync(KEYS_DIR);
        const dirMode = dirStat.mode & 0o777;
        if (dirMode !== DIR_MODE) {
          chmodSync(KEYS_DIR, DIR_MODE);
        }
      } catch {
        // Permission check failed, continue anyway
      }
    }
    // Write key file with restrictive permissions (0o600)
    writeFileSync(KEY_FILE, JSON.stringify(keyPair, null, 2), { flag: 'w', mode: FILE_MODE });
    // Verify file permissions on supported platforms
    if (process.platform !== 'win32') {
      try {
        const fileStat = statSync(KEY_FILE);
        const fileMode = fileStat.mode & 0o777;
        if (fileMode !== FILE_MODE) {
          chmodSync(KEY_FILE, FILE_MODE);
        }
      } catch {
        // Permission check failed, continue anyway
      }
    }
  } catch (error) {
    // Directory/key file may already exist
  }

  cachedKeyPair = keyPair;
  cachedKeyPairMtime = getKeyFileMtime();
  return keyPair;
}

export function loadFounderKeyPair(): FounderKeyPair | null {
  const mtime = getKeyFileMtime();
  if (cachedKeyPair && cachedKeyPairMtime === mtime) {
    return cachedKeyPair;
  }

  try {
    if (!existsSync(KEY_FILE)) return null;
    const data = readFileSync(KEY_FILE, 'utf-8');
    const keyPair = JSON.parse(data) as FounderKeyPair;

    // Validate key structure
    if (!keyPair.public_key || !keyPair.private_key_pem || !keyPair.key_id) {
      // Clear cache on invalid structure
      cachedKeyPair = null;
      cachedKeyPairMtime = 0;
      return null;
    }

    cachedKeyPair = keyPair;
    cachedKeyPairMtime = mtime;
    return keyPair;
  } catch (error) {
    // Clear cache on parse error
    cachedKeyPair = null;
    cachedKeyPairMtime = 0;
    return null;
  }
}

// Always read from disk (bypasses cache) - used for security-critical validation
export function loadFounderKeyPairFresh(): FounderKeyPair | null {
  try {
    if (!existsSync(KEY_FILE)) return null;
    const data = readFileSync(KEY_FILE, 'utf-8');
    const keyPair = JSON.parse(data) as FounderKeyPair;

    // Validate key structure
    if (!keyPair.public_key || !keyPair.private_key_pem || !keyPair.key_id) {
      return null;
    }

    return keyPair;
  } catch (error) {
    return null;
  }
}

export function initializeFounderKeys(): FounderKeyPair {
  const existing = loadFounderKeyPair();
  if (existing) return existing;
  return generateFounderKeyPair();
}

export function rotateFounderKeys(): FounderKeyPair {
  const oldKeys = loadFounderKeyPair();
  if (oldKeys) {
    // Archive old keys
    const archiveDir = join(KEYS_DIR, 'archive');
    try {
      mkdirSync(archiveDir, { recursive: true, mode: DIR_MODE });
      // Verify archive directory permissions on supported platforms
      if (process.platform !== 'win32') {
        try {
          const dirStat = statSync(archiveDir);
          const dirMode = dirStat.mode & 0o777;
          if (dirMode !== DIR_MODE) {
            chmodSync(archiveDir, DIR_MODE);
          }
        } catch {
          // Permission check failed, continue anyway
        }
      }
      const archiveFile = join(archiveDir, `founder-keys-${oldKeys.key_id}.json`);
      writeFileSync(archiveFile, JSON.stringify(oldKeys, null, 2), { flag: 'w', mode: FILE_MODE });
      // Verify archived file permissions on supported platforms
      if (process.platform !== 'win32') {
        try {
          const fileStat = statSync(archiveFile);
          const fileMode = fileStat.mode & 0o777;
          if (fileMode !== FILE_MODE) {
            chmodSync(archiveFile, FILE_MODE);
          }
        } catch {
          // Permission check failed, continue anyway
        }
      }
    } catch (error) {
      // Archive failed but rotation continues
    }
  }
  return generateFounderKeyPair();
}

// Canonicalize payload for signing - operation-bound, timestamped, nonce-protected
export function canonicalizeForSigning(operation: string, payload: any, timestamp: number, nonce: string, key_id: string): string {
  // Deterministic JSON with sorted keys, operation-bound
  // Use a custom replacer to ensure nested objects are also sorted
  const canonical = {
    op: operation,
    payload: payload,
    ts: timestamp,
    nonce: nonce,
    kid: key_id
  };

  function sortKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);

    const sorted: any = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }

  return JSON.stringify(sortKeys(canonical));
}

export function signFounderRequest(operation: string, payload: any, privateKeyPem: string, keyId: string): FounderSignedRequest {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(NONCE_LENGTH).toString('base64url');

  const data = canonicalizeForSigning(operation, payload, timestamp, nonce, keyId);

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKeyPem, 'base64');

  return {
    operation,
    payload,
    timestamp,
    nonce,
    signature,
    key_id: keyId
  };
}

export function verifyFounderRequest(
  operation: string,
  payload: any,
  timestamp: number,
  nonce: string,
  signature: string,
  publicKeyPem: string,
  keyId: string
): boolean {
  try {
    // Check timestamp freshness (replay protection)
    const now = Date.now();
    if (Math.abs(now - timestamp) > REQUEST_TIMESTAMP_TOLERANCE_MS) {
      return false; // Expired or future timestamp
    }

    // Validate nonce format
    if (!nonce || typeof nonce !== 'string') {
      return false; // Empty or missing nonce
    }
    if (nonce.length > NONCE_MAX_LENGTH) {
      return false; // Excessively long nonce
    }
    if (!/^[A-Za-z0-9_-]+$/.test(nonce)) {
      return false; // Malformed nonce (non-base64url chars)
    }

    // Canonicalize the same way
    const data = canonicalizeForSigning(operation, payload, timestamp, nonce, keyId);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch (error) {
    return false;
  }
}

export function verifyFounderRequestWithLoadedKeys(
  signedRequest: FounderSignedRequest
): boolean {
  const keys = loadFounderKeyPair();
  if (!keys) return false;

  // Key ID must match
  if (signedRequest.key_id !== keys.key_id) {
    return false; // Key rotation occurred or wrong key
  }

  return verifyFounderRequest(
    signedRequest.operation,
    signedRequest.payload,
    signedRequest.timestamp,
    signedRequest.nonce,
    signedRequest.signature,
    keys.public_key,
    keys.key_id
  );
}

// Verify and consume nonce atomically using SQLite
// Returns: { valid: boolean, error?: string; owner_type?; owner_id?; runtime? }
// - valid: true if signature valid and nonce not previously consumed
// - error: reason if invalid (for audit logging)
// - owner_type/owner_id/runtime: extracted from body for ownership verification
export function verifyFounderOperation(
  operation: string,
  body: any,
  signature: string,
  timestamp: number,
  nonce: string,
  keyId: string
): { valid: boolean; error?: string; owner_type?: 'founder' | 'staff'; owner_id?: string; runtime?: 'claude' | 'hermes' } {
  const keys = loadFounderKeyPair();
  if (!keys) return { valid: false, error: 'NO_KEYS' };
  if (keyId !== keys.key_id) return { valid: false, error: 'KEY_MISMATCH' };

  // Validate timestamp freshness (replay protection)
  // NOTE: Expired nonce cleanup is handled deterministically by startNonceCleanupInterval()
  // which runs every 5 minutes, not on every verification
  const now = Date.now();
  if (Math.abs(now - timestamp) > REQUEST_TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: 'TIMESTAMP_EXPIRED' };
  }

  // Validate nonce format
  if (!nonce || typeof nonce !== 'string') {
    return { valid: false, error: 'NONCE_MISSING' };
  }
  if (nonce.length > NONCE_MAX_LENGTH) {
    return { valid: false, error: 'NONCE_TOO_LONG' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) {
    return { valid: false, error: 'NONCE_MALFORMED' };
  }

  // Extract ownership fields from body for verification
  const owner_type = body.owner_type;
  const owner_id = body.owner_id;
  const runtime = body.runtime;

  // Validate ownership fields if present (SEC-06: ownership verification)
  if (owner_type !== undefined) {
    if (!['founder', 'staff'].includes(owner_type)) {
      return { valid: false, error: 'INVALID_OWNER_TYPE' };
    }
  }
  if (owner_type === 'founder' && owner_id !== 'founder') {
    return { valid: false, error: 'FOUNDER_OWNER_MISMATCH' };
  }
  if (runtime !== undefined && !['claude', 'hermes'].includes(runtime)) {
    return { valid: false, error: 'INVALID_RUNTIME' };
  }

  // Canonicalize and verify signature FIRST - before consuming nonce
  try {
    const data = canonicalizeForSigning(operation, body, timestamp, nonce, keyId);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    verifier.end();
    const valid = verifier.verify(keys.public_key, signature, 'base64');

    if (!valid) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }
  } catch (error) {
    return { valid: false, error: 'VERIFICATION_ERROR' };
  }

  // Signature valid - NOW atomically consume nonce via SQLite unique constraint
  const nonceConsumed = checkAndConsumeNonce(keyId, operation, nonce, now);
  if (!nonceConsumed) {
    return { valid: false, error: 'NONCE_REPLAY' };
  }

  return { valid: true, owner_type, owner_id, runtime };
}

export function requireFounderSignature(
  ctx: { owner_type: string; owner_id: string }
): void {
  if (ctx.owner_type !== 'founder') {
    throw new Error('Founder signature required for this operation');
  }
}

// Get public key for external verification (e.g., client SDKs)
export function getFounderPublicKey(): string | null {
  const keys = loadFounderKeyPair();
  return keys?.public_key ?? null;
}

export function getFounderKeyId(): string | null {
  const keys = loadFounderKeyPair();
  return keys?.key_id ?? null;
}

// Check if key rotation is needed (keys older than specified days)
export function isKeyRotationNeeded(maxAgeDays: number = 90): boolean {
  const keys = loadFounderKeyPair();
  if (!keys) return true;

  const created = new Date(keys.created_at).getTime();
  const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return ageDays > maxAgeDays;
}