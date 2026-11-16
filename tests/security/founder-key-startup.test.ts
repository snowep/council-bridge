// SEC-04: Founder Key Startup Validation Tests
// Tests that server fails to start when required Founder key material is missing

import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { rmSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { KEYS_DIR, KEY_FILE, loadFounderKeyPair, generateFounderKeyPair, clearFounderKeyCache } from '../../src/auth/founder.js';
import { validateFounderKeyConfiguration } from '../../src/auth/index.js';

// Save original env
const originalAuthMode = process.env.AUTH_MODE;
const originalLocalMode = process.env.LOCAL_SINGLE_USER_MODE;
const originalSessionSecret = process.env.SESSION_SECRET;

// Helper to set production env with valid session secret
function setProductionEnv() {
  process.env.AUTH_MODE = 'production';
  process.env.SESSION_SECRET = 'a'.repeat(32);
}

// Helper to clean .secrets dir
function cleanSecretsDir() {
  if (existsSync(KEYS_DIR)) {
    rmSync(KEYS_DIR, { recursive: true, force: true });
  }
}

describe('SEC-04: Founder Key Startup Validation', () => {
  before(() => {
    // Ensure .secrets dir doesn't interfere with tests
    if (existsSync(KEYS_DIR)) {
      rmSync(KEYS_DIR, { recursive: true, force: true });
    }
  });

  after(() => {
    // Restore env
    process.env.AUTH_MODE = originalAuthMode;
    if (originalLocalMode) {
      process.env.LOCAL_SINGLE_USER_MODE = originalLocalMode;
    } else {
      delete process.env.LOCAL_SINGLE_USER_MODE;
    }
  });

  beforeEach(() => {
    // Clean .secrets before each test
    if (existsSync(KEYS_DIR)) {
      rmSync(KEYS_DIR, { recursive: true, force: true });
    }
    // Clear founder key cache between tests
    clearFounderKeyCache();
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(KEYS_DIR)) {
      rmSync(KEYS_DIR, { recursive: true, force: true });
    }
  });

  it('should pass validation in development mode without keys', () => {
    process.env.AUTH_MODE = 'development';
    delete process.env.LOCAL_SINGLE_USER_MODE;
    delete process.env.SESSION_SECRET;

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, true, 'Development mode should pass without keys');
    assert.strictEqual(result.errors.length, 0, 'No errors expected in development');
  });

  it('should fail validation in production mode without keys', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, false, 'Production mode should fail without keys');
    assert.ok(result.errors.length > 0, 'Should have at least one error');
    assert.ok(
      result.errors.some(e => e.includes('Founder keys must be initialized')),
      'Error should mention missing founder keys'
    );
  });

  it('should pass validation in production mode with valid keys', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    // Generate valid keys
    generateFounderKeyPair();

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, true, 'Production mode should pass with valid keys');
    assert.strictEqual(result.errors.length, 0, 'No errors expected with valid keys');
  });

  it('should fail validation in production mode with local single-user mode enabled', () => {
    setProductionEnv();
    process.env.LOCAL_SINGLE_USER_MODE = 'true';

    // Generate valid keys
    generateFounderKeyPair();

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, false, 'Should fail with local mode in production');
    assert.ok(result.errors.length > 0, 'Should have at least one error');
    assert.ok(
      result.errors.some(e => e.includes('Local single-user mode cannot be enabled in production')),
      'Error should mention local mode conflict'
    );
  });

  it('should fail validation in production with corrupted key file', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    // Clean secrets dir first to ensure fresh state
    cleanSecretsDir();

    // Create corrupted key file
    mkdirSync(KEYS_DIR, { recursive: true });
    writeFileSync(KEY_FILE, 'invalid json', { mode: 0o600 });

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, false, 'Should fail with corrupted key file');
    assert.ok(result.errors.length > 0, 'Should have at least one error');
  });

  it('should fail validation in production with incomplete key structure', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    // Create key file with missing fields
    mkdirSync(KEYS_DIR, { recursive: true });
    const incompleteKeys = {
      public_key: 'test-public'
      // Missing private_key_pem and key_id
    };
    writeFileSync(KEY_FILE, JSON.stringify(incompleteKeys, null, 2), { mode: 0o600 });

    const result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, false, 'Should fail with incomplete key structure');
    assert.ok(result.errors.length > 0, 'Should have at least one error');
  });

  it('should return specific error messages for different failure modes', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    // Test missing keys error
    const resultMissing = validateFounderKeyConfiguration();
    assert.ok(
      resultMissing.errors.some(e => e.includes('Founder keys must be initialized')),
      'Missing keys should produce specific error message'
    );

    // Test local mode error (with keys)
    process.env.LOCAL_SINGLE_USER_MODE = 'true';
    generateFounderKeyPair();

    const resultLocal = validateFounderKeyConfiguration();
    assert.ok(
      resultLocal.errors.some(e => e.includes('Local single-user mode cannot be enabled in production')),
      'Local mode should produce specific error message'
    );
  });

  it('should not log private key material during validation', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

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
      // Generate keys and validate
      generateFounderKeyPair();
      validateFounderKeyConfiguration();

      assert.strictEqual(loggedPrivateKey, false, 'Private key material should never be logged during validation');
    } finally {
      console.error = consoleError;
      console.log = consoleLog;
    }
  });

  it('should validate keys are loaded from file not cached', () => {
    setProductionEnv();
    delete process.env.LOCAL_SINGLE_USER_MODE;

    // Generate initial keys
    const initialKeys = generateFounderKeyPair();

    // Validate with initial keys
    let result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, true, 'Should pass with valid keys');

    // Remove key file
    rmSync(KEY_FILE, { force: true });

    // Validation should now fail (no caching)
    result = validateFounderKeyConfiguration();
    assert.strictEqual(result.valid, false, 'Should fail when key file is removed');
    assert.ok(result.errors.some(e => e.includes('Founder keys must be initialized')));
  });
});