# Phase 8 Reliability Plan

## Current Reliability State

### Database Reliability

**Current Implementation:**
- SQLite with WAL mode
- Explicit transactions (beginTransaction/commitTransaction/rollbackTransaction)
- Prepared statements for all queries
- No connection pooling (file-based)

**Strengths:**
- ACID transactions supported
- WAL mode enables concurrent reads
- Simple backup mechanism (file copy)

**Weaknesses:**
- No built-in replication
- File-based concurrency limits
- No automatic failover
- No monitoring/recovery alerts

### Migration Reliability

**Current Implementation:**
- Sequential migrations (001-006)
- Migration verification tests
- Backup before each migration
- Checksum verification planned

**Status:** Phase 7 migration 006 complete, verified.

### Execution Reliability

**Current State:**
- `executeExecutionRequest()` runs synchronously
- Immediate status updates
- History recorded on transitions
- No timeout handling
- No retry mechanism

### Audit Reliability

**Current State:**
- `execution_history` table immutable by design
- `memory_access` records all access
- No tamper detection
- No backup mechanism

## Reliability Requirements

### R1: Database Integrity
Database must remain consistent and recoverable.

### R2: Execution Durability
Incomplete executions can be resumed or rolled back.

### R3: Audit Preservation
Audit records must be preserved and tamper-evident.

### R4: Graceful Degradation
System continues operating with partial functionality on failure.

### R5: Recovery Automation
Common failure scenarios recovered automatically.

## Proposed Reliability Controls

### Control 1: Automated Backups

**Implementation:**
```typescript
// src/database.ts
class DatabaseInstance {
  async createBackup(tag?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.dbPath}.backup-${tag || timestamp}`;
    
    // Close database to ensure clean backup
    this.close();
    
    // Copy file
    await fs.promises.copyFile(this.dbPath, backupPath);
    
    // Copy WAL files
    await Promise.all([
      fs.promises.copyFile(`${this.dbPath}-wal`, `${backupPath}-wal`),
      fs.promises.copyFile(`${this.dbPath}-shm`, `${backupPath}-shm`)
    ].filter(p => fs.existsSync(p[0])));
    
    // Reopen
    this.reopen();
    
    return backupPath;
  }
  
  async restoreBackup(backupPath: string): Promise<void> {
    this.close();
    await fs.promises.copyFile(backupPath, this.dbPath);
    await fs.promises.copyFile(`${backupPath}-wal`, `${this.dbPath}-wal`);
    await fs.promises.copyFile(`${backupPath}-shm`, `${this.dbPath}-shm`);
    this.reopen();
  }
}
```

**Schedule:**
- Daily full backup
- Hourly WAL archiving
- Pre-migration backup

### Control 2: Migration Rollback Capability

**Current:** Manual backup restoration

**Proposed:**
```typescript
// migrations/migration-runner.ts
class MigrationRunner {
  private migrationHistory: Migration[] = [];
  
  async runMigration(migration: Migration): Promise<ExecutionResult> {
    const backup = await this.db.createBackup(`pre-${migration.id}`);
    
    try {
      await this.db.beginTransaction();
      await migration.up();
      await this.updateLedger(migration);
      await this.db.commitTransaction();
      
      // Update backup - migration complete
      await this.archiveBackup(backup);
      
      return { success: true };
    } catch (error) {
      await this.db.rollbackTransaction();
      await this.restoreBackup(backup);
      
      return { success: false, error, rolledBack: true };
    }
  }
}
```

**Additional:**
- Migration checksum verification
- Rollback script generation
- Ledger-based migration history

### Control 3: Transaction Monitoring

**Implementation:**
```typescript
// src/database.ts
class TransactionMonitor {
  private activeTransactions: Map<string, {start: number, statement: string}> = new Map();
  private readonly TIMEOUT = 30000; // 30 seconds
  
  begin(name: string) {
    const id = crypto.randomUUID();
    this.activeTransactions.set(id, {
      start: Date.now(),
      statement: name
    });
    return id;
  }
  
  commit(id: string) {
    this.activeTransactions.delete(id);
  }
  
  rollback(id: string) {
    this.activeTransactions.delete(id);
  }
  
  checkTimeouts(): void {
    const now = Date.now();
    for (const [id, tx] of this.activeTransactions) {
      if (now - tx.start > this.TIMEOUT) {
        console.warn(`Long-running transaction: ${tx.statement}`);
        // Could trigger alert or force rollback
      }
    }
  }
}
```

### Control 4: Execution Recovery

**Problem:** If process dies during `executeExecutionRequest()`, execution is left in 'running' state.

**Solution:**
```typescript
// src/council.ts
async function recoverInterruptedExecutions(): Promise<void> {
  // Find executions in 'running' state that haven't updated in 5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const stuck = await dbInstance.stmt.getStuckExecutions.all(cutoff);
  
  for (const exec of stuck) {
    // Mark as failed with timeout reason
    await dbInstance.stmt.updateExecutionRequest.run(
      exec.task_id, exec.requested_by_type, exec.requested_by_id,
      exec.autonomy_level, exec.action_description, exec.action_payload,
      'failed', exec.approval_request_id, exec.approval_id,
      exec.permission_grants, 'Execution timeout - process interrupted',
      exec.result_payload, exec.started_at, null, exec.execution_id
    );
    
    // Record failure history
    await dbInstance.stmt.insertExecutionHistory.run(
      generateId(), exec.execution_id, exec.task_id,
      exec.requested_by_type, exec.requested_by_id,
      exec.autonomy_level, exec.action_description, exec.action_payload,
      'running', 'failed', exec.approval_request_id,
      exec.permission_grants, null, 'Process interrupted',
      ctx.owner_type, ctx.owner_id, new Date().toISOString(), null
    );
  }
}
```

**Schedule:** Run at startup and periodically

### Control 5: Audit Log Integrity

**Problem:** Memory access and execution history can be modified.

**Solution:**
```sql
-- Create read-only audit views
CREATE VIEW IF NOT EXISTS execution_history_audit AS
SELECT * FROM execution_history;

