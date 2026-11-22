// Founder Authentication - Production Hardened
// Phase 8: RSA-2048 signatures with operation binding and replay protection

import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, chmodSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { DatabaseInstance } from '../database.js';

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

// File-based nonce store for pre-database nonce validation
// Used during bootstrap before SQLite database is initialized
// Environment variable override: FOUNDER_NONCE_STORE_PATH points to the nonce store file
// Environment variable override: FOUNDER_NONCE_LOCK_DB points to the lock database file
const LOCK_STALE_MS = 30 * 1000; // 30 seconds - lock considered stale after this
let lockDb: Database.Database | null = null;

// Lazy path resolution - allows env vars to be set before module import
function getNonceStoreFile(): string {
  return process.env.FOUNDER_NONCE_STORE_PATH
    ? process.env.FOUNDER_NONCE_STORE_PATH
    : join(process.cwd(), '.secrets', 'nonces', 'used-nonces.jsonl');
}
function getNonceStoreDir(): string {
  const file = getNonceStoreFile();
  return join(file, '..');
}
function getLockDbPath(): string {
  return process.env.FOUNDER_NONCE_LOCK_DB
    || join(getNonceStoreDir(), '.nonces-lock.db');
}

function getLockDb(): Database.Database {
  if (lockDb) return lockDb;
  const nonceDir = getNonceStoreDir();
  const lockPath = getLockDbPath();
  mkdirSync(nonceDir, { recursive: true, mode: DIR_MODE });
  lockDb = new Database(lockPath, { verbose: undefined });
  lockDb.pragma('journal_mode = WAL');
  lockDb.pragma('busy_timeout = 30000');
  lockDb.exec(`
    CREATE TABLE IF NOT EXISTS nonce_lock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      owner_pid INTEGER NOT NULL,
      owner_token TEXT NOT NULL,
      acquired_at INTEGER NOT NULL
    )
  `);
  return lockDb;
}

function closeLockDb(): void {
  if (lockDb) {
    try { lockDb.close(); } catch {}
    lockDb = null;
  }
}

// Remove the lock database file so a fresh lock is always used. Leftover
// .db-wal/.db-shm files are harmless: SQLite treats an empty/missing main file
// as a new database, and the lock table is recreated by getLockDb().
export function resetNonceLockStore(): void {
  closeLockDb();
  const lockPath = getLockDbPath();
  // Delete main file, WAL, and SHM files
  for (const suffix of ['', '-wal', '-shm']) {
    const p = lockPath + suffix;
    try { if (existsSync(p)) unlinkSync(p); } catch {}
  }
  // Also try deleting-journal-mode files (iOS) and any temp files
  try { if (existsSync(lockPath + '-journal')) unlinkSync(lockPath + '-journal'); } catch {}
}

interface NonceRecord {
  key_id: string;
  operation: string;
  nonce: string;
  timestamp: number;
}

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
export const NONCE_MAX_LENGTH = 128; // Prevent excessive nonce length
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

/**
 * Cross-process safe file-based nonce store.
 * Uses atomic file operations instead of JavaScript Set (which is insufficient
 * because separate Node.js processes do not share memory).
 * Mutual exclusion is provided by a dedicated SQLite lock database (see LOCK_DB_PATH).
 */

/**
 * Initialize the nonce store directory and file with proper permissions.
 * Throws on filesystem errors (fail-closed security model).
 */
export function initNonceStore(): void {
  const nonceDir = getNonceStoreDir();
  const nonceFile = getNonceStoreFile();
  if (!existsSync(nonceDir)) {
    mkdirSync(nonceDir, { recursive: true, mode: DIR_MODE });
  }
  if (!existsSync(nonceFile)) {
    writeFileSync(nonceFile, '', { mode: FILE_MODE });
  }
}

/**
 * Generate a unique ownership token for this lock acquisition.
 * Combines PID, timestamp, and random bytes.
 */
