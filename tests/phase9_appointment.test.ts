// Phase 9 Batch 1: Appointment Ceremony Tests
// Tests for approveDivisionHead, approveSpecialist, activateStaffAgent

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import {
  createDivision,
  getDivisionById,
  registerStaffAgent,
  getStaffAgentById,
  listStaffAgents,
  approveDivisionHead,
  approveSpecialist,
  activateStaffAgent,
  addDivisionMember
} from '../src/council/divisions.js';
import crypto from 'crypto';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder' };
const staffCtx = { owner_type: 'staff' as const, owner_id: 'staff-001' };

function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueStaffId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

describe('Phase 9 Batch 1: Appointment Ceremony', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  function setupDivision(divisionId: string, name: string) {
    return createDivision(db, {
      division_id: divisionId,
      name,
      description: `${name} division`
    });
  }

  function setupStaff(staffId: string, name: string, role: string, divisionId: string, status: 'active' | 'inactive' = 'inactive') {
    return registerStaffAgent(db, {
      staff_id: staffId,
      name,
      role,
      division_id: divisionId,
      runtime_instances: [],
      permissions: [],
      status
    });
  }

  // --- approveDivisionHead Tests ---

  it('should approve Division Head with founder context', () => {
    const divName = uniqueName('Developer');
    setupDivision(divName, divName);
    const staffId = uniqueStaffId('dev-head');
    setupStaff(staffId, 'Dev Head', 'Division Head, Developer Division', divName, 'active');

    const result = approveDivisionHead(db, founderCtx, {
      division_id: divName,
      staff_id: staffId
    });

    assert.strictEqual(result.head_staff_id, staffId);
    assert.strictEqual(result.division_id, divName);
  });

  it('should reject Division Head approval from non-founder', () => {
    const divName = uniqueName('Developer');
    setupDivision(divName, divName);
    const staffId = uniqueStaffId('dev-head');
    setupStaff(staffId, 'Dev Head', 'Division Head', divName, 'active');

    assert.throws(() => {
      approveDivisionHead(db, staffCtx, {
        division_id: divName,
        staff_id: staffId
      });
    }, /Only Founder can approve Division Head appointments/);
  });

  it('should reject Division Head approval for non-existent division', () => {
    const divName = uniqueName('Developer');
    setupDivision(divName, divName);
    const staffId = uniqueStaffId('dev-head');
    setupStaff(staffId, 'Dev Head', 'Division Head', divName, 'active');

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: 'Non-existent Division',
        staff_id: staffId
      });
    }, /Division 'Non-existent Division' not found/);
  });

  it('should reject Division Head approval for non-existent staff', () => {
    const divName = uniqueName('Developer');
    setupDivision(divName, divName);

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: divName,
        staff_id: 'non-existent-staff'
      });
    }, /Staff agent 'non-existent-staff' not found/);
  });

  it('should reject Division Head approval when staff belongs to different division', () => {
    const devName = uniqueName('Developer');
    const marketingName = uniqueName('Marketing');
    setupDivision(devName, devName);
    setupDivision(marketingName, marketingName);
    const staffId = uniqueStaffId('marketing-head');
    setupStaff(staffId, 'Marketing Head', 'Division Head, Marketing Division', marketingName, 'active');

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: devName,
        staff_id: staffId
      });
    }, new RegExp(`Staff agent '${staffId}' is not a member of division '${devName}'`));
  });

  it('should reject duplicate Division Head appointment', () => {
    const divName = uniqueName('Developer');
    setupDivision(divName, divName);
    const staffId = uniqueStaffId('dev-head');
    setupStaff(staffId, 'Dev Head', 'Division Head', divName, 'active');

    approveDivisionHead(db, founderCtx, {
      division_id: divName,
      staff_id: staffId
    });

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: divName,
        staff_id: staffId
      });
    }, /already the Division Head/);
  });

  it('should create audit memory entry on Division Head approval', () => {
    const divName = uniqueName('Developer');
    const staffId = uniqueStaffId('dev-head');
    setupDivision(divName, divName);
    setupStaff(staffId, 'Dev Head', 'Division Head', divName, 'active');

    approveDivisionHead(db, founderCtx, {
      division_id: divName,
      staff_id: staffId
    });

    // Query memory entries with content matching this division
    const memories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ? AND content LIKE '%' || ? || '%'",
      ['council_shared', 'appointment_record', divName]
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'approve_division_head');
    assert.strictEqual(content.division_id, divName);
    assert.strictEqual(content.staff_id, staffId);
  });

  // --- approveSpecialist Tests ---

  it('should approve specialist with founder context', () => {
    const divName = uniqueName('Developer');
    const division = createDivision(db, {
      division_id: divName,
      name: divName
    });
    const staffId = uniqueStaffId('dev-platform');

    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    const result = approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    // Approval does not change status - activation is separate
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.staff_id, staffId);

    // But division membership should be created
    const members = db.query(
      'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
      [division.division_id, staffId]
    );
    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].role, 'specialist');
  });

  it('should reject specialist approval from non-founder', () => {
    const divName = uniqueName('Developer');
    const div = createDivision(db, { division_id: divName, name: divName });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: div.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, staffCtx, {
        staff_id: staffId,
        division_id: div.division_id
      });
    }, /Only Founder can approve specialist appointments/);
  });

  it('should reject specialist approval for non-existent staff', () => {
    const divName = uniqueName('Developer');
    const div = createDivision(db, { division_id: divName, name: divName });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: 'non-existent-staff',
        division_id: div.division_id
      });
    }, /Staff agent 'non-existent-staff' not found/);
  });

  it('should reject specialist approval for non-existent division', () => {
    const divName = uniqueName('Developer');
    const division = createDivision(db, { division_id: divName, name: divName });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: staffId,
        division_id: 'Non-existent Division'
      });
    }, new RegExp(`Division 'Non-existent Division' not found`));
  });

  it('should reject specialist approval when staff registered to different division', () => {
    const devDivision = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const marketingDivision = createDivision(db, { division_id: uniqueName('Marketing'), name: uniqueName('Marketing') });

    const staffId = uniqueStaffId('marketing-growth');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Growth Lead',
      role: 'Growth/Acquisition Lead',
      division_id: marketingDivision.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: staffId,
        division_id: devDivision.division_id
      });
    }, new RegExp(`Staff agent '${staffId}' is not registered to division '${devDivision.division_id}'`));
  });

  it('should allow specialist approval regardless of current status (activation is separate)', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    // Should not throw - approval is separate from activation
    const result = approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    // Staff status should remain unchanged (approval doesn't activate)
    assert.strictEqual(result.status, 'active');
  });

  it('should add division member record on specialist approval', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    const members = db.query(
      'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
      [division.division_id, staffId]
    );

    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].role, 'specialist');
  });

  it('should create audit memory entry on specialist approval', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    // Query memory entries with content matching this staff
    const memories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ? AND content LIKE '%' || ? || '%'",
      ['council_shared', 'appointment_record', staffId]
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'approve_specialist');
    assert.strictEqual(content.staff_id, staffId);
    assert.strictEqual(content.role, 'Platform Engineering Lead');
  });

  // --- activateStaffAgent Tests ---

  it('should activate staff agent with founder context', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    const result = activateStaffAgent(db, founderCtx, {
      staff_id: staffId,
      runtimes: ['claude', 'hermes']
    });

    const runtimes = JSON.parse(result.runtime_instances);
    assert.ok(runtimes.includes('claude'));
    assert.ok(runtimes.includes('hermes'));
    assert.strictEqual(result.status, 'active');
  });

  it('should reject staff activation from non-founder', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    assert.throws(() => {
      activateStaffAgent(db, staffCtx, {
        staff_id: staffId,
        runtimes: ['claude']
      });
    }, /Only Founder can activate staff agents/);
  });

  it('should reject activation for non-existent staff', () => {
    assert.throws(() => {
      activateStaffAgent(db, founderCtx, {
        staff_id: 'non-existent-staff',
        runtimes: ['claude']
      });
    }, /Staff agent 'non-existent-staff' not found/);
  });

  it('should reject activation for non-approved staff', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      activateStaffAgent(db, founderCtx, {
        staff_id: staffId,
        runtimes: ['claude']
      });
    }, /must be approved before activation/);
  });

  it('should create runtime persona records on activation', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: staffId,
      runtimes: ['claude', 'hermes']
    });

    const runtimePersonas = db.query(
      'SELECT * FROM staff_runtime_personas WHERE staff_id = ?',
      [staffId]
    );

    assert.strictEqual(runtimePersonas.length, 2);
    const runtimes = runtimePersonas.map(p => p.runtime).sort();
    assert.deepStrictEqual(runtimes, ['claude', 'hermes']);
  });

  it('should create audit memory entry on staff activation', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: staffId,
      runtimes: ['claude', 'hermes']
    });

    // Query memory entries with content matching this staff
    const memories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ? AND content LIKE '%' || ? || '%'",
      ['council_shared', 'activation_record', staffId]
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'activate_staff_agent');
    assert.strictEqual(content.staff_id, staffId);
    assert.deepStrictEqual(content.runtimes, ['claude', 'hermes']);
  });

  it('should not duplicate runtime personas on re-activation', () => {
    const division = createDivision(db, { division_id: uniqueName('Developer'), name: uniqueName('Developer') });
    const staffId = uniqueStaffId('dev-platform');
    const staff = registerStaffAgent(db, {
      staff_id: staffId,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: division.division_id,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: staffId,
      division_id: division.division_id
    });

    // First activation
    activateStaffAgent(db, founderCtx, {
      staff_id: staffId,
      runtimes: ['claude']
    });

    // Second activation with same runtime
    activateStaffAgent(db, founderCtx, {
      staff_id: staffId,
      runtimes: ['claude']
    });

    const runtimePersonas = db.query(
      'SELECT * FROM staff_runtime_personas WHERE staff_id = ?',
      [staffId]
    );

    assert.strictEqual(runtimePersonas.length, 1);
  });

  // --- Integration Test ---

  it('should complete full Division Head appointment and activation workflow', () => {
    // 1. Create division
    const divisionId = uniqueName('Developer');
    const divisionName = uniqueName('Developer');
    const division = createDivision(db, {
      division_id: divisionId,
      name: divisionName,
      description: 'Software development division',
      strategic_objectives: ['Platform stability', 'Developer experience']
    });

    // 2. Register Division Head candidate
    const headStaffId = uniqueStaffId('dev-head');
    const headStaff = registerStaffAgent(db, {
      staff_id: headStaffId,
      name: 'Dev Head',
      role: 'Division Head, Developer Division',
      division_id: divisionId,
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    // 3. Register specialists
    const specialist1Id = uniqueStaffId('dev-platform');
    const specialist1 = registerStaffAgent(db, {
      staff_id: specialist1Id,
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: divisionId,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    const specialist2Id = uniqueStaffId('dev-devops');
    const specialist2 = registerStaffAgent(db, {
      staff_id: specialist2Id,
      name: 'DevOps Engineer',
      role: 'DevOps/Infrastructure Lead',
      division_id: divisionId,
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // 4. Approve Division Head
    const approvedDivision = approveDivisionHead(db, founderCtx, {
      division_id: divisionId,
      staff_id: headStaffId
    });
    assert.strictEqual(approvedDivision.head_staff_id, headStaffId);

    // 5. Approve specialists
    approveSpecialist(db, founderCtx, {
      staff_id: specialist1Id,
      division_id: divisionId
    });

    approveSpecialist(db, founderCtx, {
      staff_id: specialist2Id,
      division_id: divisionId
    });

    // 6. Activate Division Head
    activateStaffAgent(db, founderCtx, {
      staff_id: headStaffId,
      runtimes: ['claude', 'hermes']
    });

    // 7. Activate specialists
    activateStaffAgent(db, founderCtx, {
      staff_id: specialist1Id,
      runtimes: ['claude', 'hermes']
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: specialist2Id,
      runtimes: ['claude']
    });

    // Verify final state
    const finalDivision = getDivisionById(db, divisionId);
    assert.strictEqual(finalDivision?.head_staff_id, headStaffId);

    const head = getStaffAgentById(db, headStaffId);
    const headRuntimes = JSON.parse(head!.runtime_instances);
    assert.ok(headRuntimes.includes('claude'));
    assert.ok(headRuntimes.includes('hermes'));
    assert.strictEqual(head!.status, 'active');

    const spec1 = getStaffAgentById(db, specialist1Id);
    assert.strictEqual(spec1!.status, 'active');
    const spec1Runtimes = JSON.parse(spec1!.runtime_instances);
    assert.ok(spec1Runtimes.includes('claude'));
    assert.ok(spec1Runtimes.includes('hermes'));

    const spec2 = getStaffAgentById(db, specialist2Id);
    assert.strictEqual(spec2!.status, 'active');
    const spec2Runtimes = JSON.parse(spec2!.runtime_instances);
    assert.ok(spec2Runtimes.includes('claude'));

    // Verify audit trail
    const appointmentMemories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?",
      ['council_shared', 'appointment_record']
    );
    assert.strictEqual(appointmentMemories.length, 3); // 1 division head + 2 specialists

    const activationMemories = db.query(
      "SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?",
      ['council_shared', 'activation_record']
    );
    assert.strictEqual(activationMemories.length, 3); // 1 division head + 2 specialists
  });
});