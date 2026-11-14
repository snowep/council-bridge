// Phase 9 Batch 3: Task Delegation Tests
// Tests for delegation, acceptance, rejection, and deliverable workflow

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import {
  createDivision,
  registerStaffAgent,
  approveSpecialist,
  activateStaffAgent,
  createTask as createBasicTask,
  getTaskById as getBasicTaskById,
  listTasks as listBasicTasks,
} from '../src/council/divisions.js';
import {
  delegateTask,
  acceptDelegation,
  rejectDelegation,
  createDeliverableDraft,
  submitDeliverable,
  reviewDeliverable,
  getDelegationTaskById,
  listDelegationTasks,
} from '../src/council/task-delegation.js';
import crypto from 'crypto';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueStaffId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

describe('Phase 9 Batch 3: Task Delegation', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  function setupTestDivision(): string {
    const divisionId = uniqueName('Division');
    createDivision(db, {
      division_id: divisionId,
      name: divisionId,
      description: 'Test division'
    });
    return divisionId;
  }

  function setupTestStaff(divisionId: string, name: string, role: string, status = 'active'): string {
    const staffId = uniqueStaffId('staff');
    registerStaffAgent(db, {
      staff_id: staffId,
      name,
      role,
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status
    });
    // Add staff member to division_members
    db.runPreparedStatement('insertDivisionMember', [divisionId, staffId, new Date().toISOString()]);
    return staffId;
  }

  // --- delegateTask Tests ---

  it('should delegate a task to another staff member', () => {
    const divisionId = setupTestDivision();
    const creatorId = setupTestStaff(divisionId, 'Creator', 'Senior Dev');
    const delegateeId = setupTestStaff(divisionId, 'Delegatee', 'Junior Dev');

    // Create task using basic createTask (founder creates it)
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Build complex feature',
      description: 'Create user authentication API',
      assigned_to_type: 'staff',
      assigned_to_id: creatorId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // Founder delegates the task
    const delegated = delegateTask(db, founderCtx, {
      task_id: task.task_id,
      delegatee_type: 'staff',
      delegatee_id: delegateeId,
      reason: 'Need help with implementation'
    });

    assert.ok(delegated.task_id.startsWith('task-'));
    assert.ok(delegated.dependencies.length > 0);

    // Check original task is now in_progress
    const original = getBasicTaskById(db, task.task_id);
    assert.strictEqual(original!.status, 'in_progress');
  });

  it('should reject delegation by non-authorized user', () => {
    const divisionId = setupTestDivision();
    const creatorId = setupTestStaff(divisionId, 'Creator', 'Senior Dev', 'active');
    const delegateeId = setupTestStaff(divisionId, 'Delegatee', 'Junior Dev', 'active');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Test task',
      assigned_to_type: 'staff',
      assigned_to_id: creatorId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };
    assert.throws(() => {
      delegateTask(db, otherCtx, {
        task_id: task.task_id,
        delegatee_type: 'staff',
        delegatee_id: delegateeId
      });
    }, /Only the task creator or Founder can delegate this task/);
  });

  it('should reject delegation to oneself', () => {
    // This test verifies that a staff member cannot delegate a task to themselves
    // Note: Founder can delegate any task, but staff can only delegate tasks they created
    // For this test, we need a task created by staff member themselves

    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Staff', 'Developer', 'active');

    // Create task directly using SQL (created by this staff member)
    const now = new Date().toISOString();
    const taskId = `task-${crypto.randomUUID().slice(0, 8)}`;
    db.runPreparedStatement('insertTask', [
      taskId, 'Self-delegation test', 'Test description', 'staff', staffId, 'division_head', staffId,
      'pending', 'medium', 0, null, null, now, now, '[]', null
    ]);

    // Staff member tries to delegate to themselves (cannot)
    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    assert.throws(() => {
      delegateTask(db, staffCtx, {
        task_id: taskId,
        delegatee_type: 'staff',
        delegatee_id: staffId
      });
    }, /Cannot delegate task to yourself/);
  });

  it('should reject delegation of non-existent task', () => {
    assert.throws(() => {
      delegateTask(db, founderCtx, {
        task_id: 'non-existent-task',
        delegatee_type: 'staff',
        delegatee_id: 'some-staff'
      });
    }, /Task 'non-existent-task' not found/);
  });

  // --- acceptDelegation Tests ---

  it('should accept a delegated task', () => {
    const divisionId = setupTestDivision();
    const creatorId = setupTestStaff(divisionId, 'Creator', 'Senior Dev', 'active');
    const delegateeId = setupTestStaff(divisionId, 'Delegatee', 'Junior Dev', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Build feature',
      assigned_to_type: 'staff',
      assigned_to_id: creatorId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // Founder delegates
    const delegated = delegateTask(db, founderCtx, {
      task_id: task.task_id,
      delegatee_type: 'staff',
      delegatee_id: delegateeId
    });

    // Delegatee accepts
    const delegateeCtx = { owner_type: 'staff' as const, owner_id: delegateeId, runtime: 'claude' as const };
    const accepted = acceptDelegation(db, delegateeCtx, { task_id: delegated.task_id });

    assert.strictEqual(accepted.status, 'in_progress');
  });

  it('should reject acceptDelegation by non-assignee', () => {
    const divisionId = setupTestDivision();
    const creatorId = setupTestStaff(divisionId, 'Creator', 'Senior Dev', 'active');
    const delegateeId = setupTestStaff(divisionId, 'Delegatee', 'Junior Dev', 'active');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Build feature',
      assigned_to_type: 'staff',
      assigned_to_id: creatorId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // Founder delegates
    const delegated = delegateTask(db, founderCtx, {
      task_id: task.task_id,
      delegatee_type: 'staff',
      delegatee_id: delegateeId
    });

    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };
    assert.throws(() => {
      acceptDelegation(db, otherCtx, { task_id: delegated.task_id });
    }, /This task is not assigned to you/);
  });

  it('should reject acceptDelegation for non-delegated task', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');

    // Create task (not delegated)
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Direct task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    assert.throws(() => {
      acceptDelegation(db, staffCtx, { task_id: task.task_id });
    }, /This task is not a delegated task/);
  });

  // --- rejectDelegation Tests ---

  it('should reject a delegated task', () => {
    const divisionId = setupTestDivision();
    const creatorId = setupTestStaff(divisionId, 'Creator', 'Senior Dev', 'active');
    const delegateeId = setupTestStaff(divisionId, 'Delegatee', 'Junior Dev', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Build feature',
      assigned_to_type: 'staff',
      assigned_to_id: creatorId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // Founder delegates
    const delegated = delegateTask(db, founderCtx, {
      task_id: task.task_id,
      delegatee_type: 'staff',
      delegatee_id: delegateeId
    });

    // Delegatee rejects
    const delegateeCtx = { owner_type: 'staff' as const, owner_id: delegateeId, runtime: 'claude' as const };
    const rejected = rejectDelegation(db, delegateeCtx, {
      task_id: delegated.task_id,
      reason: 'Not enough time'
    });

    assert.strictEqual(rejected.status, 'cancelled');
  });

  // --- getDelegationTaskById Tests ---

  it('should get task by ID with authorization check', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Test task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const retrieved = getDelegationTaskById(db, staffCtx, task.task_id);
    assert.strictEqual(retrieved.task_id, task.task_id);
    assert.strictEqual(retrieved.title, 'Test task');
  });

  it('should throw for non-existent task', () => {
    assert.throws(() => {
      getDelegationTaskById(db, founderCtx, 'non-existent-id');
    }, /Task 'non-existent-id' not found/);
  });

  // --- listDelegationTasks Tests ---

  it('should list tasks for founder', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');

    // Create tasks using the basic createTask (need to use SQL directly for db.generateId)
    const now = new Date().toISOString();
    const taskId1 = `task-${crypto.randomUUID().slice(0, 8)}`;
    const taskId2 = `task-${crypto.randomUUID().slice(0, 8)}`;

    db.runPreparedStatement('insertTask', [
      taskId1, 'Task 1', '', 'staff', staffId, 'founder', 'founder', 'pending', 'medium', 0, null, null, now, now, '[]', null
    ]);
    db.runPreparedStatement('insertTask', [
      taskId2, 'Task 2', '', 'division', divisionId, 'founder', 'founder', 'pending', 'medium', 0, null, null, now, now, '[]', null
    ]);

    const founderTasks = listDelegationTasks(db, founderCtx, { limit: 10 });
    assert.ok(founderTasks.length >= 2, `Expected at least 2 tasks, got ${founderTasks.length}`);
    const taskIds = founderTasks.map(t => t.task_id);
    assert.ok(taskIds.includes(taskId1), 'Should include Task 1');
    assert.ok(taskIds.includes(taskId2), 'Should include Task 2');
  });

  // --- submitDeliverable Tests ---

  it('should submit a deliverable for a completed task', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Complete work',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };

    // Create draft first
    const draft = createDeliverableDraft(db, staffCtx, {
      task_id: task.task_id,
      content: '{"implementation": "Completed all requirements"}',
      quality_score: 95
    });

    // Submit the draft
    const deliverable = submitDeliverable(db, staffCtx, {
      deliverable_id: draft.deliverable_id
    });

    assert.strictEqual(deliverable.task_id, task.task_id);
    assert.strictEqual(deliverable.status, 'submitted');
    assert.ok(deliverable.deliverable_id.startsWith('del-'));

    // Task should now be in review
    const updatedTask = getBasicTaskById(db, task.task_id);
    assert.strictEqual(updatedTask!.status, 'review');
  });

  it('should reject deliverable submission by non-assignee', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };

    // Create draft as assignee first
    const draft = createDeliverableDraft(db, staffCtx, {
      task_id: task.task_id,
      content: 'Some content'
    });

    // Try to submit as non-assignee
    assert.throws(() => {
      submitDeliverable(db, otherCtx, {
        deliverable_id: draft.deliverable_id
      });
    }, /Only the assigned staff agent or Founder can submit deliverable/);
  });

  // --- reviewDeliverable Tests ---

  it('should review a deliverable as founder', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };

    // Create and submit deliverable
    const draft = createDeliverableDraft(db, staffCtx, {
      task_id: task.task_id,
      content: '{"implementation": "Done"}'
    });
    const deliverable = submitDeliverable(db, staffCtx, {
      deliverable_id: draft.deliverable_id
    });

    // Founder reviews
    reviewDeliverable(db, founderCtx, {
      deliverable_id: deliverable.deliverable_id,
      status: 'accepted',
      quality_score: 90,
      comments: 'Good work!'
    });

    // Verify deliverable status was updated
    const result = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [deliverable.deliverable_id]);
    assert.strictEqual(result[0].status, 'accepted');
  });

  it('should reject deliverable review by unauthorized user', () => {
    const divisionId = setupTestDivision();
    const otherDivisionId = uniqueName('Division');
    createDivision(db, {
      division_id: otherDivisionId,
      name: otherDivisionId,
      description: 'Other division'
    });

    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer', 'active');
    const otherStaffId = setupTestStaff(otherDivisionId, 'Other', 'Developer', 'active');

    // Create task
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };

    // Create and submit deliverable
    const draft = createDeliverableDraft(db, staffCtx, {
      task_id: task.task_id,
      content: '{"implementation": "Done"}'
    });
    const deliverable = submitDeliverable(db, staffCtx, {
      deliverable_id: draft.deliverable_id
    });

    // Other division member should not be able to review
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };
    assert.throws(() => {
      reviewDeliverable(db, otherCtx, {
        deliverable_id: deliverable.deliverable_id,
        status: 'accepted'
      });
    }, /Authorization denied/);
  });

  // --- Integration Tests ---

  it('should complete full task delegation workflow', () => {
    // 1. Create division and staff
    const divisionId = setupTestDivision();
    const seniorDevId = setupTestStaff(divisionId, 'Senior Dev', 'Senior Developer');
    const juniorDevId = setupTestStaff(divisionId, 'Junior Dev', 'Junior Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Team Lead');

    // 2. Assign task to senior developer (using SQL directly to bypass signature issues)
    const now = new Date().toISOString();
    const task = createBasicTask(db, {
      task_id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Implement new API endpoint',
      description: 'Create user management API with CRUD operations',
      assigned_to_type: 'staff',
      assigned_to_id: seniorDevId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    assert.strictEqual(task.status, 'pending');

    // 3. Senior dev delegates to junior (using founder context for simplicity)
    const delegated = delegateTask(db, founderCtx, {
      task_id: task.task_id,
      delegatee_type: 'staff',
      delegatee_id: juniorDevId,
      reason: 'Complex implementation needs assistance'
    });

    assert.strictEqual(delegated.status, 'pending');
    assert.ok(delegated.dependencies.length > 0);

    // 4. Junior accepts
    const juniorCtx = { owner_type: 'staff' as const, owner_id: juniorDevId, runtime: 'claude' as const };
    const accepted = acceptDelegation(db, juniorCtx, { task_id: delegated.task_id });
    assert.strictEqual(accepted.status, 'in_progress');

    // 5. Submit deliverable
    const draft = createDeliverableDraft(db, juniorCtx, {
      task_id: delegated.task_id,
      content: '{"endpoint": "/api/users", "methods": ["GET", "POST", "PUT", "DELETE"]}',
      quality_score: 85
    });
    const deliverable = submitDeliverable(db, juniorCtx, {
      deliverable_id: draft.deliverable_id
    });
    assert.strictEqual(deliverable.status, 'submitted');

    // 6. Reviewer approves
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    reviewDeliverable(db, reviewerCtx, {
      deliverable_id: deliverable.deliverable_id,
      status: 'accepted',
      quality_score: 90
    });

    // Check audit trail
    const memories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?",
      ['task_history', 'delegation_record']
    );
    assert.ok(memories.length >= 1);
  });
});