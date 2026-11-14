// Database Persistence Tests
// Verifies data survives server restart with persistent database

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance, SCHEMA_VERSION } from '../src/database.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Database Persistence', () => {
  const testDbDir = path.join(process.cwd(), 'test-persistence');
  let testDbPath: string;
  let db: DatabaseInstance;

  before(() => {
    // Ensure test data directory exists
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test database directory
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Use a unique database path for each test
    testDbPath = path.join(testDbDir, `persistence-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    db = createDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database files
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    const shmPath = testDbPath + '-shm';
    const walPath = testDbPath + '-wal';
    if (fs.existsSync(shmPath)) { try { fs.unlinkSync(shmPath); } catch {} }
    if (fs.existsSync(walPath)) { try { fs.unlinkSync(walPath); } catch {} }
  });

  it('should persist agents across database close and reopen', () => {
    const agentId = db.generateId();
    const displayName = 'Test Agent';
    const runtime = 'claude';

    db.stmt.insertAgent.run(agentId, agentId, displayName, runtime);

    // Verify agent exists
    const agent = db.stmt.getAgentById.get(agentId);
    assert.ok(agent, 'Agent should exist after insert');
    assert.strictEqual(agent.agent_id, agentId);
    assert.strictEqual(agent.display_name, displayName);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify agent still exists
    const persistedAgent = db.stmt.getAgentById.get(agentId);
    assert.ok(persistedAgent, 'Agent should persist after reopen');
    assert.strictEqual(persistedAgent.agent_id, agentId);
    assert.strictEqual(persistedAgent.display_name, displayName);
  });

  it('should persist messages across database close and reopen', () => {
    const senderId = 'sender-agent-' + Date.now();
    const recipientId = 'recipient-agent-' + Date.now();
    const messageId = db.generateId();
    const content = 'Test message content';

    // Insert sender and recipient first
    db.stmt.insertAgent.run(senderId, senderId, 'Sender', 'claude');
    db.stmt.insertAgent.run(recipientId, recipientId, 'Recipient', 'claude');

    // Insert message
    db.stmt.insertMessage.run(messageId, senderId, recipientId, content, null);

    // Verify message exists
    const message = db.stmt.getMessageById.get(messageId);
    assert.ok(message, 'Message should exist after insert');
    assert.strictEqual(message.content, content);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify message still exists
    const persistedMessage = db.stmt.getMessageById.get(messageId);
    assert.ok(persistedMessage, 'Message should persist after reopen');
    assert.strictEqual(persistedMessage.content, content);
  });

  it('should persist council seats across database close and reopen', () => {
    const seatId = 'seat-test-' + Date.now();
    const name = 'Test Seat';
    const status = 'permanent';
    const isFounder = 0;
    const description = 'Test seat description';

    db.stmt.insertSeat.run(seatId, name, status, isFounder, description);

    // Verify seat exists
    const seat = db.stmt.getSeatById.get(seatId);
    assert.ok(seat, 'Seat should exist after insert');
    assert.strictEqual(seat.seat_id, seatId);
    assert.strictEqual(seat.name, name);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify seat still exists
    const persistedSeat = db.stmt.getSeatById.get(seatId);
    assert.ok(persistedSeat, 'Seat should persist after reopen');
    assert.strictEqual(persistedSeat.seat_id, seatId);
    assert.strictEqual(persistedSeat.name, name);
  });

  it('should persist personas across database close and reopen', () => {
    const seatId = 'seat-for-persona-' + Date.now();
    const personaId = 'persona-test-' + Date.now();
    const name = 'Test Persona';
    const description = 'Test persona description';
    const traits = 'Test traits';

    // Insert seat first
    db.stmt.insertSeat.run(seatId, 'Seat for Persona', 'permanent', 0, '');

    // Insert persona
    db.stmt.insertPersona.run(personaId, seatId, name, description, traits);

    // Verify persona exists
    const persona = db.stmt.getPersonaById.get(personaId);
    assert.ok(persona, 'Persona should exist after insert');
    assert.strictEqual(persona.persona_id, personaId);
    assert.strictEqual(persona.name, name);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify persona still exists
    const persistedPersona = db.stmt.getPersonaById.get(personaId);
    assert.ok(persistedPersona, 'Persona should persist after reopen');
    assert.strictEqual(persistedPersona.persona_id, personaId);
    assert.strictEqual(persistedPersona.name, name);
  });

  it('should persist constitutions across database close and reopen', () => {
    const version = '1.0.0-test-' + Date.now();
    const content = 'Test constitution content';
    const status = 'active';
    const approvedByFounder = 1;

    db.stmt.insertConstitution.run(version, content, status, approvedByFounder);

    // Verify constitution exists
    const constitution = db.stmt.getConstitution.get(version);
    assert.ok(constitution, 'Constitution should exist after insert');
    assert.strictEqual(constitution.version, version);
    assert.strictEqual(constitution.content, content);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify constitution still exists
    const persistedConstitution = db.stmt.getConstitution.get(version);
    assert.ok(persistedConstitution, 'Constitution should persist after reopen');
    assert.strictEqual(persistedConstitution.version, version);
    assert.strictEqual(persistedConstitution.content, content);
  });

  it('should persist meetings across database close and reopen', () => {
    const meetingId = 'meeting-test-' + Date.now();
    const number = 1;
    const status = 'preparing';
    const constitutionVersion = '1.0.0';

    // First need to create constitution for FK
    db.stmt.insertConstitution.run(constitutionVersion, 'Test constitution', 'active', 1);

    db.stmt.insertMeeting.run(meetingId, number, status, constitutionVersion, null, null);

    // Verify meeting exists
    const meeting = db.stmt.getMeetingById.get(meetingId);
    assert.ok(meeting, 'Meeting should exist after insert');
    assert.strictEqual(meeting.meeting_id, meetingId);
    assert.strictEqual(meeting.number, number);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify meeting still exists
    const persistedMeeting = db.stmt.getMeetingById.get(meetingId);
    assert.ok(persistedMeeting, 'Meeting should persist after reopen');
    assert.strictEqual(persistedMeeting.meeting_id, meetingId);
    assert.strictEqual(persistedMeeting.number, number);
  });

  it('should persist schema version across database close and reopen', () => {
    // Check schema version exists
    const schemaVersion = db.stmt.getSchemaVersion.get(SCHEMA_VERSION);
    assert.ok(schemaVersion, 'Schema version should exist');
    assert.strictEqual(schemaVersion.version, SCHEMA_VERSION);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify schema version still exists
    const persistedSchemaVersion = db.stmt.getSchemaVersion.get(SCHEMA_VERSION);
    assert.ok(persistedSchemaVersion, 'Schema version should persist after reopen');
    assert.strictEqual(persistedSchemaVersion.version, SCHEMA_VERSION);
  });

  it('should persist multiple records of different types in single session', () => {
    const agentId = db.generateId();
    db.stmt.insertAgent.run(agentId, agentId, 'Multi-Test Agent', 'claude');

    const seatId = 'seat-multi-' + Date.now();
    db.stmt.insertSeat.run(seatId, 'Multi-Test Seat', 'permanent', 0, '');

    const personaId = 'persona-multi-' + Date.now();
    db.stmt.insertPersona.run(personaId, seatId, 'Multi-Test Persona', '', '');

    const messageId = db.generateId();
    const senderId = 'sender-multi-' + Date.now();
    const recipientId = 'recipient-multi-' + Date.now();
    db.stmt.insertAgent.run(senderId, senderId, 'Sender', 'claude');
    db.stmt.insertAgent.run(recipientId, recipientId, 'Recipient', 'claude');
    db.stmt.insertMessage.run(messageId, senderId, recipientId, 'Multi-test message', null);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify all persisted
    assert.ok(db.stmt.getAgentById.get(agentId), 'Agent should persist');
    assert.ok(db.stmt.getSeatById.get(seatId), 'Seat should persist');
    assert.ok(db.stmt.getPersonaById.get(personaId), 'Persona should persist');
    assert.ok(db.stmt.getMessageById.get(messageId), 'Message should persist');
  });

  it('should maintain foreign key constraints after reopen', () => {
    const seatId = 'seat-fk-' + Date.now();
    const personaId = 'persona-fk-' + Date.now();

    db.stmt.insertSeat.run(seatId, 'FK Test Seat', 'permanent', 0, '');
    db.stmt.insertPersona.run(personaId, seatId, 'FK Test Persona', '', '');

    // Verify relationship exists
    const persona = db.stmt.getPersonaById.get(personaId);
    assert.strictEqual(persona.seat_id, seatId);

    // Close database
    db.close();

    // Reopen database
    db = createDatabase(testDbPath);

    // Verify relationship still valid
    const persistedPersona = db.stmt.getPersonaById.get(personaId);
    assert.ok(persistedPersona, 'Persona should persist');
    assert.strictEqual(persistedPersona.seat_id, seatId, 'Foreign key relationship should be maintained');
  });
});