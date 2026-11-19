import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const testDb = path.join(process.cwd(), 'test-dbs-guard', 'test-bootstrap.db');
const testDir = path.dirname(testDb);
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

const child = spawn('node', ['--import', 'tsx', 'scripts/bootstrap-database.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    AUTH_MODE: 'production',
    SESSION_SECRET: 'test-secret-32-characters-minimum-length',
    DATABASE_PATH: testDb
  },
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

let stdout = '';
let stderr = '';

child.stdout?.on('data', (data) => { stdout += data.toString(); });
child.stderr?.on('data', (data) => { stderr += data.toString(); });

child.on('close', (code) => {
  console.log('exitCode:', code);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
  // Cleanup
  try { fs.unlinkSync(testDb); } catch {}
});

setTimeout(() => { child.kill('SIGTERM'); }, 5000);