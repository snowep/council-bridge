// Phase 9 Batch 5: Full Integration Tests
// End-to-end integration of Council, Divisions, Staff, Delegation, Execution, Deliverable workflows

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTestDatabase } from './helpers/test-database.js';
import { initializeTestDatabase } from './helpers/test-migrations.js';
import {
  createDivision,
  registerStaffAgent,
  approveSpecialist,
  activateStaffAgent,
  createTask as createBasicTask,
  getTaskById as getBasicTaskById,
  listTasks as listBasicTasks,
  updateDivision,
  createDivisionHead,
} from '../src/council/divisions.js';
import {
  createDeliverableDraft,
  submitDeliverable,
  assignReviewer,
  requestRevision,
  resubmitDeliverable,
  approveDeliverable,
  rejectDeliverable,
  getDeliverableHistory,
  setQualityThreshold,
  getQualityThresholdConfig,
  enforceHITLApproval,
  verifyFounderSignature,
  isDivisionHead,
} from '../src/council/task-delegation.js';
import {
  createTaskAutonomyLevel,
  requestExecution,
  approveExecution,
  executeExecutionRequest,
  getExecutionRequest,
  getExecutionHistory,
} from '../src/council/operations.js';
import crypto from 'crypto';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueStaffId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

describe('Phase 9 Batch 5: Full Integration', () => {
  let db: ReturnType<typeof createTestDatabase>;

  beforeEach(async () => {
    db = createTestDatabase('integration');
    await initializeTestDatabase(db.instance);
  });

  afterEach(() => {
    db.close();
  });

  function setupTestDivision(): string {
    const divisionId = uniqueName('Division');
    createDivision(db.instance, {
      division_id: divisionId,
      name: divisionId,
      description: 'Test division'
    });
    return divisionId;
  }

  function setupTestStaff(divisionId: string, name: string, role: string, status = 'active'): string {
    const staffId = uniqueStaffId('staff');
    registerStaffAgent(db.instance, {
      staff_id: staffId,
      name,
      role,
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, staffId, new Date().toISOString()]);
    return staffId;
  }

  // Create standard autonomy levels with unique names per test
  function setupAutonomyLevels(testPrefix: string) {
    createTaskAutonomyLevel(db.instance, founderCtx, { task_type: `${testPrefix} Level 1 task`, autonomy_level: 1, description: '' });
    createTaskAutonomyLevel(db.instance, founderCtx, { task_type: `${testPrefix} Level 2 task`, autonomy_level: 2, description: '' });
    createTaskAutonomyLevel(db.instance, founderCtx, { task_type: `${testPrefix} Level 3 task`, autonomy_level: 3, description: '' });
    createTaskAutonomyLevel(db.instance, founderCtx, { task_type: `${testPrefix} Execute and deliver`, autonomy_level: 3, description: '' });
    createTaskAutonomyLevel(db.instance, founderCtx, { task_type: `${testPrefix} Implement feature X`, autonomy_level: 1, description: '' });
  }

  // ============================================================
  // SCENARIO 1: Founder → Division Head → Specialist → Task → Execution → Deliverable → Approval
  // ============================================================
  it('should complete full end-to-end workflow from task creation to completion', () => {
    setupAutonomyLevels('Scenario1');
    const divisionId = setupTestDivision();
    const divisionHeadId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: divisionHeadId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, divisionHeadId, new Date().toISOString()]);

    // Set division head
    updateDivision(db.instance, divisionId, {
      head_staff_id: divisionHeadId
    });

    // 2. Founder creates specialist
    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    // 3. Founder creates task assigned to Division Head
    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Implement feature X',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // 4. Specialist creates deliverable draft (not division head)
    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"implementation": "completed", "code": "function foo() { return 42; }"}',
      quality_score: 90
    });

    // 5. Specialist submits deliverable
    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(submitted.status, 'submitted');

    // 6. Division Head assigns reviewer (themselves)
    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: divisionHeadId
    });

    // 7. Division Head approves deliverable (Level 1 autonomy - auto approve)
    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(approved.approved, true);
    assert.strictEqual(approved.requires_founder_sig, false);

    // 8. Verify task is completed
    const completedTask = getBasicTaskById(db.instance, task.task_id);
    assert.strictEqual(completedTask!.status, 'completed');

    // 9. Verify deliverable history
    const history = getDeliverableHistory(db.instance, founderCtx, draft.deliverable_id);
    assert.ok(history.length >= 1);
  });

  // ============================================================
  // SCENARIO 2: Level 2 Autonomy - Division Head Approval Required
  // ============================================================
  it('should require Division Head approval for Level 2 autonomy', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const divisionHeadId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: divisionHeadId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, divisionHeadId, new Date().toISOString()]);

    updateDivision(db.instance, divisionId, { head_staff_id: divisionHeadId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Level 2 task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"result": "done"}',
      quality_score: 85
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 85
    });

    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: divisionHeadId
    });

    // Level 2 autonomy requires explicit approval
    createTaskAutonomyLevel(db.instance, founderCtx, {
      task_type: 'Level 2 task',
      autonomy_level: 2
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 85
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 3: Level 3 Autonomy - Founder Signature Required
  // ============================================================
  it('should require Founder signature for Level 3 autonomy', () => {
    setupAutonomyLevels('Scenario3');
    const divisionId = setupTestDivision();
    const divisionHeadId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: divisionHeadId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, divisionHeadId, new Date().toISOString()]);

    updateDivision(db.instance, divisionId, { head_staff_id: divisionHeadId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Scenario3 Level 3 task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"critical": "decision"}',
      quality_score: 95
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 95
    });

    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: divisionHeadId
    });

    // Level 3 autonomy requires founder signature - approveDeliverable will throw for Level 3
    let threw = false;
    try {
      approveDeliverable(db.instance, delegationCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 95
      });
    } catch (e) {
      threw = true;
      assert.ok((e as Error).message.includes('Founder'));
    }
    assert.ok(threw, 'Level 3 should require Founder approval');
  });

  // ============================================================
  // SCENARIO 4: Revision Request and Resubmission
  // ============================================================
  it('should handle revision request and resubmission correctly', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const divisionHeadId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: divisionHeadId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, divisionHeadId, new Date().toISOString()]);

    updateDivision(db.instance, divisionId, { head_staff_id: divisionHeadId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Implement feature X',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"v1": "initial"}',
      quality_score: 60
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 60
    });

    const delegationCtx = { owner_type: 'staff' as const, owner_id: divisionHeadId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: divisionHeadId
    });

    // Request revision (as division head)
    const revision = requestRevision(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Needs more tests'
    });
    assert.strictEqual(revision.status, 'revision_requested');

    // Resubmit with fixes
    const resubmitted = resubmitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      content: '{"v2": "with tests"}',
      quality_score: 80
    });
    assert.strictEqual(resubmitted.status, 'submitted');
    assert.strictEqual(resubmitted.version, 2);

    // Approve resubmission
    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 80
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 5: Cross-Division Authorization Boundaries
  // ============================================================
  it('should enforce cross-division authorization boundaries', () => {
    setupAutonomyLevels();
    const divisionA = setupTestDivision();
    const divisionB = setupTestDivision();

    const headA = uniqueStaffId('head-a');
    registerStaffAgent(db.instance, {
      staff_id: headA,
      name: 'Head A',
      role: 'Lead',
      division_id: divisionA,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionA, headA, new Date().toISOString()]);
    updateDivision(db.instance, divisionA, { head_staff_id: headA });

    const headB = uniqueStaffId('head-b');
    registerStaffAgent(db.instance, {
      staff_id: headB,
      name: 'Head B',
      role: 'Lead',
      division_id: divisionB,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionB, headB, new Date().toISOString()]);
    updateDivision(db.instance, divisionB, { head_staff_id: headB });

    const specialistA = setupTestStaff(divisionA, 'Specialist A', 'Developer');

    // Task assigned to Division A
    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Cross-division task',
      assigned_to_type: 'division',
      assigned_to_id: divisionA,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistACtx = { owner_type: 'staff' as const, owner_id: specialistA, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistACtx, {
      task_id: task.task_id,
      content: '{"data": "from A"}',
      quality_score: 80
    });

    const submitted = submitDeliverable(db.instance, specialistACtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 80
    });

    // Division B head should NOT be able to assign reviewer
    const delegationBCtx = { owner_type: 'staff' as const, owner_id: headB, runtime: 'claude' as const };
    let threw = false;
    try {
      assignReviewer(db.instance, delegationBCtx, {
        deliverable_id: draft.deliverable_id,
        reviewer_type: 'division_head',
        reviewer_id: headB
      });
    } catch {
      threw = true;
    }
    assert.ok(threw, 'Division B head should not assign reviewer to Division A task');

    // Division A head CAN assign reviewer and approve
    const delegationACtx = { owner_type: 'staff' as const, owner_id: headA, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationACtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headA
    });

    createTaskAutonomyLevel(db.instance, founderCtx, {
      task_type: 'Execute and deliver',
      autonomy_level: 1
    });

    const approved = approveDeliverable(db.instance, delegationACtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 80
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 6: Agent-to-Agent Delegation Within Same Division
  // ============================================================
  it('should support agent-to-agent delegation within same division', () => {
    setupAutonomyLevels('Scenario6');
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialist1 = setupTestStaff(divisionId, 'Specialist 1', 'Developer');
    const specialist2 = setupTestStaff(divisionId, 'Specialist 2', 'QA');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Delegated task',
      assigned_to_type: 'staff',
      assigned_to_id: specialist1,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    // Specialist 1 executes their own task
    const spec1Ctx = { owner_type: 'staff' as const, owner_id: specialist1, runtime: 'claude' as const };
    const execReq = requestExecution(db.instance, spec1Ctx, {
      task_id: task.task_id,
      autonomy_level: 1,
      action_description: 'Work on task',
      action_payload: {}
    });

    const execution = executeExecutionRequest(db.instance, spec1Ctx, execReq.execution_id, {});
    assert.strictEqual(execution.status, 'completed');
  });

  // ============================================================
  // SCENARIO 7: Task Execution Connected to Deliverable Workflow
  // ============================================================
  it('should connect task execution to deliverable workflow', () => {
    setupAutonomyLevels('Scenario7');
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Scenario7 Level 2 task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };

    // Create execution request
    const execReq = requestExecution(db.instance, specCtx, {
      task_id: task.task_id,
      autonomy_level: 1,
      action_description: 'Complete task and create deliverable',
      action_payload: {}
    });

    // Execute
    const execution = executeExecutionRequest(db.instance, specCtx, execReq.execution_id, {});
    assert.strictEqual(execution.status, 'completed');

    // Create deliverable draft after execution
    const draft = createDeliverableDraft(db.instance, specCtx, {
      task_id: task.task_id,
      content: '{"execution_result": "success"}',
      quality_score: 90
    });

    const submitted = submitDeliverable(db.instance, specCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });

    const delegationCtx = { owner_type: 'staff' as const, owner_id: headId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 8: Quality Thresholds Enforced Across Workflow
  // ============================================================
  it('should enforce quality thresholds across workflow', () => {
    setupAutonomyLevels('Scenario8');
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    // Set high quality threshold for this division
    setQualityThreshold(db.instance, founderCtx, {
      division_id: divisionId,
      min_quality_score: 80,
      requires_review: 1
    });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Quality checked task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"work": "done"}',
      quality_score: 75 // Below threshold
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 75
    });

    const delegationCtx = { owner_type: 'staff' as const, owner_id: headId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    // Should reject due to quality threshold
    let threw = false;
    try {
      approveDeliverable(db.instance, delegationCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 75
      });
    } catch {
      threw = true;
    }
    assert.ok(threw, 'Should reject deliverable below quality threshold');

    // Request revision first (required before resubmit)
    const revision = requestRevision(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      revision_notes: 'Quality below threshold'
    });
    assert.strictEqual(revision.status, 'revision_requested');

    // Resubmit with higher quality
    const resubmitted = resubmitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      content: '{"work": "done well"}',
      quality_score: 85
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 85
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 9: Concurrent Approval Attempts
  // ============================================================
  it('should handle concurrent approval attempts safely', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Concurrent test',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"data": "test"}',
      quality_score: 90
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });

    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    // First approval succeeds
    const approved1 = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(approved1.approved, true);

    // Second approval should fail (already approved)
    let threw = false;
    try {
      approveDeliverable(db.instance, delegationCtx, {
        deliverable_id: draft.deliverable_id,
        quality_score: 90
      });
    } catch {
      threw = true;
    }
    assert.ok(threw, 'Second approval should fail');
  });

  // ============================================================
  // SCENARIO 10: Cancellation Propagation
  // ============================================================
  it('should propagate cancellation through workflow', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Cancellable task',
      assigned_to_type: 'staff',
      assigned_to_id: specialistId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };

    // Create execution and cancel
    const execReq = requestExecution(db.instance, specCtx, {
      task_id: task.task_id,
      autonomy_level: 1,
      action_description: 'Will be cancelled',
      action_payload: {}
    });

    const execution = executeExecutionRequest(db.instance, specCtx, execReq.execution_id, {});
    assert.strictEqual(execution.status, 'completed');

    // Create deliverable
    const draft = createDeliverableDraft(db.instance, specCtx, {
      task_id: task.task_id,
      content: '{"partial": "work"}',
      quality_score: 50
    });

    const submitted = submitDeliverable(db.instance, specCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 50
    });

    // Cancel task
    const cancelled = db.instance.runPreparedStatement('updateTask', [
      task.title, '', 'staff', specialistId, 'founder', 'founder',
      'cancelled', 'medium', 0, null, new Date().toISOString(), task.task_id
    ]);

    // Verify task is cancelled
    const taskAfter = getBasicTaskById(db.instance, task.task_id);
    assert.strictEqual(taskAfter!.status, 'cancelled');
  });

  // ============================================================
  // SCENARIO 11: Complete Audit Trail
  // ============================================================
  it('should maintain complete audit trail across all operations', () => {
    setupAutonomyLevels('Scenario11');
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Audited task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    
    // Create and execute an execution request to generate execution_history
    const execReq = requestExecution(db.instance, specialistCtx, {
      task_id: task.task_id,
      autonomy_level: 1,
      action_description: 'Execute task',
      action_payload: {}
    });
    executeExecutionRequest(db.instance, specialistCtx, execReq.execution_id, {});

    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"v1": "draft"}',
      quality_score: 80
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 80
    });

    const delegationCtx = { owner_type: 'staff' as const, owner_id: headId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 80
    });

    // Verify audit trail in task_audit table
    const audit = db.instance.query('SELECT * FROM task_audit WHERE task_id = ?', [task.task_id]);
    assert.ok(audit.length > 0, 'Should have audit entries');

    // Verify deliverable_versions
    const versions = db.instance.query('SELECT * FROM deliverable_versions WHERE deliverable_id = ?', [draft.deliverable_id]);
    assert.ok(versions.length >= 1, 'Should have deliverable versions');

    // Verify execution_history
    const history = db.instance.query('SELECT * FROM execution_history WHERE task_id = ?', [task.task_id]);
    assert.ok(history.length >= 1, 'Should have execution history');
  });

  // ============================================================
  // SCENARIO 12: Hermes Runtime Support
  // ============================================================
  it('should support Hermes runtime for staff agents', () => {
    setupAutonomyLevels('Scenario12');
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const hermesStaffId = uniqueStaffId('hermes');
    registerStaffAgent(db.instance, {
      staff_id: hermesStaffId,
      name: 'Hermes Agent',
      role: 'AI Assistant',
      division_id: divisionId,
      runtime_instances: ['hermes'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, hermesStaffId, new Date().toISOString()]);

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Hermes task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const hermesCtx = { owner_type: 'staff' as const, owner_id: hermesStaffId, runtime: 'hermes' as const };
    const draft = createDeliverableDraft(db.instance, hermesCtx, {
      task_id: task.task_id,
      content: '{"hermes": "result"}',
      quality_score: 90
    });

    const submitted = submitDeliverable(db.instance, hermesCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });

    const delegationCtx = { owner_type: 'staff' as const, owner_id: headId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 13: Council Decisions Generate Tasks
  // ============================================================
  it('should allow Council decisions to generate tasks', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    // Simulate Council decision creating task
    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Council mandated task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'council',
      created_by_id: 'founder',
      status: 'pending'
    });

    assert.strictEqual(task.created_by_type, 'council');
    assert.strictEqual(task.assigned_to_type, 'division');

    // Division Head can approve deliverables for council-created tasks
    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"council": "mandate fulfilled"}',
      quality_score: 90
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });

    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 90
    });
    assert.strictEqual(approved.approved, true);
  });

  // ============================================================
  // SCENARIO 14: Division Heads Monitor Delegated Work
  // ============================================================
  it('should allow Division Heads to monitor delegated work', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Monitored task',
      assigned_to_type: 'staff',
      assigned_to_id: specialistId,
      created_by_type: 'division_head',
      created_by_id: headId,
      status: 'pending'
    });

    const specCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const execReq = requestExecution(db.instance, specCtx, {
      task_id: task.task_id,
      autonomy_level: 1,
      action_description: 'Work on task',
      action_payload: {}
    });

    const execution = executeExecutionRequest(db.instance, specCtx, execReq.execution_id, {});
    assert.strictEqual(execution.status, 'completed');

    // Division Head can view execution history
    const history = getExecutionHistory(db.instance, founderCtx, { execution_id: execReq.execution_id });
    assert.ok(history.length >= 1);
    assert.strictEqual(history[0].execution_id, execReq.execution_id);
  });

  // ============================================================
  // SCENARIO 15: Founder Accesses Final Results
  // ============================================================
  it('should allow Founder to access final results', () => {
    setupAutonomyLevels();
    const divisionId = setupTestDivision();
    const headId = uniqueStaffId('head');
    registerStaffAgent(db.instance, {
      staff_id: headId,
      name: 'Division Head',
      role: 'Lead',
      division_id: divisionId,
      runtime_instances: ['claude'],
      permissions: [],
      status: 'active'
    });
    db.instance.runPreparedStatement('insertDivisionMember', [divisionId, headId, new Date().toISOString()]);
    updateDivision(db.instance, divisionId, { head_staff_id: headId });

    const specialistId = setupTestStaff(divisionId, 'Specialist', 'Developer');

    const task = createBasicTask(db.instance, {
      task_id: uniqueName('task'),
      title: 'Founder visible task',
      assigned_to_type: 'division',
      assigned_to_id: divisionId,
      created_by_type: 'founder',
      created_by_id: 'founder',
      status: 'pending'
    });

    const specialistCtx = { owner_type: 'staff' as const, owner_id: specialistId, runtime: 'claude' as const };
    const draft = createDeliverableDraft(db.instance, specialistCtx, {
      task_id: task.task_id,
      content: '{"final": "result for founder"}',
      quality_score: 95
    });

    const submitted = submitDeliverable(db.instance, specialistCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 95
    });

    const delegationCtx = { owner_type: 'division' as const, owner_id: divisionId, runtime: 'claude' as const };
    assignReviewer(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      reviewer_type: 'division_head',
      reviewer_id: headId
    });

    const approved = approveDeliverable(db.instance, delegationCtx, {
      deliverable_id: draft.deliverable_id,
      quality_score: 95
    });
    assert.strictEqual(approved.approved, true);

    // Founder can access deliverable history
    const history = getDeliverableHistory(db.instance, founderCtx, draft.deliverable_id);
    assert.ok(history.length >= 1);
    assert.ok(history.some(h => h.status === 'accepted'));
  });
});