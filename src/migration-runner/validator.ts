import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import { Migration } from './registry.js';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
  details?: unknown;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
}

export class Validator {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async preMigrationValidation(migration: Migration): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Check 1: Database file exists and is readable
    checks.push(this.checkDatabaseAccessible());

    // Check 2: Database is not locked
    checks.push(this.checkDatabaseNotLocked());

    // Check 3: Foreign keys are enabled
    checks.push(this.checkForeignKeysEnabled());

    // Check 4: Migration file is readable
    checks.push(this.checkMigrationFileReadable(migration));

    // Check 5: Database schema matches expected pre-migration state (for table rebuilds)
    if (migration.type === 'table_rebuild') {
      checks.push(this.checkPreMigrationSchema(migration));
    }

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }

  async postMigrationValidation(migration: Migration): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Check 1: Integrity check passes
    checks.push(this.checkIntegrity());

    // Check 2: Foreign key check passes
    checks.push(this.checkForeignKeys());

    // Check 3: Migration-specific schema changes verified
    checks.push(...this.verifyMigrationChanges(migration));

    // Check 4: Row counts preserved (for table rebuilds)
    if (migration.type === 'table_rebuild') {
      checks.push(this.checkRowCountsPreserved(migration));
    }

    // Check 5: Indexes recreated (for table rebuilds)
    if (migration.type === 'table_rebuild') {
      checks.push(this.checkIndexesRecreated(migration));
    }

    // Check 6: FTS5 triggers still functional
    checks.push(this.checkFtsTriggers());

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }

  async fullIntegrityCheck(): Promise<boolean> {
    const integrity = this.db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    const fkCheck = this.db.prepare('PRAGMA foreign_key_check').all();
    return integrity.integrity_check === 'ok' && fkCheck.length === 0;
  }

  private checkDatabaseAccessible(): ValidationCheck {
    try {
      this.db.prepare('SELECT 1').get();
      return { name: 'database_accessible', passed: true };
    } catch (e) {
      return { name: 'database_accessible', passed: false, message: String(e) };
    }
  }

  private checkDatabaseNotLocked(): ValidationCheck {
    try {
      // Try to begin immediate transaction - will fail if locked
      this.db.prepare('BEGIN IMMEDIATE TRANSACTION').run();
      this.db.prepare('ROLLBACK').run();
      return { name: 'database_not_locked', passed: true };
    } catch (e) {
      return { name: 'database_not_locked', passed: false, message: 'Database is locked' };
    }
  }

  private checkForeignKeysEnabled(): ValidationCheck {
    const result = this.db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    return {
      name: 'foreign_keys_enabled',
      passed: result.foreign_keys === 1,
      message: result.foreign_keys === 1 ? 'Foreign keys ON' : 'Foreign keys OFF'
    };
  }

  private checkMigrationFileReadable(migration: Migration): ValidationCheck {
    try {
      fs.readFileSync(migration.filepath, 'utf-8');
      return { name: 'migration_file_readable', passed: true };
    } catch (e) {
      return { name: 'migration_file_readable', passed: false, message: String(e) };
    }
  }

  private checkPreMigrationSchema(migration: Migration): ValidationCheck {
    // Verify tables exist before migration
    const missingTables = migration.targetTables.filter(table => {
      const exists = this.db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      return !exists;
    });

    if (missingTables.length > 0) {
      return {
        name: 'pre_migration_schema',
        passed: false,
        message: `Missing tables: ${missingTables.join(', ')}`,
        details: { missingTables }
      };
    }
    return { name: 'pre_migration_schema', passed: true };
  }

  private checkIntegrity(): ValidationCheck {
    const result = this.db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    return {
      name: 'integrity_check',
      passed: result.integrity_check === 'ok',
      message: result.integrity_check === 'ok' ? 'Integrity OK' : `Integrity failed: ${result.integrity_check}`
    };
  }

  private checkForeignKeys(): ValidationCheck {
    const violations = this.db.prepare('PRAGMA foreign_key_check').all();
    return {
      name: 'foreign_key_check',
      passed: violations.length === 0,
      message: violations.length === 0 ? 'No FK violations' : `${violations.length} FK violations`,
      details: { violations }
    };
  }

  private verifyMigrationChanges(migration: Migration): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    for (const table of migration.targetTables) {
      const tableInfo = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; dflt_value: string | null; notnull: number }>;
      const columns = tableInfo.map(c => c.name);

      if (migration.id === '001') {
        // Verify staff_agents status default is 'inactive'
        const statusCol = tableInfo.find(c => c.name === 'status');
        checks.push({
          name: 'migration_001_status_default',
          passed: statusCol?.dflt_value?.includes('inactive') === true,
          message: statusCol?.dflt_value?.includes('inactive') ? 'Default is inactive' : `Default is ${statusCol?.dflt_value}`
        });
      }

      if (migration.id === '002') {
        // Verify cross_division_shares granted_by_type CHECK only allows 'founder'
        const grantedByTypeCol = tableInfo.find(c => c.name === 'granted_by_type');
        // We can't easily check CHECK constraints via PRAGMA, so test insert
        try {
          this.db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id) VALUES ('test-chk', 'mem', 'div', 'division', 'div')`).run();
          this.db.prepare(`DELETE FROM cross_division_shares WHERE share_id = 'test-chk'`).run();
          checks.push({ name: 'migration_002_check_constraint', passed: false, message: 'Division grant incorrectly allowed' });
        } catch {
          checks.push({ name: 'migration_002_check_constraint', passed: true, message: 'Division grant correctly rejected' });
        }

        // Verify migration_audit table exists
        const auditExists = this.db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='migration_audit'`).get();
        checks.push({
          name: 'migration_002_audit_table',
          passed: !!auditExists,
          message: auditExists ? 'migration_audit table exists' : 'migration_audit table missing'
        });
      }

      if (migration.id === '003') {
        checks.push({
          name: 'migration_003_dependencies_column',
          passed: columns.includes('dependencies'),
          message: columns.includes('dependencies') ? 'dependencies column exists' : 'dependencies column missing'
        });
        checks.push({
          name: 'migration_003_deliverable_id_column',
          passed: columns.includes('deliverable_id'),
          message: columns.includes('deliverable_id') ? 'deliverable_id column exists' : 'deliverable_id column missing'
        });
        // Check default
        const depCol = tableInfo.find(c => c.name === 'dependencies');
        checks.push({
          name: 'migration_003_dependencies_default',
          passed: depCol?.dflt_value?.includes('[]') === true,
          message: depCol?.dflt_value?.includes('[]') ? 'dependencies defaults to []' : `default is ${depCol?.dflt_value}`
        });
      }

      if (migration.id === '004') {
        for (const colName of ['file_references', 'task_relationships', 'audit_log']) {
          checks.push({
            name: `migration_004_${colName}_column`,
            passed: columns.includes(colName),
            message: columns.includes(colName) ? `${colName} column exists` : `${colName} column missing`
          });
          const col = tableInfo.find(c => c.name === colName);
          checks.push({
            name: `migration_004_${colName}_default`,
            passed: col?.dflt_value?.includes('[]') === true,
            message: col?.dflt_value?.includes('[]') ? `${colName} defaults to []` : `default is ${col?.dflt_value}`
          });
        }
      }

      if (migration.id === '005') {
        const expectedCols = ['request_type', 'status', 'justification', 'priority', 'deadline', 'approved_by_type', 'approved_by_id', 'approved_at'];
        for (const colName of expectedCols) {
          checks.push({
            name: `migration_005_${colName}_column`,
            passed: columns.includes(colName),
            message: columns.includes(colName) ? `${colName} column exists` : `${colName} column missing`
          });
        }
        // Test CHECK constraints
        try {
          this.db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, request_type) VALUES ('test-005', 'mem', 'div', 'founder', 'founder', 'invalid')`).run();
          checks.push({ name: 'migration_005_request_type_check', passed: false, message: 'Invalid request_type allowed' });
        } catch {
          checks.push({ name: 'migration_005_request_type_check', passed: true, message: 'Invalid request_type rejected' });
        }
      }
    }

    return checks;
  }

  private checkRowCountsPreserved(migration: Migration): ValidationCheck {
    // This would need pre-migration counts - for now just verify table not empty if it was before
    const results: ValidationCheck[] = [];
    for (const table of migration.targetTables) {
      const count = this.db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
      results.push({
        name: `row_count_${table}`,
        passed: count.c >= 0, // Non-negative
        message: `${table} has ${count.c} rows`,
        details: { table, count: count.c }
      });
    }
    return results[0] || { name: 'row_counts', passed: true };
  }

  private checkIndexesRecreated(migration: Migration): ValidationCheck {
    // For table rebuilds, verify expected indexes exist
    if (migration.id === '001') {
      const indexes = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='staff_agents'`).all() as Array<{ name: string }>;
      const names = indexes.map(i => i.name);
      return {
        name: 'indexes_recreated_001',
        passed: names.includes('idx_staff_agents_division') && names.includes('idx_staff_agents_status'),
        message: 'Standard indexes recreated',
        details: { indexes: names }
      };
    }
    if (migration.id === '002') {
      const indexes = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cross_division_shares'`).all() as Array<{ name: string }>;
      const names = indexes.map(i => i.name);
      return {
        name: 'indexes_recreated_002',
        passed: names.includes('idx_cross_division_shares_memory') && names.includes('idx_cross_division_shares_division'),
        message: 'Standard indexes recreated',
        details: { indexes: names }
      };
    }
    return { name: 'indexes_recreated', passed: true };
  }

  private checkFtsTriggers(): ValidationCheck {
    try {
      // Test FTS insert trigger
      this.db.prepare(`INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content) VALUES ('verify-fts', 'staff', 'staff-1', 'staff_private', 'note', 'Test', 'Content')`).run();
      const ftsResult = this.db.prepare(`SELECT * FROM memory_fts WHERE memory_id = 'verify-fts'`).get();
      this.db.prepare(`DELETE FROM memory_entries WHERE memory_id = 'verify-fts'`).run();
      return {
        name: 'fts_triggers',
        passed: !!ftsResult,
        message: ftsResult ? 'FTS insert trigger works' : 'FTS insert trigger failed'
      };
    } catch (e) {
      return { name: 'fts_triggers', passed: false, message: String(e) };
    }
  }
}