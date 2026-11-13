import { createDatabase } from './src/database.js';
import { createCouncilService } from './src/council.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-debug-test2.db');
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
const db = createDatabase(TEST_DB_PATH);
const council = createCouncilService(db);

const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
console.log('Creating division...');
try {
  const div = council.createDivision(ctx, { name: 'Test', description: 'Test' });
  console.log('Division created:', div);
} catch (e) {
  console.error('Error creating division:', e);
}

// Try again with different name
console.log('Creating division 2...');
try {
  const div2 = council.createDivision(ctx, { name: 'Test2', description: 'Test2' });
  console.log('Division 2 created:', div2);
} catch (e) {
  console.error('Error creating division 2:', e);
}