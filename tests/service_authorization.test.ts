import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import { createCouncilService, CouncilService } from '../src/council.js';
import crypto from 'crypto';

let db: DatabaseInstance;
let council: CouncilService;

const founder = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

function setup(): void {
  db = createDatabase(':memory:');
  council = createCouncilService(db);
}

afterEach(() => {
  db.db.exec('DROP TRIGGER IF EXISTS fail_execution_history');
  db.close();
});

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

describe('service-layer authorization', () => {
  it('rejects unauthenticated service calls and creator identity substitution', () => {
    setup();
    const division = council.createDivision(founder, { name: uniqueName('Research') });
    const staffId = uniqueName('staff');
    const staff = council.registerStaffAgent(founder, {
      staff_id: staffId,
      name: 'Researcher',
      role: 'Researcher',
      division_id: division.division_id,
      runtime_instances: ['claude'],
    });
    const staffContext = {
      owner_type: 'staff' as const,
      owner_id: staff.staff_id,
      runtime: 'claude' as const,
    };

    assert.throws(() => council.createTask(undefined as never, {
      title: 'Unauthenticated task',
      assigned_to_type: 'staff',
      assigned_to_id: staff.staff_id,
      created_by_type: 'founder',
      created_by_id: 'founder',
    }), /Authentication required/);

    assert.throws(() => council.createTask(staffContext, {
      title: 'Forged creator task',
      assigned_to_type: 'staff',
      assigned_to_id: staff.staff_id,
      created_by_type: 'founder',
      created_by_id: 'founder',
    }), /Task creator must match authenticated identity/);
  });

  it('filters task and deliverable lookups by assignment ownership', () => {
    setup();
    const division = council.createDivision(founder, { name: uniqueName('Research') });
    const staffId1 = uniqueName('staff');
    const staffId2 = uniqueName('staff');
    for (const staffId of [staffId1, staffId2]) {
      council.registerStaffAgent(founder, {
        staff_id: staffId,
        name: staffId,
        role: 'Researcher',
        division_id: division.division_id,
        runtime_instances: ['claude'],
      });
      council.updateStaffStatus(founder, { staff_id: staffId, status: 'active' });
    }

    const task = council.createTask(founder, {
      title: 'Private task',
      assigned_to_type: 'staff',
      assigned_to_id: staffId1,
      created_by_type: 'founder',
      created_by_id: 'founder',
    });
    const deliverable = council.createDeliverable({
      owner_type: 'staff',
      owner_id: staffId1,
      runtime: 'claude',
    }, {
      deliverable_id: uniqueName('deliverable'),
      task_id: task.task_id,
      submitted_by_type: 'staff',
      submitted_by_id: staffId1,
      content: 'Result',
      file_references: [],
      task_relationships: [],
      audit_log: [],
    });
    const otherStaff = { owner_type: 'staff' as const, owner_id: staffId2, runtime: 'claude' as const };

    assert.equal(council.getTaskById(otherStaff, task.task_id), undefined);
    assert.equal(council.getDeliverableById(otherStaff, deliverable.deliverable_id), undefined);
    assert.throws(() => council.updateTask(otherStaff, {
      task_id: task.task_id,
      title: 'Unauthorized edit',
    }), /Authorization denied/);
  });

  it('does not expose another staff member\'s private memory', () => {
    setup();
    const division = council.createDivision(founder, { name: uniqueName('Research') });
    const ownerId = uniqueName('staff');
    const readerId = uniqueName('staff');
    const owner = council.registerStaffAgent(founder, {
      staff_id: ownerId,
      name: 'Owner',
      role: 'Researcher',
      division_id: division.division_id,
      runtime_instances: ['claude'],
    });
    council.registerStaffAgent(founder, {
      staff_id: readerId,
      name: 'Reader',
      role: 'Researcher',
      division_id: division.division_id,
      runtime_instances: ['claude'],
    });
    const ownerContext = { owner_type: 'staff' as const, owner_id: owner.staff_id, runtime: 'claude' as const };
    const memory = council.createMemory(ownerContext, {
      category: 'staff_private',
      memory_type: 'note',
      title: 'Private note',
      content: { text: 'Confidential' },
    });

    assert.equal(council.getMemoryById({
      owner_type: 'staff',
      owner_id: readerId,
      runtime: 'claude',
    }, memory.memory_id), undefined);
  });

  it('prevents a peer from reading or executing another staff member\'s request', () => {
    setup();
    const division = council.createDivision(founder, { name: uniqueName('Research') });
    const requesterId = uniqueName('staff');
    const peerId = uniqueName('staff');
    for (const staffId of [requesterId, peerId]) {
      council.registerStaffAgent(founder, {
        staff_id: staffId,
        name: staffId,
        role: 'Researcher',
        division_id: division.division_id,
        runtime_instances: ['claude'],
      });
      council.updateStaffStatus(founder, { staff_id: staffId, status: 'active' });
    }
    const task = council.createTask(founder, {
      title: 'research',
      assigned_to_type: 'staff',
      assigned_to_id: requesterId,
      created_by_type: 'founder',
      created_by_id: 'founder',
    });
    council.createTaskAutonomyLevel(founder, { task_type: uniqueName('research'), autonomy_level: 1 });
    const request = council.requestExecution({
      owner_type: 'staff',
      owner_id: requesterId,
      runtime: 'claude',
    }, {
      task_id: task.task_id,
      action_description: 'Run research',
    });
    const peer = { owner_type: 'staff' as const, owner_id: peerId, runtime: 'claude' as const };

    assert.throws(() => council.getExecutionRequest(peer, { execution_id: request.execution_id }), /Access denied/);
    assert.throws(() => council.executeExecutionRequest(peer, request.execution_id), /Access denied/);
  });

  it('rolls back execution state when history recording fails', () => {
    setup();
    const division = council.createDivision(founder, { name: uniqueName('Research') });
    const staffId = uniqueName('staff');
    council.registerStaffAgent(founder, {
      staff_id: staffId,
      name: 'Researcher',
      role: 'Researcher',
      division_id: division.division_id,
      runtime_instances: ['claude'],
    });
    council.updateStaffStatus(founder, { staff_id: staffId, status: 'active' });
    const task = council.createTask(founder, {
      title: 'research',
      assigned_to_type: 'staff',
      assigned_to_id: staffId,
      created_by_type: 'founder',
      created_by_id: 'founder',
    });
    const taskType = uniqueName('research');
    council.createTaskAutonomyLevel(founder, { task_type: taskType, autonomy_level: 1 });
    const request = council.requestExecution({
      owner_type: 'staff',
      owner_id: staffId,
      runtime: 'claude',
    }, {
      task_id: task.task_id,
      action_description: 'Run research',
    });
    db.db.exec(`
      CREATE TRIGGER fail_execution_history
      BEFORE INSERT ON execution_history
      BEGIN SELECT RAISE(ABORT, 'forced history failure'); END;
    `);

    assert.throws(() => council.executeExecutionRequest(founder, request.execution_id), /forced history failure/);
    assert.equal(
      council.getExecutionRequest(founder, { execution_id: request.execution_id }).status,
      'queued',
    );
  });
});
