// SEC-02: Founder Key Permissions Tests
// Tests for restrictive directory (0o700) and file (0o600) permissions

import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, statSync, existsSync, chmodSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import {
  generateFounderKeyPair,
  loadFounderKeyPair,
  initializeFounderKeys,
  rotateFounderKeys,
  signFounderRequest,
  KEYS_DIR as KEYS_DIR_IMPORT,
  KEY_FILE as KEY_FILE_IMPORT,
  clearFounderKeyCache
} from '../../src/auth/founder.js';

const KEYS_DIR = KEYS_DIR_IMPORT;
const KEY_FILE = KEY_FILE_IMPORT;

let db: DatabaseInstance;

describe('SEC-02: Founder Key Directory and File Permissions', () => {
  before(() => {
    db = createDatabase(':memory:');
  });

  after(() => {
    db.close();
  });

  beforeEach(() => {
    // Clean up .secrets directory before each test
    if (existsSync(KEYS_DIR)) {
      rmSync(KEYS_DIR, { recursive: true, force: true });
    }
    // Clear founder key cache between tests
    clearFounderKeyCache();
  });

  it('should create .secrets directory with 0o700 permissions on supported platforms', () => {
    const keyPair = generateFounderKeyPair();

    // Verify directory exists
    assert.ok(existsSync(KEYS_DIR), 'Directory should exist');

    // Check directory permissions (only on platforms that support it)
    const dirStat = statSync(KEYS_DIR);
    const dirMode = dirStat.mode & 0o777;

    // On Windows, the mode check may not apply the same way
    // We check that the directory was created and is accessible
    assert.ok(dirStat.isDirectory(), 'Should be a directory');

    // On Unix-like systems, verify 0o700
    if (process.platform !== 'win32') {
      assert.strictEqual(dirMode, 0o700, `Directory should have 0o700 permissions, got ${dirMode.toString(8)}`);
    }
  });

  it('should create founder-keys.json with 0o600 permissions on supported platforms', () => {
    const keyPair = generateFounderKeyPair();

    // Verify file exists
    assert.ok(existsSync(KEY_FILE), 'Key file should exist');

    // Check file permissions (only on platforms that support it)
    const fileStat = statSync(KEY_FILE);
    const fileMode = fileStat.mode & 0o777;

    assert.ok(fileStat.isFile(), 'Should be a file');

    // On Unix-like systems, verify 0o600
    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, `File should have 0o600 permissions, got ${fileMode.toString(8)}`);
    }
  });

  it('should verify existing directory permissions are 0o700 if already exists', () => {
    // Pre-create directory with 0o700
    mkdirSync(KEYS_DIR, { mode: 0o700, recursive: true });

    const keyPair = generateFounderKeyPair();

    // Verify directory still has 0o700
    const dirStat = statSync(KEYS_DIR);
    const dirMode = dirStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(dirMode, 0o700, 'Existing directory should retain 0o700 permissions');
    }
  });

  it('should verify existing file permissions are 0o600 if already exists', () => {
    // Pre-create directory and file with 0o600
    mkdirSync(KEYS_DIR, { mode: 0o700, recursive: true });
    chmodSync(KEYS_DIR, 0o700); // Ensure dir perms
    const testKeys = {
      public_key: 'test-public',
      private_key_pem: 'test-private',
      created_at: new Date().toISOString(),
      key_id: 'test-key-id'
    };
    writeFileSync(KEY_FILE, JSON.stringify(testKeys, null, 2), { mode: 0o600 });
    chmodSync(KEY_FILE, 0o600); // Ensure file perms

    // Now generate new keys (should not change existing file perms on load)
    const keyPair = generateFounderKeyPair();

    // Verify file still has 0o600
    const fileStat = statSync(KEY_FILE);
    const fileMode = fileStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, 'Existing file should retain 0o600 permissions');
    }
  });

  it('should create archive directory with 0o700 on key rotation', () => {
    // First create initial keys
    const keyPair = generateFounderKeyPair();

    // Then rotate keys
    const newKeyPair = rotateFounderKeys();

    // Verify archive directory exists with 0o700
    const archiveDir = join(KEYS_DIR, 'archive');
    assert.ok(existsSync(archiveDir), 'Archive directory should exist');

    const dirStat = statSync(archiveDir);
    const dirMode = dirStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(dirMode, 0o700, 'Archive directory should have 0o700 permissions');
    }

    // Verify archived key file has 0o600
    const archiveFiles = readdirSync(archiveDir);
    assert.ok(archiveFiles.length > 0, 'Should have archived key file');

    const archiveFilePath = join(archiveDir, archiveFiles[0]);
    const fileStat = statSync(archiveFilePath);
    const fileMode = fileStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, 'Archived key file should have 0o600 permissions');
    }
  });

  it('should not log private key material in any operation', () => {
    const consoleError = console.error;
    const consoleLog = console.log;
    let loggedPrivateKey = false;

    console.error = (...args: any[]) => {
      const msg = args.join(' ');
      if (msg.includes('PRIVATE KEY') || msg.includes('private_key_pem') || msg.includes('BEGIN PRIVATE')) {
        loggedPrivateKey = true;
      }
      consoleError.apply(console, args);
    };

    console.log = (...args: any[]) => {
      const msg = args.join(' ');
      if (msg.includes('PRIVATE KEY') || msg.includes('private_key_pem') || msg.includes('BEGIN PRIVATE')) {
        loggedPrivateKey = true;
      }
      consoleLog.apply(console, args);
    };

    try {
      // Generate keys
      generateFounderKeyPair();

      // Load keys
      loadFounderKeyPair();

      // Initialize keys
      initializeFounderKeys();

      // Rotate keys
      rotateFounderKeys();

      // Sign request
      const keys = loadFounderKeyPair();
      if (keys) {
        signFounderRequest('test_op', { data: 'test' }, keys.private_key_pem, keys.key_id);
      }

      // Verify no private key was logged
      assert.strictEqual(loggedPrivateKey, false, 'Private key material should never be logged');
    } finally {
      console.error = consoleError;
      console.log = consoleLog;
    }
  });

  it('should load keys without exposing private key in errors', () => {
    // Corrupt the key file
    mkdirSync(KEYS_DIR, { recursive: true });
    writeFileSync(KEY_FILE, 'invalid json', { mode: 0o600 });

    // Should return null, not throw or expose key material
    const result = loadFounderKeyPair();
    assert.strictEqual(result, null, 'Should return null for corrupted key file');
  });

  it('should handle missing directory gracefully', () => {
    // Ensure directory doesn't exist
    if (existsSync(KEYS_DIR)) {
      rmSync(KEYS_DIR, { recursive: true, force: true });
    }

    // Should return null when no keys exist
    const result = loadFounderKeyPair();
    assert.strictEqual(result, null, 'Should return null when no key file exists');
  });

  it('should not change permissions on load', () => {
    // Create file with specific permissions
    mkdirSync(KEYS_DIR, { mode: 0o700, recursive: true });
    chmodSync(KEYS_DIR, 0o700);

    const testKeys = {
      public_key: 'test-public',
      private_key_pem: 'test-private',
      created_at: new Date().toISOString(),
      key_id: 'test-key-id'
    };
    writeFileSync(KEY_FILE, JSON.stringify(testKeys, null, 2), { mode: 0o600 });
    chmodSync(KEY_FILE, 0o600);

    // Verify initial permissions
    let fileStat = statSync(KEY_FILE);
    let fileMode = fileStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, 'Initial file should have 0o600');
    }

    // Load keys
    loadFounderKeyPair();

    // Verify permissions unchanged
    fileStat = statSync(KEY_FILE);
    fileMode = fileStat.mode & 0o777;

    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, 'File permissions should not change on load');
    }
  });
});

