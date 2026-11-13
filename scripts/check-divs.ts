import { createDatabase } from '../src/database.js';
import { listDivisions } from '../src/council/divisions.js';

const db = createDatabase('data/council.db');
const divs = listDivisions(db);
for (const d of divs) {
  console.log(`${d.division_id}: ${d.name}`);
}
db.close();