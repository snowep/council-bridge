import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeChecksum } from './ledger.js';

export type MigrationType = 'table_rebuild' | 'alter_additive';

export interface Migration {
  id: string;
  filename: string;
  filepath: string;
  type: MigrationType;
  dependencies: string[];
  targetTables: string[];
  description: string;
  checksum: string;
}

export interface MigrationRegistryConfig {
  directory: string;
  pattern: string;
  order: 'sequential' | 'dependency';
}

export class MigrationRegistry {
  private config: MigrationRegistryConfig;
  private migrations: Migration[] = [];
  private loaded = false;

  constructor(config?: Partial<MigrationRegistryConfig>) {
    this.config = {
      directory: 'migrations',
      pattern: '*.sql',
      order: 'sequential',
      ...config
    };
  }

  load(): Migration[] {
    if (this.loaded) {
      return this.migrations;
    }

    const files = fs.readdirSync(this.config.directory)
      .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
      .sort();

    this.migrations = files.map(filename => {
      const filepath = path.join(this.config.directory, filename);
      const id = this.parseMigrationId(filename);
      const { type, dependencies, targetTables, description } = this.parseMigrationFile(filepath, filename);
      const checksum = computeChecksum(filepath);

      return {
        id,
        filename,
        filepath,
        type,
        dependencies,
        targetTables,
        description,
        checksum
      };
    });

    this.loaded = true;
    return this.migrations;
  }

  private parseMigrationId(filename: string): string {
    const match = filename.match(/^(\d+)_/);
    return match ? match[1] : filename.replace('.sql', '');
  }

  private parseMigrationFile(filepath: string, filename: string): { type: MigrationType; dependencies: string[]; targetTables: string[]; description: string } {
    const content = fs.readFileSync(filepath, 'utf-8');

    // Parse type from comments
    let type: MigrationType = 'alter_additive';
    if (content.includes('Table rebuild') || content.includes('DROP TABLE') || content.includes('RENAME TO')) {
      type = 'table_rebuild';
    }

    // Parse dependencies from comments
    const depsMatch = content.match(/-- Prerequisites:?\s*([^\n]+)/i);
    const dependencies = depsMatch
      ? depsMatch[1].split(',').map(d => d.trim().replace(/^Migrations?\s+/, '').replace(/\s+complete/, '').trim())
        .filter(d => d && d !== 'None' && !d.toLowerCase().includes('phase'))
        .map(d => d.replace(/^0*(\d+)$/, '$1').padStart(3, '0'))
      : [];

    // Parse target tables from comments
    const tablesMatch = content.match(/-- Tables affected:?\s*([^\n]+)/i) ||
                       content.match(/-- Target tables:?\s*([^\n]+)/i);
    const targetTables = tablesMatch
      ? tablesMatch[1].split(',').map(t => t.trim())
      : [];

    // Parse description
    const descMatch = content.match(/-- (?:Purpose|Description):?\s*([^\n]+)/i);
    const description = descMatch ? descMatch[1].trim() : filename.replace('.sql', '');

    return { type, dependencies, targetTables, description };
  }

  getAll(): Migration[] {
    return this.load();
  }

  getById(id: string): Migration | undefined {
    return this.load().find(m => m.id === id);
  }

  getByFilename(filename: string): Migration | undefined {
    return this.load().find(m => m.filename === filename);
  }

  getOrdered(): Migration[] {
    const migrations = this.load();

    if (this.config.order === 'sequential') {
      return migrations.sort((a, b) => a.id.localeCompare(b.id));
    }

    // Dependency-based ordering (topological sort)
    return this.topologicalSort(migrations);
  }

  private topologicalSort(migrations: Migration[]): Migration[] {
    const graph = new Map<string, Migration>();
    const inDegree = new Map<string, number>();
    const result: Migration[] = [];

    for (const m of migrations) {
      graph.set(m.id, m);
      inDegree.set(m.id, 0);
    }

    for (const m of migrations) {
      for (const dep of m.dependencies) {
        if (graph.has(dep)) {
          inDegree.set(m.id, (inDegree.get(m.id) || 0) + 1);
        }
      }
    }

    const queue = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([id]) => id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      const migration = graph.get(id)!;
      result.push(migration);

      for (const m of migrations) {
        if (m.dependencies.includes(id)) {
          const newDegree = (inDegree.get(m.id) || 0) - 1;
          inDegree.set(m.id, newDegree);
          if (newDegree === 0) {
            queue.push(m.id);
          }
        }
      }
    }

    if (result.length !== migrations.length) {
      // Cycle detected, fall back to sequential
      return migrations.sort((a, b) => a.id.localeCompare(b.id));
    }

    return result;
  }

  verifyChecksums(): { migration: Migration; valid: boolean; expected: string; actual: string }[] {
    const results = [];
    for (const migration of this.load()) {
      const actual = computeChecksum(migration.filepath);
      results.push({
        migration,
        valid: actual === migration.checksum,
        expected: migration.checksum,
        actual
      });
    }
    return results;
  }
}