-- Add hash chain verification (application-level)
-- Each entry includes hash of previous entry
```

**Implementation:**
```typescript
// src/council.ts
function addHistoryEntry(hashPrev?: string): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify({
      ...entry,
      prev_hash: hashPrev
    }))
    .digest('hex');
  
  return hash;
}
```

### Control 6: Graceful Shutdown

**Implementation:**
```typescript
// src/server.ts
class GracefulShutdown {
  private shuttingDown = false;
  private pendingRequests = 0;
  private shutdownTimeout = 30000; // 30 seconds
  
  startShutdown(signal: string) {
    this.shuttingDown = true;
    
    // Stop accepting new requests
    this.server.close(() => {
      console.log('Server closed');
    });
    
    // Wait for pending requests
    setTimeout(() => {
      console.log('Forcing shutdown after timeout');
      process.exit(1);
    }, this.shutdownTimeout);
  }
  
  waitForPending() {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.pendingRequests === 0) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 100);
    });
  }
}
```

## Reliability Monitoring

### Key Metrics

| Metric | Description | Threshold |
|--------|-------------|-----------|
| Database size | Growth rate | Alert at 10%/month |
| Active transactions | Long-running txs | Alert > 30s |
| Failed executions | Execution failures | Alert > 5% |
| Stuck executions | Interrupted runs | Auto-recover |
| Transaction rollbacks | Rollback frequency | Alert > 10/day |

### Health Check Endpoint

```typescript
// src/server.ts
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabaseHealth(),
    migrations: await checkMigrationStatus(),
    executions: await checkExecutionQueue(),
    backups: await checkBackupStatus(),
    memory: process.memoryUsage()
  };
  
  const healthy = Object.values(checks).every(c => c?.healthy ?? false);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

### Database Health Check

```typescript
async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await db.db.prepare('SELECT 1').get();
    const latency = Date.now() - start;
    
    // Check for pending migrations
    const version = await db.db.prepare('SELECT MAX(version) as max FROM schema_version').get();
    
    // Check database size
    const stats = fs.statSync(dbPath);
    
    return {
      healthy: latency < 1000,
      latency,
      size: stats.size,
      version: version?.max ?? 0
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

## Recovery Scenarios

### Scenario 1: Database Corruption

**Detection:**
- WAL apply failures
- Checksum mismatches
- Query failures

**Recovery:**
1. Switch to last known good backup
2. Re-run migrations from backup point
3. Restore any unbacked-up data

### Scenario 2: Process Crash During Migration

**Detection:**
- Migration not marked complete
- Ledger entry missing

**Recovery:**
1. Check ledger for pending migration
2. Verify partial migration status
3. Rollback or complete manually

### Scenario 3: Interrupted Execution

**Detection:**
- Execution stuck in 'running'
- No heartbeat for 5+ minutes

**Recovery:**
1. Auto-mark as failed
2. Record failure reason
3. Alert operators

### Scenario 4: Disk Full

**Detection:**
- Write failures
- Low disk space alert

**Recovery:**
1. Alert operator immediately
2. Clean old backups/temporary files
3. If possible, continue with limited capacity

## Backup Strategy

### Types of Backups

1. **Full Database Backup** - Complete copy of database file
2. **WAL Archive** - Transaction logs for point-in-time recovery
3. **Logical Backup** - SQL dump of schema and data

### Schedule

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full | Daily | 30 days |
| WAL | Hourly | 24 hours |
| Pre-migration | Before each | Until verified |
| Config | On change | 90 days |

### Storage

- Local filesystem only (no cloud)
- Separate directory from database
- Versioned with timestamps
- Compressed on older versions

## Testing for Reliability

### Unit Tests

```typescript
// test/database-recovery.test.ts
describe('Database Recovery', () => {
  test('backup and restore cycle');
  test('rollback on migration failure');
  test('WAL replay after crash');
  test('checksum verification');
});
```

### Integration Tests

```
- Crash simulation during execution
- Migration failure and rollback
- Disk full scenario
- Concurrent write stress test
```

### Chaos Engineering (Optional)

```
- Random process kills
- Disk latency injection
- Network partition simulation
- Clock skew testing
```

## Implementation Priority

### Phase 1: Critical (Week 1)
- Graceful shutdown handling
- Health check endpoint
- Recovery for interrupted executions
- Backup automation

### Phase 2: Important (Week 2)
- Transaction monitoring
- Database health checks
- Migration rollback
- WAL archiving

### Phase 3: Nice-to-have (Week 3)
- Audit log integrity
- Chaos testing framework
- Alert integration
- Performance benchmarks

## Rollback Plan

If reliability controls cause issues:

1. **Immediate:** Disable automatic recovery, enable manual mode
2. **Short-term:** Disable backup automation, use manual backups
3. **Long-term:** Fix issues and re-enable

**Rollback triggers:**
- Backup failures > 5%
- Recovery failures
- Performance impact > 50%

## Dependencies

- Node.js fs/promises for file operations
- Crypto module for checksums
- No external backup services
- Compatible with existing TypeScript setup