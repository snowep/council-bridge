import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');

// Check runtime_personas table
const rpSchema = db.query('PRAGMA table_info(runtime_personas)');
console.log('=== runtime_personas schema ===');
for (const s of rpSchema) console.log(s.name, s.type);

// Check personas table
const pSchema = db.query('PRAGMA table_info(personas)');
console.log('\n=== personas schema ===');
for (const s of pSchema) console.log(s.name, s.type);

// Check runtime_personas content
const rp = db.query('SELECT * FROM runtime_personas');
console.log('\n=== runtime_personas count:', rp.length);
const claudeCount = rp.filter(r => r.runtime === 'claude').length;
const hermesCount = rp.filter(r => r.runtime === 'hermes').length;
console.log('  claude:', claudeCount, 'hermes:', hermesCount);

// Check personas count
const personas = db.query('SELECT * FROM personas');
console.log('\n=== personas count:', personas.length);
for (const p of personas) console.log('  ', p.persona_id, p.seat_id);

// Check foreign key
console.log('\n=== foreign_key_check ===');
const fk = db.query('PRAGMA foreign_key_check');
if (fk.length === 0) {
  console.log('  OK - no violations');
} else {
  for (const f of fk) console.log('  VIOLATION:', f);
}

// Check integrity
console.log('\n=== integrity_check ===');
const integrity = db.query('PRAGMA integrity_check');
console.log('  ', integrity);

db.close();