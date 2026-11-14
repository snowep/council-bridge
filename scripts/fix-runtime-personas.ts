import { createDatabase } from '../src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const db = createDatabase('data/council.db');

// Backup database
const backupDir = path.join(process.cwd(), 'data', 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `council_pre_remediation_${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
fs.copyFileSync('data/council.db', backupPath);
console.log('Backup created:', backupPath);

// 1. Get all staff runtime mappings from runtime_personas
const staffRuntimes = db.query('SELECT * FROM runtime_personas');
console.log('Found', staffRuntimes.length, 'runtime persona records (all staff)');

// 2. Get all staff agents to verify
const staffAgents = db.query('SELECT staff_id FROM staff_agents');
const staffIds = new Set(staffAgents.map(s => s.staff_id));
console.log('Staff agents:', staffIds.size);

// 3. Verify all runtime_personas are staff (not Council)
let allStaff = true;
for (const r of staffRuntimes) {
  if (!staffIds.has(r.persona_id)) {
    console.log('WARNING: Found non-staff persona_id:', r.persona_id);
    allStaff = false;
  }
}
console.log('All runtime_personas are staff mappings:', allStaff);

// 4. Create staff_runtime_personas table
console.log('\n=== Creating staff_runtime_personas table ===');
db.db.exec(`
  CREATE TABLE IF NOT EXISTS staff_runtime_personas (
    runtime TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    PRIMARY KEY (runtime, staff_id),
    FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
  );
`);

// 5. Migrate staff runtime mappings
console.log('Migrating staff runtime mappings...');
db.db.pragma('foreign_keys = OFF');
try {
  for (const r of staffRuntimes) {
    db.db.prepare('INSERT OR IGNORE INTO staff_runtime_personas (runtime, staff_id) VALUES (?, ?)').run(r.runtime, r.persona_id);
  }
} finally {
  db.db.pragma('foreign_keys = ON');
}

// 6. Verify migration
const migrated = db.query('SELECT * FROM staff_runtime_personas');
console.log('Migrated records:', migrated.length);
const claudeCount = migrated.filter(r => r.runtime === 'claude').length;
const hermesCount = migrated.filter(r => r.runtime === 'hermes').length;
console.log('  claude:', claudeCount, 'hermes:', hermesCount);

// 7. Clear runtime_personas (all were staff, no Council personas exist)
console.log('\nClearing runtime_personas (no Council personas exist)...');
db.db.exec('DELETE FROM runtime_personas;');

// 8. Verify cleanup
const remaining = db.query('SELECT * FROM runtime_personas');
console.log('Remaining runtime_personas:', remaining.length);

// 9. Verify staff_runtime_personas FK
console.log('\n=== foreign_key_check ===');
const fk = db.query('PRAGMA foreign_key_check');
if (fk.length === 0) {
  console.log('  OK - no violations');
} else {
  for (const f of fk) console.log('  VIOLATION:', f);
}

// 10. Verify integrity
console.log('\n=== integrity_check ===');
const integrity = db.query('PRAGMA integrity_check');
console.log('  ', integrity);

// 11. Verify staff agents still intact
const staff = db.query('SELECT COUNT(*) as c FROM staff_agents');
console.log('\nStaff agents:', staff[0].c);

db.close();