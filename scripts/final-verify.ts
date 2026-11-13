import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');

const schema = db.query('PRAGMA table_info(runtime_personas)');
console.log('=== runtime_personas schema ===');
for (const s of schema) console.log(s.name, s.type);

const count = db.query('SELECT COUNT(*) as c FROM runtime_personas');
console.log('\nRuntime personas count:', count[0].c);

const sample = db.query('SELECT * FROM runtime_personas LIMIT 5');
for (const r of sample) console.log(r);

const mems = db.query("SELECT memory_id, type, category, created_by, created_at FROM memories WHERE category = 'council_shared' ORDER BY created_at DESC LIMIT 10");
console.log('\n=== Recent council_shared memories ===');
for (const m of mems) console.log(m.memory_id, m.type, m.category, m.created_by, m.created_at);

console.log('\n=== COUNTS ===');
console.log('Divisions:', db.query('SELECT COUNT(*) as c FROM divisions')[0].c);
console.log('Division Heads:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE staff_id LIKE "staff-%-head-%"')[0].c);
console.log('Specialists:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE staff_id NOT LIKE "staff-%-head-%"')[0].c);
console.log('Active agents:', db.query('SELECT COUNT(*) as c FROM staff_agents WHERE status = "active"')[0].c);
console.log('Runtime personas:', db.query('SELECT COUNT(*) as c FROM runtime_personas')[0].c);
console.log('Division members:', db.query('SELECT COUNT(*) as c FROM division_members')[0].c);
console.log('Audit memories:', db.query("SELECT COUNT(*) as c FROM memories WHERE category = 'council_shared'")[0].c);

db.close();