// P2-04: Authorized Division Head can manage division deliverables
// Tests that division identity has proper authorization for deliverable operations

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createDivision,
  registerStaffAgent,
  approveSpecialist,
  activateStaffAgent,
  createTask,
} from '../../src/council/divisions.js';
import {
  createDeliverableDraft,
  submitDeliverable,
  assignReviewer,
  requestRevision,
  resubmitDeliverable,
  approveDeliverable,
  rejectDeliverable,
  getDeliverableHistory,
} from '../../src/council/task-delegation.js';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

interface TestContext {
  db: DatabaseInstance;
  divisionId: string;
  divisionHeadStaffId: string;
  divisionMemberStaffId: string;
  otherDivisionId: string;
  cleanup: () => void;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function uniqueStaffId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function setupTestDivision(db: DatabaseInstance, name: string, headStaffId?: string): string {
  const divisionId = uniqueId(name);
  createDivision(db, {
    division_id: divisionId,
    name: divisionId,
    description: 'Test division for deliverables',
    head_staff_id: headStaffId,
  });
  return divisionId;
}

function setupStaffAgent(
  db: DatabaseInstance,
  divisionId: string,
  name: string,
  role: string = 'specialist',
  status: 'active' | 'inactive' | 'terminated' = 'active'
): string {
  const staffId = uniqueStaffId('staff');
  registerStaffAgent(db, {
    staff_id: staffId,
    name,
    role,
    division_id: divisionId,
    runtime_instances: ['claude'],
    permissions: [],
    status,
  });
  // Add to division members (using raw query since addDivisionMember uses db.runPreparedStatement)
  db.runPreparedStatement('insertDivisionMember', [divisionId, staffId, role]);
  return staffId;
}

function createDivisionTask(db: DatabaseInstance, divisionId: string, title: string = 'Test Task'): string {
  const task = createTask(db, {
    title,
    description: 'Test task for deliverables',
    assigned_to_type: 'division',
    assigned_to_id: divisionId,
    created_by_type: 'founder',
    created_by_id: 'founder',
    status: 'pending',
  });
  return task.task_id;
}

describe('P2-04: Authorized Division Head can manage division deliverables', () => {
  let db: DatabaseInstance;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(process.cwd(), 'data', `test-p2-04-${randomUUID()}.db`);
    db = createDatabase(testDbPath);
  });