function generateLockToken(): string {
  return `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Acquire cross-process exclusive lock using SQLite's BEGIN IMMEDIATE.
 * Returns ownership token on success, null on failure (lock held or timeout).
 * Ownership token MUST be passed to releaseNonceLock() for safe release.
 *
 * SQLite's IMMEDIATE transaction serializes all writers on the same file.
 * The busy_timeout (30s) controls how long we wait before giving up.
 * This replaces the PID-marker directory protocol which had a TOCTOU race
 * in the takeover marker (two different PIDs could both create their own marker).
 */
export function acquireNonceLock(): string | null {
  try {
    const db = getLockDb();
    const token = generateLockToken();

    // BEGIN IMMEDIATE acquires the write lock, blocking if another
    // process holds it. If busy_timeout expires, it throws.
    const tx = db.prepare('BEGIN IMMEDIATE TRANSACTION');
    tx.run();

    // Check if lock table has an owner we don't own
    const existing = db.prepare('SELECT owner_token, acquired_at FROM nonce_lock WHERE id = 1').get();
    if (existing && (existing as any).owner_token) {
      // Lock is held by another process (or stale entry from crash)
      // We still own the IMMEDIATE tx, so we can overwrite if stale
      const ageMs = Date.now() - ((existing as any).acquired_at || 0);
      if (ageMs < LOCK_STALE_MS) {
        db.prepare('ROLLBACK').run();
        return null;
      }
    }

    // Write our ownership atomically within the same transaction
    db.prepare(`
      INSERT INTO nonce_lock (id, owner_pid, owner_token, acquired_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_pid = excluded.owner_pid,
        owner_token = excluded.owner_token,
        acquired_at = excluded.acquired_at
    `).run(process.pid, token, Date.now());

    db.prepare('COMMIT').run();
    return token;
  } catch (error: any) {
    // Lock acquisition failed (timeout, busy, or other error)
    try { getLockDb().prepare('ROLLBACK').run(); } catch {}
    return null;
  }
}

/**
 * Check if the lock is stale (owner process crashed and lock is old).
 * Uses SQLite transaction for consistent read.
 */
export function isLockStale(): boolean {
  try {
    const db = getLockDb();
    const tx = db.prepare('BEGIN IMMEDIATE TRANSACTION');
    tx.run();

    const existing = db.prepare('SELECT owner_pid, owner_token, acquired_at FROM nonce_lock WHERE id = 1').get();
    db.prepare('ROLLBACK').run();

    if (!existing || !(existing as any).owner_token) {
      // No owner - lock is free, not "stale" in the sense of needing recovery
      // Return true to allow acquisition if the caller checks this
      return true;
    }

    const ageMs = Date.now() - (existing as any).acquired_at;
    if (ageMs > LOCK_STALE_MS) {
      return true;
    }

    // Process might still be alive; fail-closed (don't treat as stale)
    return false;
  } catch {
    // If we can't check, treat as stale to allow recovery
    return true;
  }
}

/**
 * Release lock ONLY if we own it.
 * Verifies ownership token before clearing the lock table.
 * @param token - The ownership token returned by acquireNonceLock()
 * @returns true if lock was released, false if not owned by caller or error
 */
export function releaseNonceLock(token: string | null): boolean {
  if (!token) return false;

  try {
    const db = getLockDb();
    const tx = db.prepare('BEGIN IMMEDIATE TRANSACTION');
    tx.run();

    // Verify we still own the lock
    const existing = db.prepare('SELECT owner_token FROM nonce_lock WHERE id = 1').get();
    if (!existing || (existing as any).owner_token !== token) {
      db.prepare('ROLLBACK').run();
      return false;
    }

    // Clear our ownership
    db.prepare('UPDATE nonce_lock SET owner_token = \'\', owner_pid = 0, acquired_at = 0 WHERE id = 1').run();
    db.prepare('COMMIT').run();
    return true;
  } catch {
    try { getLockDb().prepare('ROLLBACK').run(); } catch {}
    return false;
  }
}

/**
 * Parse nonce records from the file.
 * Returns a Map of nonce keys to their timestamps.
 * Throws if file contains corrupt/invalid JSON lines (fail-closed security model).
 */
export function parseNonceRecords(): Map<string, number> {
  const records = new Map<string, number>();
  const nonceFile = getNonceStoreFile();
  try {
    if (!existsSync(nonceFile)) return records;
    const content = readFileSync(nonceFile, 'utf-8');
    const lines = content.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const record: NonceRecord = JSON.parse(line); // Throws on corrupt JSON - fail closed
      const key = `${record.key_id}:${record.operation}:${record.nonce}`;
      records.set(key, record.timestamp);
    }
  } catch (error) {
    // File read error or corrupt JSON - return empty map to signal corruption
    // The caller will treat empty map from a file with content as corruption
    throw error;
  }
  return records;
}

/**
 * Atomically write all nonce records to the file.
 * Uses temp file + rename pattern to never expose partially written files.
 */
export function writeNonceRecordsSync(records: Map<string, NonceRecord>): boolean {
  try {
    initNonceStore();
    const nonceFile = getNonceStoreFile();
    const tmpFile = nonceFile + '.tmp';

    const lines: string[] = [];
    for (const record of records.values()) {
      lines.push(JSON.stringify(record));
    }

    // Write to temp file first
    writeFileSync(tmpFile, lines.join('\n') + '\n', { mode: FILE_MODE });

    // Atomic rename - either old file or new file, never partial
    renameSync(tmpFile, nonceFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check and consume a nonce atomically for cross-process safety.
 * Uses the SQLite lock database (BEGIN IMMEDIATE) for cross-process atomicity.
 *
 * @param keyId The founder key ID
 * @param operation The operation name (e.g., 'bootstrap_database')
 * @param nonce The nonce string to check/consume
 * @param now Current timestamp in ms
 * @returns true if nonce was successfully consumed, false if already consumed or error
 */
export function checkAndConsumeNonceFile(keyId: string, operation: string, nonce: string, now: number): boolean {
  // Validate inputs
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  if (nonce.length > NONCE_MAX_LENGTH) {
    return false;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) {
    return false;
  }

  const nonceKey = `${keyId}:${operation}:${nonce}`;

  // Acquire cross-process lock with ownership token
  const token = acquireNonceLock();
  if (!token) {
    return false; // Could not acquire lock, reject operation
  }

  try {
    // Initialize nonce store
    initNonceStore();

    // Parse existing records - fail closed on corruption
    let records: Map<string, number>;
    try {
      records = parseNonceRecords();
    } catch {
      // Corrupt nonce file - fail closed, reject the operation
      return false;
    }

    // Check if nonce already consumed
    if (records.has(nonceKey)) {
      return false;
    }

    // Add new record and write atomically using temp file + rename
    const newRecord: NonceRecord = { key_id: keyId, operation, nonce, timestamp: now };
    records.set(nonceKey, now);
    // Convert Map<string, number> to Map<string, NonceRecord> for writeNonceRecordsSync
    const fullRecords = new Map<string, NonceRecord>();
    for (const [key, timestamp] of records.entries()) {
      const [k, op, n] = key.split(':');
      fullRecords.set(key, { key_id: k, operation: op, nonce: n, timestamp });
    }
    fullRecords.set(nonceKey, newRecord);

    if (!writeNonceRecordsSync(fullRecords)) {
      return false;
    }
    return true;
  } finally {
    // Release ONLY our lock
    releaseNonceLock(token);
  }
}

// Clear file-based nonce store (for testing)
export function clearFileNonceStore(): void {
  const nonceFile = getNonceStoreFile();
  if (existsSync(nonceFile)) {
    writeFileSync(nonceFile, '');
  }
}

export function getKeyFileMtime(): number {
  try {
    return statSync(KEY_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

import { getDatabase } from '../database.js';

function getDb(): DatabaseInstance {
  const db = getDatabase();
  return db;
}

export function checkAndConsumeNonce(keyId: string, operation: string, nonce: string, now: number): boolean {
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
  if (cleanupInterval !== null) return;
  cleanupInterval = setInterval(() => {
    try {
      const db = getDatabase();
      db.stmt.cleanupFounderNonces.run();
    } catch (error) {
      // Silent cleanup failure - database may be closing/closed
      // This is expected during test cleanup when E2E databases are destroyed
    }
  }, 5 * 60 * 1000);
  // Allow the interval to not keep the process alive (test-friendly)
  cleanupInterval.unref?.();
}

export function stopNonceCleanupInterval(): void {
  if (cleanupInterval !== null) {
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

  // Signature valid - consume nonce via SQLite, with file-based fallback
  let nonceConsumed = false;
  try {
    nonceConsumed = checkAndConsumeNonce(keyId, operation, nonce, now);
  } catch {
    // SQLite not available, fall back to file-based store
    nonceConsumed = checkAndConsumeNonceFile(keyId, operation, nonce, now);
  }

  if (!nonceConsumed) {
    return { valid: false, error: 'NONCE_REPLAY' };
  }

  return { valid: true, owner_type, owner_id, runtime };
}

// Verify signature and consume nonce BEFORE database initialization
// Uses file-based nonce store for replay protection when SQLite is not available
// Returns: { valid: boolean, error?: string; owner_type?; owner_id?; runtime? }
// Uses loadFounderPublicKey() for public-key-only verification (no private key loaded)
export function verifyFounderOperationBeforeBootstrap(
  operation: string,
  body: any,
  signature: string,
  timestamp: number,
  nonce: string,
  keyId: string
): { valid: boolean; error?: string; owner_type?: 'founder' | 'staff'; owner_id?: string; runtime?: 'claude' | 'hermes' } {
  const keys = loadFounderPublicKey();
  if (!keys) return { valid: false, error: 'NO_KEYS' };
  if (keyId !== keys.key_id) return { valid: false, error: 'KEY_MISMATCH' };

  // Validate timestamp freshness (replay protection)
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

  // Canonicalize and verify signature BEFORE consuming nonce
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

  // Signature valid - consume nonce via file-based store (before DB available)
  const nonceConsumed = checkAndConsumeNonceFile(keyId, operation, nonce, now);
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

// Load only the public key from the key file - for production verification before DB is available
// This separates public key loading from full key pair loading for security
export function loadFounderPublicKey(): { public_key: string; key_id: string } | null {
  try {
    if (!existsSync(KEY_FILE)) return null;
    const data = readFileSync(KEY_FILE, 'utf-8');
    const keyPair = JSON.parse(data) as FounderKeyPair;

    // Validate only public key fields are present (no private key required)
    if (!keyPair.public_key || !keyPair.key_id) {
      return null;
    }

    return {
      public_key: keyPair.public_key,
      key_id: keyPair.key_id
    };
  } catch (error) {
    return null;
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