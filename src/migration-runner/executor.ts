import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import { Migration, MigrationRegistry } from './registry.js';
import { MigrationLedger } from './ledger.js';
import { BackupManager, BackupResult } from './backup.js';
import { Validator, ValidationResult } from './validator.js';

export interface MigrationExecutionContext {
  db: Database.Database;
  migration: Migration;
  backupPath: string;
  options: {
    dryRun: boolean;
    force: boolean;
    transaction: boolean;
    timeout: number;
  };
  logger: Logger;
}

export interface ExecutionResult {
  success: boolean;
  durationMs: number;
  error?: Error;
  backupResult?: BackupResult;
  preValidation?: ValidationResult;
  postValidation?: ValidationResult;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message, ...context };
    console.log(JSON.stringify(entry));
  }
  debug(message: string, context?: Record<string, unknown>): void { this.log('debug', message, context); }
  info(message: string, context?: Record<string, unknown>): void { this.log('info', message, context); }
  warn(message: string, context?: Record<string, unknown>): void { this.log('warn', message, context); }
  error(message: string, context?: Record<string, unknown>): void { this.log('error', message, context); }
  fatal(message: string, context?: Record<string, unknown>): void { this.log('fatal', message, context); }
}

export class MigrationExecutor {
  private db: Database.Database;
  private registry: MigrationRegistry;
  private ledger: MigrationLedger;
  private backupManager: BackupManager;
  private validator: Validator;
  private logger: Logger;
  private dbPath: string;

  private getDefaultDbPath(db: Database.Database): string {
    // Try to get path from database object; fall back to standard path
    // better-sqlite3 Database has a .name property containing the path
    const dbName = (db as any).name;
    if (dbName && typeof dbName === 'string' && dbName !== ':memory:') {
      return dbName;
    }
    return 'data/council.db';
  }

  constructor(
    db: Database.Database,
    registry: MigrationRegistry,
    ledger: MigrationLedger,
    backupManager: BackupManager,
    validator: Validator,
    logger?: Logger
  ) {
    this.db = db;
    this.registry = registry;
    this.ledger = ledger;
    this.backupManager = backupManager;
    this.validator = validator;
    this.logger = logger || new ConsoleLogger();
    this.dbPath = this.getDefaultDbPath(db);
  }

