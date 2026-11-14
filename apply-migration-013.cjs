const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = new Database('data/council.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read migration 013
const migrationPath = 'migrations/013_deliverable_workflow.sql';
const sql = fs.readFileSync(migrationPath, 'utf-8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');

console.log('Migration 013 checksum:', checksum);

// Check if already in ledger
const existing = db.prepare('SELECT * FROM migration_ledger WHERE migration_id = ?').get('013');
if (existing) {
  console.log('Already in ledger:', existing);
  db.close();
  process.exit(0);
}

// Create backup first
const backupDir = 'data/backups';
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const backupPath = path.join(backupDir, 'council_pre_013_' + timestamp + '.db');

// Use VACUUM INTO for binary backup
const escapedPath = backupPath.replace(/\\/g, '\\\\');
db.exec("VACUUM INTO '" + escapedPath + "'");
console.log('Backup created:', backupPath);

// Verify backup
const backupDb = new Database(backupPath, { readonly: true });
const integrity = backupDb.prepare('PRAGMA integrity_check').get();
backupDb.close();
console.log('Backup integrity:', integrity.integrity_check);

// Record in ledger
db.prepare(`
  INSERT INTO migration_ledger
  (migration_id, filename, checksum, applied_at, applied_by, duration_ms, status, backup_path, notes)
  VALUES (?, ?, ?, datetime('now'), ?, ?, 'success', ?, ?)
`).run('013', '013_deliverable_workflow.sql', checksum, 'system', 0, backupPath, JSON.stringify({ targetTables: ['deliverables', 'deliverable_versions', 'quality_thresholds'] }));

console.log('Migration 013 recorded in ledger');

db.close();