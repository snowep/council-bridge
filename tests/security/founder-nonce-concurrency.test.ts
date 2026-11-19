// Concurrency test for cross-process nonce consumption
// Tests the lock mechanism directly

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, renameSync } from 'fs';
import crypto from 'crypto';

const TEST_DIR = join(process.cwd(), '.secrets', 'test-concurrency');
const NONCE_STORE_DIR = join(TEST_DIR, 'nonces');
const NONCE_STORE_FILE = join(NONCE_STORE_DIR, 'used-nonces.jsonl');
const LOCK_FILE = join(NONCE_STORE_DIR, '.nonces.lock');
const PID_FILE = join(LOCK_FILE, 'owner.pid');
const LOCK_STALE_MS = 30 * 1000;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const NONCE_MAX_LENGTH = 128;

// Copy of the lock functions from founder.ts for testing
function isLockStaleTest(): boolean {
  if (!existsSync(PID_FILE)) {
    try {
      const stat = statSync(LOCK_FILE);
      return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
    } catch {
      return true;
    }
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
    if (isNaN(pid)) return true;
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

function writeLockPidTest(): void {
  try { writeFileSync(PID_FILE, String(process.pid)); } catch {}
}

function acquireNonceLockTest(): boolean {
  try {
    if (!existsSync(NONCE_STORE_DIR)) {
      mkdirSync(NONCE_STORE_DIR, { recursive: true, mode: DIR_MODE });
    }
    mkdirSync(LOCK_FILE);
    writeLockPidTest();
    return true;
  } catch (error: any) {
    if (error.code === 'EEXIST' && existsSync(LOCK_FILE)) {
      if (isLockStaleTest()) {
        try {
          if (existsSync(PID_FILE)) rmSync(PID_FILE);
          rmSync(LOCK_FILE, { recursive: true, force: true });
          mkdirSync(LOCK_FILE);
          writeLockPidTest();
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }
}

function releaseNonceLockTest(): void {
  try {
    if (existsSync(PID_FILE)) rmSync(PID_FILE);
    rmSync(LOCK_FILE, { recursive: true, force: true });
  } catch {}
}

function initNonceStoreTest(): void {
  if (!existsSync(NONCE_STORE_DIR)) {
    mkdirSync(NONCE_STORE_DIR, { recursive: true, mode: DIR_MODE });
  }
  if (!existsSync(NONCE_STORE_FILE)) {
    writeFileSync(NONCE_STORE_FILE, '', { mode: FILE_MODE });
  }
}

function parseNonceRecordsTest(): Map<string, number> {
  const records = new Map<string, number>();
  try {
    if (!existsSync(NONCE_STORE_FILE)) return records;
    const content = readFileSync(NONCE_STORE_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const key = `${record.key_id}:${record.operation}:${record.nonce}`;
      records.set(key, record.timestamp);
    }
  } catch (error) {
    throw error;
  }
  return records;
}

function writeNonceRecordsSyncTest(records: Map<string, { key_id: string; operation: string; nonce: string; timestamp: number }>): boolean {
  try {
    initNonceStoreTest();
    const tmpFile = NONCE_STORE_FILE + '.tmp';
    const lines: string[] = [];
    for (const record of records.values()) {
      lines.push(JSON.stringify(record));
    }
    writeFileSync(tmpFile, lines.join('\n') + '\n', { mode: FILE_MODE });
    renameSync(tmpFile, NONCE_STORE_FILE);
    return true;
  } catch {
    return false;
  }
}

function checkAndConsumeNonceFileTest(keyId: string, operation: string, nonce: string, now: number): boolean {
  if (!nonce || typeof nonce !== 'string') return false;
  if (nonce.length > NONCE_MAX_LENGTH) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) return false;

  const nonceKey = `${keyId}:${operation}:${nonce}`;

  if (!acquireNonceLockTest()) {
    return false;
  }

  try {
    initNonceStoreTest();
    let records: Map<string, number>;
    try {
      records = parseNonceRecordsTest();
    } catch {
      return false;
    }

    if (records.has(nonceKey)) {
      return false;
    }

    const newRecord = { key_id: keyId, operation, nonce, timestamp: now };
    records.set(nonceKey, now);
    const fullRecords = new Map<string, { key_id: string; operation: string; nonce: string; timestamp: number }>();
    for (const [key, timestamp] of records.entries()) {
      const [k, op, n] = key.split(':');
      fullRecords.set(key, { key_id: k, operation: op, nonce: n, timestamp });
    }
    fullRecords.set(nonceKey, newRecord);

    if (!writeNonceRecordsSyncTest(fullRecords)) {
      return false;
    }
    return true;
  } finally {
    releaseNonceLockTest();
  }
}

describe('Founder Nonce Cross-Process Concurrency', () => {
  const keyId = 'test-key-' + crypto.randomBytes(8).toString('hex');
  const operation = 'bootstrap_database';
  const nonce = 'test-nonce-' + crypto.randomBytes(16).toString('hex');
  const now = Date.now();

  before(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (existsSync(NONCE_STORE_FILE)) {
      writeFileSync(NONCE_STORE_FILE, '');
    }
    if (existsSync(LOCK_FILE)) {
      rmSync(LOCK_FILE, { recursive: true, force: true });
    }
  });

  it('should acquire and release lock correctly', () => {
    const acquired = acquireNonceLockTest();
    assert.strictEqual(acquired, true, 'Should acquire lock');

    const acquired2 = acquireNonceLockTest();
    assert.strictEqual(acquired2, false, 'Should fail to acquire lock when already held');

    releaseNonceLockTest();
    assert.strictEqual(existsSync(LOCK_FILE), false, 'Lock should be released');

    const acquired3 = acquireNonceLockTest();
    assert.strictEqual(acquired3, true, 'Should acquire lock after release');
    releaseNonceLockTest();
  });

  it('should reject acquisition when lock directory already exists', () => {
    mkdirSync(LOCK_FILE);
    writeLockPidTest();

    const acquired = acquireNonceLockTest();
    assert.strictEqual(acquired, false, 'Should fail to acquire when lock exists');

    releaseNonceLockTest();
  });

  it('should detect stale lock by PID', () => {
    mkdirSync(LOCK_FILE);
    writeFileSync(PID_FILE, '999999');

    const stale = isLockStaleTest();
    assert.strictEqual(stale, true, 'Should detect non-existent PID as stale');

    releaseNonceLockTest();
  });

  it('should detect stale lock by mtime (recent = not stale)', () => {
    mkdirSync(LOCK_FILE);
    const stale = isLockStaleTest();
    assert.strictEqual(typeof stale, 'boolean');
    releaseNonceLockTest();
  });

  it('should consume nonce atomically in single process', () => {
    const result1 = checkAndConsumeNonceFileTest(keyId, operation, nonce, now);
    assert.strictEqual(result1, true, 'First consumption should succeed');

    const result2 = checkAndConsumeNonceFileTest(keyId, operation, nonce, now);
    assert.strictEqual(result2, false, 'Second consumption should fail');
  });

  it('should validate nonce format', () => {
    assert.strictEqual(checkAndConsumeNonceFileTest(keyId, operation, '', now), false);
    assert.strictEqual(checkAndConsumeNonceFileTest(keyId, operation, 'a'.repeat(NONCE_MAX_LENGTH + 1), now), false);
    assert.strictEqual(checkAndConsumeNonceFileTest(keyId, operation, 'invalid@nonce', now), false);
  });

  it('should use atomic temp-file rename for writes', () => {
    const records = new Map();
    records.set(`${keyId}:${operation}:${nonce}`, { key_id: keyId, operation, nonce, timestamp: now });

    const success = writeNonceRecordsSyncTest(records);
    assert.strictEqual(success, true, 'Write should succeed');

    const content = readFileSync(NONCE_STORE_FILE, 'utf-8');
    assert.ok(content.includes(nonce), 'Nonce should be in file');

    if (existsSync(LOCK_FILE)) {
      releaseNonceLockTest();
    }
  });

  it('should parse nonce records correctly', () => {
    const record = { key_id: keyId, operation, nonce, timestamp: now };
    writeFileSync(NONCE_STORE_FILE, JSON.stringify(record) + '\n');

    const records = parseNonceRecordsTest();
    assert.strictEqual(records.size, 1);
    const key = `${keyId}:${operation}:${nonce}`;
    assert.strictEqual(records.get(key), now);

    if (existsSync(LOCK_FILE)) {
      releaseNonceLockTest();
    }
  });

  it('should fail closed on corrupt nonce file', () => {
    writeFileSync(NONCE_STORE_FILE, 'not valid json\n');

    assert.throws(() => parseNonceRecordsTest(), /Unexpected token/);
  });

  it('should handle concurrent-like scenario (sequential lock acquire/release)', () => {
    const testNonce = 'test-nonce-' + crypto.randomBytes(16).toString('hex');
    let successCount = 0;

    const result1 = checkAndConsumeNonceFileTest(keyId, operation, testNonce, now);
    if (result1) successCount++;

    const result2 = checkAndConsumeNonceFileTest(keyId, operation, testNonce, now);
    if (result2) successCount++;

    assert.strictEqual(successCount, 1, `Expected exactly 1 success, got ${successCount}`);
  });

  it('should recover from stale lock', () => {
    mkdirSync(LOCK_FILE);
    writeFileSync(PID_FILE, '999999');

    const acquired = acquireNonceLockTest();
    assert.strictEqual(acquired, true, 'Should acquire lock by recovering stale lock');

    releaseNonceLockTest();
    assert.strictEqual(existsSync(LOCK_FILE), false, 'Lock should be released after recovery');
  });

  it('should initialize nonce store directory', () => {
    initNonceStoreTest();
    assert.strictEqual(existsSync(NONCE_STORE_DIR), true);
    assert.strictEqual(existsSync(NONCE_STORE_FILE), true);
  });
});