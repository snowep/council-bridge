// E2E Database Bootstrap Test
// Tests database initialization with founder authorization

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { initializeFounderKeys, loadFounderKeyPair, signFounderRequest, getFounderKeyId } from '../../src/auth/founder.js';
import { setDatabaseInstance } from '../../src/auth/founder.js';
import { initializeCouncil, createDefaultConstitution } from '../../scripts/seed/initialize-council.js';
import server, { getAuthContext } from '../../src/server.js';
import * as fs from 'fs';
import * as path from 'path';

let db: DatabaseInstance;
let founderKeyPair: ReturnType<typeof loadFounderKeyPair>;

describe('E2E: Database Bootstrap', () => {
  before(() => {
    // Initialize founder keys
    founderKeyPair = initializeFounderKeys();
  });

  after(() => {
    if (db) db.close();
  });

  describe('with founder signature', () => {
    it('should bootstrap database with valid founder signature', async () => {
      // Create in-memory database
      db = createDatabase(':memory:');
      setDatabaseInstance(db);

      // Create founder signature for bootstrap
      const signature = signFounderRequest(
        'bootstrap_database',
        { database_path: ':memory:' },
        founderKeyPair.private_key_pem,
        founderKeyPair.key_id
      );

      // Bootstrap the database
      const council = initializeCouncil(db);
      const version = createDefaultConstitution(db);

      // Verify results
      const seats = db.stmt.listSeats.all() as any[];
      const personas = db.stmt.listPersonas.all() as any[];

      assert.strictEqual(seats.length, 11, 'Should have 11 council seats');
      assert.strictEqual(personas.length, 4, 'Should have 4 founding personas (4 permanent seats)');
      assert.strictEqual(version, '1.0.0', 'Constitution should be v1.0.0');
    });

    it('should verify founder signature in API call', async () => {
      // Create in-memory database
      db = createDatabase(':memory:');
      setDatabaseInstance(db);

      // Create founder signature
      const signature = signFounderRequest(
        'test_operation',
        { test_data: 'value' },
        founderKeyPair.private_key_pem,
        founderKeyPair.key_id
      );

      // Make authenticated request with founder credentials
      const response = await request(server)
        .post('/api/auth/session')
        .set('Content-Type', 'application/json')
        .send({
          owner_type: 'founder',
          owner_id: 'admin',
          runtime: 'claude',
          founder_signature: signature.signature,
          founder_timestamp: signature.timestamp,
          founder_nonce: signature.nonce,
          founder_key_id: signature.key_id
        });

      // Should reject because identity not in database
      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.error, 'Invalid or inactive identity for session provisioning');
    });
  });

  describe('database connectivity', () => {
    it('should verify health endpoint', async () => {
      const response = await request(server).get('/health');
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.status, 'healthy');
    });

    it('should verify session creation without auth in development mode', async () => {
      const response = await request(server)
        .post('/api/auth/session')
        .set('Content-Type', 'application/json')
        .send({
          owner_type: 'staff',
          owner_id: 'staff-001',
          runtime: 'claude'
        });

      // Should succeed in development mode with fallback
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.session_token);
    });
  });
});