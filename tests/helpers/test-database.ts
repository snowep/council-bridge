import { createDatabase, DatabaseInstance } from '../../src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface TestDatabase {
  instance: DatabaseInstance;
  path: string;
  close: () => void;
}

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs');

export function createTestDatabase(name: string): TestDatabase {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const uniqueName = `${name}-${Date.now()}-${randomUUID().slice(0, 8)}.db`;
  const dbPath = path.join(TEST_DB_DIR, uniqueName);

  const instance = createDatabase(dbPath);

  function close(): void {
    try {
      instance.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
    }
    instance.close();

    const files = [dbPath, dbPath + '-wal', dbPath + '-shm'];
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
      }
    }
  }

  return { instance, path: dbPath, close };
}

process.on('exit', () => {
  if (fs.existsSync(TEST_DB_DIR)) {
    try {
      fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch {
    }
  }
});