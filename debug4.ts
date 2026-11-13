import { createDatabase } from './src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-debug-test4.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
const db = createDatabase(TEST_DB_PATH);

// Test the prepared statement
console.log('Testing prepared statement...');
try {
  const stmt = db.stmt.insertDivision;
  console.log('Statement:', stmt);
  const result = stmt.run('div-1', 'Test', 'Test', null, 0, '[]', '[]');
  console.log('Prepared statement worked:', result);
} catch (e) {
  console.error('Prepared statement failed:', e);
}