  async executeMigration(
    migrationId: string,
    options: {
      dryRun?: boolean;
      force?: boolean;
      transaction?: boolean;
      timeout?: number;
      createBackup?: boolean;
      appliedBy?: string;
    } = {}
  ): Promise<ExecutionResult> {
    const migration = this.registry.getById(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    const startTime = Date.now();
    const appliedBy = options.appliedBy || process.env.USER || 'system';
    let backupResult: BackupResult | undefined;
    let preValidation: ValidationResult | undefined;
    let postValidation: ValidationResult | undefined;

    this.logger.info(`Starting migration ${migrationId}`, {
      migration: migration.filename,
      type: migration.type,
      dryRun: options.dryRun
    });

    // Check if already applied
    if (this.ledger.isApplied(migrationId) && !options.force) {
      this.logger.warn(`Migration ${migrationId} already applied, skipping`, { migrationId });
      return {
        success: true,
        durationMs: Date.now() - startTime,
        error: new Error('Already applied')
      };
    }

    // Verify checksum
    const recordedChecksum = this.ledger.getChecksum(migrationId);
    if (recordedChecksum && recordedChecksum !== migration.checksum) {
      const error = new Error(`Checksum mismatch for ${migrationId}! File may have been tampered.`);
      this.logger.fatal('Checksum verification failed', { migrationId, recordedChecksum, currentChecksum: migration.checksum });
      throw error;
    }

    // Pre-flight validation
    preValidation = await this.validator.preMigrationValidation(migration);
    if (!preValidation.passed) {
      const error = new Error(`Pre-migration validation failed: ${preValidation.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`);
      this.logger.error('Pre-migration validation failed', { migrationId, checks: preValidation.checks });
      if (!options.force) {
        throw error;
      }
    }

    // Create backup
    if (options.createBackup !== false) {
      backupResult = await this.backupManager.createBackup(
        this.dbPath,
        { method: 'binary', verify: true },
        `council_pre_${migrationId}`
      );
      this.logger.info('Pre-migration backup created', {
        migrationId,
        backupPath: backupResult.backupPath,
        sizeBytes: backupResult.sizeBytes,
        verified: backupResult.verified
      });

      if (backupResult.verified === false) {
        const error = new Error('Backup integrity check failed');
        this.logger.error('Backup verification failed', { migrationId, backupPath: backupResult.backupPath });
        if (!options.force) {
          throw error;
        }
      }
    }

    if (options.dryRun) {
      this.logger.info('Dry run complete - migration not executed', { migrationId });
      return {
        success: true,
        durationMs: Date.now() - startTime,
        backupResult,
        preValidation
      };
    }

    // Execute migration - use schema-aware logic for migration 022
    let error: Error | undefined;
    let executedMigration = migration;
    try {
      // Migration 022 requires special handling - check schema before executing
      if (migration.id === '022') {
        // Verify prerequisites before executing
        const prereq = this.verifyMigration022Prerequisites();
        if (!prereq.success) {
          const err = new Error(`Prerequisite verification failed for migration ${migrationId}: migration 021 must be successfully applied first - ${prereq.error || 'unknown error'}`);
          this.logger.error(err.message, { migrationId });
          this.ledger.recordFailure(
            migration.id,
            migration.filename,
            migration.checksum,
            err,
            Date.now() - startTime,
            backupResult?.backupPath || '',
            appliedBy,
            { targetTables: migration.targetTables, reason: 'prerequisite_not_met' }
          );
          return {
            success: false,
            durationMs: Date.now() - startTime,
            error: err,
            backupResult,
            preValidation,
            postValidation
          };
        }
        const result = await this.executeMigration022(migration, backupResult, appliedBy);
        executedMigration = migration;
        return result;
      }

      // Standard migration execution path
      const sql = fs.readFileSync(migration.filepath, 'utf-8');
      // Migration SQL files contain their own transaction handling (BEGIN/COMMIT)
      // Don't wrap in additional transaction
      this.db.exec(sql);

      // Post-migration validation
      postValidation = await this.validator.postMigrationValidation(migration);

      if (!postValidation.passed) {
        error = new Error(`Post-migration validation failed: ${postValidation.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`);
        throw error;
      }

      // Record success in ledger
      const durationMs = Date.now() - startTime;
      this.ledger.recordSuccess(
        migration.id,
        migration.filename,
        migration.checksum,
        durationMs,
        backupResult?.backupPath || '',
        appliedBy,
        { targetTables: migration.targetTables }
      );

      this.logger.info(`Migration ${migrationId} completed successfully`, {
        durationMs,
        backupPath: backupResult?.backupPath
      });

      return {
        success: true,
        durationMs,
        backupResult,
        preValidation,
        postValidation
      };
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));

      this.logger.error(`Migration ${migrationId} failed`, {
        migrationId,
        error: error.message,
        durationMs: Date.now() - startTime
      });

      // Record failure in ledger
      this.ledger.recordFailure(
        executedMigration.id,
        executedMigration.filename,
        executedMigration.checksum,
        error,
        Date.now() - startTime,
        backupResult?.backupPath || '',
        appliedBy,
        { targetTables: executedMigration.targetTables }
      );

      return {
        success: false,
        durationMs: Date.now() - startTime,
        error,
        backupResult,
        preValidation,
        postValidation
      };
    }
  }

  /**
   * Verify that migration 021 prerequisite is satisfied.
   * Migration 022 requires 021_runtime_sessions_history.sql to be applied first.
   * Returns an object with success flag and optional error message.
   */
  private verifyMigration022Prerequisites(): { success: boolean; error?: string } {
    // Verify migration 021 exists in the registry
    const migration021 = this.registry.getById('021');
    if (!migration021) {
      return { success: false, error: 'Migration 021 not found in registry' };
    }

    // Check if migration 021 has a ledger entry
    const status = this.ledger.getStatus('021');
    if (status === null) {
      return { success: false, error: 'Migration 021 not recorded in ledger' };
    }

    // Verify 021 has a successful status (reject pending, failed, rolled_back)
    if (status !== 'success') {
      return { success: false, error: `Migration 021 has status '${status}', expected 'success'` };
    }

    return { success: true };
  }

  /**
   * Execute migration 022 with schema-aware column and index verification.
   * This migration adds 'generation' and 'credential_id' columns to
   * runtime_sessions and runtime_session_history tables.
   *
   * The schema-aware approach inspects the database before making changes,
   * ensuring no duplicate-column errors and proper index verification.
   * All schema changes execute atomically within a transaction.
   * Post-migration validation is synchronous to avoid async boundaries inside transactions.
   */
  private async executeMigration022(
    migration: Migration,
    backupResult: BackupResult | undefined,
    appliedBy: string
  ): Promise<ExecutionResult> {
    const migrationId = '022';
    const startTime = Date.now();

    this.logger.info(`Starting schema-aware migration ${migrationId}`, { migrationId });

    // Track if any changes were made
    let changesMade = false;
    const operations: string[] = [];

    // Use a transaction to ensure atomicity of all schema changes
    let transactionError: Error | null = null;
    let postValidation: ValidationResult = { passed: true, checks: [] };

    // Start a transaction - better-sqlite3 uses synchronous transactions
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // Check current schema state WHILE HOLDING TRANSACTION
      // This ensures no schema changes can occur between inspection and modification
      const runtimeSessionsCols = this.db.prepare('PRAGMA table_info(runtime_sessions)').all() as Array<{ name: string }>;
      const runtimeSessionHistoryCols = this.db.prepare('PRAGMA table_info(runtime_session_history)').all() as Array<{ name: string }>;

      const rsColNames = runtimeSessionsCols.map(c => c.name);
      const rshColNames = runtimeSessionHistoryCols.map(c => c.name);

      const rsHasGeneration = rsColNames.includes('generation');
      const rsHasCredentialId = rsColNames.includes('credential_id');
      const rshHasGeneration = rshColNames.includes('generation');
      const rshHasCredentialId = rshColNames.includes('credential_id');

      // Check existing indexes
      const rsIndexes = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='runtime_sessions'`).all() as Array<{ name: string }>;
      const rshIndexes = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='runtime_session_history'`).all() as Array<{ name: string }>;
      const rsIndexNames = rsIndexes.map(i => i.name);
      const rshIndexNames = rshIndexes.map(i => i.name);

      const rsHasCredIdx = rsIndexNames.includes('idx_runtime_sessions_credential_id');
      const rshHasCredIdx = rshIndexNames.includes('idx_runtime_session_history_credential_id');

      // Add missing columns to runtime_sessions
      if (!rsHasGeneration) {
        this.db.exec('ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0');
        changesMade = true;
        operations.push('runtime_sessions.generation added');
      }
      if (!rsHasCredentialId) {
        this.db.exec('ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT');
        changesMade = true;
        operations.push('runtime_sessions.credential_id added');
      }

      // Add missing columns to runtime_session_history
      if (!rshHasGeneration) {
        this.db.exec('ALTER TABLE runtime_session_history ADD COLUMN generation INTEGER DEFAULT 0');
        changesMade = true;
        operations.push('runtime_session_history.generation added');
      }
      if (!rshHasCredentialId) {
        this.db.exec('ALTER TABLE runtime_session_history ADD COLUMN credential_id TEXT');
        changesMade = true;
        operations.push('runtime_session_history.credential_id added');
      }

      // Create missing indexes (always verify/create, even if columns exist)
      if (!rsHasCredIdx) {
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_runtime_sessions_credential_id ON runtime_sessions(credential_id)');
        changesMade = true;
        operations.push('idx_runtime_sessions_credential_id created');
      }
      if (!rshHasCredIdx) {
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_runtime_session_history_credential_id ON runtime_session_history(credential_id)');
        changesMade = true;
        operations.push('idx_runtime_session_history_credential_id created');
      }

      // Run POST-MIGRATION VALIDATION SYNCHRONOUSLY inside transaction
      // This ensures all validation happens before COMMIT, and any failure triggers ROLLBACK
      postValidation = this.validator.postMigrationValidationSync(migration);

      if (!postValidation.passed) {
        throw new Error(`Post-migration validation failed: ${postValidation.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`);
      }

      // Record success in ledger (synchronous, part of same transaction)
      const durationMs = Date.now() - startTime;
      this.ledger.recordSuccess(
        migration.id,
        migration.filename,
        migration.checksum,
        durationMs,
        backupResult?.backupPath || '',
        appliedBy,
        { targetTables: migration.targetTables, note: changesMade ? operations.join(', ') : 'no_changes_needed' }
      );

      // Commit transaction
      this.db.exec('COMMIT');

      this.logger.info(`Migration ${migrationId} completed`, {
        durationMs,
        changesMade,
        operations
      });

      return {
        success: true,
        durationMs,
        backupResult,
        postValidation
      };
    } catch (e) {
      transactionError = e instanceof Error ? e : new Error(String(e));

      // Rollback on any error
      try {
        this.db.exec('ROLLBACK');
      } catch {
        this.logger.error(`Failed to rollback transaction`, { migrationId });
      }

      this.logger.error(`Migration ${migrationId} failed`, {
        migrationId,
        error: transactionError.message,
        durationMs: Date.now() - startTime
      });

      const durationMs = Date.now() - startTime;

      // Record failure in ledger (synchronous, will be rolled back if still in transaction)
      // After ROLLBACK, we need a new transaction for the ledger entry
      this.db.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        this.ledger.recordFailure(
          migration.id,
          migration.filename,
          migration.checksum,
          transactionError,
          durationMs,
          backupResult?.backupPath || '',
          appliedBy,
          { targetTables: migration.targetTables }
        );
        this.db.exec('COMMIT');
      } catch (recordError) {
        this.logger.error(`Failed to record ledger failure after rollback`, { migrationId, error: String(recordError) });
        try { this.db.exec('ROLLBACK'); } catch { }
      }

      // Create a failed post-validation result
      const failedPostValidation: ValidationResult = {
        passed: false,
        checks: [{
          name: 'post_validation',
          passed: false,
          message: `Validation failed: ${transactionError.message}`
        }]
      };

      return {
        success: false,
        durationMs,
        error: transactionError,
        backupResult,
        postValidation: failedPostValidation
      };
    }
  }

  async executeAll(
    migrationIds: string[],
    options: {
      dryRun?: boolean;
      force?: boolean;
      transaction?: boolean;
      createBackup?: boolean;
      appliedBy?: string;
      stopOnError?: boolean;
    } = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Resolve dependencies: calculate transitive dependencies for requested migrations
    let orderedMigrations: Migration[];
    if (migrationIds.length === 0) {
      // No specific migrations requested - run all ordered migrations
      orderedMigrations = this.registry.getOrdered();
    } else {
      const resolved = this.resolveDependencies(migrationIds);
      orderedMigrations = this.registry.getOrdered().filter(m => resolved.has(m.id));
    }

    // Filter out already-applied migrations (unless force flag is set)
    const force = options.force === true;
    const migrationsToExecute = orderedMigrations.filter(m => {
      if (force) return true;
      return !this.ledger.isApplied(m.id);
    });

    this.logger.info(`Executing ${migrationsToExecute.length} migrations`, {
      migrations: migrationsToExecute.map(m => m.id),
      dryRun: options.dryRun
    });

    for (const migration of migrationsToExecute) {
      const result = await this.executeMigration(migration.id, options);
      results.push(result);

      if (!result.success && options.stopOnError !== false) {
        this.logger.error(`Stopping due to migration failure`, {
          failedMigration: migration.id,
          error: result.error?.message
        });
        break;
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    this.logger.info(`Migration batch complete`, { total: results.length, succeeded, failed });

    return results;
  }

  /**
   * Resolve transitive dependencies for the given migration IDs.
   * Returns a set of all migration IDs that should be executed (requested + all dependencies).
   * Throws if any dependency is missing or if the dependency graph has a cycle.
   */
  private resolveDependencies(migrationIds: string[]): Set<string> {
    const allMigrations = this.registry.getAll();
    const migrationMap = new Map<string, Migration>();
    for (const m of allMigrations) {
      migrationMap.set(m.id, m);
    }

    // Validate all requested migrations exist
    for (const id of migrationIds) {
      if (!migrationMap.has(id)) {
        throw new Error(`Migration ${id} not found in registry`);
      }
    }

    const result = new Set<string>();
    const visiting = new Set<string>(); // Track migrations currently being visited (cycle detection)

    const visit = (id: string) => {
      if (result.has(id)) return; // Already resolved
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving migration ${id}`);
      }

      const migration = migrationMap.get(id);
      if (!migration) {
        throw new Error(`Migration ${id} not found in registry`);
      }

      visiting.add(id);

      // Visit dependencies first (topological order)
      // Note: Dependencies that don't exist in the registry are skipped
      // This allows for dependency ranges that may include non-existent migrations
      for (const depId of migration.dependencies) {
        if (!migrationMap.has(depId)) {
          // Dependency doesn't exist - could be from a range that includes missing migrations
          // Skip it and continue
          continue;
        }

        if (!result.has(depId)) {
          visit(depId);
        }
      }

      visiting.delete(id);
      result.add(id);
    };

    // Visit each requested migration (dependencies will be resolved first)
    for (const id of migrationIds) {
      visit(id);
    }

    return result;
  }
}

export class RollbackEngine {
  private backupManager: BackupManager;
  private ledger: MigrationLedger;
  private logger: Logger;
  private dbPath: string;

  private getDefaultDbPath(db: Database.Database): string {
    // Try to get path from database object; fall back to standard path
    // better-sqlite3 Database has a .name property containing the path
    const dbName = (db as any).name;
    if (dbName && typeof dbName === 'string' && dbName !== ':memory:') {
      return dbName;
    }
    return 'data/council.db';
  }

  constructor(
    db: Database.Database,
    backupManager: BackupManager,
    ledger: MigrationLedger,
    logger?: Logger
  ) {
    this.backupManager = backupManager;
    this.ledger = ledger;
    this.logger = logger || new ConsoleLogger();
    this.dbPath = this.getDefaultDbPath(db);
  }

  async rollback(migrationId: string, method: 'backup' | 'reapply' = 'backup'): Promise<boolean> {
    const entry = this.ledger.getAll().find(e => e.migration_id === migrationId);
    if (!entry || entry.status !== 'success') {
      this.logger.warn(`Cannot rollback ${migrationId}: not applied or not successful`, { migrationId, entry });
      return false;
    }

    this.logger.info(`Rolling back migration ${migrationId}`, { method, backupPath: entry.backup_path });

    try {
      if (method === 'backup' && entry.backup_path) {
        this.backupManager.restoreBackup(entry.backup_path, this.dbPath);
      }
      // reapply method would need Phase 4 schema recreation - not implemented

      this.ledger.recordRolledBack(
        migrationId,
        entry.filename,
        entry.checksum,
        entry.backup_path,
        'rollback',
        { method }
      );

      this.logger.info(`Rollback of ${migrationId} complete`, { migrationId });
      return true;
    } catch (e) {
      this.logger.error(`Rollback of ${migrationId} failed`, { migrationId, error: String(e) });
      return false;
    }
  }

  async rollbackTo(migrationId: string): Promise<boolean> {
    const applied = this.ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    const targetIndex = applied.findIndex(e => e.migration_id === migrationId);
    if (targetIndex === -1) {
      this.logger.error(`Target migration ${migrationId} not found in ledger`);
      return false;
    }

    // Rollback all migrations after the target (newest first)
    const toRollback = applied.slice(0, targetIndex);
    this.logger.info(`Rolling back ${toRollback.length} migrations to ${migrationId}`, {
      migrations: toRollback.map(e => e.migration_id)
    });

    for (const entry of toRollback) {
      const success = await this.rollback(entry.migration_id);
      if (!success) {
        this.logger.error(`Rollback failed at ${entry.migration_id}, stopping`);
        return false;
      }
    }

    return true;
  }

  async rollbackAll(): Promise<boolean> {
    const applied = this.ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    this.logger.info(`Rolling back all ${applied.length} migrations`, {
      migrations: applied.map(e => e.migration_id)
    });

    for (const entry of applied) {
      const success = await this.rollback(entry.migration_id);
      if (!success) {
        this.logger.error(`Rollback failed at ${entry.migration_id}, stopping`);
        return false;
      }
    }

    return true;
  }
}