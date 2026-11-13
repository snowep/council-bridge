import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import { createCouncilService, CouncilService, Task, TaskAutonomyLevel, ExecutionRequest, ApprovalRequest, ExecutionHistory, AutonomyLevel } from '../src/council.js';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-phase7-test.db');

let testDbInstance: DatabaseInstance;
let council: CouncilService;

function setupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
      const shmPath = TEST_DB_PATH + '-shm';
      const walPath = TEST_DB_PATH + '-wal';
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    } catch (e) {
      // Ignore if locked by another process
    }
  }
  const instance = createDatabase(TEST_DB_PATH);
  return instance;
}

function createTestSetup(council: CouncilService) {
  const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

  const division = council.createDivision(founderCtx, {
    name: 'Research Division',
    description: 'Test division'
  });

  const staff = council.registerStaffAgent(founderCtx, {
    staff_id: 'staff-001',
    name: 'Research Staff',
    role: 'Researcher',
    division_id: division.division_id,
    runtime_instances: ['claude'],
    permissions: []
  });

  council.updateStaffStatus(founderCtx, { staff_id: 'staff-001', status: 'active' });

  const task = council.createTask(founderCtx, {
    title: 'research',
    description: 'Research task',
    assigned_to_type: 'staff',
    assigned_to_id: 'staff-001',
    created_by_type: 'founder',
    created_by_id: 'founder',
    status: 'pending',
    priority: 'medium'
  });

  council.createTaskAutonomyLevel(founderCtx, {
    task_type: 'research',
    autonomy_level: 1,
    description: 'Autonomous research'
  });

  const staffCtx = { owner_type: 'staff' as const, owner_id: 'staff-001', runtime: 'claude' as const };

  return { founderCtx, staffCtx, division, staff, task };
}

function createLevel3Setup(council: CouncilService) {
  const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

  const division = council.createDivision(founderCtx, { name: 'Research', description: 'Test' });
  const staff = council.registerStaffAgent(founderCtx, {
    staff_id: 'staff-001', name: 'Researcher', role: 'Researcher',
    division_id: division.division_id, runtime_instances: ['claude'], permissions: []
  });
  council.updateStaffStatus(founderCtx, { staff_id: 'staff-001', status: 'active' });

  const task = council.createTask(founderCtx, {
    title: 'deployment', description: 'Deploy task',
    assigned_to_type: 'staff', assigned_to_id: 'staff-001',
    created_by_type: 'founder', created_by_id: 'founder',
    status: 'pending', priority: 'high'
  });

  council.createTaskAutonomyLevel(founderCtx, {
    task_type: 'deployment', autonomy_level: 3
  });

  const staffCtx = { owner_type: 'staff' as const, owner_id: 'staff-001', runtime: 'claude' as const };
  const execution = council.requestExecution(staffCtx, {
    task_id: task.task_id,
    action_description: 'Deploy to production',
    action_payload: { env: 'prod' }
  });

  return { founderCtx, staffCtx, execution, task, division };
}

describe('Phase 7: Autonomy Levels', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        const shmPath = TEST_DB_PATH + '-shm';
        const walPath = TEST_DB_PATH + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('Founder can create task autonomy level', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    const level = council.createTaskAutonomyLevel(ctx, {
      task_type: 'research',
      autonomy_level: 1,
      description: 'Autonomous research tasks'
    });

    assert.strictEqual(level.task_type, 'research');
    assert.strictEqual(level.autonomy_level, 1);
    assert.strictEqual(level.description, 'Autonomous research tasks');
    assert.ok(level.created_at);
    assert.ok(level.updated_at);
  });

  test('Founder can create Level 2 autonomy level', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    const level = council.createTaskAutonomyLevel(ctx, {
      task_type: 'analysis',
      autonomy_level: 2,
      description: 'Bounded execution with permission check'
    });

    assert.strictEqual(level.autonomy_level, 2);
  });

  test('Founder can create Level 3 autonomy level', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    const level = council.createTaskAutonomyLevel(ctx, {
      task_type: 'deployment',
      autonomy_level: 3,
      description: 'Requires Founder approval'
    });

    assert.strictEqual(level.autonomy_level, 3);
  });

  test('Non-Founder cannot create autonomy level', () => {
    const ctx = { owner_type: 'staff' as const, owner_id: 'staff-001', runtime: 'claude' as const };
    assert.throws(() => {
      council.createTaskAutonomyLevel(ctx, {
        task_type: 'test',
        autonomy_level: 1
      });
    }, /Only Founder can define task autonomy levels/);
  });

  test('Cannot create duplicate autonomy level for same task type', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    council.createTaskAutonomyLevel(ctx, {
      task_type: 'research',
      autonomy_level: 1
    });

    assert.throws(() => {
      council.createTaskAutonomyLevel(ctx, {
        task_type: 'research',
        autonomy_level: 2
      });
    }, /already exists/);
  });

  test('Get task autonomy level by task type', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    council.createTaskAutonomyLevel(ctx, {
      task_type: 'planning',
      autonomy_level: 1,
      description: 'Planning tasks'
    });

    const level = council.getTaskAutonomyLevel(ctx, 'planning');
    assert.ok(level);
    assert.strictEqual(level!.task_type, 'planning');
    assert.strictEqual(level!.autonomy_level, 1);

    const notFound = council.getTaskAutonomyLevel(ctx, 'nonexistent');
    assert.strictEqual(notFound, undefined);
  });

  test('List all task autonomy levels', () => {
    const ctx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    council.createTaskAutonomyLevel(ctx, { task_type: 'research', autonomy_level: 1 });
    council.createTaskAutonomyLevel(ctx, { task_type: 'analysis', autonomy_level: 2 });
    council.createTaskAutonomyLevel(ctx, { task_type: 'deployment', autonomy_level: 3 });

    const levels = council.listTaskAutonomyLevels(ctx);
    assert.strictEqual(levels.length, 3);
    const types = levels.map(l => l.task_type).sort();
    assert.deepStrictEqual(types, ['analysis', 'deployment', 'research']);
  });
});

