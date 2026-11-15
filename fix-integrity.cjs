const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'database-audit-bundle', 'council-bridge-audit.db');
const db = new Database(dbPath, { readonly: true });

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
output += '| Page Size | ' + JSON.stringify(pageSize) + ' |\n';
output += '| Page Count | ' + JSON.stringify(pageCount) + ' |\n';
output += '| Free Pages | ' + JSON.stringify(freelistCount) + ' |\n';
output += '| Schema Version | ' + JSON.stringify(schemaVersion) + ' |\n';
output += '| User Version | ' + JSON.stringify(userVersion) + ' |\n';
output += '| Journal Mode | ' + JSON.stringify(journalMode) + ' |\n';
output += '| Foreign Keys | ' + JSON.stringify(foreignKeys) + ' |\n';
output += '| Encoding | ' + JSON.stringify(encoding) + ' |\n';
output += '| Database Size | ' + (pageSize * pageCount) + ' bytes (' + Math.round(pageSize * pageCount / 1024 / 1024) + ' MB) |\n';

fs.writeFileSync(path.join(process.cwd(), 'database-audit-bundle', 'integrity-report.md'), output);
console.log('Written integrity-report.md');

db.close();