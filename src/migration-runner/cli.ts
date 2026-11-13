import { Command } from 'commander';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MigrationRegistry } from './registry.js';
import { MigrationLedger, computeChecksum } from './ledger.js';
import { BackupManager } from './backup.js';
import { Validator } from './validator.js';
import { MigrationExecutor, RollbackEngine, ConsoleLogger } from './executor.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('migration-runner')
  .description('Phase 6 Production Migration Runner')
  .version('1.0.0');

const DB_PATH = 'data/council.db';
const BACKUP_DIR = 'data/backups';
const MIGRATIONS_DIR = 'migrations';

// Global instances
let db: Database.Database;
let registry: MigrationRegistry;
let ledger: MigrationLedger;
let backupManager: BackupManager;
let validator: Validator;
let executor: MigrationExecutor;
let rollbackEngine: RollbackEngine;
let logger: ConsoleLogger;

function initialize() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  registry = new MigrationRegistry({ directory: MIGRATIONS_DIR });
  ledger = new MigrationLedger(db);
  ledger.initialize();
  backupManager = new BackupManager(BACKUP_DIR);
  validator = new Validator(db);
  logger = new ConsoleLogger();
  executor = new MigrationExecutor(db, registry, ledger, backupManager, validator, logger);
  rollbackEngine = new RollbackEngine(db, backupManager, ledger, logger);
}

program
  .command('status')
  .description('Show migration ledger state')
  .action(() => {
    initialize();
    const migrations = registry.getOrdered();
    const allEntries = ledger.getAll();

    console.log('\nMigration Status:');
    console.log('┌─────────┬─────────────────────────────────┬───────────┬─────────────────────┬────────────┐');
    console.log('│ ID      │ File                            │ Status    │ Applied At          │ Checksum   │');
    console.log('├─────────┼─────────────────────────────────┼───────────┼─────────────────────┼────────────┤');

    for (const m of migrations) {
      const entry = allEntries.find(e => e.migration_id === m.id);
      const status = entry?.status || 'pending';
      const appliedAt = entry?.applied_at || '-';
      const checksum = (entry?.checksum || m.checksum).slice(0, 10) + '...';

      const idPad = m.id.padEnd(7);
      const filePad = m.filename.padEnd(33);
      const statusPad = status.padEnd(9);
      const atPad = appliedAt.padEnd(19);

      console.log(`│ ${idPad} │ ${filePad} │ ${statusPad} │ ${atPad} │ ${checksum} │`);
    }

    console.log('└─────────┴─────────────────────────────────┴───────────┴─────────────────────┴────────────┘');

    const pending = migrations.filter(m => !ledger.isApplied(m.id)).length;
    const applied = allEntries.filter(e => e.status === 'success').length;
    const failed = allEntries.filter(e => e.status === 'failed').length;
    console.log(`\nTotal: ${pending} pending, ${applied} applied, ${failed} failed\n`);
  });

program
  .command('run [migrations...]')
  .description('Execute migrations (default: all pending)')
  .option('--dry-run', 'Validate only, do not execute')
  .option('--force', 'Override safety checks')
  .option('--no-backup', 'Skip backup creation')
  .option('--no-transaction', 'Execute without transaction')
  .option('--stop-on-error', 'Stop on first error (default: true)')
  .action(async (migrationIds, options) => {
    initialize();

    if (options.dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }

    const allMigrations = registry.getOrdered();
    const targetIds = migrationIds.length > 0 ? migrationIds : allMigrations.filter(m => !ledger.isApplied(m.id)).map(m => m.id);

    if (targetIds.length === 0) {
      console.log('No migrations to run (all applied or none specified)');
      return;
    }

    console.log(`Target migrations: ${targetIds.join(', ')}`);
    console.log(`Dry run: ${options.dryRun}`);
    console.log(`Force: ${options.force}`);
    console.log(`Create backup: ${!options.noBackup}`);
    console.log('');

    const results = await executor.executeAll(targetIds, {
      dryRun: options.dryRun,
      force: options.force,
      transaction: !options.noTransaction,
      createBackup: !options.noBackup,
      stopOnError: options.stopOnError !== false
    });

    console.log('\nExecution Summary:');
    for (const [i, result] of results.entries()) {
      const m = allMigrations.find(m => m.id === targetIds[i]);
      const status = result.success ? 'SUCCESS' : 'FAILED';
      console.log(`  ${targetIds[i]} (${m?.filename}): ${status} (${result.durationMs}ms)`);
      if (!result.success && result.error) {
        console.log(`    Error: ${result.error.message}`);
      }
    }

    const failed = results.filter(r => !r.success).length;
    if (failed > 0 && !options.dryRun) {
      console.log(`\n${failed} migration(s) failed. Check logs for details.`);
      process.exit(1);
    }

    if (options.dryRun) {
      console.log('\nDry run completed successfully.');
    }
  });

