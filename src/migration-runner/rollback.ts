// Migration Rollback Engine
// Provides rollback functionality for migrations using backups and transaction safety

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import { MigrationLedger } from './ledger.js';
import { BackupManager } from './backup.js';
import { MigrationRegistry } from './registry.js';
import { Migration } from './registry.js';

export interface RollbackResult {
  success: boolean;
  migration_id: string;
  error?: string;
  restored_schema?: string;
  data_integrity?: boolean;
  was_safe?: boolean;
}

export interface RollbackOptions {
  dryRun?: boolean;
  force?: boolean;
  method?: 'backup' | 'reapply';
  targetDbPath?: string; // Override target database path for restore
}

export class RollbackEngine {
  private db: Database.Database;
  private ledger: MigrationLedger;
  private backupManager: BackupManager;
  private registry: MigrationRegistry;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private targetDbPath: string;

  constructor(
    db: Database.Database,
    ledger: MigrationLedger,
    backupManager: BackupManager,
    registry: MigrationRegistry,
    targetDbPath?: string
  ) {
    this.db = db;
    this.ledger = ledger;
    this.backupManager = backupManager;
    this.registry = registry;
    this.targetDbPath = targetDbPath ?? this.getDefaultDbPath(db);
  }

  private getDefaultDbPath(db: Database.Database): string {
    // Try to get path from database object; fall back to standard path
    // better-sqlite3 Database has a .name property containing the path
    const dbName = (db as any).name;
    if (dbName && typeof dbName === 'string' && dbName !== ':memory:') {
      return dbName;
    }
    return 'data/council.db';
  }

  /**
   * Check if a rollback is safe (backup exists and migration was successful)
   */
  isRollbackSafe(migrationId: string): { safe: boolean; reason?: string } {
    const entry = this.ledger.getAll().find(e => e.migration_id === migrationId);

    if (!entry) {
      return { safe: false, reason: 'Migration not found in ledger' };
    }

    if (entry.status !== 'success') {
      return { safe: false, reason: `Migration status is ${entry.status}, not successful` };
    }

    if (!entry.backup_path || entry.backup_path === '') {
      return { safe: false, reason: 'No backup available for rollback' };
    }

    if (!fs.existsSync(entry.backup_path)) {
      return { safe: false, reason: 'Backup file no longer exists' };
    }

    return { safe: true };
  }

