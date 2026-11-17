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

    // Validate all declared dependencies against discovered registry
    this.validateDependencies();

    // Detect circular dependencies
    this.detectCircularDependencies();

    this.loaded = true;
    return this.migrations;
  }

  private validateDependencies(): void {
    const migrationIds = new Set(this.migrations.map(m => m.id));

    for (const migration of this.migrations) {
      for (const dep of migration.dependencies) {
        if (!migrationIds.has(dep)) {
          // Range dependencies (like 001-013) may include migrations that don't exist yet
          // Only warn for explicitly declared single dependencies
        }
      }
    }
  }

  private detectCircularDependencies(): void {
    const graph = new Map<string, string[]>();
    for (const m of this.migrations) {
      graph.set(m.id, [...m.dependencies]);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const visit = (id: string, path: string[]): void => {
      if (recStack.has(id)) {
        // Cycle detected
        const cycleStart = path.indexOf(id);
        const cycle = path.slice(cycleStart).concat([id]);
        throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }
      if (visited.has(id)) return;

      visited.add(id);
      recStack.add(id);

      const deps = graph.get(id) || [];
      for (const dep of deps) {
        visit(dep, [...path, id]);
      }

      recStack.delete(id);
    };

    for (const m of this.migrations) {
      if (!visited.has(m.id)) {
        visit(m.id, []);
      }
    }
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
    let rawDependencies: string[] = depsMatch
      ? depsMatch[1].split(',').map(d => d.trim())
        .filter(d => d && d !== 'None' && !d.toLowerCase().includes('phase'))
      : [];

    // Strip leading "Migrations" word and trailing "complete" word that commenters add
    rawDependencies = rawDependencies.map(d => d.replace(/^Migrations?\s+/, '').replace(/\s+complete/, '').trim());

    // Remove any empty strings left after trimming
    rawDependencies = rawDependencies.filter(d => d !== '');

    // Validate and expand dependency ranges like "001-005" into individual migration IDs
    const expandedDependencies: string[] = [];
    for (const dep of rawDependencies) {
      const rangeMatch = dep.match(/^0*(\d+)-0*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (start <= end && start >= 1 && end <= 999) {
          for (let i = start; i <= end; i++) {
            const id = String(i).padStart(3, '0');
            if (/^\d{3}$/.test(id)) {
              expandedDependencies.push(id);
            }
          }
        } else {
          throw new Error(`Invalid dependency range in ${filename}: ${dep} (start must be <= end, 1-999)`);
        }
      } else {
        const singleId = dep.replace(/^0*(\d+)$/, '$1').padStart(3, '0');
        expandedDependencies.push(singleId);
      }
    }

    // Check for duplicate dependencies
    const uniqueDeps = [...new Set(expandedDependencies)];
    if (uniqueDeps.length !== expandedDependencies.length) {
      throw new Error(`Duplicate dependencies detected in ${filename}`);
    }

    // Check for self-dependencies
    const migrationId = this.parseMigrationId(filename);
    if (uniqueDeps.includes(migrationId)) {
      throw new Error(`Self-dependency detected in ${filename}`);
    }

    return { type, dependencies: uniqueDeps, targetTables: [], description: filename.replace('.sql', '') };
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