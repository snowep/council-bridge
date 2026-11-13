import { createDatabase } from './src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-debug-test.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
const db = createDatabase(TEST_DB_PATH);

// Check tables
const tables = db.db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all();
console.log('Tables:', tables.map(t => t.name));

// Check divisions table
const divInfo = db.db.prepare('PRAGMA table_info(divisions)').all();
console.log('Divisions schema:', divInfo);

// Check foreign keys
const fk = db.db.prepare('PRAGMA foreign_key_list(divisions)').all();
console.log('Divisions FKs:', fk);

// Check staff_agents FKs
const fk2 = db.db.prepare('PRAGMA foreign_key_list(staff_agents)').all();
console.log('Staff agents FKs:', fk2);