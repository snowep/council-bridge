# Repository Security Artifact Report

## Public Database Artifacts Identified

### 1. database-audit-bundle/council-bridge-audit.db

**Status**: REMOVED from current tree

**What it was**: A SQLite database (8.2 MB) containing a full audit snapshot of the Council Bridge database at 2026-11-15. Contains:
- All table schemas
- Historical data snapshots
- Migration records
- Configuration settings

**Security Classification**: 
- Contains no credentials or secrets
- Contains organizational data (divisions, staff, tasks, approvals)
- Historical data, not active production records

**Removal action**: Manually deleted and git-rm'd from tracking

### 2. Test-Database Artifacts from Git History

**Status**: Present in Git history (previous commits)

**Pattern**: `test-*.db`, `test-*.db-shm`, `test-*.db-wal`

**Files affected**:
- `test-backup-Ub9ow5/test.db` - Test backup
- `test-corrupt-*/corrupt.db`, `restored.db`, `test.db` - Corruption test data
- `test-data/prod-test-final.db`, `prod-test3.db` - Production-like test data
- `test-recovery-*/target.db`, `original.db` - Recovery test data
- `test-wal-*/test.db` - WAL mode test data
- `*.db-shm`, `*.db-wal` - SQLite WAL files

**Security Classification**:
- Test data mimicking production schema
- No real credentials (uses generated IDs)
- WAL/SHM files may contain transient data

**Removal from current tree**: COMPLETED
**Removal from Git history**: NOT PERFORMED

## Difference: Tree vs History Removal

### Removing from Current Tree (Completed)
```bash
git rm -r --cached test-* database-audit-bundle/
rm -rf test-* database-audit-bundle/
```

**Effect**: Files are no longer tracked. They can be re-added in future commits if needed.

### Purging from Git History (NOT Completed)
```bash
git filter-branch --tree-filter 'rm -rf test-* database-audit-bundle/' HEAD
# OR using BFG Repo-Cleaner
java -jar bfg.jar --delete-files *.db --no-blob-protection
```

**Effect**: Files are completely removed from all commits, including history. This:
- Reduces repository size permanently
- Removes all historical copies
- May break links to other commits (requires force-push)
- Is a breaking operation requiring Founder authorization

## Recommendation

The test artifacts and audit database in the current working tree have been removed from tracking. However, historical copies exist in Git history.

**Action Required**: Founder authorization needed to:
1. Permanently purge database files from Git history
2. Verify no sensitive data exists in historical commits
3. Force-push cleaned history (breaks CI for clones)

## Audit Trail

- Files removed: 1 database bundle (8.2 MB), 155 test directories (50+ files)
- Removal timestamp: 2026-11-16
- Removed by: Repository structure refactor
- Verification: All .db files now tracked in .gitignore
