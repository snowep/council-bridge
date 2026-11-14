# Phase 10 Batch 1: Backup and Restore Guide

## Overview

This guide documents the SQLite-safe backup and restoration procedures for the Council Bridge database. The system uses SQLite's VACUUM INTO for binary backups (which properly handles WAL mode) and provides verified, timestamped backups with integrity checking.

## Backup System

### Backup Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **binary** | VACUUM INTO - creates standalone .db file with WAL checkpointed | Production backups, pre-migration |
| **schema_dump** | SQL CREATE statements only | Schema migration, version control |
| **full_dump** | Schema + INSERT statements for all data | Full data export, debugging |

### Creating Backups

#### Via CLI
```bash
# Binary backup (recommended for production)
npx tsx src/migration-runner/cli.ts backup --method binary --prefix council

# Schema dump
npx tsx src/migration-runner/cli.ts backup --method schema_dump --prefix council_schema

# Full dump
npx tsx src/migration-runner/cli.ts backup --method full_dump --prefix council_full
```

#### Via Code
```typescript
import { BackupManager } from './src/migration-runner/backup.js';

const backupManager = new BackupManager('data/backups');

const result = await backupManager.createBackup(
  'data/council.db',
  { method: 'binary', verify: true, compress: false, retentionDays: 30 },
  'council_pre_migration_013'
);

console.log('Backup created:', result.backupPath);
console.log('Verified:', result.verified);
console.log('Size:', result.sizeBytes, 'bytes');
```

### Backup File Naming
```
{prefix}_{timestamp}_{random}.db
Example: council_pre_013_2026-11-14_20-22-59_abc123.db
```

### Backup Verification

All binary backups are automatically verified:
1. **Integrity Check**: `PRAGMA integrity_check` returns "ok"
2. **WAL Consistency**: VACUUM INTO checkpoints WAL before writing
3. **File Existence**: Confirms backup file created with content > 0

### Pre-Migration Backups

The migration runner automatically creates a binary backup before each migration:
- Stored in `data/backups/`
- Named: `council_pre_{migrationId}_{timestamp}_{random}.db`
- Path recorded in migration ledger
- Verified before migration proceeds

### Backup Retention

Default retention: 30 days
```bash
# Cleanup old backups (run periodically)
npx tsx -e "
import { BackupManager } from './src/migration-runner/backup.js';
const bm = new BackupManager('data/backups');
const deleted = bm.cleanupOldBackups();
console.log('Deleted', deleted, 'old backups');
"
```

## Restore System

### Restore Procedures

#### Binary Restore (Recommended)
```bash
# Via CLI
npx tsx src/migration-runner/cli.ts restore council_pre_013_2026-11-14_20-22-59_abc123.db

# Via Code
import { BackupManager } from './src/migration-runner/backup.js';
const backupManager = new BackupManager('data/backups');
await backupManager.restoreBackup(
  'data/backups/council_pre_013_2026-11-14_20-22-59_abc123.db',
  'data/council.db'
);
```

#### SQL Dump Restore
```bash
# Schema dump
npx tsx src/migration-runner/cli.ts restore council_schema_2026-11-14_20-22-59_abc123.sql

# Full dump
npx tsx src/migration-runner/cli.ts restore council_full_2026-11-14_20-22-59_abc123.sql
```

### Restore Validation

Before restoration, the system:
1. **Verifies backup file exists**
2. **Validates file format** (.db for binary, .sql for dumps)
3. **For binary**: Opens as readonly and runs `PRAGMA integrity_check`
4. **For SQL**: Checks file size > 0

### Restoration Process

**Binary Restore (uses better-sqlite3 backup API):**
```typescript
async restoreBackup(backupPath: string, targetDbPath: string): Promise<void> {
  const src = new Database(backupPath, { readonly: true });
  await src.backup(targetDbPath);  // Properly awaited
  src.close();
}
```

**SQL Dump Restore:**
```typescript
const sql = fs.readFileSync(backupPath, 'utf-8');
const db = new Database(targetDbPath);
db.exec(sql);
db.close();
```

### Post-Restore Verification

After restoration, always verify:
```bash
# Check integrity
sqlite3 data/council.db "PRAGMA integrity_check;"

# Check foreign keys
sqlite3 data/council.db "PRAGMA foreign_key_check;"

# Verify schema
sqlite3 data/council.db ".schema"
```

Or via code:
```typescript
const db = new Database('data/council.db', { readonly: true });
const integrity = db.prepare('PRAGMA integrity_check').get();
const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
console.log('Integrity:', integrity.integrity_check);
console.log('FK Violations:', fkCheck.length);
db.close();
```