describe('Phase 7: Execution Requests', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        const shmPath = TEST_DB_PATH + '-shm';
        const walPath = TEST_DB_PATH + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('Staff can request Level 1 (autonomous) execution', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research analysis',
      action_payload: { dataset: 'test' }
    });

    assert.ok(execution.execution_id);
    assert.strictEqual(execution.task_id, task.task_id);
    assert.strictEqual(execution.requested_by_type, 'staff');
    assert.strictEqual(execution.requested_by_id, 'staff-001');
    assert.strictEqual(execution.autonomy_level, 1);
    assert.strictEqual(execution.status, 'queued');
    assert.strictEqual(execution.action_description, 'Run research analysis');
  });

  test('Staff can request Level 2 (bounded) execution', () => {
    const { task, staffCtx, founderCtx } = createTestSetup(council);
    council.createTaskAutonomyLevel(founderCtx, {
      task_type: 'analysis',
      autonomy_level: 2
    });

    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      autonomy_level: 2,
      action_description: 'Run bounded analysis',
      action_payload: {}
    });

    assert.strictEqual(execution.autonomy_level, 2);
    assert.strictEqual(execution.status, 'permission_check');
  });

  test('Staff can request Level 3 (founder approval) execution', () => {
    const { task, staffCtx, founderCtx } = createTestSetup(council);
    council.createTaskAutonomyLevel(founderCtx, {
      task_type: 'deployment',
      autonomy_level: 3
    });

    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      autonomy_level: 3,
      action_description: 'Deploy to production',
      action_payload: { env: 'prod' }
    });

    assert.strictEqual(execution.autonomy_level, 3);
    assert.strictEqual(execution.status, 'approval_required');
    assert.ok(execution.approval_request_id);
  });

  test('Division Head can request execution for division tasks', () => {
    const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    const division = council.createDivision(founderCtx, { name: 'Ops', description: 'Test division' });
    const head = council.registerStaffAgent(founderCtx, {
      staff_id: 'head-001', name: 'Ops Head', role: 'head',
      division_id: division.division_id, runtime_instances: ['claude'], permissions: []
    });
    council.updateStaffStatus(founderCtx, { staff_id: 'head-001', status: 'active' });

    const task = council.createTask(founderCtx, {
      title: 'ops-task', description: 'Ops task',
      assigned_to_type: 'division', assigned_to_id: division.division_id,
      created_by_type: 'founder', created_by_id: 'founder',
      status: 'pending', priority: 'high'
    });

    // Set division head
    testDbInstance.db.exec(`UPDATE divisions SET head_staff_id = 'head-001' WHERE division_id = '${division.division_id}'`);

    const divCtx = { owner_type: 'division' as const, owner_id: division.division_id, runtime: 'claude' as const };

    const execution = council.requestExecution(divCtx, {
      task_id: task.task_id,
      action_description: 'Division head requests execution',
      action_payload: {}
    });

    assert.strictEqual(execution.requested_by_type, 'division');
    assert.strictEqual(execution.requested_by_id, division.division_id);
  });

  test('Staff cannot request execution for other staff tasks', () => {
    const { task, division, founderCtx } = createTestSetup(council);
    council.registerStaffAgent(founderCtx, {
      staff_id: 'staff-002',
      name: 'Other Staff',
      role: 'Analyst',
      division_id: division.division_id,
      runtime_instances: ['claude'],
      permissions: []
    });
    council.updateStaffStatus(founderCtx, { staff_id: 'staff-002', status: 'active' });

    const ctx2 = { owner_type: 'staff' as const, owner_id: 'staff-002', runtime: 'claude' as const };
    assert.throws(() => {
      council.requestExecution(ctx2, {
        task_id: task.task_id,
        action_description: 'Unauthorized request',
        action_payload: {}
      });
    }, /Staff can only request execution for their own tasks/);
  });

  test('Get execution request by ID', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Test execution',
      action_payload: {}
    });

    const retrieved = council.getExecutionRequest(staffCtx, { execution_id: execution.execution_id });
    assert.ok(retrieved);
    assert.strictEqual(retrieved!.execution_id, execution.execution_id);
  });

  test('Staff cannot access other execution requests', () => {
    const { task, division, founderCtx } = createTestSetup(council);
    council.registerStaffAgent(founderCtx, {
      staff_id: 'staff-002',
      name: 'Other Staff',
      role: 'Analyst',
      division_id: division.division_id,
      runtime_instances: ['claude'],
      permissions: []
    });
    council.updateStaffStatus(founderCtx, { staff_id: 'staff-002', status: 'active' });

    const staffCtx1 = { owner_type: 'staff' as const, owner_id: 'staff-001', runtime: 'claude' as const };
    const execution = council.requestExecution(staffCtx1, {
      task_id: task.task_id,
      action_description: 'Test',
      action_payload: {}
    });

    const staffCtx2 = { owner_type: 'staff' as const, owner_id: 'staff-002', runtime: 'claude' as const };
    assert.throws(() => {
      council.getExecutionRequest(staffCtx2, { execution_id: execution.execution_id });
    }, /Access denied/);
  });

  test('Founder can access all execution requests', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Test',
      action_payload: {}
    });

    const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };
    const retrieved = council.getExecutionRequest(founderCtx, { execution_id: execution.execution_id });
    assert.ok(retrieved);
  });

  test('List execution requests with filters', () => {
    const { task, division, founderCtx, staffCtx } = createTestSetup(council);
    council.requestExecution(staffCtx, { task_id: task.task_id, action_description: 'Exec 1', action_payload: {} });
    council.requestExecution(staffCtx, { task_id: task.task_id, action_description: 'Exec 2', action_payload: {} });

    const all = council.listExecutionRequests(founderCtx, {});
    assert.ok(all.length >= 2);

    const queued = council.listExecutionRequests(founderCtx, { status: 'queued' });
    assert.ok(queued.length >= 2);

    const autonomy1 = council.listExecutionRequests(founderCtx, { autonomy_level: 1 });
    assert.ok(autonomy1.length >= 2);

    const staffRequests = council.listExecutionRequests(founderCtx, { requested_by_type: 'staff' });
    assert.ok(staffRequests.length >= 2);

    const divisionRequests = council.listExecutionRequests(founderCtx, { requested_by_type: 'division' });
    assert.strictEqual(divisionRequests.length, 0);
  });
});

