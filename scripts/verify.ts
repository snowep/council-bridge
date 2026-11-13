import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');
const divisions = db.query('SELECT division_id, name, head_staff_id FROM divisions');
console.log('Divisions:', divisions);
const heads = db.query("SELECT staff_id, name, status, runtime_instances FROM staff_agents WHERE staff_id LIKE 'staff-%-head-%'");
console.log('Division Heads:', heads);
const specs = db.query("SELECT staff_id, name, status, runtime_instances FROM staff_agents WHERE staff_id NOT LIKE 'staff-%-head-%'");
console.log('Specialists count:', specs.length);
const active = specs.filter(s => s.status === 'active');
console.log('Active specialists:', active.length);
const withRuntimes = specs.filter(s => {
  try { return JSON.parse(s.runtime_instances).length > 0; } catch { return false; }
});
console.log('Specialists with runtimes:', withRuntimes.length);
db.close();