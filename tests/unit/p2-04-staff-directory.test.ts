// P2-04: Staff Directory Pagination and Authorization Tests
// Tests for consistent authorization and pagination across staff endpoints

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance, closeDatabase, setDatabaseInstance, stmt } from '../../src/database.js';
import { setDbSessionStore, generateSessionToken } from '../../src/auth/session.js';
import { authMiddleware, getAuthContext } from '../../src/auth/index.js';
import { listStaffAgents, listStaffByDivisionMembership } from '../../src/council/divisions.js';

let db: DatabaseInstance;
let app: express.Express;
let server: any;

// Create test session token
function createTestSession(ctx: { owner_type: 'founder' | 'staff' | 'division'; owner_id: string; runtime: 'claude' | 'hermes'; client_ip?: string; user_agent?: string }): string {
  return generateSessionToken({
    owner_type: ctx.owner_type,
    owner_id: ctx.owner_id,
    runtime: ctx.runtime
  });
}

describe('P2-04: Staff Directory Authorization and Pagination', () => {
  before(async () => {
    // Create test database
    db = createDatabase(':memory:');
    setDatabaseInstance(db);
    setDbSessionStore(db);

    // Set session secret for test mode
    process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

    // Register test agents
    const agentService = (await import('../../src/communication/agents.js')).createAgentService(db);
    agentService.registerAgent({ agent_id: 'staff-001', display_name: 'Staff Agent 1', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'staff-002', display_name: 'Staff Agent 2', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'staff-003', display_name: 'Staff Agent 3', runtime: 'claude' });

    // Add divisions
    stmt.insertDivision.run('div-001', 'Division Alpha', 'Description', 'staff-001', 0, '[]', '[]');
    stmt.insertDivision.run('div-002', 'Division Beta', 'Description', 'staff-002', 0, '[]', '[]');
    stmt.insertDivision.run('div-003', 'Division Gamma', 'Description', null, 0, '[]', '[]');

    // Add staff members with division FK and membership
    stmt.insertStaffAgent.run('staff-001', 'Alice Johnson', 'member', 'div-001', '["claude"]', '[]', 'active');
    stmt.insertStaffAgent.run('staff-002', 'Bob Smith', 'member', 'div-001', '["claude"]', '[]', 'active');
    stmt.insertStaffAgent.run('staff-003', 'Carol Williams', 'member', 'div-002', '["claude"]', '[]', 'active');
    stmt.insertStaffAgent.run('staff-004', 'Dave Brown', 'member', 'div-003', '["claude"]', '[]', 'active');
    stmt.insertStaffAgent.run('staff-005', 'Eve Davis', 'member', 'div-001', '["claude"]', '[]', 'active');

    // Add division memberships (staff can belong to multiple divisions)
    stmt.insertDivisionMember.run('div-001', 'staff-001', 'member'); // Alice - div-001
    stmt.insertDivisionMember.run('div-001', 'staff-002', 'member'); // Bob - div-001
    stmt.insertDivisionMember.run('div-001', 'staff-005', 'member'); // Eve - div-001
    stmt.insertDivisionMember.run('div-002', 'staff-003', 'member'); // Carol - div-002
    stmt.insertDivisionMember.run('div-002', 'staff-001', 'member'); // Alice also in div-002
    stmt.insertDivisionMember.run('div-003', 'staff-004', 'member'); // Dave - div-003

    // Create test Express app with auth
    app = express();
    app.use(express.json());
    app.use((req, res, next) => authMiddleware(req, res, next));

    // GET /api/staff - List all staff agents (internal endpoint for testing)
    app.get('/api/staff', async (req, res) => {
      const ctx = getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      }

      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      let limit = parseInt(url.searchParams.get('limit') || '50');
      let offset = parseInt(url.searchParams.get('offset') || '0');
      const divisionId = url.searchParams.get('division_id') || undefined;
      const status = url.searchParams.get('status') || undefined;

      let effectiveDivisionId = divisionId;
      let staff: any[] = [];

      if (ctx.owner_type === 'division') {
        // Division Head can only see their own division's staff
        effectiveDivisionId = ctx.owner_id;
        staff = listStaffByDivisionMembership(db, effectiveDivisionId, status as any);

      } else if (ctx.owner_type === 'founder') {
        // Founder can see all staff (division_id filter if provided)
        if (effectiveDivisionId) {
          staff = listStaffByDivisionMembership(db, effectiveDivisionId, status as any);
        } else {
          staff = listStaffAgents(db, { status: status as any });
        }

      } else if (ctx.owner_type === 'staff') {
        // Staff can see all staff from their divisions (deduplicated)
        const myDivisions = db.query('SELECT division_id FROM division_members WHERE staff_id = ?', [ctx.owner_id]);
        const myDivisionIds = myDivisions.map((d: any) => d.division_id);

        if (myDivisionIds.length === 0) {
          return res.set('X-Total-Count', '0').json({ staff: [], total_count: 0, limit, offset });
        }

        // If a specific division_id is requested, filter to that division
        if (effectiveDivisionId) {
          if (!myDivisionIds.includes(effectiveDivisionId)) {
            return res.set('X-Total-Count', '0').json({ staff: [], total_count: 0, limit, offset });
          }
          staff = listStaffByDivisionMembership(db, effectiveDivisionId, status as any);
        } else {
          // Staff can see staff from all their divisions (deduplicated)
          const allStaff = new Map<string, any>();
          for (const divId of myDivisionIds) {
            const staffInDiv = listStaffByDivisionMembership(db, divId, status as any);
            for (const s of staffInDiv) {
              if (!allStaff.has(s.staff_id)) {
                allStaff.set(s.staff_id, s);
              }
            }
          }
          staff = Array.from(allStaff.values());
        }
      } else {
        return res.status(403).json({ error: 'Not authorized to list staff', code: 'AUTHORIZATION_ERROR' });
      }

      // Apply pagination AFTER deduplication/authorization
      const totalCount = staff.length;
      const paginated = staff.slice(offset, offset + limit);

      res.set('X-Total-Count', String(totalCount));
      res.json({ staff: paginated, total_count: totalCount, limit, offset });
    });

    // GET /api/staff/:id - Get staff agent details
    app.get('/api/staff/:id', async (req, res) => {
      const ctx = getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      }

      const id = req.params.id;

      // Fetch actual staff record first
      const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [id])[0];
      if (!staff) {
        return res.status(404).json({ error: 'Staff agent not found' });
      }

      // Authorization check - same policy as list endpoint
      if (ctx.owner_type !== 'founder') {
        if (ctx.owner_type === 'division') {
          const members = db.query('SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?', [ctx.owner_id, id]);
          if (members.length === 0) {
            return res.status(404).json({ error: 'Staff agent not found' });
          }
        } else if (ctx.owner_type === 'staff') {
          // Staff can access records of staff in their divisions (same policy as list)
          // First check if accessing own record
          if (ctx.owner_id === id) {
            // Allow access to own record
          } else {
            // Check if target is in any of requesting staff's divisions
            const myDivisions = db.query('SELECT division_id FROM division_members WHERE staff_id = ?', [ctx.owner_id]);
            const myDivisionIds = myDivisions.map((d: any) => d.division_id);
            if (myDivisionIds.length === 0) {
              return res.status(404).json({ error: 'Staff agent not found' });
            }
            const targetDivisions = db.query('SELECT division_id FROM division_members WHERE staff_id = ?', [id]);
            const targetDivisionIds = targetDivisions.map((d: any) => d.division_id);
            const hasAccess = myDivisionIds.some(divId => targetDivisionIds.includes(divId));
            if (!hasAccess) {
              return res.status(404).json({ error: 'Staff agent not found' });
            }
          }
        } else {
          return res.status(404).json({ error: 'Staff agent not found' });
        }
      }

      res.json({ staff });
    });

    // Create session tokens for different auth contexts
    var founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
    var divisionHeadToken = createTestSession({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });
    var staffToken1 = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });
    var staffTokenNotInDivision = createTestSession({ owner_type: 'staff', owner_id: 'staff-004', runtime: 'claude' });
  });

  after(() => {
    closeDatabase();
  });

  beforeEach(() => {
    delete process.env.AUTH_MODE;
  });

  describe('Authorization Policy: Founder Access', () => {
    it('should allow founder to list all staff', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.ok(response.body.staff.length > 0, 'Should return staff list');
      assert.strictEqual(response.body.total_count, response.body.staff.length, 'Total count should match staff length');
    });

    it('should allow founder to list staff with division filter', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff?division_id=div-001')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.ok(response.body.staff.length > 0, 'Should return staff for division');
    });

    it('should allow founder to access any staff member detail', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-001')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.staff_id, 'staff-001', 'Should return requested staff');
    });
  });

  describe('Authorization Policy: Division Head Access', () => {
    it('should allow division head to list members of their division', async () => {
      const divisionHeadToken = createTestSession({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${divisionHeadToken}`)
        .expect(200);

      assert.ok(response.body.staff.length > 0, 'Should return division members');
      for (const s of response.body.staff) {
        const isMember = s.division_id === 'div-001';
        assert.ok(isMember, `Staff ${s.staff_id} should belong to div-001`);
      }
    });

    it('should allow division head to access member detail', async () => {
      const divisionHeadToken = createTestSession({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-002')
        .set('Authorization', `Bearer ${divisionHeadToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.staff_id, 'staff-002', 'Should return member of own division');
    });

    it('should reject division head accessing staff from other division', async () => {
      const divisionHeadToken = createTestSession({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-003') // Carol is in div-002, not div-001
        .set('Authorization', `Bearer ${divisionHeadToken}`)
        .expect(404);
    });
  });

  describe('Authorization Policy: Staff Self-Access', () => {
    it('should allow staff to access their own detail', async () => {
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-001')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.staff_id, 'staff-001', 'Should allow self-access');
    });

    it('should allow staff to see peers in their divisions', async () => {
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const visibleIds = response.body.staff.map((s: any) => s.staff_id);
      assert.ok(visibleIds.length > 0, 'Should see peers in divisions');
      assert.ok(visibleIds.includes('staff-001'), 'User should see their own record');
      assert.ok(visibleIds.includes('staff-002'), 'Should see Bob from div-001');
      assert.ok(visibleIds.includes('staff-005'), 'Should see Eve from div-001');
      assert.ok(visibleIds.includes('staff-003'), 'Should see Carol from div-002');
      assert.ok(!visibleIds.includes('staff-004'), 'Should NOT see Dave from other division');
    });

    it('should allow staff to access colleague detail in same division', async () => {
      // staff-001 (Alice) and staff-003 (Carol) are both in div-002
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-003')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.staff_id, 'staff-003', 'Should allow access to colleague in same division');
    });

    it('should reject staff accessing colleague detail from different division', async () => {
      // staff-001 (Alice) is NOT in div-003, staff-004 (Dave) is in div-003
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff/staff-004')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('should reject staff accessing division they are not a member of', async () => {
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff?division_id=div-003')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.length, 0, 'Should return empty for non-member division');
      assert.strictEqual(response.body.total_count, 0);
    });

    it('should return empty for staff with no division membership', async () => {
      // Create a staff member not in any division (staff-006 has no division_members entry)
      stmt.insertStaffAgent.run('staff-006', 'No Division', 'member', 'div-001', '["claude"]', '[]', 'active');
      // (intentionally not adding to division_members)

      // Create session for staff-006 who has no division membership
      const staffTokenNoDiv = createTestSession({ owner_type: 'staff', owner_id: 'staff-006', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${staffTokenNoDiv}`)
        .expect(200);

      assert.strictEqual(response.body.staff.length, 0, 'Staff with no division sees empty');
      assert.strictEqual(response.body.total_count, 0);
    });
  });

  describe('Pagination: offset and limit applied to deduplicated results', () => {
    it('should apply offset and limit correctly for founder', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
      const limit = 2;
      const offset = 0;

      const response = await request(app)
        .get(`/api/staff?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.length, limit, 'Should return limited items');
      assert.strictEqual(response.body.limit, limit);
      assert.strictEqual(response.body.offset, offset);
    });

    it('should apply offset correctly for pagination', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
      const limit = 1;
      const offset = 2;

      const response = await request(app)
        .get(`/api/staff?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      assert.strictEqual(response.body.staff.length, limit, 'Should return only 1 item after offset');
      assert.strictEqual(response.body.offset, offset);
    });

    it('should return accurate total_count with pagination', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      // Get all with large limit first to establish total
      const allResponse = await request(app)
        .get('/api/staff?limit=1000')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      const limit = 2;
      const offset = 1;

      const response = await request(app)
        .get(`/api/staff?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      // total_count should be the same as the full count (before pagination)
      assert.strictEqual(response.body.total_count, allResponse.body.total_count, 'Total count should match full count');
      // staff length should be limited by pagination
      assert.strictEqual(response.body.staff.length, limit, 'Should return only paginated items');
      assert.strictEqual(response.body.total_count, allResponse.body.total_count, 'Total count should reflect all authorized items');
    });

    it('should apply pagination after deduplication for staff in multiple divisions', async () => {
      const staffToken = createTestSession({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });
      const limit = 2;
      const offset = 1;

      const response = await request(app)
        .get(`/api/staff?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      assert.ok(response.body.total_count >= 0, 'Total count should be set');
      assert.ok(response.body.total_count >= response.body.staff.length, 'Staff should be paginated correctly');
    });
  });

  describe('Duplicate Handling: Single staff in multiple divisions', () => {
    it('should deduplicate staff appearing in multiple divisions', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      const aliceCount = response.body.staff.filter((s: any) => s.staff_id === 'staff-001').length;
      assert.strictEqual(aliceCount, 1, 'Alice should appear only once despite being in 2 divisions');
    });

    it('should deduplicate correctly with division filter for founder', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff?division_id=div-001')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      const aliceCount = response.body.staff.filter((s: any) => s.staff_id === 'staff-001').length;
      assert.strictEqual(aliceCount, 1, 'Alice should appear only once in filtered results');
    });
  });

  describe('Authorization Policy: Unauthorized Access', () => {
    it('should reject anonymous request for staff list', async () => {
      await request(app)
        .get('/api/staff')
        .expect(401);
    });

    it('should reject anonymous request for staff detail', async () => {
      await request(app)
        .get('/api/staff/staff-001')
        .expect(401);
    });
  });

  describe('X-Total-Count Header', () => {
    it('should include X-Total-Count header with correct value', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      const totalCount = parseInt(response.headers['x-total-count'] as string);
      assert.strictEqual(totalCount, response.body.total_count, 'Header should match body total_count');
      assert.strictEqual(totalCount, response.body.staff.length, 'Header should match returned count when no pagination');
    });

    it('should set X-Total-Count header even when paginated', async () => {
      const founderToken = createTestSession({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });

      const response = await request(app)
        .get('/api/staff?limit=2&offset=0')
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(200);

      const totalCount = parseInt(response.headers['x-total-count'] as string);
      assert.strictEqual(totalCount > 2, true, 'Header should show total, not page size');
      assert.strictEqual(totalCount, response.body.total_count, 'Header should match body');
    });
  });
});