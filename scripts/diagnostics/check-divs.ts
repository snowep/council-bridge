import { createDatabase } from '../../src/database.js';
import { guardDatabaseAccess } from '../../src/security/database-seeding-guard.js';
import { listDivisions } from '../../src/council/divisions.js';

guardDatabaseAccess('data/council.db', { allowedDevPaths: ['data'] });
const db = createDatabase('data/council.db');
const divs = listDivisions(db);
for (const d of divs) {
  console.log(`${d.division_id}: ${d.name}`);
}
db.close();