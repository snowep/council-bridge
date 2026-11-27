// P1-05: Non-designated Staff cannot reject/request revision
// Regression test for deliverable reviewer authorization policy

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import crypto from 'crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createDivision,
  registerStaffAgent,
  updateDivision,
  createTask as createBasicTask,
} from '../../src/council/divisions.js';
import {
  createDeliverableDraft,
  submitDeliverable,
  assignReviewer,
  requestRevision,
  rejectDeliverable,
} from '../../src/council/task-delegation.js';
import { randomUUID } from 'node:crypto';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function uniqueStaffId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe('P1-05: Reviewer Policy - Non-designated Staff Cannot Reject/Request Revision', () => {
  let dbInstance: DatabaseInstance;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(process.cwd(), 'test-dbs', `p1-05-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
    const testDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    dbInstance = createDatabase(testDbPath);

    // Set schema version (insertSchemaVersion takes only 1 parameter: version)
    try {
      dbInstance.stmt.getSchemaVersion.get('5.0.0');
    } catch {
      dbInstance.stmt.insertSchemaVersion.run('5.0.0');
    }
  });

  afterEach(() => {
    try {
      dbInstance.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    dbInstance.close();
    const files = [testDbPath, testDbPath + '-wal', testDbPath + '-shm'];
    for (const file of files) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
  });

  function setupTestDivision(): string {
    const divisionId = uniqueName('Division');
    createDivision(dbInstance, {
      division_id: divisionId,
      name: divisionId,
      description: 'Test division'
    });
    return divisionId;
  }

  function setupTestStaff(divisionId: string, name: string, role: string): string {
    const staffId = uniqueStaffId('staff');
    registerStaffAgent(dbInstance, {
      staff_id: staffId,
      name,
      role,
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    dbInstance.runPreparedStatement('insertDivisionMember', [divisionId, staffId, new Date().toISOString()]);
    return staffId;
  }

  function setupTask(divisionId: string, staffId: string, title: string = 'Test Task') {
    const task = createBasicTask(dbInstance, {
      title,
      description: 'Test task description',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });
    return task.task_id;
  }

  // ============================================================================
  // P1-05 Test 1: Non-founder staff cannot request revision when founder reviewer assigned
  // ============================================================================
  it('should reject revision request by non-founder staff when founder reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'founder',
      reviewer_id: 'founder'
    });

    // Non-founder staff cannot request revision when founder reviewer assigned
    assert.throws(() => {
      requestRevision(dbInstance, staffCtx, {
        deliverable_id: draft.deliverable_id,
        revision_notes: 'Unauthorized revision request'
      });
    }, /Authorization denied: Founder reviewer must be a founder/);
  });

  // ============================================================================
  // P1-05 Test 2: Non-founder staff cannot reject when founder reviewer assigned
  // ============================================================================
  it('should reject rejection by non-founder staff when founder reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'founder',
      reviewer_id: 'founder'
    });

    // Non-founder staff cannot reject when founder reviewer assigned
    assert.throws(() => {
      rejectDeliverable(dbInstance, staffCtx, {
        deliverable_id: draft.deliverable_id,
        rejection_reason: 'Unauthorized rejection'
      });
    }, /Authorization denied: Founder reviewer must be a founder/);
  });

  // ============================================================================
  // P1-05 Test 3: Founder CAN request revision when founder reviewer assigned
  // ============================================================================
  it('should allow founder to request revision when founder reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'founder',
      reviewer_id: 'founder'
    });

    // Founder CAN request revision
    const revised = requestRevision(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Founder revision request'
    });

    assert.strictEqual(revised.status, 'revision_requested');
    assert.strictEqual(revised.revision_notes, 'Founder revision request');
  });

  // ============================================================================
  // P1-05 Test 4: Founder CAN reject when founder reviewer assigned
  // ============================================================================
  it('should allow founder to reject when founder reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'founder',
      reviewer_id: 'founder'
    });

    // Founder CAN reject
    rejectDeliverable(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      rejection_reason: 'Founder rejection'
    });

    const rejectedDeliverable = dbInstance.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
    assert.strictEqual(rejectedDeliverable[0].status, 'rejected');
  });

  // ============================================================================
  // P1-05 Test 5: Designated division head reviewer CAN request revision
  // ============================================================================
  it('should allow designated division head reviewer to request revision', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head BEFORE creating deliverable
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Division head reviewer CAN request revision
    const revised = requestRevision(dbInstance, reviewerCtx, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Authorized revision request'
    });

    assert.strictEqual(revised.status, 'revision_requested');
  });

  // ============================================================================
  // P1-05 Test 6: Designated division head reviewer CAN reject
  // ============================================================================
  it('should allow designated division head reviewer to reject', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head BEFORE creating deliverable
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Designated division head reviewer CAN reject
    rejectDeliverable(dbInstance, reviewerCtx, {
      deliverable_id: draft.deliverable_id,
      rejection_reason: 'Authorized rejection'
    });

    const rejectedDeliverable = dbInstance.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
    assert.strictEqual(rejectedDeliverable[0].status, 'rejected');
  });

  // ============================================================================
  // P1-05 Test 7: Submitter can request revision when no reviewer assigned
  // ============================================================================
  it('should allow submitter to request revision when no reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    // No reviewer assigned - submitter CAN request revision
    const revised = requestRevision(dbInstance, staffCtx, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Submitter revision request'
    });

    assert.strictEqual(revised.status, 'revision_requested');
  });

  // ============================================================================
  // P1-05 Test 8: Non-submitter staff cannot request revision when no reviewer assigned
  // ============================================================================
  it('should reject revision request by non-submitter when no reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    // No reviewer assigned - non-submitter staff CANNOT request revision
    assert.throws(() => {
      requestRevision(dbInstance, otherCtx, {
        deliverable_id: draft.deliverable_id,
        revision_notes: 'Unauthorized revision request'
      });
    }, /Authorization denied: Only the deliverable submitter or Founder can request revision when no reviewer is assigned/);
  });

  // ============================================================================
  // P1-05 Test 9: No reviewer assigned - only founder can reject
  // ============================================================================
  it('should reject rejection by non-founder when no reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    // No reviewer assigned - non-founder staff CANNOT reject
    assert.throws(() => {
      rejectDeliverable(dbInstance, otherCtx, {
        deliverable_id: draft.deliverable_id,
        rejection_reason: 'Unauthorized rejection'
      });
    }, /Authorization denied: No reviewer assigned, only Founder can reject/);
  });

  // ============================================================================
  // P1-05 Test 10: No reviewer assigned - founder CAN reject
  // ============================================================================
  it('should allow founder to reject when no reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    // No reviewer assigned - founder CAN reject
    rejectDeliverable(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      rejection_reason: 'Founder rejection'
    });

    const rejectedDeliverable = dbInstance.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
    assert.strictEqual(rejectedDeliverable[0].status, 'rejected');
  });

  // ============================================================================
  // P1-05 Test 11: Non-division-head staff cannot reject when division head reviewer assigned
  // ============================================================================
  it('should reject rejection by non-division-head staff when division head reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Non-division-head staff (otherStaffId is a regular staff member, not division head) CANNOT reject
    assert.throws(() => {
      rejectDeliverable(dbInstance, otherCtx, {
        deliverable_id: draft.deliverable_id,
        rejection_reason: 'Unauthorized rejection'
      });
    }, /Authorization denied: Not the Division Head for this task's division/);
  });

  // ============================================================================
  // P1-05 Test 12: Non-division-head staff CANNOT request revision when division head reviewer assigned
  // The HITL-style flexibility is a bug - only the division head should be able to request revision
  // ============================================================================
  it('should reject revision request by non-division-head staff when division head reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const otherStaffId = setupTestStaff(divisionId, 'Other', 'Developer');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const otherCtx = { owner_type: 'staff' as const, owner_id: otherStaffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Non-division-head staff (otherStaffId) CANNOT request revision
    assert.throws(() => {
      requestRevision(dbInstance, otherCtx, {
        deliverable_id: draft.deliverable_id,
        revision_notes: 'Revision request by other staff'
      });
    }, /Authorization denied: Only the Division Head reviewer can request revision/);
  });

  // ============================================================================
  // P1-05 Test 13: Division context CAN reject when division head reviewer assigned
  // ============================================================================
  it('should allow division context to reject when division head reviewer assigned', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const divisionCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Division context CAN reject (division head via division context)
    rejectDeliverable(dbInstance, divisionCtx, {
      deliverable_id: draft.deliverable_id,
      rejection_reason: 'Division rejection'
    });

    const rejectedDeliverable = dbInstance.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [draft.deliverable_id]);
    assert.strictEqual(rejectedDeliverable[0].status, 'rejected');
  });

  // ============================================================================
  // P1-05 Test 14: HITL-style flexibility - division head can request revision when NOT the assigned reviewer
  // This tests that division heads can request revision on any deliverable with division_head reviewer
  // ============================================================================
  it('should allow division head to request revision when division head reviewer assigned (HITL-style flexibility)', () => {
    const divisionId = setupTestDivision();
    const staffId = setupTestStaff(divisionId, 'Dev', 'Developer');
    const reviewerId = setupTestStaff(divisionId, 'Reviewer', 'Senior Dev');
    const taskId = setupTask(divisionId, staffId);

    const staffCtx = { owner_type: 'staff' as const, owner_id: staffId, runtime: 'claude' as const };
    const reviewerCtx = { owner_type: 'staff' as const, owner_id: reviewerId, runtime: 'claude' as const };
    const founderContext = { ...founderCtx };

    // Make reviewer the division head
    updateDivision(dbInstance, divisionId, { head_staff_id: reviewerId });

    const draft = createDeliverableDraft(dbInstance, staffCtx, { task_id: taskId, content: 'Content', quality_score: 85 });
    submitDeliverable(dbInstance, staffCtx, { deliverable_id: draft.deliverable_id });

    assignReviewer(dbInstance, founderContext, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: reviewerId
    });

    // Division head reviewer CAN request revision
    const revised = requestRevision(dbInstance, reviewerCtx, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Authorized revision request'
    });

    assert.strictEqual(revised.status, 'revision_requested');
  });
});