  afterEach(() => {
    if (db && typeof db.close === 'function') {
      db.close();
    }
    // Small delay for file handle release on Windows
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }

    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {
      // Ignore cleanup errors
    }
  });

  function createContext(): TestContext {
    // Create Division A with a head and member
    const divisionId = setupTestDivision(db, 'division-a');
    const divisionHeadStaffId = setupStaffAgent(db, divisionId, 'Division Head', 'head');

    // Make them the actual division head in the database
    const currentDiv = db.query('SELECT * FROM divisions WHERE division_id = ?', [divisionId]);
    if (currentDiv.length > 0) {
      db.db.prepare('UPDATE divisions SET head_staff_id = ? WHERE division_id = ?').run(divisionHeadStaffId, divisionId);
    }

    const divisionMemberStaffId = setupStaffAgent(db, divisionId, 'Division Member', 'member');

    // Create task assigned to the division (not staff)
    const taskId = createDivisionTask(db, divisionId);

    return {
      db,
      divisionId,
      divisionHeadStaffId,
      divisionMemberStaffId,
      taskId,
      otherDivisionId: setupTestDivision(db, 'division-b'),
      cleanup: () => {
        try { db.close(); } catch {}
        try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch {}
      }
    };
  };

  describe('Division identity can create and submit deliverables', () => {
    it('should allow division to create deliverable for its own task (division-assigned)', () => {
      const ctx = createContext();

      // Division identity context
      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };

      // Create draft as division identity
      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Division deliverable content',
        quality_score: 85,
      });

      assert.strictEqual(draft.status, 'draft');
      assert.strictEqual(draft.deliverable_id.startsWith('del-'), true);
      // Verify deliverable was created with correct submitter in database
      const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id])[0];
      assert.strictEqual(deliverable.submitted_by_type, 'division');
      assert.strictEqual(deliverable.submitted_by_id, ctx.divisionId);
    });

    it('should allow division to submit its own deliverable', () => {
      const ctx = createContext();
      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Division deliverable content',
        quality_score: 85,
      });

      const submitted = submitDeliverable(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
      });

      assert.strictEqual(submitted.status, 'submitted');
    });

    it('should allow division head to assign reviewer', () => {
      const ctx = createContext();
      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Division deliverable content',
        quality_score: 85,
      });

      submitDeliverable(db, divisionCtx, { deliverable_id: draft.deliverable_id });

      // Division head assigns themselves as reviewer
      const assigned = assignReviewer(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      assert.strictEqual(assigned.reviewer_type, 'division_head');
      assert.strictEqual(assigned.reviewer_id, ctx.divisionHeadStaffId);
    });
  });

  describe('Division head can manage delivered deliverables with reviewer', () => {
    it('should allow division head to approve deliverable with review assignment', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };
      const founder = { ...founderCtx };

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Final content',
        quality_score: 88,
      });

      submitDeliverable(db, divisionCtx, { deliverable_id: draft.deliverable_id });

      // Division head assigns themselves as reviewer
      assignReviewer(db, founder, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      // Division head approves
      const approved = approveDeliverable(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 88,
      });

      assert.strictEqual(approved.approved, true);
      assert.strictEqual(approved.requires_founder_sig, false);

      // Verify status in database
      const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
      assert.strictEqual(deliverable[0].status, 'accepted');
      assert.strictEqual(deliverable[0].approved_by_type, 'division_head');
      assert.strictEqual(deliverable[0].approved_by_id, ctx.divisionHeadStaffId);
    });

    it('should allow division head to reject deliverable', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };
      const founder = { ...founderCtx };

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Poor quality content',
        quality_score: 60,
      });

      submitDeliverable(db, divisionCtx, { deliverable_id: draft.deliverable_id });

      // Division head assigns themselves as reviewer
      assignReviewer(db, founder, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      // Division head rejects
      rejectDeliverable(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        rejection_reason: 'Quality below threshold',
      });

      // Verify status in database
      const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
      assert.strictEqual(deliverable[0].status, 'rejected');
    });

    it('should allow division head to request revision and member to resubmit', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };
      const memberCtx = { owner_type: 'staff' as const, owner_id: ctx.divisionMemberStaffId, runtime: 'claude' as const };
      const founder = { ...founderCtx };

      // Create draft as staff member
      const draft = createDeliverableDraft(db, memberCtx, {
        task_id: ctx.taskId,
        content: 'Initial content',
        quality_score: 60,
      });

      submitDeliverable(db, memberCtx, { deliverable_id: draft.deliverable_id });

      // Division head assigns themselves as reviewer
      assignReviewer(db, founder, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      // Division head requests revision
      requestRevision(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        revision_notes: 'Improve quality',
      });

      // Member resubmits
      const resubmitted = resubmitDeliverable(db, memberCtx, {
        deliverable_id: draft.deliverable_id,
        content: 'Improved content',
        quality_score: 85,
      });

      assert.strictEqual(resubmitted.status, 'submitted');
      assert.strictEqual(resubmitted.version, 2);
    });
  });

  describe('Division can access deliverable history and revisions', () => {
    it('should retrieve deliverable version history for division-assigned task', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };
      const memberCtx = { owner_type: 'staff' as const, owner_id: ctx.divisionMemberStaffId, runtime: 'claude' as const };
      const founder = { ...founderCtx };

      // Create draft as staff member (division member)
      const draft = createDeliverableDraft(db, memberCtx, {
        task_id: ctx.taskId,
        content: 'v1 content',
        quality_score: 75,
      });

      submitDeliverable(db, memberCtx, { deliverable_id: draft.deliverable_id });

      assignReviewer(db, founder, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      requestRevision(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        revision_notes: 'Fix issues',
      });

      resubmitDeliverable(db, memberCtx, {
        deliverable_id: draft.deliverable_id,
        content: 'v2 content',
        quality_score: 85,
      });

      approveDeliverable(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 85,
      });

      // Division can view history
      const history = getDeliverableHistory(db, divisionCtx, draft.deliverable_id);
      assert.ok(history.length >= 2, 'Should have at least 2 versions');
      assert.strictEqual(history[0].version_num, 1);
      assert.strictEqual(history[1].version_num, 2);
    });
  });

  describe('Authorization boundaries for division deliverable access', () => {
    it('should reject staff from other division creating deliverable for division task', () => {
      const ctx = createContext();

      // Create division B with a staff member
      const divisionBStaffId = setupStaffAgent(db, ctx.otherDivisionId, 'Other Staff', 'member');
      const otherCtx = { owner_type: 'staff' as const, owner_id: divisionBStaffId, runtime: 'claude' as const };

      // Other staff tries to create deliverable for task in division A
      assert.throws(() => {
        createDeliverableDraft(db, otherCtx, {
          task_id: ctx.taskId,
          content: 'Unauthorized draft',
        });
      }, /Authorization denied: Staff must be a member of the assigned division/);
    });

    it('should reject division from approving deliverable not assigned to them', () => {
      const ctx = createContext();

      // Create task assigned to other division
      const otherStaffId = setupStaffAgent(db, ctx.otherDivisionId, 'Other Member', 'member');
      const otherDivisionHeadId = setupStaffAgent(db, ctx.otherDivisionId, 'Other Head', 'head');

      // Make them the division head
      db.db.prepare('UPDATE divisions SET head_staff_id = ? WHERE division_id = ?').run(otherDivisionHeadId, ctx.otherDivisionId);

      // Create task assigned to other division
      const otherTaskId = createDivisionTask(db, ctx.otherDivisionId);

      // Create draft as staff from other division
      const draft = createDeliverableDraft(db, { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const }, {
        task_id: otherTaskId,
        content: 'Other division deliverable',
        quality_score: 80,
      });

      submitDeliverable(db, { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const }, { deliverable_id: draft.deliverable_id });

      // Division A head cannot approve division B's deliverable
      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };

      assert.throws(() => {
        approveDeliverable(db, divisionCtx, {
          deliverable_id: draft.deliverable_id,
          quality_score: 80,
        });
      }, /Authorization denied/);
    });

    it('should allow founder to manage any divide deliverable', () => {
      const ctx = createContext();

      const draft = createDeliverableDraft(db, { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const }, {
        task_id: ctx.taskId,
        content: 'Content',
        quality_score: 85,
      });

      submitDeliverable(db, { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const }, { deliverable_id: draft.deliverable_id });

      // Founder can approve any deliverable
      const approved = approveDeliverable(db, founderCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 85,
      });

      assert.strictEqual(approved.approved, true);
    });
  });

  describe('Division can manage task status through deliverables', () => {
    it('should update task status to review when deliverable is submitted', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };

      // Task starts in pending
      let task = db.query('SELECT * FROM tasks WHERE task_id = ?', [ctx.taskId])[0];
      assert.strictEqual(task.status, 'pending');

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Content',
      });

      submitDeliverable(db, divisionCtx, { deliverable_id: draft.deliverable_id });

      // Task should now be in review
      task = db.query('SELECT * FROM tasks WHERE task_id = ?', [ctx.taskId])[0];
      assert.strictEqual(task.status, 'review');
    });

    it('should update task status to completed when deliverable is approved', () => {
      const ctx = createContext();

      const divisionCtx = { owner_type: 'division' as const, owner_id: ctx.divisionId, runtime: 'claude' as const };
      const founder = { ...founderCtx };

      const draft = createDeliverableDraft(db, divisionCtx, {
        task_id: ctx.taskId,
        content: 'Content',
        quality_score: 85,
      });

      submitDeliverable(db, divisionCtx, { deliverable_id: draft.deliverable_id });

      assignReviewer(db, founder, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: ctx.divisionHeadStaffId,
      });

      approveDeliverable(db, divisionCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 85,
      });

      // Task should now be completed
      const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [ctx.taskId])[0];
      assert.strictEqual(task.status, 'completed');
      assert.ok(task.completed_at, 'completed_at should be set');
    });
  });

  describe('Division staff member can also create deliverables', () => {
    it('should allow division staff member to create deliverable for assigned task', () => {
      const ctx = createContext();

      // Create task assigned to division member staff
      const staffTaskId = createDivisionTask(db, ctx.divisionId, 'Staff Task');

      const memberCtx = { owner_type: 'staff' as const, owner_id: ctx.divisionMemberStaffId, runtime: 'claude' as const };

      // Staff member should be able to create deliverable for their task
      const draft = createDeliverableDraft(db, memberCtx, {
        task_id: staffTaskId,
        content: 'Staff deliverable content',
        quality_score: 80,
      });

      assert.strictEqual(draft.status, 'draft');
      // Verify deliverable was created with correct submitter in database
      const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id])[0];
      assert.strictEqual(deliverable.submitted_by_type, 'staff');
      assert.strictEqual(deliverable.submitted_by_id, ctx.divisionMemberStaffId);
    });
  });
});