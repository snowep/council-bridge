import { test } from 'node:test';
import assert from 'node:assert';
import { createTestDatabase } from './test-database.js';
import { initializeTestDatabase } from './test-migrations.js';

test('applies all migrations to fresh test database', async () => {
  const db = createTestDatabase('migration-test');

  await initializeTestDatabase(db.instance);

  const tables = db.instance.query(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tableNames = tables.map((t: any) => t.name);

  assert.ok(tableNames.includes('deliverable_versions'), 'deliverable_versions from migration 013');
  assert.ok(tableNames.includes('quality_thresholds'), 'quality_thresholds from migration 013');
  assert.ok(tableNames.includes('task_autonomy_levels'), 'task_autonomy_levels from migration 006');
  assert.ok(tableNames.includes('execution_requests'), 'execution_requests from migration 006');
  assert.ok(tableNames.includes('approval_requests'), 'approval_requests from migration 006');

  db.close();
});

test('applies migrations to existing database (upgrade path)', async () => {
  const db = createTestDatabase('upgrade-test');

  await initializeTestDatabase(db.instance);

  const tables = db.instance.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map((t: any) => t.name);
  assert.ok(tableNames.includes('deliverable_versions'));

  db.close();
});

test('deliverables CHECK constraint accepts draft status', async () => {
  const db = createTestDatabase('draft-constraint-test');

  await initializeTestDatabase(db.instance);

  // Create a test task first (needed for FK constraint)
  const taskId = `test-task-${Date.now()}`;
  db.instance.db.prepare(`
    INSERT INTO tasks (task_id, title, description, assigned_to_type, assigned_to_id, created_by_type, created_by_id, status, priority, budget_allocated, dependencies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, 'Test Task', 'Description', 'staff', 'test-staff', 'founder', 'founder', 'pending', 'medium', 0, '[]');

  const testId = `test-draft-${Date.now()}`;
  db.instance.db.prepare(`
    INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testId, taskId, 'staff', 'test-staff', '{}', 'draft');

  const inserted = db.instance.db.prepare('SELECT status FROM deliverables WHERE deliverable_id = ?').get(testId) as { status: string } | undefined;
  assert.strictEqual(inserted?.status, 'draft', 'draft status accepted by CHECK constraint');

  db.instance.db.prepare('DELETE FROM deliverables WHERE deliverable_id = ?').run(testId);
  db.instance.db.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);

  db.close();
});