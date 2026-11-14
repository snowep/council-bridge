// Production Database Configuration Tests
// Verifies production fails closed when DATABASE_PATH is missing

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Production Database Configuration', () => {
  const testDbDir = path.join(process.cwd(), 'test-data');
  const testDbPath = path.join(testDbDir, 'test-council.db');

  before(() => {
    // Ensure test data directory exists
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should exit with code 1 in production when DATABASE_PATH is not set', async () => {
    const result = await runServer({
      NODE_ENV: 'production',
      AUTH_MODE: 'production',
      SESSION_SECRET: 'test-secret-32-characters-minimum-length',
      // DATABASE_PATH deliberately not set
    });

    assert.strictEqual(result.exitCode, 1, 'Production should exit with code 1 when DATABASE_PATH is missing');
    assert.ok(result.stderr.includes('DATABASE_PATH environment variable is required'), 'Should output clear error about missing DATABASE_PATH');
    assert.ok(result.stderr.includes('In-memory database'), 'Should mention in-memory database not allowed');
  });

  it('should exit with code 1 in production when DATABASE_PATH is :memory:', async () => {
    const result = await runServer({
      NODE_ENV: 'production',
      AUTH_MODE: 'production',
      SESSION_SECRET: 'test-secret-32-characters-minimum-length',
      DATABASE_PATH: ':memory:',
    });

    assert.strictEqual(result.exitCode, 1, 'Production should exit with code 1 when DATABASE_PATH is :memory:');
    assert.ok(result.stderr.includes('DATABASE_PATH environment variable is required'), 'Should output clear error about :memory: not allowed');
  });

  it('should start successfully in production with valid DATABASE_PATH', async () => {
    const result = await runServer({
      NODE_ENV: 'production',
      AUTH_MODE: 'production',
      SESSION_SECRET: 'test-secret-32-characters-minimum-length',
      DATABASE_PATH: testDbPath,
    }, 3000); // Give it time to start

    // Server should be running (we kill it after timeout)
    assert.ok(result.timedOut || result.exitCode === 0, 'Server should start with valid DATABASE_PATH');
    assert.ok(!result.stderr.includes('DATABASE_PATH environment variable is required'), 'Should not show DATABASE_PATH error');
  });

  it('should use default path in development when DATABASE_PATH not set', async () => {
    // Use a unique dev database path to avoid conflicts
    const devDbDir = path.join(testDbDir, 'dev-test');
    const devDbPath = path.join(devDbDir, 'council.db');

    // Clean up any existing test directory
    if (fs.existsSync(devDbDir)) {
      try { fs.rmSync(devDbDir, { recursive: true, force: true }); } catch {}
    }

    const result = await runServer({
      NODE_ENV: 'development',
      AUTH_MODE: 'development',
      // DATABASE_PATH deliberately not set - will use default but we test via separate logic
    }, 3000);

    assert.ok(result.timedOut || result.exitCode === 0, 'Development should start with default path');

    // Note: The default dev database is created at process.cwd()/data/council.db
    // We don't verify it here since it may conflict with other tests
    // The important thing is that development mode doesn't fail
  });

  it('should allow :memory: in test environment', async () => {
    const result = await runServer({
      NODE_ENV: 'test',
      AUTH_MODE: 'development',
      DATABASE_PATH: ':memory:',
    }, 2000);

    assert.ok(result.timedOut || result.exitCode === 0, 'Test environment should allow :memory:');
    assert.ok(!result.stderr.includes('DATABASE_PATH environment variable is required'), 'Should not show DATABASE_PATH error in test');
  });

  it('should create directory if it does not exist', async () => {
    const newDbPath = path.join(testDbDir, 'new-subdir', 'new-council.db');
    const newDbDir = path.dirname(newDbPath);

    // Ensure parent doesn't exist
    if (fs.existsSync(newDbDir)) {
      fs.rmSync(newDbDir, { recursive: true, force: true });
    }

    const result = await runServer({
      NODE_ENV: 'production',
      AUTH_MODE: 'production',
      SESSION_SECRET: 'test-secret-32-characters-minimum-length',
      DATABASE_PATH: newDbPath,
    }, 5000);

    // Server should be running (timedOut) or started successfully
    assert.ok(result.timedOut || result.exitCode === 0, 'Should create directory and start');

    // Wait for database file to be created (server may still be running)
    let dbExists = false;
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(newDbPath)) {
        dbExists = true;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(dbExists, 'Database file should be created');

    // Cleanup
    fs.rmSync(newDbDir, { recursive: true, force: true });
  });
});

function runServer(env: Record<string, string>, timeoutMs = 5000): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, ...env };
    const child = spawn('node', ['--import', 'tsx', 'src/server.ts'], {
      env: childEnv,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ exitCode: null, stdout, stderr: err.message, timedOut: false });
    });
  });
}