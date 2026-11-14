// Phase 9 Batch 1: Appointment Ceremony Tests
// Tests for approveDivisionHead, approveSpecialist, activateStaffAgent

import { describe, it, before, after, beforeEach } from 'node:test';
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
import { createMemory } from '../src/council/memory.js';

let db: DatabaseInstance;

const founderCtx = { owner_type: 'founder', owner_id: 'founder' };
const staffCtx = { owner_type: 'staff', owner_id: 'staff-001' };
const divisionCtx = { owner_type: 'division', owner_id: 'div-001' };

describe('Phase 9 Batch 1: Appointment Ceremony', () => {
  before(() => {
    db = createDatabase(':memory:');
  });

  after(() => {
    db.close();
  });

  beforeEach(() => {
    // Reset database by recreating tables
    db = createDatabase(':memory:');
  });

  function setupDivision(db: DatabaseInstance, divisionId: string, name: string) {
    return createDivision(db, {
      division_id: divisionId,
      name,
      description: `${name} division`
    });
  }

  function setupStaff(db: DatabaseInstance, staffId: string, name: string, role: string, divisionId: string, status: 'active' | 'inactive' = 'inactive') {
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
    setupDivision(db, 'Developer Division', 'Developer');
    setupStaff(db, 'staff-dev-head-001', 'Dev Head', 'Division Head, Developer Division', 'Developer Division', 'active');

    const result = approveDivisionHead(db, founderCtx, {
      division_id: 'Developer Division',
      staff_id: 'staff-dev-head-001'
    });

    assert.strictEqual(result.head_staff_id, 'staff-dev-head-001');
    assert.strictEqual(result.division_id, 'Developer Division');
  });

  it('should reject Division Head approval from non-founder', () => {
    setupDivision(db, 'Developer Division', 'Developer');
    setupStaff(db, 'staff-dev-head-001', 'Dev Head', 'Division Head', 'Developer Division', 'active');

    assert.throws(() => {
      approveDivisionHead(db, staffCtx, {
        division_id: 'Developer Division',
        staff_id: 'staff-dev-head-001'
      });
    }, /Only Founder can approve Division Head appointments/);
  });

  it('should reject Division Head approval for non-existent division', () => {
    setupDivision(db, 'Developer Division', 'Developer');
    setupStaff(db, 'staff-dev-head-001', 'Dev Head', 'Division Head', 'Developer Division', 'active');

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: 'Non-existent Division',
        staff_id: 'staff-dev-head-001'
      });
    }, /Division 'Non-existent Division' not found/);
  });

  it('should reject Division Head approval for non-existent staff', () => {
    setupDivision(db, 'Developer Division', 'Developer');

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: 'Developer Division',
        staff_id: 'non-existent-staff'
      });
    }, /Staff agent 'non-existent-staff' not found/);
  });

  it('should reject Division Head approval when staff belongs to different division', () => {
    setupDivision(db, 'Developer Division', 'Developer');
    setupDivision(db, 'Marketing Division', 'Marketing');
    setupStaff(db, 'staff-marketing-head-001', 'Marketing Head', 'Division Head, Marketing Division', 'Marketing Division', 'active');

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: 'Developer Division',
        staff_id: 'staff-marketing-head-001'
      });
    }, /Staff agent 'staff-marketing-head-001' is not a member of division 'Developer Division'/);
  });

  it('should reject duplicate Division Head appointment', () => {
    setupDivision(db, 'Developer Division', 'Developer');
    setupStaff(db, 'staff-dev-head-001', 'Dev Head', 'Division Head', 'Developer Division', 'active');

    approveDivisionHead(db, founderCtx, {
      division_id: 'Developer Division',
      staff_id: 'staff-dev-head-001'
    });

    assert.throws(() => {
      approveDivisionHead(db, founderCtx, {
        division_id: 'Developer Division',
        staff_id: 'staff-dev-head-001'
      });
    }, /already the Division Head/);
  });

  it('should create audit memory entry on Division Head approval', () => {
    setupDivision(db, 'Developer Division', 'Developer');
    setupStaff(db, 'staff-dev-head-001', 'Dev Head', 'Division Head', 'Developer Division', 'active');

    approveDivisionHead(db, founderCtx, {
      division_id: 'Developer Division',
      staff_id: 'staff-dev-head-001'
    });

    const memories = db.query(
      'SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?',
      ['council_shared', 'appointment_record']
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'approve_division_head');
    assert.strictEqual(content.division_id, 'Developer Division');
    assert.strictEqual(content.staff_id, 'staff-dev-head-001');
  });

  // --- approveSpecialist Tests ---

  it('should approve specialist with founder context', () => {
    const division = createDivision(db, {
      division_id: 'Developer Division',
      name: 'Developer'
    });

    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    const result = approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    // Approval does not change status - activation is separate
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.staff_id, 'staff-dev-platform-001');

    // But division membership should be created
    const members = db.query(
      'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
      ['Developer Division', 'staff-dev-platform-001']
    );
    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].role, 'specialist');
  });

  it('should reject specialist approval from non-founder', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, staffCtx, {
        staff_id: 'staff-dev-platform-001',
        division_id: 'Developer Division'
      });
    }, /Only Founder can approve specialist appointments/);
  });

  it('should reject specialist approval for non-existent staff', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: 'non-existent-staff',
        division_id: 'Developer Division'
      });
    }, /Staff agent 'non-existent-staff' not found/);
  });

  it('should reject specialist approval for non-existent division', () => {
    createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: 'staff-dev-platform-001',
        division_id: 'Non-existent Division'
      });
    }, /Division 'Non-existent Division' not found/);
  });

  it('should reject specialist approval when staff registered to different division', () => {
    const devDivision = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const marketingDivision = createDivision(db, { division_id: 'Marketing Division', name: 'Marketing' });

    const staff = registerStaffAgent(db, {
      staff_id: 'staff-marketing-growth-001',
      name: 'Growth Lead',
      role: 'Growth/Acquisition Lead',
      division_id: 'Marketing Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      approveSpecialist(db, founderCtx, {
        staff_id: 'staff-marketing-growth-001',
        division_id: 'Developer Division'
      });
    }, /Staff agent 'staff-marketing-growth-001' is not registered to division 'Developer Division'/);
  });

  it('should allow specialist approval regardless of current status (activation is separate)', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    // Should not throw - approval is separate from activation
    const result = approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    // Staff status should remain unchanged (approval doesn't activate)
    assert.strictEqual(result.status, 'active');
  });

  it('should add division member record on specialist approval', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    const members = db.query(
      'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
      ['Developer Division', 'staff-dev-platform-001']
    );

    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].role, 'specialist');
  });

  it('should create audit memory entry on specialist approval', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    const memories = db.query(
      'SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?',
      ['council_shared', 'appointment_record']
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'approve_specialist');
    assert.strictEqual(content.staff_id, 'staff-dev-platform-001');
    assert.strictEqual(content.role, 'Platform Engineering Lead');
  });

  // --- activateStaffAgent Tests ---

  it('should activate staff agent with founder context', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    const result = activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude', 'hermes']
    });

    const runtimes = JSON.parse(result.runtime_instances);
    assert.ok(runtimes.includes('claude'));
    assert.ok(runtimes.includes('hermes'));
    assert.strictEqual(result.status, 'active');
  });

  it('should reject staff activation from non-founder', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    assert.throws(() => {
      activateStaffAgent(db, staffCtx, {
        staff_id: 'staff-dev-platform-001',
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
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    assert.throws(() => {
      activateStaffAgent(db, founderCtx, {
        staff_id: 'staff-dev-platform-001',
        runtimes: ['claude']
      });
    }, /must be approved before activation/);
  });

  it('should create runtime persona records on activation', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude', 'hermes']
    });

    const runtimePersonas = db.query(
      'SELECT * FROM staff_runtime_personas WHERE staff_id = ?',
      ['staff-dev-platform-001']
    );

    assert.strictEqual(runtimePersonas.length, 2);
    const runtimes = runtimePersonas.map(p => p.runtime).sort();
    assert.deepStrictEqual(runtimes, ['claude', 'hermes']);
  });

  it('should create audit memory entry on staff activation', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude', 'hermes']
    });

    const memories = db.query(
      'SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?',
      ['council_shared', 'activation_record']
    );

    assert.strictEqual(memories.length, 1);
    const content = JSON.parse(memories[0].content);
    assert.strictEqual(content.action, 'activate_staff_agent');
    assert.strictEqual(content.staff_id, 'staff-dev-platform-001');
    assert.deepStrictEqual(content.runtimes, ['claude', 'hermes']);
  });

  it('should not duplicate runtime personas on re-activation', () => {
    const division = createDivision(db, { division_id: 'Developer Division', name: 'Developer' });
    const staff = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // Must approve first to create division membership
    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    // First activation
    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude']
    });

    // Second activation with same runtime
    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude']
    });

    const runtimePersonas = db.query(
      'SELECT * FROM staff_runtime_personas WHERE staff_id = ?',
      ['staff-dev-platform-001']
    );

    assert.strictEqual(runtimePersonas.length, 1);
  });

  // --- Integration Test ---

  it('should complete full Division Head appointment and activation workflow', () => {
    // 1. Create division
    const division = createDivision(db, {
      division_id: 'Developer Division',
      name: 'Developer',
      description: 'Software development division',
      strategic_objectives: ['Platform stability', 'Developer experience']
    });

    // 2. Register Division Head candidate
    const headStaff = registerStaffAgent(db, {
      staff_id: 'staff-dev-head-001',
      name: 'Dev Head',
      role: 'Division Head, Developer Division',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'active'
    });

    // 3. Register specialists
    const specialist1 = registerStaffAgent(db, {
      staff_id: 'staff-dev-platform-001',
      name: 'Platform Engineer',
      role: 'Platform Engineering Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    const specialist2 = registerStaffAgent(db, {
      staff_id: 'staff-dev-devops-001',
      name: 'DevOps Engineer',
      role: 'DevOps/Infrastructure Lead',
      division_id: 'Developer Division',
      runtime_instances: [],
      permissions: [],
      status: 'inactive'
    });

    // 4. Approve Division Head
    const approvedDivision = approveDivisionHead(db, founderCtx, {
      division_id: 'Developer Division',
      staff_id: 'staff-dev-head-001'
    });
    assert.strictEqual(approvedDivision.head_staff_id, 'staff-dev-head-001');

    // 5. Approve specialists
    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      division_id: 'Developer Division'
    });

    approveSpecialist(db, founderCtx, {
      staff_id: 'staff-dev-devops-001',
      division_id: 'Developer Division'
    });

    // 6. Activate Division Head
    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-head-001',
      runtimes: ['claude', 'hermes']
    });

    // 7. Activate specialists
    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-platform-001',
      runtimes: ['claude', 'hermes']
    });

    activateStaffAgent(db, founderCtx, {
      staff_id: 'staff-dev-devops-001',
      runtimes: ['claude']
    });

    // Verify final state
    const finalDivision = getDivisionById(db, 'Developer Division');
    assert.strictEqual(finalDivision?.head_staff_id, 'staff-dev-head-001');

    const head = getStaffAgentById(db, 'staff-dev-head-001');
    const headRuntimes = JSON.parse(head!.runtime_instances);
    assert.ok(headRuntimes.includes('claude'));
    assert.ok(headRuntimes.includes('hermes'));
    assert.strictEqual(head!.status, 'active');

    const spec1 = getStaffAgentById(db, 'staff-dev-platform-001');
    assert.strictEqual(spec1!.status, 'active');
    const spec1Runtimes = JSON.parse(spec1!.runtime_instances);
    assert.ok(spec1Runtimes.includes('claude'));
    assert.ok(spec1Runtimes.includes('hermes'));

    const spec2 = getStaffAgentById(db, 'staff-dev-devops-001');
    assert.strictEqual(spec2!.status, 'active');
    const spec2Runtimes = JSON.parse(spec2!.runtime_instances);
    assert.ok(spec2Runtimes.includes('claude'));

    // Verify audit trail
    const appointmentMemories = db.query(
      'SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?',
      ['council_shared', 'appointment_record']
    );
    assert.strictEqual(appointmentMemories.length, 3); // 1 division head + 2 specialists

    const activationMemories = db.query(
      'SELECT * FROM memory_entries WHERE category = ? AND memory_type = ?',
      ['council_shared', 'activation_record']
    );
    assert.strictEqual(activationMemories.length, 3); // 1 division head + 2 specialists
  });
});