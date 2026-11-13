import { createDatabase } from './src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-debug-test3.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
const db = createDatabase(TEST_DB_PATH);

// Check PRAGMA foreign_keys
const fk = db.db.prepare('PRAGMA foreign_keys').get();
console.log('PRAGMA foreign_keys:', fk);

// Try direct insert
try {
  db.db.exec("INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives) VALUES ('div-1', 'Test', 'Test', NULL, 0, '[]', '[]')");
  console.log('Direct insert worked');
} catch (e) {
  console.error('Direct insert failed:', e);
}

// Check tables again
const tables = db.db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all();
console.log('Tables:', tables.map(t => t.name));