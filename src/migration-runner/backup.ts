import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

export type BackupMethod = 'binary' | 'schema_dump' | 'full_dump';

export interface BackupOptions {
  method: BackupMethod;
  compress: boolean;
  retentionDays: number;
  verify: boolean;
}

export interface BackupResult {
  backupPath: string;
  method: string;
  timestamp: string;
  verified: boolean;
  sizeBytes: number;
  integrityCheck: boolean;
}

export class BackupManager {
  private backupDir: string;
  private defaultOptions: BackupOptions;

  constructor(backupDir: string = 'data/backups', options?: Partial<BackupOptions>) {
    this.backupDir = backupDir;
    this.defaultOptions = {
      method: 'binary',
      compress: false,
      retentionDays: 30,
      verify: true,
      ...options
    };

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private generateTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  }

  private getBackupFileName(prefix: string, method: BackupMethod, timestamp: string): string {
    const ext = method === 'binary' ? '.db' : '.sql';
    return `${prefix}_${timestamp}${ext}`;
  }

  async createBackup(dbPath: string, options?: Partial<BackupOptions>, prefix: string = 'council'): Promise<BackupResult> {
    const opts = { ...this.defaultOptions, ...options };
    const timestamp = this.generateTimestamp();
    const backupPath = path.join(this.backupDir, this.getBackupFileName(prefix, opts.method, timestamp));
    const startTime = Date.now();

    try {
      switch (opts.method) {
        case 'binary':
          await this.createBinaryBackup(dbPath, backupPath);
          break;
        case 'schema_dump':
          this.createSchemaDump(dbPath, backupPath);
          break;
        case 'full_dump':
          this.createFullDump(dbPath, backupPath);
          break;
      }

      const sizeBytes = fs.statSync(backupPath).size;
      let verified = false;
      let integrityCheck = false;

      if (opts.verify) {
        if (opts.method === 'binary') {
          verified = this.verifyBinaryBackup(backupPath);
          integrityCheck = verified;
        } else {
          verified = this.verifyDumpBackup(backupPath);
        }
      }

      return {
        backupPath,
        method: opts.method,
        timestamp: new Date().toISOString(),
        verified,
        sizeBytes,
        integrityCheck
      };
    } catch (error) {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      throw error;
    }
  }

  private async createBinaryBackup(dbPath: string, backupPath: string): Promise<void> {
    const db = new Database(dbPath, { readonly: true });
    const escapedPath = backupPath.replace(/\\/g, '\\\\');
    db.exec("VACUUM INTO '" + escapedPath + "'");
    db.close();
  }

  private createSchemaDump(dbPath: string, backupPath: string): void {
    const db = new Database(dbPath, { readonly: true });
    const schemas = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name").all() as Array<{ sql: string }>;
    const dump = schemas.map(s => s.sql + ';').join('\n');
    fs.writeFileSync(backupPath, dump);
    db.close();
  }

  private createFullDump(dbPath: string, backupPath: string): void {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    let dump = '';

    for (const table of tables) {
      const createSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name) as { sql: string } | undefined;
      if (createSql) {
        dump += createSql.sql + ';\n';
      }
      const rows = db.prepare(`SELECT * FROM ${table.name}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null) return 'NULL';
          if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
          return v;
        });
        dump += `INSERT INTO ${table.name} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
      }
    }
    fs.writeFileSync(backupPath, dump);
    db.close();
  }

  private verifyBinaryBackup(backupPath: string): boolean {
    try {
      const db = new Database(backupPath, { readonly: true });
      const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      db.close();
      return result.integrity_check === 'ok';
    } catch {
      return false;
    }
  }

  private verifyDumpBackup(backupPath: string): boolean {
    try {
      const stats = fs.statSync(backupPath);
      return stats.size > 0;
    } catch {
      return false;
    }
  }

  restoreBackup(backupPath: string, targetDbPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const ext = path.extname(backupPath);
    if (ext === '.db') {
      // Binary restore using better-sqlite3 backup
      const src = new Database(backupPath, { readonly: true });
      src.backup(targetDbPath).then(() => {}).catch(() => {});
      src.close();
    } else {
      // SQL dump restore
      const sql = fs.readFileSync(backupPath, 'utf-8');
      const db = new Database(targetDbPath);
      db.exec(sql);
      db.close();
    }
  }

  listBackups(): string[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }
    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.db') || f.endsWith('.sql'))
      .sort()
      .reverse();
  }

  cleanupOldBackups(): number {
    const files = this.listBackups();
    const cutoff = Date.now() - this.defaultOptions.retentionDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }
    return deleted;
  }
}