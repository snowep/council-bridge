import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  guardDatabaseAccess,
  validateDatabaseTarget,
  resolveCanonicalPath,
  classifyDatabaseTarget,
  checkProductionPathConflict
} from '../../src/security/database-seeding-guard.js';

const TEST_DIR = path.join(__dirname, '..', '..', 'test-dbs-guard');

describe('Database Seeding Guard - Unit Tests', () => {
  before(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  after(() => {
    // Best effort cleanup - Windows may have permission issues during parallel test runs
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('resolveCanonicalPath', () => {
    it('resolves relative paths', () => {
      const result = resolveCanonicalPath('test.db', '/base');
      assert.ok(result.endsWith('test.db'));
    });

    it('handles absolute paths', () => {
      const result = resolveCanonicalPath('/absolute/path/db.sqlite', '/base');
      assert.strictEqual(result, '/absolute/path/db.sqlite');
    });

    it('returns :memory: unchanged', () => {
      const result = resolveCanonicalPath(':memory:', '/base');
      assert.strictEqual(result, ':memory:');
    });

    it('throws on empty path', () => {
      assert.throws(() => resolveCanonicalPath('', '/base'), /empty/);
    });
  });

  describe('classifyDatabaseTarget', () => {
    it('classifies production environment as production', () => {
      const result = classifyDatabaseTarget('/any/path.db', 'production');
      assert.strictEqual(result, 'production');
    });

    it('classifies test-dbs paths as test', () => {
      const result = classifyDatabaseTarget('/project/test-dbs/test.db', 'development');
      assert.strictEqual(result, 'test');
    });

    it('classifies test-data paths as test', () => {
      const result = classifyDatabaseTarget('/project/test-data/test.db', 'development');
      assert.strictEqual(result, 'test');
    });

    it('classifies dev paths as development when dev is in allowedDevDirs', () => {
      const result = classifyDatabaseTarget('/project/dev/council.db', 'development', [], ['dev']);
      assert.strictEqual(result, 'development');
    });

    it('classifies data/council.db as development when data is in allowedDevDirs', () => {
      const result = classifyDatabaseTarget('/project/data/council.db', 'development', [], ['data']);
      assert.strictEqual(result, 'development');
    });

    it('classifies unknown paths as unknown', () => {
      const result = classifyDatabaseTarget('/project/some/random/path.db', 'development');
      assert.strictEqual(result, 'unknown');
    });
  });

  describe('checkProductionPathConflict', () => {
    it('detects production path patterns', () => {
      assert.ok(checkProductionPathConflict('/var/production/council.db'));
      assert.ok(checkProductionPathConflict('/data/prod.db'));
      assert.ok(checkProductionPathConflict('/live/database.sqlite'));
    });

    it('does not flag test paths', () => {
      assert.ok(!checkProductionPathConflict('/test-dbs/test.db'));
      assert.ok(!checkProductionPathConflict('/project/test-data/test.db'));
    });
  });

  describe('validateDatabaseTarget - Production Environment', () => {
    it('rejects missing DATABASE_PATH in production', () => {
      const result = validateDatabaseTarget('', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('missing or empty'));
    });

    it('rejects :memory: in production', () => {
      const result = validateDatabaseTarget(':memory:', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('In-memory database'));
      assert.strictEqual(result.targetType, 'production');
    });

    it('rejects any path in production without explicit authorization', () => {
      const result = validateDatabaseTarget('/some/path.db', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('Production environment'));
      assert.strictEqual(result.targetType, 'production');
    });

    it('rejects relative paths in production', () => {
      const result = validateDatabaseTarget('../data/council.db', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
    });

    it('rejects path traversal attempts in production (production check takes precedence)', () => {
      const result = validateDatabaseTarget('../../etc/passwd', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('Production environment'));
    });
  });

  describe('validateDatabaseTarget - Test Environment', () => {
    it('accepts explicit test-dbs path in test env', () => {
      const result = validateDatabaseTarget('test-dbs/test.db', { environment: 'test' });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.targetType, 'test');
    });

    it('accepts explicit test-data path in test env', () => {
      const result = validateDatabaseTarget('test-data/test.db', { environment: 'test' });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.targetType, 'test');
    });

    it('accepts :memory: in test env', () => {
      const result = validateDatabaseTarget(':memory:', { environment: 'test' });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.targetType, 'test');
    });

    it('rejects unknown path in test env without explicit allowlist', () => {
      const result = validateDatabaseTarget('random/path.db', {
        environment: 'test',
        allowedTestPaths: ['test-dbs', 'test-data']
      });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('explicit test database path'));
    });

    it('rejects production-like path in test env', () => {
      const result = validateDatabaseTarget('data/council.db', { environment: 'test' });
      assert.strictEqual(result.allowed, false);
    });
  });

  describe('validateDatabaseTarget - Development Environment', () => {
    it('rejects data/council.db by default (no default dev allowlist)', () => {
      const result = validateDatabaseTarget('data/council.db', { environment: 'development' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('explicit development database path'));
    });

    it('accepts dev path when explicitly allowed', () => {
      const result = validateDatabaseTarget('dev/council.db', {
        environment: 'development',
        allowedDevPaths: ['dev']
      });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.targetType, 'development');
    });

    it('accepts :memory: in development', () => {
      const result = validateDatabaseTarget(':memory:', { environment: 'development' });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.targetType, 'development');
    });

    it('rejects unknown path in development', () => {
      const result = validateDatabaseTarget('random/path.db', { environment: 'development' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('explicit development database path'));
    });

    it('rejects production-like path in development', () => {
      const result = validateDatabaseTarget('production/council.db', { environment: 'development' });
      assert.strictEqual(result.allowed, false);
    });
  });

  describe('guardDatabaseAccess - throws on rejection', () => {
    it('throws on empty path', () => {
      assert.throws(() => guardDatabaseAccess(''), /missing or empty/);
    });

    it('throws on production rejection', () => {
      assert.throws(() => guardDatabaseAccess('/any/path', { environment: 'production' }), /Production environment/);
    });

    it('returns canonical path on success', () => {
      const result = guardDatabaseAccess('test-dbs/test.db', {
        environment: 'test',
        allowedTestPaths: ['test-dbs']
      });
      assert.ok(result.canonicalPath);
      assert.strictEqual(result.targetType, 'test');
    });
  });
});

