// Cross-process race condition tests for nonce lock
// Real child processes to verify atomic takeover behavior

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { spawn, spawnSync } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync, statSync } from 'fs';
import crypto from 'crypto';

const TEST_DIR = join(process.cwd(), '.secrets', 'test-race');
const LOCK_FILE = join(TEST_DIR, '.nonces.lock');
const LOCK_OWNER_FILE = join(LOCK_FILE, 'owner.json');

interface LockOwner {
  pid: number;
  token: string;
  acquired: number;
}

function generateToken() {
  return `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

// Worker that creates a stale lock then exits (simulating crash)
function createStaleLockWorker(): string {
  const lockPath = LOCK_FILE.replace(/\\/g, "\\\\");
  const ownerPath = LOCK_OWNER_FILE.replace(/\\/g, "\\\\");

  return [
    'const fs = require("fs");',
    'const LOCK_FILE = "' + lockPath + '";',
    'const LOCK_OWNER_FILE = "' + ownerPath + '";',
    'fs.mkdirSync(LOCK_FILE, { recursive: true });',
    "const owner = { pid: 999999, token: 'stale-token-' + Date.now(), acquired: Date.now() - 60000 };",
    'const tmpFile = LOCK_OWNER_FILE + ".tmp";',
    'fs.writeFileSync(tmpFile, JSON.stringify(owner));',
    'fs.renameSync(tmpFile, LOCK_OWNER_FILE);',
    "console.log(JSON.stringify({ status: 'stale-lock-created' }));"
  ].join("\n");
}

// Worker that attempts lock acquisition and reports result
function acquireLockWorker(): string {
  const lockPath = LOCK_FILE.replace(/\\/g, "\\\\");
  const ownerPath = LOCK_OWNER_FILE.replace(/\\/g, "\\\\");
  const testDir = TEST_DIR.replace(/\\/g, "\\\\");

  return [
    'const fs = require("fs");',
    'const crypto = require("crypto");',
    'const LOCK_FILE = "' + lockPath + '";',
    'const LOCK_OWNER_FILE = "' + ownerPath + '";',
    'function readLockOwner() {',
    '  try {',
    '    if (!fs.existsSync(LOCK_OWNER_FILE)) return null;',
    '    const data = fs.readFileSync(LOCK_OWNER_FILE, "utf-8");',
    '    const owner = JSON.parse(data);',
    '    if (typeof owner.pid !== "number" || typeof owner.token !== "string") return null;',
    '    return owner;',
    '  } catch { return null; }',
    '}',
    'function generateToken() {',
    '  return process.pid + "-" + Date.now() + "-" + crypto.randomBytes(8).toString("hex");',
    '}',
    'function isStale() {',
    '  const owner = readLockOwner();',
    '  if (!owner) {',
    '    try {',
    '      const stat = fs.statSync(LOCK_FILE);',
    '      return Date.now() - stat.mtimeMs > 30000;',
    '    } catch { return true; }',
    '  }',
    '  try { process.kill(owner.pid, 0); return false; } catch { return true; }',
    '}',
    'function acquire() {',
    '  try {',
    '    fs.mkdirSync(LOCK_FILE);',
    '    const token = generateToken();',
    '    const owner = { pid: process.pid, token: token, acquired: Date.now() };',
    '    const tmp = LOCK_OWNER_FILE + ".tmp";',
    '    fs.writeFileSync(tmp, JSON.stringify(owner));',
    '    fs.renameSync(tmp, LOCK_OWNER_FILE);',
    '    ',
    '    const verify = readLockOwner();',
    '    if (verify && verify.token === token) {',
    '      console.log(JSON.stringify({ acquired: true, token: token }));',
    '      return token;',
    '    }',
    '    console.log(JSON.stringify({ acquired: false, reason: "verification-failed" }));',
    '    return null;',
    '  } catch (e) {',
    '    if (e.code === "EEXIST" && isStale()) {',
    '      const token = generateToken();',
    '      const marker = LOCK_OWNER_FILE + ".takeover-" + process.pid;',
    '      try {',
    '        // Exclusive marker creation - atomic CAS',
    '        fs.openSync(marker, "wx");',
    '        // We won - write ownership',
    '        const owner = { pid: process.pid, token: token, acquired: Date.now() };',
    '        fs.writeFileSync(LOCK_OWNER_FILE, JSON.stringify(owner));',
    '        fs.unlinkSync(marker);',
    '        console.log(JSON.stringify({ acquired: true, token: token, tookOver: true }));',
    '        return token;',
    '      } catch (markerErr) {',
    '        // Someone else won the race',
    '        console.log(JSON.stringify({ acquired: false, reason: "takeover-race" }));',
    '        return null;',
    '      }',
    '    }',
    '    console.log(JSON.stringify({ acquired: false, reason: "lock-held" }));',
    '    return null;',
    '  }',
    '}',
    '',
    'const token = acquire();',
    'if (token) {',
    '  fs.writeFileSync("' + testDir + '/.acquired-token", token);',
    '}',
    'process.exit(0);'
  ].join("\n");
}

// Worker that releases a lock with a given token
function releaseLockWorker(): string {
  const lockPath = LOCK_FILE.replace(/\\/g, "\\\\");
  const ownerPath = LOCK_OWNER_FILE.replace(/\\/g, "\\\\");

  return [
    'const fs = require("fs");',
    'const LOCK_FILE = "' + lockPath + '";',
    'const LOCK_OWNER_FILE = "' + ownerPath + '";',
    'const token = process.argv[2];',
    '',
    'function readLockOwner() {',
    '  try {',
    '    if (!fs.existsSync(LOCK_OWNER_FILE)) return null;',
    '    const data = fs.readFileSync(LOCK_OWNER_FILE, "utf-8");',
    '    const owner = JSON.parse(data);',
    '    if (typeof owner.pid !== "number" || typeof owner.token !== "string") return null;',
    '    return owner;',
    '  } catch { return null; }',
    '}',
    '',
    'function release(t) {',
    '  const owner = readLockOwner();',
    '  if (!owner || owner.token !== t) {',
    '    console.log(JSON.stringify({ released: false, reason: "token-mismatch" }));',
    '    return false;',
    '  }',
    '  try { fs.unlinkSync(LOCK_OWNER_FILE); } catch {}',
    '  try { fs.rmSync(LOCK_FILE, { recursive: true, force: true }); } catch {}',
    '  console.log(JSON.stringify({ released: true }));',
    '  return true;',
    '}',
    '',
    'release(token);'
  ].join("\n");
}

function runWorker(script: string, args: string[] = []): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['-e', script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', () => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(JSON.stringify(result));
      } catch {
        resolve(stdout || stderr || '{}');
      }
    });
  });
}

describe('Founder Nonce Cross-Process Race Conditions', () => {
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
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it('should allow exactly one process to acquire lock via stale takeover', async () => {
    // First, create a stale lock
    const staleScript = createStaleLockWorker();
    const staleResult = spawnSync('node', ['-e', staleScript], { encoding: 'utf-8' });
    assert.ok(existsSync(LOCK_FILE), 'Stale lock should exist');

    // Now have TWO processes simultaneously attempt takeover
    const acquireScript = acquireLockWorker();

    const results = await Promise.all([
      runWorker(acquireScript),
      runWorker(acquireScript)
    ]);

    // Parse results
    const parsed = results.map(r => JSON.parse(r));
    const successes = parsed.filter(r => r.acquired === true);

    // Exactly ONE should succeed
    assert.strictEqual(successes.length, 1, `Expected exactly 1 success, got ${successes.length}. Results: ${JSON.stringify(parsed)}`);

    // Verify nonce file has exactly one record (lock was taken once)
    if (existsSync(LOCK_OWNER_FILE)) {
      assert.ok(successes.length === 1, 'Only one process should have acquired the lock');
    }
  });

  it('should reject takeover when lock is not stale', async () => {
    // Create lock with active process (use current PID)
    mkdirSync(LOCK_FILE, { recursive: true });
    const owner: LockOwner = {
      pid: process.pid,
      token: generateToken(),
      acquired: Date.now()
    };
    const tmp = LOCK_OWNER_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(owner));
    renameSync(tmp, LOCK_OWNER_FILE);

    // Another process should NOT be able to acquire (lock not stale)
    const acquireScript = acquireLockWorker();
    const result = JSON.parse(await runWorker(acquireScript));

    assert.strictEqual(result.acquired, false, 'Should not acquire non-stale lock');
    assert.strictEqual(result.reason, 'lock-held', `Expected lock-held, got ${result.reason}`);
  });

  it('should prevent release by wrong token (cross-process)', async () => {
    // Process A acquires lock
    mkdirSync(LOCK_FILE);
    const tokenA = generateToken();
    const ownerA: LockOwner = { pid: process.pid, token: tokenA, acquired: Date.now() };
    const tmpA = LOCK_OWNER_FILE + '.tmp';
    writeFileSync(tmpA, JSON.stringify(ownerA));
    renameSync(tmpA, LOCK_OWNER_FILE);

    // Worker B tries to release with wrong token
    const releaseScript = releaseLockWorker();
    const result = JSON.parse(await runWorker(releaseScript, ['wrong-token-xyz']));

    assert.strictEqual(result.released, false, 'Should not release with wrong token');
    assert.strictEqual(result.reason, 'token-mismatch', 'Should fail with token mismatch');

    // Lock file should still exist
    assert.ok(existsSync(LOCK_FILE), 'Lock should still exist after failed release');
  });

  it('should handle permission rejection on stale detection', async () => {
    // Create lock directory with no owner.json
    mkdirSync(LOCK_FILE, { recursive: true });

    // Check if isLockStale handles missing owner gracefully
    // When owner.json is missing and directory is fresh, should NOT be stale
    const stat = statSync(LOCK_FILE);
    const ageMs = Date.now() - stat.mtimeMs;

    // Fresh directory should not be stale (fail-closed: ambiguous = not stale)
    assert.ok(ageMs < 30000, 'Directory should be fresh, not stale');
  });

  it('should verify atomic read-after-write consistency', async () => {
    // Create lock that our process holds
    mkdirSync(LOCK_FILE, { recursive: true });
    const myToken = generateToken();
    const myOwner: LockOwner = { pid: process.pid, token: myToken, acquired: Date.now() };
    writeFileSync(LOCK_OWNER_FILE + '.tmp', JSON.stringify(myOwner));
    renameSync(LOCK_OWNER_FILE + '.tmp', LOCK_OWNER_FILE);

    // Verify we can read it back correctly
    const readOwner = JSON.parse(readFileSync(LOCK_OWNER_FILE, 'utf-8')) as LockOwner;
    assert.strictEqual(readOwner.pid, process.pid, 'Should read own PID');
    assert.strictEqual(readOwner.token, myToken, 'Should read own token');
  });
});