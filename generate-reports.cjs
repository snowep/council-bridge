const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'database-audit-bundle', 'council-bridge-audit.db');
const db = new Database(dbPath, { readonly: true });

// Integrity Report
let output = '# Integrity Report\n\n## PRAGMA integrity_check\n\n```\n';
const integrity = db.pragma('integrity_check');
output += JSON.stringify(integrity, null, 2);
output += '\n```\n\n## PRAGMA foreign_key_check\n\n';
const fkCheck = db.pragma('foreign_key_check');
if (fkCheck.length === 0) {
  output += 'OK - No foreign key violations';
} else {
  output += '```\n' + JSON.stringify(fkCheck, null, 2) + '\n```';
}
output += '\n\n## Database Info\n\n| Property | Value |\n|----------|-------|\n';
const pageSize = db.pragma('page_size');
const pageCount = db.pragma('page_count');
const freelistCount = db.pragma('freelist_count');
const schemaVersion = db.pragma('schema_version');
const userVersion = db.pragma('user_version');
const journalMode = db.pragma('journal_mode');
const foreignKeys = db.pragma('foreign_keys');
const encoding = db.pragma('encoding');
output += '| Page Size | ' + pageSize + ' |\n';
output += '| Page Count | ' + pageCount + ' |\n';
output += '| Free Pages | ' + freelistCount + ' |\n';
output += '| Schema Version | ' + schemaVersion + ' |\n';
output += '| User Version | ' + userVersion + ' |\n';
output += '| Journal Mode | ' + journalMode + ' |\n';
output += '| Foreign Keys | ' + foreignKeys + ' |\n';
output += '| Encoding | ' + encoding + ' |\n';
output += '| Database Size | ' + (pageSize * pageCount) + ' bytes (' + Math.round(pageSize * pageCount / 1024 / 1024) + ' MB) |\n';

fs.writeFileSync(path.join(process.cwd(), 'database-audit-bundle', 'integrity-report.md'), output);
console.log('Written integrity-report.md');

// Migration Ledger
let migrationOutput = '# Migration Ledger\n\n';
migrationOutput += '| Version | Applied At |\n';
migrationOutput += '|---------|------------|\n';

const migrations = db.prepare('SELECT * FROM schema_version ORDER BY applied_at').all();
for (const m of migrations) {
  migrationOutput += '| ' + m.version + ' | ' + m.applied_at + ' |\n';
}

migrationOutput += '\n### Migration Audit\n';
const audit = db.prepare('SELECT * FROM migration_audit ORDER BY migrated_at').all();
if (audit.length === 0) {
  migrationOutput += '(No migration audit records found)\n';
} else {
  migrationOutput += '| Migration ID | Source Table | Source PK | Action | Reason | Migrated At |\n';
  migrationOutput += '|--------------|--------------|-----------|--------|--------|-------------|\n';
  for (const a of audit) {
    migrationOutput += '| ' + a.migration_id + ' | ' + a.source_table + ' | ' + a.source_pk + ' | ' + a.action + ' | ' + a.reason + ' | ' + a.migrated_at + ' |\n';
  }
}

migrationOutput += '\n### Migration Ledger (from migration_ledger table)\n';
const ledger = db.prepare('SELECT * FROM migration_ledger ORDER BY applied_at').all();
migrationOutput += '| Migration ID | Filename | Checksum | Checksum Algo | Applied At | Applied By | Duration MS | Status | Backup Path | Notes |\n';
migrationOutput += '|--------------|----------|----------|---------------|------------|------------|-------------|--------|-------------|-------|\n';
for (const l of ledger) {
  migrationOutput += '| ' + l.migration_id + ' | ' + l.filename + ' | ' + l.checksum + ' | ' + l.checksum_algo + ' | ' + l.applied_at + ' | ' + l.applied_by + ' | ' + (l.duration_ms || '') + ' | ' + l.status + ' | ' + (l.backup_path || '') + ' | ' + (l.notes || '') + ' |\n';
}

fs.writeFileSync(path.join(process.cwd(), 'database-audit-bundle', 'migration-ledger.md'), migrationOutput);
console.log('Written migration-ledger.md');

db.close();