## WAL Mode Handling

### Why WAL Matters
- SQLite WAL (Write-Ahead Logging) mode writes changes to `-wal` file
- Main database file may be stale until checkpoint
- Simple file copy misses WAL data → corrupted backup

### How We Handle WAL

**Backup (VACUUM INTO):**
```sql
VACUUM INTO '/path/to/backup.db';
```
- Automatically checkpoints WAL (`TRUNCATE` mode)
- Creates consistent standalone database
- No `-wal` or `-shm` files needed for restore

**Verification:**
```typescript
private verifyBinaryBackup(backupPath: string): boolean {
  const db = new Database(backupPath, { readonly: true });
  const result = db.prepare('PRAGMA integrity_check').get();
  db.close();
  return result.integrity_check === 'ok';
}
```

**Restore:**
- Restored database opens in WAL mode automatically
- New `-wal` and `-shm` files created on first write

## Production Backup Strategy

### Scheduled Backups
```bash
# Add to cron (daily at 2 AM)
0 2 * * * /usr/bin/node -e "
  const { BackupManager } = require('./src/migration-runner/backup.js');
  const bm = new BackupManager('data/backups');
  bm.createBackup('data/council.db', { method: 'binary', verify: true }, 'council_daily');
  bm.cleanupOldBackups();
" >> /var/log/council-backup.log 2>&1
```

### Pre-Deployment Backup
```bash
# Before any production migration
NODE_ENV=production npx tsx src/migration-runner/cli.ts backup --method binary --prefix council_pre_deploy
NODE_ENV=production npx tsx src/migration-runner/cli.ts run --confirm-production
```

### Disaster Recovery
```bash
# 1. Identify last known good backup
ls -la data/backups/council_pre_*.db | tail -5

# 2. Stop application
# (Ensure no active connections to database)

# 3. Restore
npx tsx src/migration-runner/cli.ts restore council_pre_013_2026-11-14_20-22-59_abc123.db

# 4. Verify
sqlite3 data/council.db "PRAGMA integrity_check; PRAGMA foreign_key_check;"

# 5. Restart application
```

## Troubleshooting

### Backup Fails: "output file already exists"
**Cause**: Rapid successive backups with same timestamp
**Fix**: Backup manager now adds random suffix - ensure using latest code

### Restore Fails: "database is locked"
**Cause**: Active connections to target database
**Fix**: Stop all applications/processes using the database before restore

### Integrity Check Fails After Restore
**Cause**: Corrupted backup file or incomplete restore
**Fix**: 
1. Verify backup with `PRAGMA integrity_check` on backup file
2. Ensure restore completed fully (check file size matches)
3. Try different backup file

### WAL Files Not Cleaned Up
**Cause**: Application crashed with open transaction
**Fix**: 
```bash
# Manual checkpoint
sqlite3 data/council.db "PRAGMA wal_checkpoint(TRUNCATE);"
# Then remove -wal/-shm if they persist
```

## Security Considerations

1. **Backup files contain all data** - Protect with filesystem permissions
2. **No external transmission** - Backups stay local
3. **Verify before restore** - Always run integrity check
4. **Production access** - Require `--confirm-production` flag
5. **Retention policy** - Automatic cleanup prevents disk exhaustion

## Quick Reference

| Operation | Command |
|-----------|---------|
| Create binary backup | `npx tsx src/migration-runner/cli.ts backup -m binary` |
| Create schema dump | `npx tsx src/migration-runner/cli.ts backup -m schema_dump` |
| List backups | `ls -la data/backups/` |
| Restore binary | `npx tsx src/migration-runner/cli.ts restore <file.db>` |
| Restore SQL | `npx tsx src/migration-runner/cli.ts restore <file.sql>` |
| Verify integrity | `sqlite3 data/council.db "PRAGMA integrity_check;"` |
| Check FK | `sqlite3 data/council.db "PRAGMA foreign_key_check;"` |
| Manual WAL checkpoint | `sqlite3 data/council.db "PRAGMA wal_checkpoint(TRUNCATE);"` |
| Cleanup old | `npx tsx -e "require('./src/migration-runner/backup.js').cleanupOldBackups()"` |

## Production Deployment Procedure

1. **Pre-deployment**: Create verified binary backup
2. **Deploy**: Run migrations with `--confirm-production`
3. **Verify**: Run integrity checks post-migration
4. **Monitor**: Check application logs for errors
5. **Rollback plan**: Keep pre-deployment backup for 48 hours minimum