import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');

console.log('=== STAFF AGENTS ===');
const staff = db.query('SELECT staff_id, name, division_id, status FROM staff_agents ORDER BY division_id, staff_id');
for (const s of staff) console.log(s.staff_id, s.division_id, s.status);

console.log('\n=== DIVISION MEMBERS ===');
const members = db.query('SELECT division_id, staff_id, role FROM division_members ORDER BY division_id, staff_id');
for (const m of members) console.log(m.division_id, m.staff_id, m.role);

console.log('\n=== RUNTIME PERSONAS ===');
const runtimes = db.query('SELECT runtime, persona_id FROM runtime_personas ORDER BY persona_id, runtime');
for (const r of runtimes) console.log(r.persona_id, r.runtime);

console.log('\n=== MEMORY ENTRIES (council_shared) ===');
const mems = db.query("SELECT memory_id, memory_type, category, owner_id, created_at FROM memory_entries WHERE category = 'council_shared' ORDER BY created_at DESC LIMIT 20");
for (const m of mems) console.log(m.memory_id, m.memory_type, m.category, m.owner_id, m.created_at);

console.log('\n=== COUNTS ===');
console.log('Divisions:', db.query('SELECT COUNT(*) as c FROM divisions')[0].c);
console.log('Division Heads:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE staff_id LIKE \'staff-%-head-%\'')[0].c);
console.log('Specialists:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE staff_id NOT LIKE \'staff-%-head-%\'')[0].c);
console.log('Active agents:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE status = \'active\'')[0].c);
console.log('Runtime personas:', db.query('SELECT COUNT(*) as c FROM runtime_personas')[0].c);
console.log('Division members:', db.query('SELECT COUNT(*) as c FROM division_members')[0].c);
console.log('Audit memories:', db.query("SELECT COUNT(*) as c FROM memory_entries WHERE category = 'council_shared'")[0].c);

db.close();