  /**
   * Perform a safe rollback of a single migration
   */
  async rollback(migrationId: string, options: RollbackOptions = {}): Promise<RollbackResult> {
    const { dryRun = false, force = false, method = 'backup' } = options;

    // Check if rollback is safe (unless forced)
    if (!force) {
      const safetyCheck = this.isRollbackSafe(migrationId);
      if (!safetyCheck.safe) {
        return {
          success: false,
          migration_id: migrationId,
          error: safetyCheck.reason
        };
      }
    }

    const ledgerEntry = this.ledger.getAll().find(e => e.migration_id === migrationId);

    if (!ledgerEntry) {
      return {
        success: false,
        migration_id: migrationId,
        error: 'Migration not found in ledger'
      };
    }

    if (ledgerEntry.status !== 'success') {
      return {
        success: false,
        migration_id: migrationId,
        error: `Cannot rollback migration with status: ${ledgerEntry.status}`
      };
    }

    if (dryRun) {
      return {
        success: true,
        migration_id: migrationId,
        error: undefined,
        was_safe: true
      };
    }

    try {
      // Start transaction for safety
      const stmt = this.db.prepare('BEGIN IMMEDIATE TRANSACTION');
      stmt.run();

      try {
        let success = false;

        if (method === 'backup' && ledgerEntry.backup_path) {
          // Restore from backup (throws on failure)
          await this.backupManager.restoreBackup(ledgerEntry.backup_path, this.targetDbPath);
          success = true;
        } else {
          // Fallback: record rollback attempt without actual restoration
          throw new Error('Only backup-based rollback is supported. Use method: "backup"');
        }

        // Record rollback in ledger
        this.ledger.recordRolledBack(
          migrationId,
          ledgerEntry.filename,
          ledgerEntry.checksum,
          ledgerEntry.backup_path,
          'rollback_engine',
          { method, success, restored_schema: 'from_backup' }
        );

        // Commit transaction
        this.db.prepare('COMMIT').run();

        return {
          success: true,
          migration_id: migrationId,
          was_safe: true
        };

      } catch (rollbackError) {
        // Rollback transaction on failure
        this.db.prepare('ROLLBACK').run();
        throw rollbackError;
      }

    } catch (error) {
      return {
        success: false,
        migration_id: migrationId,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Rollback to a specific migration (roll back all migrations after this one)
   */
  async rollbackTo(migrationId: string, options: RollbackOptions = {}): Promise<RollbackResult[]> {
    const results: RollbackResult[] = [];

    // Get all successful migrations in reverse chronological order
    const applied = this.ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    const targetIndex = applied.findIndex(e => e.migration_id === migrationId);

    if (targetIndex === -1) {
      return [{
        success: false,
        migration_id: migrationId,
        error: 'Target migration not found or not successful in ledger'
      }];
    }

    const toRollback = applied.slice(0, targetIndex);

    // Try to rollback each migration
    let stopOnError = options.force ? false : true;

    for (const entry of toRollback) {
      const result = await this.rollback(entry.migration_id, options);
      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Rollback all applied migrations (in reverse order)
   */
  async rollbackAll(options: RollbackOptions = {}): Promise<RollbackResult[]> {
    const applied = this.ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    const results: RollbackResult[] = [];

    let stopOnError = !options.force;

    for (const entry of applied) {
      const result = await this.rollback(entry.migration_id, options);
      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Get migration history with rollback status
   */
  getRollbackHistory(): {
    id: string;
    status: 'success' | 'failed' | 'rolled_back';
    rolled_back_by?: string;
    rolled_back_at?: string;
    backup_available?: boolean;
  }[] {
    return this.ledger.getAll().map(entry => ({
      id: entry.migration_id,
      status: entry.status as 'success' | 'failed' | 'rolled_back',
      rolled_back_by: entry.status === 'rolled_back' ? (entry.notes as any)?.method : undefined,
      rolled_back_at: entry.status === 'rolled_back' ? entry.applied_at : undefined,
      backup_available: !!(entry.backup_path && entry.backup_path !== '')
    }));
  }

  /**
   * Verify a rollback would be safe (without actually rolling back)
   */
  verifyRollbackTarget(migrationId: string): {
    safe: boolean;
    issues: string[];
    can_proceed: boolean;
  } {
    const issues: string[] = [];

    const entry = this.ledger.getAll().find(e => e.migration_id === migrationId);

    if (!entry) {
      issues.push('Migration not found in ledger');
      return { safe: false, issues, can_proceed: false };
    }

    if (entry.status !== 'success') {
      issues.push(`Migration status is ${entry.status}`);
      return { safe: false, issues, can_proceed: false };
    }

    if (!entry.backup_path || entry.backup_path === '') {
      issues.push('No backup available');
      return { safe: false, issues, can_proceed: false };
    }

    if (!fs.existsSync(entry.backup_path)) {
      issues.push('Backup file does not exist');
      return { safe: false, issues, can_proceed: false };
    }

    // Check if there are any migrations after this one
    const applied = this.ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    const targetIndex = applied.findIndex(e => e.migration_id === migrationId);

    if (targetIndex > 0) {
      issues.push(`${targetIndex} migration(s) applied after this one will also be rolled back`);
    }

    return {
      safe: true,
      issues,
      can_proceed: issues.filter(i => i.includes('not found') || i.includes('does not exist')).length === 0
    };
  }
}

/**
 * Create a RollbackEngine instance with proper dependencies
 */
export function createRollbackEngine(
  db: Database.Database,
  options?: {
    ledger?: MigrationLedger;
    registry?: MigrationRegistry;
    backupDir?: string;
    targetDbPath?: string;
  }
): RollbackEngine {
  const actualLedger = options?.ledger ?? new MigrationLedger(db);
  const actualRegistry = options?.registry ?? new MigrationRegistry();
  const backupManager = new BackupManager(options?.backupDir ?? 'data/backups');

  return new RollbackEngine(db, actualLedger, backupManager, actualRegistry, options?.targetDbPath);
}