describe('Phase 7: Approval Workflow', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        const shmPath = TEST_DB_PATH + '-shm';
        const walPath = TEST_DB_PATH + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('Founder can approve Level 3 execution', () => {
    const { execution, founderCtx } = createLevel3Setup(council);

    const result = council.approveExecution(founderCtx, {
      approval_request_id: execution.approval_request_id!,
      approved: true
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'approved');
    assert.ok(result.execution_id);

    const updated = council.getExecutionRequest(founderCtx, { execution_id: execution.execution_id });
    assert.strictEqual(updated!.status, 'approved');
  });

  test('Founder can reject Level 3 execution', () => {
    const { execution, founderCtx } = createLevel3Setup(council);

    const result = council.approveExecution(founderCtx, {
      approval_request_id: execution.approval_request_id!,
      approved: false,
      rejection_reason: 'Insufficient testing'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'rejected');

    const updated = council.getExecutionRequest(founderCtx, { execution_id: execution.execution_id });
    assert.strictEqual(updated!.status, 'rejected');
    assert.ok(updated!.error_message?.includes('Insufficient testing'));
  });

  test('Non-Founder cannot approve execution', () => {
    const { execution, staffCtx } = createLevel3Setup(council);

    assert.throws(() => {
      council.approveExecution(staffCtx, {
        approval_request_id: execution.approval_request_id!,
        approved: true
      });
    }, /Only Founder can approve/);
  });

  test('Self-approval not allowed when founder requests', () => {
    const { execution, founderCtx } = createLevel3Setup(council);
    // The requester is staff, not founder, so this should work
    const result = council.approveExecution(founderCtx, {
      approval_request_id: execution.approval_request_id!,
      approved: true
    });
    assert.strictEqual(result.success, true);
  });

  test('List approval requests (Founder only)', () => {
    createLevel3Setup(council);
    const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

    const approvals = council.listApprovalRequests(founderCtx, {});
    assert.ok(approvals.length >= 1);
    assert.strictEqual(approvals[0].status, 'pending');
  });

  test('Non-Founder cannot list approval requests', () => {
    createLevel3Setup(council);
    const staffCtx = { owner_type: 'staff' as const, owner_id: 'staff-001', runtime: 'claude' as const };

    assert.throws(() => {
      council.listApprovalRequests(staffCtx, {});
    }, /Only Founder can list approval requests/);
  });
});

describe('Phase 7: Execution History', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        const shmPath = TEST_DB_PATH + '-shm';
        const walPath = TEST_DB_PATH + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('Get execution history for completed execution', () => {
    const { task, staffCtx, founderCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research',
      action_payload: {}
    });

    council.executeExecutionRequest(staffCtx, execution.execution_id, { result: 'success' });

    const history = council.getExecutionHistory(staffCtx, { execution_id: execution.execution_id });
    assert.ok(history.length >= 3);
    assert.strictEqual(history[0].execution_id, execution.execution_id);
    assert.strictEqual(history[0].status_before, 'proposed');
    assert.strictEqual(history[0].status_after, 'queued');
    assert.strictEqual(history[1].status_before, 'queued');
    assert.strictEqual(history[1].status_after, 'running');
    assert.strictEqual(history[2].status_before, 'running');
    assert.strictEqual(history[2].status_after, 'completed');
  });

  test('Staff can access their own execution history', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research',
      action_payload: {}
    });
    council.executeExecutionRequest(staffCtx, execution.execution_id, { result: 'success' });

    const history = council.getExecutionHistory(staffCtx, { execution_id: execution.execution_id });
    assert.ok(history.length >= 1);
  });

  test('Founder can access all execution history', () => {
    const { task, staffCtx, founderCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research',
      action_payload: {}
    });
    council.executeExecutionRequest(staffCtx, execution.execution_id, { result: 'success' });

    const history = council.getExecutionHistory(founderCtx, { execution_id: execution.execution_id });
    assert.ok(history.length >= 1);
  });
});

