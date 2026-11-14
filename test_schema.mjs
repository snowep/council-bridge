import { createDatabase } from './src/database.js';

const db = createDatabase(':memory:');
const sql = db.query('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'deliverables'])[0].sql;
const idx = sql.indexOf('CHECK (status IN');
console.log('CHECK:', sql.substring(idx, idx + 80));

const versions = db.query('SELECT * FROM schema_version ORDER BY applied_at');
console.log('Schema versions:', versions);

db.close();