import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');

const schema = db.query('PRAGMA table_info(memory_entries)');
console.log('=== memory_entries schema ===');
for (const s of schema) console.log(s.name, s.type);

db.close();