describe('Phase 7: Execution Lifecycle', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
        const shmPath = TEST_DB_PATH + '-shm';
        const walPath = TEST_DB_PATH + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('Execute queued Level 1 execution', () => {
    const { task, staffCtx, founderCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research',
      action_payload: {}
    });

    assert.strictEqual(execution.status, 'queued');

    const executed = council.executeExecutionRequest(staffCtx, execution.execution_id, { result: 'completed' });
    assert.strictEqual(executed.status, 'completed');
    assert.ok(executed.result_payload);
    assert.ok(executed.completed_at);
  });

  test('Execute approved Level 3 execution', () => {
    const { execution, staffCtx, founderCtx } = createLevel3Setup(council);
    assert.strictEqual(execution.status, 'approval_required');

    council.approveExecution(founderCtx, {
      approval_request_id: execution.approval_request_id!,
      approved: true
    });

    const executed = council.executeExecutionRequest(staffCtx, execution.execution_id, { deployed: true });
    assert.strictEqual(executed.status, 'completed');
  });

  test('Cannot execute unapproved Level 3', () => {
    const { execution, staffCtx } = createLevel3Setup(council);

    assert.throws(() => {
      council.executeExecutionRequest(staffCtx, execution.execution_id);
    }, /Level 3 execution requires Founder approval/);
  });

  test('Cancel execution request', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Test',
      action_payload: {}
    });

    const cancelled = council.cancelExecutionRequest(staffCtx, execution.execution_id);
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.ok(cancelled.completed_at);
  });

  test('Cannot cancel completed execution', () => {
    const { task, staffCtx } = createTestSetup(council);
    const execution = council.requestExecution(staffCtx, {
      task_id: task.task_id,
      action_description: 'Run research',
      action_payload: {}
    });
    council.executeExecutionRequest(staffCtx, execution.execution_id);

    assert.throws(() => {
      council.cancelExecutionRequest(staffCtx, execution.execution_id);
    }, /Cannot cancel execution with status: completed/);
  });
});