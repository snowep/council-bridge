// Task Delegation Service Boundary Tests — Phase 9 Pre-Batch 3 Gate 2 Task 5

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase } from '../src/database.js';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  validateTaskAccess,
  validateDivisionHeadAuthority,
  validateActiveStaffIdentity,
  validateDependenciesAndPreventCycles,
  recordTaskMutationAudit,
  getTaskAuditTrail,
  validateCrossDivisionTaskAccess
} from '../src/council/task-delegation.js';
import { OperationContext } from '../src/council/operations.js';

describe('Task Delegation Service Boundary — Phase 9 Task 5', () => {
  let db: any;
  let divisionHeadCtx: OperationContext;
  let staffCtx: OperationContext;
  let otherStaffCtx: OperationContext;
  let founderCtx: OperationContext;
  let divisionId: string;
  let staffId: string;
  let otherStaffId: string;
  let otherDivisionId: string;
  let taskId: string;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(process.cwd(), 'data', `test-task-delegation-${randomUUID()}.db`);
    db = createDatabase(testDbPath);

    divisionId = 'div-test';
    otherDivisionId = 'div-other';
    staffId = 'staff-001';
    otherStaffId = 'staff-002';

    // Setup division with head_staff_id set
    db.runPreparedStatement('insertDivision', [
      divisionId, 'Test Division', 'Test division description', 'staff-head', 0, '[]', '{}'
    ]);

    // Setup other division
    db.runPreparedStatement('insertDivision', [
      otherDivisionId, 'Other Division', 'Other division description', null, 0, '[]', '{}'
    ]);

    // Setup staff in division
    db.runPreparedStatement('insertStaffAgent', [
      staffId, 'Test Staff', 'specialist', divisionId, JSON.stringify(['claude']), '[]', 'active'
    ]);

    // Setup other staff in same division
    db.runPreparedStatement('insertStaffAgent', [
      otherStaffId, 'Other Staff', 'specialist', divisionId, JSON.stringify(['claude']), '[]', 'active'
    ]);

    // Setup division head staff agent first
    const headStaffId = 'staff-head';
    db.runPreparedStatement('insertStaffAgent', [
      headStaffId, 'Division Head', 'head', divisionId, JSON.stringify(['claude']), '[]', 'active'
    ]);

    // Setup division members
    db.runPreparedStatement('insertDivisionMember', [divisionId, staffId, 'member']);
    db.runPreparedStatement('insertDivisionMember', [divisionId, otherStaffId, 'member']);
    db.runPreparedStatement('insertDivisionMember', [divisionId, headStaffId, 'head']);

    // Create task assigned to staff
    taskId = randomUUID();
    db.runPreparedStatement('insertTask', [
      taskId, 'Test Task', 'Description', 'staff', staffId, 'founder', 'founder',
      'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
    ]);

    // Contexts
    divisionHeadCtx = { owner_type: 'division', owner_id: divisionId, runtime: 'claude' };
    staffCtx = { owner_type: 'staff', owner_id: staffId, runtime: 'claude' };
    otherStaffCtx = { owner_type: 'staff', owner_id: otherStaffId, runtime: 'claude' };
    founderCtx = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' };
  });

  afterEach(() => {
    // Close database connection before deleting files
    if (db && typeof db.close === 'function') {
      db.close();
    }
    // Small delay to ensure file handles are released on Windows
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }

    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
    if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
  });

  describe('validateTaskAccess', () => {
    it('should allow founder to access any task', () => {
      const task = validateTaskAccess(db, founderCtx, taskId);
      assert.strictEqual(task.task_id, taskId);
    });

    it('should allow division head to access division-assigned tasks', () => {
      // Create division-assigned task
      const divTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        divTaskId, 'Div Task', 'Desc', 'division', divisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const task = validateTaskAccess(db, divisionHeadCtx, divTaskId);
      assert.strictEqual(task.task_id, divTaskId);
    });

    it('should allow staff to access their own assigned tasks', () => {
      const task = validateTaskAccess(db, staffCtx, taskId);
      assert.strictEqual(task.task_id, taskId);
    });

    it('should reject staff accessing another staff member task', () => {
      assert.throws(
        () => validateTaskAccess(db, otherStaffCtx, taskId),
        /Staff can only request execution for their own tasks/
      );
    });

    it('should allow division to access division-assigned tasks', () => {
      const divTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        divTaskId, 'Div Task', 'Desc', 'division', divisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const task = validateTaskAccess(db, divisionHeadCtx, divTaskId);
      assert.strictEqual(task.task_id, divTaskId);
    });

    it('should enforce cross-division restrictions', () => {
      // Create task in other division
      const otherDivTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        otherDivTaskId, 'Other Div Task', 'Desc', 'division', otherDivisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      assert.throws(
        () => validateTaskAccess(db, divisionHeadCtx, otherDivTaskId),
        /Authorization denied/
      );
    });

    it('should throw for non-existent task', () => {
      assert.throws(
        () => validateTaskAccess(db, founderCtx, 'non-existent'),
        /Task 'non-existent' not found/
      );
    });
  });

  describe('validateDivisionHeadAuthority', () => {
    it('should allow founder', () => {
      validateDivisionHeadAuthority(db, founderCtx, divisionId);
      assert.ok(true); // No throw = pass
    });

    it('should allow division itself', () => {
      validateDivisionHeadAuthority(db, divisionHeadCtx, divisionId);
      assert.ok(true);
    });

    it('should allow staff who is division head', () => {
      const headCtx: OperationContext = { owner_type: 'staff', owner_id: 'staff-head', runtime: 'claude' };
      validateDivisionHeadAuthority(db, headCtx, divisionId);
      assert.ok(true);
    });

    it('should reject regular staff', () => {
      assert.throws(
        () => validateDivisionHeadAuthority(db, staffCtx, divisionId),
        /Division Head authority required/
      );
    });

    it('should reject staff from other division', () => {
      assert.throws(
        () => validateDivisionHeadAuthority(db, staffCtx, otherDivisionId),
        /Division Head authority required/
      );
    });
  });

  describe('validateActiveStaffIdentity', () => {
    it('should validate active staff with correct runtime', () => {
      const staff = validateActiveStaffIdentity(db, staffId, 'claude');
      assert.strictEqual(staff.staff_id, staffId);
      assert.strictEqual(staff.status, 'active');
    });

    it('should reject inactive staff', () => {
      // Create inactive staff (status 'inactive' is valid per CHECK constraint)
      const inactiveId = 'staff-inactive';
      db.runPreparedStatement('insertStaffAgent', [
        inactiveId, 'Inactive Staff', 'specialist', divisionId, JSON.stringify(['claude']), '[]', 'inactive'
      ]);

      assert.throws(
        () => validateActiveStaffIdentity(db, inactiveId, 'claude'),
        /Staff agent is not active/
      );
    });

    it('should reject staff not registered for runtime', () => {
      assert.throws(
        () => validateActiveStaffIdentity(db, staffId, 'hermes'),
        /Staff agent not registered for runtime: hermes/
      );
    });

    it('should reject non-existent staff', () => {
      assert.throws(
        () => validateActiveStaffIdentity(db, 'non-existent', 'claude'),
        /Staff agent 'non-existent' not found/
      );
    });
  });

  describe('validateDependenciesAndPreventCycles', () => {
    it('should allow valid dependencies', () => {
      const dep1 = randomUUID();
      const dep2 = randomUUID();

      // Create dependency tasks
      db.runPreparedStatement('insertTask', [
        dep1, 'Dep 1', 'Desc', 'staff', staffId, 'founder', 'founder',
        'completed', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);
      db.runPreparedStatement('insertTask', [
        dep2, 'Dep 2', 'Desc', 'staff', staffId, 'founder', 'founder',
        'completed', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      // Should not throw
      validateDependenciesAndPreventCycles(db, taskId, [dep1, dep2]);
      assert.ok(true);
    });

    it('should reject circular dependency', () => {
      const taskA = randomUUID();
      const taskB = randomUUID();

      // Create task A
      db.runPreparedStatement('insertTask', [
        taskA, 'Task A', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), JSON.stringify([taskB]), null
      ]);

      // Create task B depending on A
      db.runPreparedStatement('insertTask', [
        taskB, 'Task B', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), JSON.stringify([taskA]), null
      ]);

      // Try to make A depend on B (creates cycle)
      assert.throws(
        () => validateDependenciesAndPreventCycles(db, taskA, [taskB]),
        /Circular dependency detected/
      );
    });

    it('should detect indirect circular dependency', () => {
      const taskA = randomUUID();
      const taskB = randomUUID();
      const taskC = randomUUID();

      // A -> B -> C
      db.runPreparedStatement('insertTask', [
        taskA, 'Task A', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), JSON.stringify([taskB]), null
      ]);
      db.runPreparedStatement('insertTask', [
        taskB, 'Task B', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), JSON.stringify([taskC]), null
      ]);
      db.runPreparedStatement('insertTask', [
        taskC, 'Task C', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      // Try to make C depend on A (creates cycle A->B->C->A)
      assert.throws(
        () => validateDependenciesAndPreventCycles(db, taskC, [taskA]),
        /Circular dependency detected/
      );
    });
  });

  describe('recordTaskMutationAudit & getTaskAuditTrail', () => {
    it('should record audit entry for task mutation', () => {
      recordTaskMutationAudit(db, staffCtx, taskId, 'status_change', { old_status: 'pending', new_status: 'in_progress' });

      const trail = getTaskAuditTrail(db, taskId);
      assert.strictEqual(trail.length, 1);
      assert.strictEqual(trail[0].task_id, taskId);
      assert.strictEqual(trail[0].mutation_type, 'status_change');
      assert.strictEqual(trail[0].actor_type, 'staff');
      assert.strictEqual(trail[0].actor_id, staffId);
      assert.strictEqual(trail[0].runtime, 'claude');
      assert.deepStrictEqual(trail[0].details, { old_status: 'pending', new_status: 'in_progress' });
    });

    it('should record multiple audit entries in order', () => {
      recordTaskMutationAudit(db, staffCtx, taskId, 'create', { title: 'Test Task' });
      recordTaskMutationAudit(db, staffCtx, taskId, 'assign', { assigned_to: staffId });
      recordTaskMutationAudit(db, divisionHeadCtx, taskId, 'status_change', { old_status: 'pending', new_status: 'in_progress' });

      const trail = getTaskAuditTrail(db, taskId);
      assert.strictEqual(trail.length, 3);
      assert.strictEqual(trail[0].mutation_type, 'create');
      assert.strictEqual(trail[1].mutation_type, 'assign');
      assert.strictEqual(trail[2].mutation_type, 'status_change');
      // Check order by created_at
      assert.ok(new Date(trail[0].created_at) <= new Date(trail[1].created_at));
      assert.ok(new Date(trail[1].created_at) <= new Date(trail[2].created_at));
    });

    it('should return empty array for task with no audit trail', () => {
      const newTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        newTaskId, 'New Task', 'Desc', 'staff', staffId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const trail = getTaskAuditTrail(db, newTaskId);
      assert.strictEqual(trail.length, 0);
    });
  });

  describe('validateCrossDivisionTaskAccess', () => {
    it('should allow founder cross-division access', () => {
      const otherDivTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        otherDivTaskId, 'Other Div Task', 'Desc', 'division', otherDivisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [otherDivTaskId])[0];
      validateCrossDivisionTaskAccess(db, founderCtx, task);
      assert.ok(true);
    });

    it('should reject staff from other division accessing division task', () => {
      const otherDivTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        otherDivTaskId, 'Other Div Task', 'Desc', 'division', otherDivisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [otherDivTaskId])[0];
      assert.throws(
        () => validateCrossDivisionTaskAccess(db, staffCtx, task),
        /Cross-division access denied/
      );
    });

    it('should allow staff in same division accessing division task', () => {
      const divTaskId = randomUUID();
      db.runPreparedStatement('insertTask', [
        divTaskId, 'Div Task', 'Desc', 'division', divisionId, 'founder', 'founder',
        'pending', 'medium', 0, null, null, new Date().toISOString(), new Date().toISOString(), '[]', null
      ]);

      const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [divTaskId])[0];
      validateCrossDivisionTaskAccess(db, staffCtx, task);
      assert.ok(true);
    });
  });
});