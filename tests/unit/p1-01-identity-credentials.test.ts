// P1-01: Unit tests for identity credential validation
// Tests validateIdentityCredential function for staff, division, and seat credentials

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, setDatabaseInstance, stmt } from '../../src/database.js';
import {
  generateIdentityCredential,
  hashIdentityCredential,
  insertIdentityCredential,
  revokeIdentityCredential,
  validateIdentityCredential
} from '../../src/auth/identity-credentials.js';

describe('P1-01: Identity Credential Validation', () => {
  let db: any;

  beforeEach(() => {
    db = createDatabase(':memory:');
    setDatabaseInstance(db);
  });

  afterEach(() => {
    try { db.close(); } catch {}
  });

  describe('Anonymous request rejection', () => {
    it('should reject empty token', () => {
      const result = validateIdentityCredential(db, '', 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_MISSING');
    });

    it('should reject missing token', () => {
      const result = validateIdentityCredential(db, null as any, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_MISSING');
    });
  });

  describe('Token format validation', () => {
    it('should reject empty Bearer token', () => {
      const result = validateIdentityCredential(db, 'Bearer ', 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_EMPTY');
    });

    it('should reject unsupported auth scheme (Basic)', () => {
      const result = validateIdentityCredential(db, 'Basic invalid', 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'UNSUPPORTED_AUTH_SCHEME');
    });
  });

  describe('Token existence and validity', () => {
    it('should reject non-existent token with Bearer prefix', () => {
      const result = validateIdentityCredential(db, 'Bearer nonexistent', 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_INVALID');
    });

    it('should reject token without Bearer prefix', () => {
      const result = validateIdentityCredential(db, 'nonexistent', 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'INVALID_SCHEME');
    });

    it('should accept valid token with Bearer prefix', () => {
      // Create division first (required for staff foreign key)
      stmt.insertDivision.run('div-1', 'Test Division', '', null, 0, '[]', '[]');
      // Create staff agent
      stmt.insertStaffAgent.run('staff-001', 'Test Staff', 'member', 'div-1', '[]', '[]', 'active');
      stmt.updateDivision.run('Test Division', '', null, 0, '[]', '[]', 'div-1');

      const cred = generateIdentityCredential('staff', 'staff-001', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'staff',
        identityId: 'staff-001',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.principal?.type, 'staff');
    });

    it('should reject expired token', () => {
      const cred = generateIdentityCredential('staff', 'staff-expired', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: 'expired-cred',
        identityType: 'staff',
        identityId: 'staff-expired',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000  // Expired 1 second ago
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_EXPIRED');
    });

    it('should reject revoked token', () => {
      const cred = generateIdentityCredential('staff', 'staff-revoked', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: 'revoked-cred',
        identityType: 'staff',
        identityId: 'staff-revoked',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      });

      revokeIdentityCredential(db, 'revoked-cred');

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
    });

    it('should reject token with revoked_at timestamp in the past', () => {
      const cred = generateIdentityCredential('staff', 'staff-timerevoked', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: 'timerevoked-cred',
        identityType: 'staff',
        identityId: 'staff-timerevoked',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      });

      // Manually set revoked_at in the past but keep status as 'active'
      db.db.prepare(`
        UPDATE identity_credentials
        SET revoked_at = ?, status = 'active'
        WHERE credential_id = ?
      `).run(Date.now() - 5000, 'timerevoked-cred');

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_REVOKED');
    });
  });

  describe('Identity status validation', () => {
    beforeEach(() => {
      // Create division first (required for staff foreign key)
      stmt.insertDivision.run('div-1', 'Test Division', '', null, 0, '[]', '[]');
      // Create staff agent
      stmt.insertStaffAgent.run('staff-001', 'Test Staff', 'member', 'div-1', '[]', '[]', 'active');
      // Reset division (7 params: name, description, head_staff_id, budget_limit, permissions, strategic_objectives, division_id)
      stmt.updateDivision.run('Test Division', '', null, 0, '[]', '[]', 'div-1');
      // Create seats
      stmt.insertSeat.run('seat-001', 'Test Seat', 'vacant', 0, '');
    });

    it('should accept valid Staff credential for active staff', () => {
      const cred = generateIdentityCredential('staff', 'staff-001', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'staff',
        identityId: 'staff-001',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.principal?.type, 'staff');
      assert.strictEqual(result.principal?.identityId, 'staff-001');
      assert.strictEqual(result.principal?.runtimeId, 'claude');
    });

    it('should accept valid Division credential', () => {
      const cred = generateIdentityCredential('division', 'div-1', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'division',
        identityId: 'div-1',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'division');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.principal?.type, 'division');
    });

    it('should accept valid Seat credential for vacant seat', () => {
      const cred = generateIdentityCredential('seat', 'seat-001', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'seat',
        identityId: 'seat-001',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'seat');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.principal?.type, 'seat');
    });

    it('should reject credential for inactive Staff', () => {
      // updateStaffAgent: 6 params + 1 WHERE = 7 total: name, role, division_id, runtime_instances, permissions, status, staff_id
      stmt.updateStaffAgent.run('Test Staff', 'member', 'div-1', '[]', '[]', 'inactive', 'staff-001');

      const cred = generateIdentityCredential('staff', 'staff-001', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'staff',
        identityId: 'staff-001',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'IDENTITY_INACTIVE');
    });

    it('should reject credential for permanent Seat', () => {
      stmt.insertSeat.run('seat-002', 'Permanent Seat', 'permanent', 1, '');

      const cred = generateIdentityCredential('seat', 'seat-002', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'seat',
        identityId: 'seat-002',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'seat');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'IDENTITY_INACTIVE');
    });

    it('should reject credential for non-existent staff', () => {
      const cred = generateIdentityCredential('staff', 'staff-nonexistent', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'staff',
        identityId: 'staff-nonexistent',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'IDENTITY_INACTIVE');
    });
  });

  describe('Identity type validation', () => {
    beforeEach(() => {
      stmt.insertDivision.run('div-1', 'Test Division', '', null, 0, '[]', '[]');
      stmt.insertStaffAgent.run('staff-001', 'Test Staff', 'member', 'div-1', '[]', '[]', 'active');
      stmt.updateDivision.run('Test Division', '', null, 0, '[]', '[]', 'div-1');
    });

    it('should reject when credential type does not match requested type', () => {
      const cred = generateIdentityCredential('division', 'div-1', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'division',
        identityId: 'div-1',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      // Try to use division credential for staff session
      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_INVALID');
    });
  });

  describe('Last used timestamp tracking', () => {
    beforeEach(() => {
      stmt.insertDivision.run('div-1', 'Test Division', '', null, 0, '[]', '[]');
      stmt.insertStaffAgent.run('staff-001', 'Test Staff', 'member', 'div-1', '[]', '[]', 'active');
      stmt.updateDivision.run('Test Division', '', null, 0, '[]', '[]', 'div-1');
    });

    it('should update last_used_at on successful validation', () => {
      const cred = generateIdentityCredential('staff', 'staff-001', 'claude');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'staff',
        identityId: 'staff-001',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const beforeTime = Date.now() - 10000;
      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'staff');

      assert.strictEqual(result.valid, true);

      // Check that last_used_at was updated
      const credRecord = db.db.prepare('SELECT last_used_at FROM identity_credentials WHERE credential_id = ?').get(cred.credentialId);
      assert.ok(credRecord.last_used_at > beforeTime, 'last_used_at should be updated');
    });
  });

  describe('Token size validation', () => {
    it('should reject oversized tokens', () => {
      const hugeToken = 'a'.repeat(3000);
      const result = validateIdentityCredential(db, hugeToken, 'staff');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error?.code, 'TOKEN_TOO_LARGE');
    });
  });

  describe('Principal extraction', () => {
    it('should extract runtime_id from credential', () => {
      stmt.insertDivision.run('div-1', 'Test Division', '', null, 0, '[]', '[]');

      const cred = generateIdentityCredential('division', 'div-1', 'hermes');
      const credHash = hashIdentityCredential(cred.secret);
      insertIdentityCredential(db, {
        credentialId: cred.credentialId,
        identityType: 'division',
        identityId: 'div-1',
        tokenHash: credHash,
        runtimeId: cred.runtimeId,
        createdAt: cred.createdAt,
        expiresAt: cred.expiresAt
      });

      const result = validateIdentityCredential(db, `Bearer ${cred.secret}`, 'division');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.principal?.type, 'division');
      assert.strictEqual(result.principal?.identityId, 'div-1');
      assert.strictEqual(result.principal?.runtimeId, 'hermes');
      assert.strictEqual(result.principal?.credentialId, cred.credentialId);
    });
  });
});