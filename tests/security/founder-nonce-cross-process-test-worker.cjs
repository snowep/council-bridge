// Worker script for cross-process nonce lock testing (CommonJS)
const { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, renameSync } = require('fs');
const { join } = require('path');
const crypto = require('crypto');

const NONCE_STORE_DIR = process.argv[2];
const NONCE_STORE_FILE = join(NONCE_STORE_DIR, 'used-nonces.jsonl');
const LOCK_FILE = join(NONCE_STORE_DIR, '.nonces.lock');
const LOCK_OWNER_FILE = join(LOCK_FILE, 'owner.json');
const LOCK_STALE_MS = 30 * 1000;

const keyId = process.argv[3];
const operation = process.argv[4];
const nonce = process.argv[5];
const now = parseInt(process.argv[6], 10);
const workerId = process.argv[7];

function generateLockToken() {
  return process.pid + '-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
}

function writeLockOwner(token) {
  const owner = { pid: process.pid, token, acquired: Date.now() };
  const tmpFile = LOCK_OWNER_FILE + '.tmp';
  writeFileSync(tmpFile, JSON.stringify(owner));
  renameSync(tmpFile, LOCK_OWNER_FILE);
}

function readLockOwner() {
  try {
    if (!existsSync(LOCK_OWNER_FILE)) return null;
    const data = readFileSync(LOCK_OWNER_FILE, 'utf-8');
    const owner = JSON.parse(data);
    if (typeof owner.pid !== 'number' || typeof owner.token !== 'string' || typeof owner.acquired !== 'number') {
      return null;
    }
    return owner;
  } catch { return null; }
}

function isLockStale() {
  const owner = readLockOwner();
  if (!owner) {
    try {
      const stat = statSync(LOCK_FILE);
      return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
    } catch { return true; }
  }
  try { process.kill(owner.pid, 0); return false; } catch { return true; }
}

function acquireNonceLock() {
  try {
    if (!existsSync(NONCE_STORE_DIR)) mkdirSync(NONCE_STORE_DIR, { recursive: true });
    const token = generateLockToken();
    mkdirSync(LOCK_FILE);
    try { writeLockOwner(token); } catch { try { rmSync(LOCK_FILE, { recursive: true, force: true }); } catch {}; return null; }
    return token;
  } catch (error) {
    if (error.code === 'EEXIST' && existsSync(LOCK_FILE)) {
      if (isLockStale()) {
        const newToken = generateLockToken();
        const tmpOwnerFile = LOCK_OWNER_FILE + '.tmp';
        try {
          const newOwner = { pid: process.pid, token: newToken, acquired: Date.now() };
          writeFileSync(tmpOwnerFile, JSON.stringify(newOwner));
          renameSync(tmpOwnerFile, LOCK_OWNER_FILE);
          const verifyOwner = readLockOwner();
          if (verifyOwner && verifyOwner.token === newToken) return newToken;
          return null;
        } catch { try { rmSync(tmpOwnerFile, { force: true }); } catch {}; return null; }
      }
    }
    return null;
  }
}

function releaseNonceLock(token) {
  if (!token) return false;
  try {
    const owner = readLockOwner();
    if (!owner || owner.token !== token) return false;
    try { rmSync(LOCK_OWNER_FILE, { force: true }); } catch {}
    rmSync(LOCK_FILE, { recursive: true, force: true });
    return true;
  } catch { return false; }
}

function initNonceStore() {
  if (!existsSync(NONCE_STORE_DIR)) mkdirSync(NONCE_STORE_DIR, { recursive: true });
  if (!existsSync(NONCE_STORE_FILE)) writeFileSync(NONCE_STORE_FILE, '');
}

function parseNonceRecords() {
  const records = new Map();
  try {
    if (!existsSync(NONCE_STORE_FILE)) return records;
    const content = readFileSync(NONCE_STORE_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const key = record.key_id + ':' + record.operation + ':' + record.nonce;
      records.set(key, record.timestamp);
    }
  } catch (e) { throw e; }
  return records;
}

function writeNonceRecordsSync(records) {
  try {
    initNonceStore();
    const tmpFile = NONCE_STORE_FILE + '.tmp';
    const lines = [];
    for (const record of records.values()) lines.push(JSON.stringify(record));
    writeFileSync(tmpFile, lines.join('\n') + '\n');
    renameSync(tmpFile, NONCE_STORE_FILE);
    return true;
  } catch { return false; }
}

const NONCE_MAX_LENGTH = 128;

function checkAndConsumeNonceFile(keyId, operation, nonce, now) {
  if (!nonce || typeof nonce !== 'string') return false;
  if (nonce.length > NONCE_MAX_LENGTH) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) return false;

  const nonceKey = keyId + ':' + operation + ':' + nonce;

  const token = acquireNonceLock();
  if (!token) return false;

  try {
    initNonceStore();
    let records;
    try { records = parseNonceRecords(); } catch { return false; }
    if (records.has(nonceKey)) return false;

    const newRecord = { key_id: keyId, operation, nonce, timestamp: now };
    records.set(nonceKey, now);
    const fullRecords = new Map();
    for (const [key, timestamp] of records.entries()) {
      const parts = key.split(':');
      fullRecords.set(key, { key_id: parts[0], operation: parts[1], nonce: parts[2], timestamp });
    }
    fullRecords.set(nonceKey, newRecord);

    if (!writeNonceRecordsSync(fullRecords)) return false;
    return true;
  } finally {
    releaseNonceLock(token);
  }
}

const result = checkAndConsumeNonceFile(keyId, operation, nonce, now);
console.log(JSON.stringify({ workerId, success: result }));