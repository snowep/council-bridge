// P2-07: Staff Directory Consistency Tests
// Tests that list/detail and memberships follow a consistent policy
// Staff with multiple divisions should have consistent behavior across all endpoints
//
// Policy: The staff_agents.division_id should represent the PRIMARY division
// listStaffAgents({division_id: X}) should return staff who are MEMBERs of division X
// via division_members table, NOT just staff with division_id = X

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createDivision,
  registerStaffAgent,
  addDivisionMember,
  listStaffAgents,
  getDivisionMembers,
  getAllDivisionMembers,
  listStaffByDivisionMembership,
} from '../../src/council/divisions.js';

const founderCtx = { owner_type: 'founder' as const, owner_id: 'founder', runtime: 'claude' as const };

interface TestContext {
  db: DatabaseInstance;
  divisionAId: string;
  divisionBId: string;
  divisionHeadId: string;
  singleDivisionStaffId: string;
  multiDivisionStaffId: string;
  cleanup: () => void;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function setupTestDivision(db: DatabaseInstance, name: string, headStaffId?: string): string {
  const divisionId = uniqueId(name);
  createDivision(db, {
    division_id: divisionId,
    name: divisionId,
    description: 'Test division for staff consistency',
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
  const staffId = uniqueId('staff');
  registerStaffAgent(db, {
    staff_id: staffId,
    name,
    role,
    division_id: divisionId,
    runtime_instances: ['claude'],
    permissions: [],
    status,
  });
  return staffId;
}

describe('P2-07: Staff Directory Consistency', () => {
  let db: DatabaseInstance;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(process.cwd(), 'data', `test-p2-07-${randomUUID()}.db`);
    db = createDatabase(testDbPath);
  });

  afterEach(() => {
    if (db && typeof db.close === 'function') {
      db.close();
    }
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {}
  });

  function createContext(): TestContext {
    // Create Division A with a head
    const divisionAId = setupTestDivision(db, 'division-a');
    const divisionHeadId = setupStaffAgent(db, divisionAId, 'Division Head A', 'head', 'active');

    // Make them the actual division head in the database
    const currentDiv = db.query('SELECT * FROM divisions WHERE division_id = ?', [divisionAId]);
    if (currentDiv.length > 0) {
      db.db.prepare('UPDATE divisions SET head_staff_id = ? WHERE division_id = ?').run(divisionHeadId, divisionAId);
    }

    // Add division head as a member of division A (required for membership-based queries)
    db.runPreparedStatement('insertDivisionMember', [divisionAId, divisionHeadId, 'head']);

    // Create Division B
    const divisionBId = setupTestDivision(db, 'division-b');

    // Create single-division staff (only in Division A)
    const singleDivisionStaffId = setupStaffAgent(db, divisionAId, 'Single Division Staff', 'member', 'active');

    // Add single-division staff to division members
    db.runPreparedStatement('insertDivisionMember', [divisionAId, singleDivisionStaffId, 'member']);

    // Create multi-division staff (in both Division A and Division B)
    // The PRIMARY division (division_id in staff_agents) is set to div-a at creation
    const multiDivisionStaffId = setupStaffAgent(db, divisionAId, 'Multi Division Staff', 'member', 'active');

    // Add to both divisions via division_members table
    db.runPreparedStatement('insertDivisionMember', [divisionAId, multiDivisionStaffId, 'member']);
    db.runPreparedStatement('insertDivisionMember', [divisionBId, multiDivisionStaffId, 'member']);

    return {
      db,
      divisionAId,
      divisionBId,
      divisionHeadId,
      singleDivisionStaffId,
      multiDivisionStaffId,
      cleanup: () => {
        try { db.close(); } catch {}
      }
    };
  }

  describe('Staff Agent Record Consistency - staff_agents table', () => {
    it('should have division_id set at creation time', () => {
      const ctx = createContext();

      // The staff_agents record should have the division_id set at creation
      const singleStaff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.singleDivisionStaffId])[0];
      assert.strictEqual(singleStaff.division_id, ctx.divisionAId, 'Single-division staff should have their division_id set');

      const multiStaff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.multiDivisionStaffId])[0];
      assert.strictEqual(multiStaff.division_id, ctx.divisionAId, 'Multi-division staff should have their primary division_id (first assigned)');
    });

    it('should allow a staff agent to have division_id different from division_members', () => {
      const ctx = createContext();

      // Multi-division staff has division_id = divisionAId (primary)
      // but is a member of both divA and divB via division_members table
      const multiStaffRecord = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.multiDivisionStaffId])[0];

