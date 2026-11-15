import { DatabaseInstance } from '../../src/database.js';

export async function initializeTestDatabase(db: DatabaseInstance): Promise<void> {
  // The database created by createDatabase() already has all tables from schema
  // Just verify it's complete and draft status works

  const schemaVersion = db.stmt.getSchemaVersion.get('5.0.0');
  if (!schemaVersion) {
    db.stmt.insertSchemaVersion.run('5.0.0');
  }

  const deliverableInfo = db.db.prepare("PRAGMA table_info(deliverables)").all();
  const statusCol = deliverableInfo.find((c: any) => c.name === 'status');
  if (!statusCol) {
    throw new Error('deliverables.status column not found');
  }

  // Create a test task first (needed for FK constraint on deliverables.task_id)
  const taskId = `test-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.db.prepare(`
    INSERT INTO tasks (task_id, title, description, assigned_to_type, assigned_to_id, created_by_type, created_by_id, status, priority, budget_allocated, dependencies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, 'Test Task', 'Description', 'staff', 'test-staff', 'founder', 'founder', 'pending', 'medium', 0, '[]');

  // Test that draft status works
  const testId = `test-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.db.prepare(`
    INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testId, taskId, 'staff', 'test-staff', '{}', 'draft');

  const inserted = db.db.prepare('SELECT status FROM deliverables WHERE deliverable_id = ?').get(testId) as { status: string } | undefined;
  if (!inserted || inserted.status !== 'draft') {
    throw new Error('draft status not accepted by CHECK constraint');
  }

  db.db.prepare('DELETE FROM deliverables WHERE deliverable_id = ?').run(testId);
  db.db.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);

  // Verify key tables from all phases exist
  const requiredTables = [
    'agents', 'messages', 'council_seats', 'personas', 'constitutions',
    'divisions', 'staff_agents', 'division_members', 'memory_entries',
    'tasks', 'deliverables', 'deliverable_versions', 'quality_thresholds',
    'task_autonomy_levels', 'execution_requests', 'approval_requests',
    'execution_history', 'task_audit', 'founder_nonces'
  ];

  for (const table of requiredTables) {
    const exists = db.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) {
      throw new Error(`Required table '${table}' not found`);
    }
  }
}