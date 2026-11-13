import Database from 'better-sqlite3';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LedgerEntry {
  migration_id: string;
  filename: string;
  checksum: string;
  applied_at: string;
  applied_by: string;
  duration_ms: number;
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  backup_path: string;
  notes: Record<string, unknown>;
}

export interface MigrationLedgerConfig {
  table: string;
  schema_path: string;
}

export class MigrationLedger {
  private db: Database.Database;
  private config: MigrationLedgerConfig;

  constructor(db: Database.Database, config?: Partial<MigrationLedgerConfig>) {
    this.db = db;
    this.config = {
      table: 'migration_ledger',
      schema_path: 'migrations/ledger_schema.sql',
      ...config
    };
  }

  initialize(): void {
    const schemaPath = this.config.schema_path;
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    } else {
      this.createDefaultSchema();
    }
  }

  private createDefaultSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.table} (
        migration_id    TEXT PRIMARY KEY,
        filename        TEXT NOT NULL,
        checksum        TEXT NOT NULL,
        checksum_algo   TEXT NOT NULL DEFAULT 'sha256',
        applied_at      TEXT NOT NULL DEFAULT (datetime('now')),
        applied_by      TEXT NOT NULL DEFAULT 'system',
        duration_ms     INTEGER,
        status          TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
        backup_path     TEXT,
        notes           TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_migration_ledger_applied_at ON ${this.config.table}(applied_at);
      CREATE INDEX IF NOT EXISTS idx_migration_ledger_status ON ${this.config.table}(status);
    `);
  }

  recordSuccess(
    migrationId: string,
    filename: string,
    checksum: string,
    durationMs: number,
    backupPath: string,
    appliedBy: string,
    notes: Record<string, unknown> = {}
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO ${this.config.table}
      (migration_id, filename, checksum, applied_at, applied_by, duration_ms, status, backup_path, notes)
      VALUES (?, ?, ?, datetime('now'), ?, ?, 'success', ?, ?)
    `).run(migrationId, filename, checksum, appliedBy, durationMs, backupPath, JSON.stringify(notes));
  }

  recordFailure(
    migrationId: string,
    filename: string,
    checksum: string,
    error: Error,
    durationMs: number,
    backupPath: string,
    appliedBy: string,
    notes: Record<string, unknown> = {}
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO ${this.config.table}
      (migration_id, filename, checksum, applied_at, applied_by, duration_ms, status, backup_path, notes)
      VALUES (?, ?, ?, datetime('now'), ?, ?, 'failed', ?, ?)
    `).run(migrationId, filename, checksum, appliedBy, durationMs, backupPath, JSON.stringify({ ...notes, error: error.message, stack: error.stack }));
  }

  recordRolledBack(
    migrationId: string,
    filename: string,
    checksum: string,
    backupPath: string,
    appliedBy: string,
    notes: Record<string, unknown> = {}
  ): void {
    this.db.prepare(`
      INSERT INTO ${this.config.table}
      (migration_id, filename, checksum, applied_at, applied_by, duration_ms, status, backup_path, notes)
      VALUES (?, ?, ?, datetime('now'), ?, 0, 'rolled_back', ?, ?)
    `).run(migrationId, filename, checksum, appliedBy, backupPath, JSON.stringify(notes));
  }

  isApplied(migrationId: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM ${this.config.table} WHERE migration_id = ? AND status = 'success'`).get(migrationId);
    return row !== undefined;
  }

  getChecksum(migrationId: string): string | null {
    const row = this.db.prepare(`SELECT checksum FROM ${this.config.table} WHERE migration_id = ?`).get(migrationId) as { checksum: string } | undefined;
    return row?.checksum ?? null;
  }

  getStatus(migrationId: string): LedgerEntry['status'] | null {
    const row = this.db.prepare(`SELECT status FROM ${this.config.table} WHERE migration_id = ?`).get(migrationId) as { status: LedgerEntry['status'] } | undefined;
    return row?.status ?? null;
  }

  getAll(): LedgerEntry[] {
    const rows = this.db.prepare(`SELECT * FROM ${this.config.table} ORDER BY applied_at`).all() as LedgerEntry[];
    return rows.map(r => ({ ...r, notes: JSON.parse(r.notes as unknown as string) }));
  }

  getPending(migrations: Array<{ id: string }>): string[] {
    return migrations.filter(m => !this.isApplied(m.id)).map(m => m.id);
  }
}

export function computeChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}