describe('Database Seeding Guard - Integration Tests (Real CLI Entry Points)', () => {
  const testDbDir = path.join(TEST_DIR, 'integration');

  before(() => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  after(() => {
    // On Windows, cleanup can fail due to file locks - best effort
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors on Windows
    }
  });

  function runScript(scriptPath: string, env: Record<string, string> = {}, timeoutMs = 15000): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childEnv = { ...process.env, ...env };
      // Remove DATABASE_PATH from parent env to avoid contamination unless explicitly provided
      if (!env.DATABASE_PATH) {
        delete childEnv.DATABASE_PATH;
      }

      const child = spawn('node', ['--import', 'tsx', scriptPath], {
        env: childEnv,
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code: number | null) => {
        resolve({ exitCode: code, stdout, stderr });
      });

      child.on('error', (err: Error) => {
        resolve({ exitCode: null, stdout, stderr: err.message });
      });

      // Timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve({ exitCode: -1, stdout, stderr: stderr + '\nTIMEOUT' });
      }, timeoutMs);
    });
  }

  describe('bootstrap-database.ts entry point', () => {
    it('rejects production with :memory: (guard intercepts)', async () => {
      const result = await runScript('scripts/bootstrap-database.ts', {
        NODE_ENV: 'production',
        AUTH_MODE: 'production',
        SESSION_SECRET: 'test-secret-32-characters-minimum-length',
        DATABASE_PATH: ':memory:'
      });

      assert.ok(!result.stdout.includes('Database bootstrap complete'));
      assert.ok(result.stderr.includes('In-memory database') || result.stdout.includes('In-memory database'));
    });

    it('accepts :memory: in test environment', async () => {
      const result = await runScript('scripts/bootstrap-database.ts', {
        NODE_ENV: 'test',
        AUTH_MODE: 'development',
        DATABASE_PATH: ':memory:'
      });

      assert.ok(result.stdout.includes('Database bootstrap complete'));
    });
  });

  describe('bootstrap-signed.ts entry point', () => {
    it('rejects production with :memory:', async () => {
      const result = await runScript('scripts/bootstrap-signed.ts', {
        NODE_ENV: 'production',
        AUTH_MODE: 'production',
        SESSION_SECRET: 'test-secret-32-characters-minimum-length',
        DATABASE_PATH: ':memory:'
      });

      assert.ok(!result.stdout.includes('Database bootstrap complete'));
      assert.ok(result.stderr.includes('In-memory database') || result.stdout.includes('In-memory database'));
    });

    it('accepts explicit test database path', async () => {
      const testDb = path.join(testDbDir, 'test-bootstrap-signed.db');
      const result = await runScript('scripts/bootstrap-signed.ts', {
        NODE_ENV: 'test',
        AUTH_MODE: 'development',
        DATABASE_PATH: testDb
      }, 30000);

      assert.ok(result.stdout.includes('Database bootstrap complete') || result.stdout.includes('bootstrap complete'));
    });
  });

  describe('run-bootstrap.ts entry point', () => {
    it('rejects production with :memory:', async () => {
      const result = await runScript('scripts/run-bootstrap.ts', {
        NODE_ENV: 'production',
        AUTH_MODE: 'production',
        SESSION_SECRET: 'test-secret-32-characters-minimum-length',
        DATABASE_PATH: ':memory:'
      });

      assert.ok(!result.stdout.includes('Database bootstrap complete'));
      assert.ok(result.stderr.includes('In-memory database') || result.stdout.includes('In-memory database'));
    });

    it('accepts explicit test database path', async () => {
      const testDb = path.join(testDbDir, 'test-run-bootstrap.db');
      const result = await runScript('scripts/run-bootstrap.ts', {
        NODE_ENV: 'test',
        AUTH_MODE: 'development',
        DATABASE_PATH: testDb
      }, 30000);

      assert.ok(result.stdout.includes('Database bootstrap complete') || result.stdout.includes('bootstrap complete'));
    });
  });

  describe('server.ts initialization (initDb)', () => {
    it('rejects production without DATABASE_PATH using guard', async () => {
      // Test the guard directly instead of spawning the full server
      const databasePath = process.env.DATABASE_PATH || '';
      const result = validateDatabaseTarget(databasePath, { environment: 'production' });
      assert.strictEqual(result.allowed, false);
    });

    it('rejects production with :memory: using guard', async () => {
      const result = validateDatabaseTarget(':memory:', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes('In-memory database'));
    });

    it('rejects unknown paths in production using guard', async () => {
      const result = validateDatabaseTarget('/var/production/council.db', { environment: 'production' });
      assert.strictEqual(result.allowed, false);
    });
  });
});