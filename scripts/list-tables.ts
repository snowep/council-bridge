import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');

const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
console.log('=== TABLES ===');
for (const t of tables) console.log(t.name);

const schema = db.query('PRAGMA table_info(runtime_personas)');
console.log('\n=== runtime_personas schema ===');
for (const s of schema) console.log(s.name, s.type);

const count = db.query('SELECT COUNT(*) as c FROM runtime_personas');
console.log('\nRuntime personas count:', count[0].c);

const sample = db.query('SELECT * FROM runtime_personas LIMIT 10');
for (const r of sample) console.log(r);

db.close();