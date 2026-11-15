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
const pageSize = db.pragma('page_size')[0].page_size;
const pageCount = db.pragma('page_count')[0].page_count;
const freelistCount = db.pragma('freelist_count')[0].freelist_count;
const schemaVersion = db.pragma('schema_version')[0].schema_version;
const userVersion = db.pragma('user_version')[0].user_version;
const journalMode = db.pragma('journal_mode')[0].journal_mode;
const foreignKeys = db.pragma('foreign_keys')[0].foreign_keys;
const encoding = db.pragma('encoding')[0].encoding;
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

db.close();