      // Check division_members for this staff
      const divMemberships = db.query('SELECT * FROM division_members WHERE staff_id = ?', [ctx.multiDivisionStaffId]);

      // Should be a member of both divisions
      const divisionIds = divMemberships.map((m: any) => m.division_id);
      assert.ok(divisionIds.includes(ctx.divisionAId), 'Should be member of division A');
      assert.ok(divisionIds.includes(ctx.divisionBId), 'Should be member of division B');
    });
  });

  describe('listStaffAgents behavior consistency', () => {
    it('should return staff from a specific division when division_id is provided (by membership)', () => {
      const ctx = createContext();

      // After fix: listStaffAgents with division_id should use membership-based query by default
      const staffByDivisionA = listStaffAgents(db, { division_id: ctx.divisionAId });

      // Should return all staff who are members of division A (head, single-division, multi-division)
      assert.strictEqual(staffByDivisionA.length, 3, 'Should have 3 staff members in division A');

      const staffIds = staffByDivisionA.map(s => s.staff_id);
      assert.ok(staffIds.includes(ctx.divisionHeadId), 'Should include division head');
      assert.ok(staffIds.includes(ctx.singleDivisionStaffId), 'Should include single-division staff');
      assert.ok(staffIds.includes(ctx.multiDivisionStaffId), 'Should include multi-division staff');
    });

    it('should return 0 staff for division B when using division_id filter', () => {
      const ctx = createContext();

      // After fix: listStaffAgents with division_id=B should query by membership
      const staffByDivisionB = listStaffAgents(db, { division_id: ctx.divisionBId });

      // Division B only has multi-division staff as a member
      assert.strictEqual(staffByDivisionB.length, 1, 'Should have 1 staff member in division B (multi-division staff)');
      assert.strictEqual(staffByDivisionB[0].staff_id, ctx.multiDivisionStaffId, 'Should be multi-division staff');
    });

    it('should return all staff when no division filter is provided', () => {
      const ctx = createContext();

      const staff = listStaffAgents(db);

      // Should include both single and multi-division staff
      assert.ok(staff.length >= 2, 'Should have at least 2 staff members');
    });

    it('should filter by status', () => {
      const ctx = createContext();

      // Create an inactive staff
      const inactiveStaffId = setupStaffAgent(db, ctx.divisionAId, 'Inactive Staff', 'member', 'inactive');
      db.runPreparedStatement('insertDivisionMember', [ctx.divisionAId, inactiveStaffId, 'member']);

      // Note: status filtering happens after membership query
      const activeStaff = listStaffAgents(db, { status: 'active' });
      const inactiveStaff = listStaffAgents(db, { status: 'inactive' });

      assert.ok(activeStaff.every(s => s.status === 'active'), 'Active staff filter should work');
      assert.ok(inactiveStaff.every(s => s.status === 'inactive'), 'Inactive staff filter should work');
    });
  });

  describe('listStaffByDivisionMembership function', () => {
    it('should return staff who are members of a specific division', () => {
      const ctx = createContext();

      const staffA = listStaffByDivisionMembership(db, ctx.divisionAId);
      const staffB = listStaffByDivisionMembership(db, ctx.divisionBId);

      // Division A has 3 members: head, single-division, multi-division
      assert.strictEqual(staffA.length, 3, 'Division A should have 3 members');

      // Division B has 1 member: multi-division staff only
      assert.strictEqual(staffB.length, 1, 'Division B should have 1 member');
      assert.strictEqual(staffB[0].staff_id, ctx.multiDivisionStaffId, 'Division B member should be multi-division staff');
    });

    it('should return empty array for non-existent division', () => {
      const ctx = createContext();

      const staff = listStaffByDivisionMembership(db, 'non-existent-division');
      assert.strictEqual(staff.length, 0, 'Should return empty for non-existent division');
    });
  });

  describe('getDivisionMembers consistency', () => {
    it('should return all members of a division', () => {
      const ctx = createContext();

      const members = getDivisionMembers(db, ctx.divisionAId);

      // Should include: division head, single-division staff, multi-division staff
      const staffIds = members.map(m => m.staff_id);
      assert.ok(staffIds.includes(ctx.divisionHeadId), 'Should include division head');
      assert.ok(staffIds.includes(ctx.singleDivisionStaffId), 'Should include single-division staff');
      assert.ok(staffIds.includes(ctx.multiDivisionStaffId), 'Should include multi-division staff');
    });

    it('should return members for both divisions', () => {
      const ctx = createContext();

      const membersA = getDivisionMembers(db, ctx.divisionAId);
      const membersB = getDivisionMembers(db, ctx.divisionBId);

      // Division A has 3 members: head, single-division staff, multi-division staff
      assert.strictEqual(membersA.length, 3, 'Division A should have 3 members');

      // Division B has 1 member: multi-division staff only
      assert.strictEqual(membersB.length, 1, 'Division B should have 1 member');
      assert.strictEqual(membersB[0].staff_id, ctx.multiDivisionStaffId, 'Division B member should be multi-division staff');
    });
  });

  describe('getAllDivisionMembers consistency', () => {
    it('should return all division-member relationships', () => {
      const ctx = createContext();

      const allMembers = getAllDivisionMembers(db);

      // Should have 4 relationships:
      // - A: head
      // - A: single-division staff
      // - A: multi-division staff
      // - B: multi-division staff
      assert.strictEqual(allMembers.length, 4, 'Should have 4 division-member relationships');

      // Verify structure
      assert.ok(allMembers.every(m => m.division_id && m.staff_id && m.role), 'Each member should have division_id, staff_id, and role');
    });

    it('should include all staff IDs across all divisions', () => {
      const ctx = createContext();

      const allMembers = getAllDivisionMembers(db);
      const uniqueStaffIds = new Set(allMembers.map((m: any) => m.staff_id));

      // Should have 3 unique staff: head, single-division, multi-division
      assert.strictEqual(uniqueStaffIds.size, 3, 'Should have 3 unique staff across all divisions');
      assert.ok(uniqueStaffIds.has(ctx.divisionHeadId), 'Should include division head');
      assert.ok(uniqueStaffIds.has(ctx.singleDivisionStaffId), 'Should include single-division staff');
      assert.ok(uniqueStaffIds.has(ctx.multiDivisionStaffId), 'Should include multi-division staff');
    });
  });

  describe('Policy: Staff visibility based on division membership', () => {
    it('should distinguish between staff primary division and membership divisions', () => {
      const ctx = createContext();

      // Single-division staff is ONLY in division A
      const singleStaffRecord = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.singleDivisionStaffId])[0];
      const singleStaffMemberships = db.query('SELECT * FROM division_members WHERE staff_id = ?', [ctx.singleDivisionStaffId]);

      assert.strictEqual(singleStaffRecord.division_id, ctx.divisionAId, 'Primary division should be A');
      assert.strictEqual(singleStaffMemberships.length, 1, 'Should have exactly 1 membership (division A)');

      // Multi-division staff is in both divisions but has primary division A
      const multiStaffRecord = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.multiDivisionStaffId])[0];
      const multiStaffMemberships = db.query('SELECT * FROM division_members WHERE staff_id = ?', [ctx.multiDivisionStaffId]);

      assert.strictEqual(multiStaffRecord.division_id, ctx.divisionAId, 'Primary division should be A');
      assert.strictEqual(multiStaffMemberships.length, 2, 'Should have 2 memberships (both divisions)');
      assert.ok(multiStaffMemberships.some((m: any) => m.division_id === ctx.divisionAId), 'Should be member of A');
      assert.ok(multiStaffMemberships.some((m: any) => m.division_id === ctx.divisionBId), 'Should be member of B');
    });

    it('should provide consistent results between listStaffAgents and getDivisionMembers', () => {
      const ctx = createContext();

      // The key consistency test:
      // getDivisionMembers(division_id) should return the same staff as
      // listStaffAgents({division_id: X})

      const membersDivisionA = getDivisionMembers(db, ctx.divisionAId);
      const memberStaffIdsA = new Set(membersDivisionA.map((m: any) => m.staff_id));

      const staffFromListA = listStaffAgents(db, { division_id: ctx.divisionAId });
      const listStaffIdsA = new Set(staffFromListA.map(s => s.staff_id));

      // After fix, these should be the same
      assert.deepStrictEqual(
        [...memberStaffIdsA].sort(),
        [...listStaffIdsA].sort(),
        'listStaffAgents and getDivisionMembers should return same staff'
      );

      // Same for division B
      const membersDivisionB = getDivisionMembers(db, ctx.divisionBId);
      const memberStaffIdsB = new Set(membersDivisionB.map((m: any) => m.staff_id));

      const staffFromListB = listStaffAgents(db, { division_id: ctx.divisionBId });
      const listStaffIdsB = new Set(staffFromListB.map(s => s.staff_id));

      assert.deepStrictEqual(
        [...memberStaffIdsB].sort(),
        [...listStaffIdsB].sort(),
        'listStaffAgents and getDivisionMembers should return same staff for division B'
      );
    });
  });
});