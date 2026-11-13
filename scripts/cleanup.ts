import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');
const toDelete = [
  'Developer Division', 'Marketing Division', 'Finance Division',
  'Creative Division', 'Research & Intelligence Division', 'Business Operations Division'
];
for (const id of toDelete) {
  db.db.prepare('DELETE FROM divisions WHERE division_id = ?').run(id);
  console.log('Deleted:', id);
}
const remaining = db.query('SELECT division_id, name, head_staff_id FROM divisions');
console.log('Remaining divisions:', remaining);
db.close();