program
  .command('rollback [n]')
  .description('Rollback last n migrations (default: 1)')
  .option('--all', 'Rollback all migrations')
  .option('--to <migrationId>', 'Rollback to before specified migration')
  .option('--force', 'Skip safety checks')
  .action(async (n, options) => {
    initialize();

    if (options.all) {
      console.log('Rolling back ALL migrations...');
      const success = await rollbackEngine.rollbackAll();
      console.log(success ? 'Full rollback completed' : 'Full rollback failed');
      process.exit(success ? 0 : 1);
    }

    if (options.to) {
      console.log(`Rolling back to before ${options.to}...`);
      const success = await rollbackEngine.rollbackTo(options.to);
      console.log(success ? 'Rollback completed' : 'Rollback failed');
      process.exit(success ? 0 : 1);
    }

    const count = parseInt(n?.[0] || '1', 10);
    console.log(`Rolling back last ${count} migration(s)...`);

    const applied = ledger.getAll()
      .filter(e => e.status === 'success')
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));

    const toRollback = applied.slice(0, count);
    let allSuccess = true;

    for (const entry of toRollback) {
      console.log(`Rolling back ${entry.migration_id}...`);
      const success = await rollbackEngine.rollback(entry.migration_id);
      console.log(success ? '  OK' : '  FAILED');
      if (!success) allSuccess = false;
    }

    console.log(allSuccess ? '\nRollback completed' : '\nRollback failed');
    process.exit(allSuccess ? 0 : 1);
  });

program
  .command('validate [migration...]')
  .description('Run validation checks')
  .action(async (migrationIds: string[]) => {
    initialize();

    const migrations = migrationIds.length > 0
      ? migrationIds.map(id => registry.getById(id)).filter((m): m is NonNullable<typeof m> => m !== undefined)
      : registry.getOrdered();

    console.log('Running validation checks...\n');

    for (const migration of migrations) {
      console.log(`=== ${migration.id} (${migration.filename}) ===`);

      const pre = await validator.preMigrationValidation(migration);
      console.log('Pre-migration:');
      for (const check of pre.checks) {
        console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.message || (check.passed ? 'OK' : 'FAILED')}`);
      }

      if (ledger.isApplied(migration.id)) {
        const post = await validator.postMigrationValidation(migration);
        console.log('Post-migration:');
        for (const check of post.checks) {
          console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.message || (check.passed ? 'OK' : 'FAILED')}`);
        }
      }
      console.log('');
    }

    const fullCheck = await validator.fullIntegrityCheck();
    console.log(`Full integrity check: ${fullCheck ? 'PASSED' : 'FAILED'}`);
  });

program
  .command('backup')
  .description('Create backup')
  .option('-m, --method <method>', 'Backup method: binary|schema_dump|full_dump', 'binary')
  .option('-p, --prefix <prefix>', 'Backup file prefix', 'council')
  .action(async (options) => {
    initialize();

    console.log(`Creating ${options.method} backup...`);
    const result = await backupManager.createBackup(DB_PATH, { method: options.method as any, verify: true }, options.prefix);

    console.log('Backup created:');
    console.log(`  Path: ${result.backupPath}`);
    console.log(`  Method: ${result.method}`);
    console.log(`  Size: ${result.sizeBytes} bytes`);
    console.log(`  Verified: ${result.verified}`);
    console.log(`  Integrity: ${result.integrityCheck}`);
  });

program
  .command('restore <backupFile>')
  .description('Restore from backup')
  .action(async (backupFile) => {
    initialize();

    const backupPath = path.join(BACKUP_DIR, backupFile);
    if (!fs.existsSync(backupPath)) {
      console.error(`Backup not found: ${backupPath}`);
      process.exit(1);
    }

    console.log(`Restoring from ${backupPath}...`);
    backupManager.restoreBackup(backupPath, DB_PATH);
    console.log('Restore completed');
  });

program
  .command('check-authorization')
  .description('Verify founder authorization')
  .action(() => {
    const authPath = 'PHASE6_FOUNDER_AUTHORIZATION_PACKAGE.md';
    if (!fs.existsSync(authPath)) {
      console.error('Authorization package not found');
      process.exit(1);
    }

    const content = fs.readFileSync(authPath, 'utf-8');
    const hash = computeChecksum(authPath);
    console.log('Authorization package found');
    console.log(`SHA-256: ${hash}`);
    console.log('Content length:', content.length);
  });

program
  .command('compute-checksums')
  .description('Compute and report checksums for all migration files')
  .action(() => {
    initialize();

    const migrations = registry.getAll();
    console.log('Migration Checksums:');
    console.log('┌─────────┬─────────────────────────────────┬────────────────────────┐');
    console.log('│ ID      │ File                            │ SHA-256                │');
    console.log('├─────────┼─────────────────────────────────┼────────────────────────┤');

    for (const m of migrations) {
      console.log(`│ ${m.id.padEnd(7)} │ ${m.filename.padEnd(33)} │ ${m.checksum} │`);
    }

    console.log('└─────────┴─────────────────────────────────┴────────────────────────┘');
  });

program
  .command('verify-ledger')
  .description('Verify ledger checksums against current files')
  .action(() => {
    initialize();

    const results = registry.verifyChecksums();
    console.log('Checksum Verification:');
    console.log('┌─────────┬─────────────────────────────────┬─────────┐');
    console.log('│ ID      │ File                            │ Match   │');
    console.log('├─────────┼─────────────────────────────────┼─────────┤');

    for (const r of results) {
      console.log(`│ ${r.migration.id.padEnd(7)} │ ${r.migration.filename.padEnd(33)} │ ${r.valid ? '✓ OK' : '✗ MISMATCH'} │`);
      if (!r.valid) {
        console.log(`  Expected: ${r.expected}`);
        console.log(`  Actual:   ${r.actual}`);
      }
    }

    console.log('└─────────┴─────────────────────────────────┴─────────┘');

    const allValid = results.every(r => r.valid);
    console.log(allValid ? '\nAll checksums match!' : '\nChecksum mismatches detected!');
    process.exit(allValid ? 0 : 1);
  });

program.parseAsync(process.argv).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});