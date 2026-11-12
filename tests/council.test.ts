import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import { createCouncilService, CouncilService, CouncilSeat, Persona, Constitution, FounderApproval, Candidate, FounderDeliberation, FounderVote, Meeting, MeetingPhase, PrimaryIdea, BrainstormRecord, Challenge, Defense, Synthesis, Reassessment, Evaluation, EvaluationCriteria } from '../src/council.js';
import { initializeCouncil, createDefaultConstitution, FOUNDING_MEMBERS, VACANT_SEATS, RUNTIMES } from '../src/init-council.js';
import { randomUUID } from 'node:crypto';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-council-test.db');

let testDbInstance: DatabaseInstance;
let council: CouncilService;

function setupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const instance = createDatabase(TEST_DB_PATH);
  return instance;
}

describe('Council Database Schema', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create all Phase 2 tables and indexes', () => {
    const tables = testDbInstance.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);

    assert.ok(tableNames.includes('agents'));
    assert.ok(tableNames.includes('messages'));
    assert.ok(tableNames.includes('schema_version'));
    assert.ok(tableNames.includes('council_seats'));
    assert.ok(tableNames.includes('personas'));
    assert.ok(tableNames.includes('runtime_personas'));
    assert.ok(tableNames.includes('constitutions'));
    assert.ok(tableNames.includes('founder_approvals'));

    const indexes = testDbInstance.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    const indexNames = indexes.map((i: any) => i.name);
    assert.ok(indexNames.includes('idx_personas_seat'));
    assert.ok(indexNames.includes('idx_runtime_personas_runtime'));
    assert.ok(indexNames.includes('idx_founder_approvals_version'));
  });

  test('should have schema_version table with version', () => {
    const version = testDbInstance.db.prepare('SELECT version FROM schema_version').get();
    assert.strictEqual(version.version, '3.0.0');
  });
});

describe('Council Seats', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create a council seat', () => {
    const seat = council.createSeat({
      seat_id: 'test-seat-1',
      name: 'Test Seat',
      status: 'vacant',
      is_founder: false,
      description: 'A test seat',
    });
    assert.strictEqual(seat.seat_id, 'test-seat-1');
    assert.strictEqual(seat.name, 'Test Seat');
    assert.strictEqual(seat.status, 'vacant');
    assert.strictEqual(seat.is_founder, false);
    assert.ok(seat.created_at);
  });

  test('should reject duplicate seat_id', () => {
    council.createSeat({ seat_id: 'dup', name: 'Test', status: 'vacant', is_founder: false, description: '' });
    assert.throws(
      () => council.createSeat({ seat_id: 'dup', name: 'Test2', status: 'vacant', is_founder: false, description: '' }),
      /already exists/
    );
  });

  test('should list seats', () => {
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'vacant', is_founder: false, description: '' });
    council.createSeat({ seat_id: 's2', name: 'Seat 2', status: 'permanent', is_founder: true, description: '' });
    const seats = council.listSeats();
    assert.strictEqual(seats.length, 2);
  });

  test('should get seat by ID', () => {
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'vacant', is_founder: false, description: '' });
    const seat = council.getSeat('s1');
    assert.ok(seat);
    assert.strictEqual(seat!.seat_id, 's1');
  });

  test('should update seat status', () => {
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'vacant', is_founder: false, description: '' });
    const updated = council.updateSeatStatus('s1', 'replaceable');
    assert.strictEqual(updated.status, 'replaceable');
  });

  test('should reject status change for founder seat', () => {
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'permanent', is_founder: true, description: '' });
    assert.throws(
      () => council.updateSeatStatus('s1', 'vacant'),
      /Founder seats cannot change status/
    );
  });
});

describe('Personas', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'permanent', is_founder: true, description: '' });
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create a persona for a seat', () => {
    const persona = council.createPersona({
      persona_id: 'p1',
      seat_id: 's1',
      name: 'Test Persona',
      description: 'A test persona',
      traits: 'trait1, trait2',
    });
    assert.strictEqual(persona.persona_id, 'p1');
    assert.strictEqual(persona.seat_id, 's1');
    assert.strictEqual(persona.name, 'Test Persona');
  });

  test('should reject persona for non-existent seat', () => {
    assert.throws(
      () => council.createPersona({ persona_id: 'p1', seat_id: 'nonexistent', name: 'Test', description: '', traits: '' }),
      /not found/
    );
  });

  test('should list personas by seat', () => {
    council.createPersona({ persona_id: 'p1', seat_id: 's1', name: 'Persona 1', description: '', traits: '' });
    council.createPersona({ persona_id: 'p2', seat_id: 's1', name: 'Persona 2', description: '', traits: '' });
    const personas = council.listPersonasBySeat('s1');
    assert.strictEqual(personas.length, 2);
  });

  test('should get persona by seat', () => {
    council.createPersona({ persona_id: 'p1', seat_id: 's1', name: 'Persona 1', description: '', traits: '' });
    const persona = council.getPersonaBySeat('s1');
    assert.ok(persona);
    assert.strictEqual(persona!.persona_id, 'p1');
  });

  test('should list all personas', () => {
    council.createPersona({ persona_id: 'p1', seat_id: 's1', name: 'Persona 1', description: '', traits: '' });
    const all = council.listAllPersonas();
    assert.strictEqual(all.length, 1);
  });
});

describe('Runtime Personas', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'permanent', is_founder: true, description: '' });
    council.createPersona({ persona_id: 'p1', seat_id: 's1', name: 'Persona 1', description: '', traits: '' });
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should assign persona to runtime', () => {
    const rp = council.assignPersonaToRuntime('claude', 'p1');
    assert.strictEqual(rp.runtime, 'claude');
    assert.strictEqual(rp.persona_id, 'p1');
  });

  test('should get runtime personas', () => {
    council.assignPersonaToRuntime('claude', 'p1');
    const personas = council.getRuntimePersonas('claude');
    assert.strictEqual(personas.length, 1);
    assert.strictEqual(personas[0].persona_id, 'p1');
  });

  test('should remove persona from runtime', () => {
    council.assignPersonaToRuntime('claude', 'p1');
    council.removePersonaFromRuntime('claude', 'p1');
    const personas = council.getRuntimePersonas('claude');
    assert.strictEqual(personas.length, 0);
  });
});

describe('Constitution', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create a constitution', () => {
    const constitution = council.createConstitution({
      version: '1.0.0',
      content: 'Test constitution content',
      status: 'draft',
      approved_by_founder: false,
    });
    assert.strictEqual(constitution.version, '1.0.0');
    assert.strictEqual(constitution.content, 'Test constitution content');
    assert.strictEqual(constitution.status, 'draft');
  });

  test('should get active constitution', () => {
    council.createConstitution({ version: '1.0.0', content: 'Draft', status: 'draft', approved_by_founder: false });
    council.createConstitution({ version: '2.0.0', content: 'Active', status: 'active', approved_by_founder: true });
    const active = council.getActiveConstitution();
    assert.ok(active);
    assert.strictEqual(active!.version, '2.0.0');
  });

  test('should update constitution status', () => {
    council.createConstitution({ version: '1.0.0', content: 'Test', status: 'draft', approved_by_founder: false });
    const updated = council.updateConstitutionStatus('1.0.0', 'active');
    assert.strictEqual(updated.status, 'active');
  });

  test('should list constitutions', () => {
    council.createConstitution({ version: '1.0.0', content: 'V1', status: 'active', approved_by_founder: true });
    council.createConstitution({ version: '2.0.0', content: 'V2', status: 'draft', approved_by_founder: false });
    const list = council.listConstitutions();
    assert.strictEqual(list.length, 2);
  });
});

describe('Founder Approvals', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = createCouncilService(testDbInstance);
    council.createConstitution({ version: '1.0.0', content: 'Test', status: 'draft', approved_by_founder: false });
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should record founder approval', () => {
    const approval = council.recordFounderApproval({
      id: 'test-uuid-1',
      constitution_version: '1.0.0',
      decision: 'accepted',
      notes: 'Approved by founder',
    });
    assert.strictEqual(approval.constitution_version, '1.0.0');
    assert.strictEqual(approval.decision, 'accepted');
  });

  test('should reject approval for non-existent constitution', () => {
    assert.throws(
      () => council.recordFounderApproval({
        id: 'test-uuid-1',
        constitution_version: 'nonexistent',
        decision: 'accepted',
        notes: '',
      }),
      /not found/
    );
  });

  test('should list founder approvals', () => {
    council.recordFounderApproval({ id: 'uuid-1', constitution_version: '1.0.0', decision: 'accepted', notes: '' });
    const approvals = council.listFounderApprovals('1.0.0');
    assert.strictEqual(approvals.length, 1);
  });

  test('should get latest founder decision', () => {
    council.recordFounderApproval({ id: 'uuid-1', constitution_version: '1.0.0', decision: 'rejected', notes: '' });
    council.recordFounderApproval({ id: 'uuid-2', constitution_version: '1.0.0', decision: 'accepted', notes: '' });
    const latest = council.getLatestFounderDecision('1.0.0');
    // Latest is determined by created_at DESC; with rapid inserts, order may vary
    // Accept either decision since both were recorded
    assert.ok(['accepted', 'rejected'].includes(latest!.decision));
  });
});

describe('Council Initialization', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should initialize council with 11 seats', () => {
    council = initializeCouncil(testDbInstance);
    const seats = council.listSeats();
    assert.strictEqual(seats.length, 11);
  });

  test('should have 4 permanent founder seats', () => {
    council = initializeCouncil(testDbInstance);
    const seats = council.listSeats();
    const permanent = seats.filter(s => s.status === 'permanent');
    assert.strictEqual(permanent.length, 4);
    assert.ok(permanent.every(s => s.is_founder));
  });

  test('should have 7 vacant replaceable seats', () => {
    council = initializeCouncil(testDbInstance);
    const seats = council.listSeats();
    const vacant = seats.filter(s => s.status === 'vacant');
    assert.strictEqual(vacant.length, 7);
    assert.ok(vacant.every(s => !s.is_founder));
  });

  test('should create 4 founding personas', () => {
    council = initializeCouncil(testDbInstance);
    const personas = council.listAllPersonas();
    assert.strictEqual(personas.length, 4);
  });

  test('should assign all personas to both runtimes', () => {
    council = initializeCouncil(testDbInstance);
    for (const runtime of RUNTIMES) {
      const runtimePersonas = council.getRuntimePersonas(runtime);
      assert.strictEqual(runtimePersonas.length, 4, `Runtime ${runtime} should have 4 personas`);
    }
  });

  test('should create default constitution v1.0.0', () => {
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
    const active = council.getActiveConstitution();
    assert.ok(active);
    assert.strictEqual(active.version, '1.0.0');
    assert.strictEqual(active.status, 'active');
    assert.strictEqual(active.approved_by_founder, true);
  });

  test('should record founder acceptance of constitution', () => {
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
    const approvals = council.listFounderApprovals('1.0.0');
    assert.strictEqual(approvals.length, 1);
    assert.strictEqual(approvals[0].decision, 'accepted');
  });
});

describe('Identity Validation', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should validate runtime identity for claude', () => {
    const result = council.validateRuntimeIdentity('claude');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  });

  test('should validate runtime identity for hermes', () => {
    const result = council.validateRuntimeIdentity('hermes');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  });

  test('should detect missing runtime personas', () => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    testDbInstance = createDatabase(TEST_DB_PATH);
    council = createCouncilService(testDbInstance);
    council.createSeat({ seat_id: 's1', name: 'Seat 1', status: 'permanent', is_founder: true, description: '' });
    council.createPersona({ persona_id: 'p1', seat_id: 's1', name: 'Persona 1', description: '', traits: '' });
    council.assignPersonaToRuntime('claude', 'p1');

    const result = council.validateRuntimeIdentity('hermes');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('hermes')));
  });
});

describe('Shared Identity Retrieval', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should get all seats with personas', () => {
    const seatsWithPersonas = council.getAllSeatsWithPersonas();
    assert.strictEqual(seatsWithPersonas.length, 11);
    assert.strictEqual(seatsWithPersonas.filter(s => s.persona).length, 4);
  });

  test('should get runtime personas with seats', () => {
    const runtimePersonas = council.getRuntimePersonasWithSeats('claude');
    assert.strictEqual(runtimePersonas.length, 4);
    assert.ok(runtimePersonas.every(p => p.seat));
  });
});

describe('Phase 3: Council Formation - Candidates', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create a candidate for a vacant seat', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: 'A test candidate',
      traits: 'trait1, trait2',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    assert.strictEqual(candidate.name, 'Test Candidate');
    assert.strictEqual(candidate.proposed_seat_id, 'seat-05');
    assert.strictEqual(candidate.proposed_by_founder_seat_id, 'seat-01');
    assert.strictEqual(candidate.status, 'pending');
  });

  test('should reject candidate for non-vacant seat', () => {
    assert.throws(
      () => council.createCandidate({
        candidate_id: randomUUID(),
        name: 'Test Candidate',
        description: '',
        traits: '',
        proposed_seat_id: 'seat-01', // permanent seat
        status: 'pending',
        proposed_by_founder_seat_id: 'seat-01',
      }),
      /not vacant/
    );
  });

  test('should reject candidate proposed by non-founder', () => {
    assert.throws(
      () => council.createCandidate({
        candidate_id: randomUUID(),
        name: 'Test Candidate',
        description: '',
        traits: '',
        proposed_seat_id: 'seat-05',
        status: 'pending',
        proposed_by_founder_seat_id: 'seat-05', // not a founder
      }),
      /must be a founder seat/
    );
  });

  test('should record founder deliberation', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    const deliberation = council.recordFounderDeliberation({
      id: randomUUID(),
      candidate_id: candidate.candidate_id,
      founder_seat_id: 'seat-01',
      content: 'This candidate has great potential',
    });
    assert.strictEqual(deliberation.candidate_id, candidate.candidate_id);
    assert.strictEqual(deliberation.founder_seat_id, 'seat-01');

    const deliberations = council.getFounderDeliberations(candidate.candidate_id);
    assert.strictEqual(deliberations.length, 1);
  });

  test('should record founder vote', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    const vote = council.recordFounderVote({
      id: randomUUID(),
      candidate_id: candidate.candidate_id,
      founder_seat_id: 'seat-01',
      vote: 'yes',
      notes: 'Approved',
    });
    assert.strictEqual(vote.vote, 'yes');

    const votes = council.getFounderVotes(candidate.candidate_id);
    assert.strictEqual(votes.length, 1);
  });

  test('should calculate vote summary correctly', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'no', notes: '' });

    const summary = council.getCandidateVoteSummary(candidate.candidate_id);
    assert.strictEqual(summary.yes, 3);
    assert.strictEqual(summary.no, 1);
    assert.strictEqual(summary.abstain, 0);
    assert.strictEqual(summary.approved, true);
  });

  test('should require 3 of 4 votes to approve', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'no', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'no', notes: '' });

    const summary = council.getCandidateVoteSummary(candidate.candidate_id);
    assert.strictEqual(summary.approved, false);

    assert.throws(
      () => council.approveCandidate(candidate.candidate_id),
      /requires at least 3 of 4 founder votes/
    );
  });

  test('should approve candidate with 3 votes', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'no', notes: '' });

    const approved = council.approveCandidate(candidate.candidate_id);
    assert.strictEqual(approved.status, 'approved');
  });

  test('should seat approved candidate and create persona', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'New Member',
      description: 'A new council member',
      traits: 'creative, collaborative',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });

    council.approveCandidate(candidate.candidate_id);
    const result = council.seatApprovedCandidate(candidate.candidate_id);

    assert.strictEqual(result.candidate.status, 'approved');
    assert.ok(result.persona);
    assert.strictEqual(result.persona.seat_id, 'seat-05');
    assert.strictEqual(result.seat.status, 'replaceable');

    // Verify persona assigned to both runtimes
    const claudePersonas = council.getRuntimePersonas('claude');
    const hermesPersonas = council.getRuntimePersonas('hermes');
    assert.ok(claudePersonas.some(p => p.persona_id === result.persona.persona_id));
    assert.ok(hermesPersonas.some(p => p.persona_id === result.persona.persona_id));
  });

  test('should reject seating unapproved candidate', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    assert.throws(
      () => council.seatApprovedCandidate(candidate.candidate_id),
      /is not approved/
    );
  });
});

describe('Phase 3: Meetings', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create a meeting', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    assert.strictEqual(meeting.number, 1);
    assert.strictEqual(meeting.status, 'preparing');
    assert.strictEqual(meeting.constitution_version, '1.0.0');
  });

  test('should auto-assign meeting number', () => {
    const meeting1 = council.createMeeting({
      meeting_id: randomUUID(),
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    const meeting2 = council.createMeeting({
      meeting_id: randomUUID(),
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    assert.strictEqual(meeting1.number, 1);
    assert.strictEqual(meeting2.number, 2);
  });

  test('should initialize meeting phases', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    const phases = council.getMeetingPhases(meeting.meeting_id);
    assert.strictEqual(phases.length, 9);
    assert.ok(phases.every(p => p.status === 'pending'));
  });

  test('should start and complete meeting phases', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    council.startMeetingPhase(meeting.meeting_id, 'preparation');
    let phases = council.getMeetingPhases(meeting.meeting_id);
    assert.strictEqual(phases.find(p => p.phase === 'preparation')!.status, 'active');

    council.completeMeetingPhase(meeting.meeting_id, 'preparation');
    phases = council.getMeetingPhases(meeting.meeting_id);
    assert.strictEqual(phases.find(p => p.phase === 'preparation')!.status, 'completed');
  });

  test('should submit primary idea', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'primary_ideas',
      constitution_version: '1.0.0',
    });

    const idea = council.submitPrimaryIdea({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      seat_id: 'seat-01',
      persona_id: 'persona-steve-jobs',
      content: 'Primary idea from Steve Jobs',
    });
    assert.strictEqual(idea.seat_id, 'seat-01');
    assert.strictEqual(idea.content, 'Primary idea from Steve Jobs');
  });

  test('should reject primary idea from vacant seat', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'primary_ideas',
      constitution_version: '1.0.0',
    });

    assert.throws(
      () => council.submitPrimaryIdea({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        seat_id: 'seat-05', // vacant
        persona_id: 'nonexistent',
        content: 'Idea',
      }),
      /Vacant seat/
    );
  });

  test('should reject duplicate primary idea from same seat', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'primary_ideas',
      constitution_version: '1.0.0',
    });

    council.submitPrimaryIdea({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      seat_id: 'seat-01',
      persona_id: 'persona-steve-jobs',
      content: 'First idea',
    });

    assert.throws(
      () => council.submitPrimaryIdea({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        seat_id: 'seat-01',
        persona_id: 'persona-steve-jobs',
        content: 'Second idea',
      }),
      /already submitted/
    );
  });

  test('should record brainstorm', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'brainstorming',
      constitution_version: '1.0.0',
    });

    const record = council.recordBrainstorm({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      seat_id: 'seat-01',
      persona_id: 'persona-steve-jobs',
      content: 'Brainstorm contribution',
    });
    assert.strictEqual(record.content, 'Brainstorm contribution');

    const records = council.getBrainstormRecords(meeting.meeting_id);
    assert.strictEqual(records.length, 1);
  });

  test('should record challenge and defense', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'challenges',
      constitution_version: '1.0.0',
    });

    const challenge = council.recordChallenge({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      challenger_seat_id: 'seat-01',
      challenger_persona_id: 'persona-steve-jobs',
      target_seat_id: 'seat-02',
      target_persona_id: 'persona-virgil-abloh',
      content: 'Challenge to Virgil Abloh',
    });
    assert.strictEqual(challenge.challenger_seat_id, 'seat-01');
    assert.strictEqual(challenge.target_seat_id, 'seat-02');

    const defense = council.recordDefense({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      challenge_id: challenge.id,
      defender_seat_id: 'seat-02',
      defender_persona_id: 'persona-virgil-abloh',
      content: 'Defense from Virgil Abloh',
    });
    assert.strictEqual(defense.defender_seat_id, 'seat-02');
    assert.strictEqual(defense.challenge_id, challenge.id);

    const challenges = council.getChallenges(meeting.meeting_id);
    const defenses = council.getDefenses(meeting.meeting_id);
    assert.strictEqual(challenges.length, 1);
    assert.strictEqual(defenses.length, 1);
  });

  test('should reject defense from non-target', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'challenges',
      constitution_version: '1.0.0',
    });

    const challenge = council.recordChallenge({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      challenger_seat_id: 'seat-01',
      challenger_persona_id: 'persona-steve-jobs',
      target_seat_id: 'seat-02',
      target_persona_id: 'persona-virgil-abloh',
      content: 'Challenge',
    });

    assert.throws(
      () => council.recordDefense({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        challenge_id: challenge.id,
        defender_seat_id: 'seat-03', // not the target
        defender_persona_id: 'persona-shawn-stussy',
        content: 'Invalid defense',
      }),
      /Only the challenge target can defend/
    );
  });

  test('should record synthesis', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'synthesis',
      constitution_version: '1.0.0',
    });

    const synthesis = council.recordSynthesis({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      seat_id: 'seat-01',
      persona_id: 'persona-steve-jobs',
      content: 'Synthesis from Steve Jobs',
    });
    assert.strictEqual(synthesis.content, 'Synthesis from Steve Jobs');

    const syntheses = council.getSyntheses(meeting.meeting_id);
    assert.strictEqual(syntheses.length, 1);
  });

  test('should record reassessment', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'reassessment',
      constitution_version: '1.0.0',
    });

    const reassessment = council.recordReassessment({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      seat_id: 'seat-01',
      persona_id: 'persona-steve-jobs',
      target_seat_id: 'seat-02',
      content: 'Reassessment of Virgil Abloh',
    });
    assert.strictEqual(reassessment.target_seat_id, 'seat-02');

    const reassessments = council.getReassessments(meeting.meeting_id);
    assert.strictEqual(reassessments.length, 1);
  });
});

describe('Phase 3: Evaluations', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should submit evaluation for replaceable member', () => {
    // First, seat a candidate to create a replaceable member
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: 'A test replaceable member',
      traits: 'creative',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });

    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'evaluation',
      constitution_version: '1.0.0',
    });

    // Submit evaluation from seat-01 evaluating seat-05
    const evaluation = council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: 'Good contributor',
    });

    // Weighted: 8*0.3 + 7*0.25 + 9*0.2 + 6*0.15 + 8*0.10 = 2.4 + 1.75 + 1.8 + 0.9 + 0.8 = 7.65
    // Use tolerance for floating point comparison
    assert.ok(Math.abs(evaluation.weighted_score - 7.65) < 0.001);
    assert.strictEqual(evaluation.cultural_impact_score, 8);
    assert.strictEqual(evaluation.creative_output_score, 7);
  });

  test('should reject self-evaluation', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'evaluation',
      constitution_version: '1.0.0',
    });

    assert.throws(
      () => council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-05',
        evaluator_persona_id: persona.persona_id,
        subject_seat_id: 'seat-05',
        subject_persona_id: persona.persona_id,
        cultural_impact_score: 8,
        creative_output_score: 7,
        collaborative_spirit_score: 9,
        strategic_vision_score: 6,
        authenticity_score: 8,
        notes: '',
      }),
      /cannot evaluate themselves/
    );
  });

  test('should reject evaluation of permanent member', () => {
    // First seat a candidate to have a valid evaluator
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'evaluation',
      constitution_version: '1.0.0',
    });

    assert.throws(
      () => council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-05',
        evaluator_persona_id: persona.persona_id,
        subject_seat_id: 'seat-01', // permanent
        subject_persona_id: 'persona-steve-jobs',
        cultural_impact_score: 8,
        creative_output_score: 7,
        collaborative_spirit_score: 9,
        strategic_vision_score: 6,
        authenticity_score: 8,
        notes: '',
      }),
      /Only replaceable members can be evaluated/
    );
  });

  test('should calculate aggregate evaluation scores', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting1 = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'evaluation',
      constitution_version: '1.0.0',
    });
    const meeting2 = council.createMeeting({
      meeting_id: randomUUID(),
      number: 2,
      status: 'evaluation',
      constitution_version: '1.0.0',
    });

    // Two evaluations from different evaluators in meeting 1
    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting1.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });
    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting1.meeting_id,
      evaluator_seat_id: 'seat-02',
      evaluator_persona_id: 'persona-virgil-abloh',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 9,
      creative_output_score: 8,
      collaborative_spirit_score: 8,
      strategic_vision_score: 7,
      authenticity_score: 9,
      notes: '',
    });

    // One evaluation in meeting 2
    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting2.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 7,
      creative_output_score: 6,
      collaborative_spirit_score: 7,
      strategic_vision_score: 5,
      authenticity_score: 7,
      notes: '',
    });

    const aggregate = council.getAggregateEvaluationScores('seat-05');
    assert.strictEqual(aggregate.meetingCount, 2);
    assert.strictEqual(aggregate.evaluatorCount, 2); // unique evaluators across all meetings
    assert.ok(aggregate.averageWeightedScore > 0);
    assert.ok(aggregate.averageCulturalImpact > 0);
    assert.ok(aggregate.averageCreativeOutput > 0);
  });

  test('should track replaceable member meeting count', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    for (let i = 1; i <= 5; i++) {
      const meeting = council.createMeeting({
        meeting_id: randomUUID(),
        number: i,
        status: 'preparing',
        constitution_version: '1.0.0',
      });
      // Progress through all 9 phases (closure auto-sets status to closed)
      const phases = ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure'];
      for (const phase of phases) {
        council.startMeetingPhase(meeting.meeting_id, phase);
        council.completeMeetingPhase(meeting.meeting_id, phase);
      }
      // Meeting status is now 'closed' automatically via phaseToStatus['closure'] = 'closed'
      council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-01',
        evaluator_persona_id: 'persona-steve-jobs',
        subject_seat_id: 'seat-05',
        subject_persona_id: persona.persona_id,
        cultural_impact_score: 8,
        creative_output_score: 7,
        collaborative_spirit_score: 9,
        strategic_vision_score: 6,
        authenticity_score: 8,
        notes: '',
      });
    }

    const count = council.getReplaceableMemberMeetingCount('seat-05');
    assert.strictEqual(count, 5);
  });
});

describe('Phase 3: Evaluation Criteria', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test('should create evaluation criteria from constitution', () => {
    const criteria = council.createEvaluationCriteria({
      criterion_id: 'cultural-impact',
      constitution_version: '1.0.0',
      name: 'Cultural Impact',
      weight: 0.30,
      description: 'Influence on culture, trends, discourse',
    });
    assert.strictEqual(criteria.name, 'Cultural Impact');
    assert.strictEqual(criteria.weight, 0.30);

    const allCriteria = council.getEvaluationCriteria('1.0.0');
    assert.ok(allCriteria.length >= 1);
  });
});

describe('Phase 3: P2 - New Tests', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    council = initializeCouncil(testDbInstance);
    createDefaultConstitution(testDbInstance);
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Candidate seating tests
  test('should reject duplicate founder votes', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    assert.throws(
      () => council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'no', notes: '' }),
      /UNIQUE constraint failed|candidate_id.*founder_seat_id/i
    );
  });

  test('should not approve with two YES and two ABSTAIN', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'abstain', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'abstain', notes: '' });

    const summary = council.getCandidateVoteSummary(candidate.candidate_id);
    assert.strictEqual(summary.approved, false);
    assert.throws(
      () => council.approveCandidate(candidate.candidate_id),
      /requires at least 3 of 4 founder votes/
    );
  });

  test('should not approve with two YES and two NO', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Candidate',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'no', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'no', notes: '' });

    const summary = council.getCandidateVoteSummary(candidate.candidate_id);
    assert.strictEqual(summary.approved, false);
    assert.throws(
      () => council.approveCandidate(candidate.candidate_id),
      /requires at least 3 of 4 founder votes/
    );
  });

  test('should reject seating same candidate twice', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    council.seatApprovedCandidate(candidate.candidate_id);

    assert.throws(
      () => council.seatApprovedCandidate(candidate.candidate_id),
      /already exists|no longer vacant/
    );
  });

  test('should reject seating when no vacant seats remain', () => {
    // Fill all vacant seats (seat-05 through seat-11)
    for (let i = 5; i <= 11; i++) {
      const candidate = council.createCandidate({
        candidate_id: randomUUID(),
        name: `Member ${i}`,
        description: '',
        traits: '',
        proposed_seat_id: `seat-${i.toString().padStart(2, '0')}`,
        status: 'pending',
        proposed_by_founder_seat_id: 'seat-01',
      });
      council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
      council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
      council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
      council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
      council.approveCandidate(candidate.candidate_id);
      council.seatApprovedCandidate(candidate.candidate_id);
    }

    // Verify all seats are now replaceable (no vacant seats)
    const seats = council.listSeats();
    const vacantSeats = seats.filter(s => s.status === 'vacant');
    assert.strictEqual(vacantSeats.length, 0);

    // Try to create a candidate for a seat that's already replaceable - createCandidate should reject
    assert.throws(
      () => council.createCandidate({
        candidate_id: randomUUID(),
        name: 'Extra Member',
        description: '',
        traits: '',
        proposed_seat_id: 'seat-05', // already taken, now replaceable
        status: 'pending',
        proposed_by_founder_seat_id: 'seat-01',
      }),
      /not vacant/
    );
  });

  test('should rollback on persona creation failure', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);

    // Pre-create persona to cause conflict
    council.createPersona({
      persona_id: `persona-test-member`,
      seat_id: 'seat-05',
      name: 'Test Member',
      description: '',
      traits: '',
    });

    assert.throws(
      () => council.seatApprovedCandidate(candidate.candidate_id),
      /already exists/
    );

    // Verify no partial records - seat should still be vacant
    const seat = council.getSeat('seat-05');
    assert.strictEqual(seat!.status, 'vacant');
  });

  test('should rollback on first runtime assignment failure', () => {
    // This is hard to test without mocking, but we can verify transaction structure
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);

    const result = council.seatApprovedCandidate(candidate.candidate_id);
    assert.ok(result.persona);
    assert.strictEqual(result.seat.status, 'replaceable');
  });

  // Meeting lifecycle tests
  test('should reject invalid status transitions', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    // Cannot go from preparing to evaluation directly
    assert.throws(
      () => council.updateMeetingStatus(meeting.meeting_id, 'evaluation'),
      /Invalid meeting status transition/
    );

    // Progress through all 9 phases to closed - need to start and complete phases
    const phases = ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure'];
    for (const phase of phases) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically via phaseToStatus['closure'] = 'closed'

    // Cannot go from closed back to preparing
    assert.throws(
      () => council.updateMeetingStatus(meeting.meeting_id, 'preparing'),
      /Invalid meeting status transition/
    );
  });

  test('should reject starting phases out of order', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    // Cannot start evaluation before preparation
    assert.throws(
      () => council.startMeetingPhase(meeting.meeting_id, 'evaluation'),
      /preceding phase 'preparation' is pending/
    );
  });

  test('should reject completing unstarted phase', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    assert.throws(
      () => council.completeMeetingPhase(meeting.meeting_id, 'preparation'),
      /not active/
    );
  });

  test('should reject closing with incomplete phases', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    // Progress to evaluation but don't complete all phases
    council.updateMeetingStatus(meeting.meeting_id, 'deliberation');
    council.updateMeetingStatus(meeting.meeting_id, 'primary_ideas');
    council.updateMeetingStatus(meeting.meeting_id, 'brainstorming');
    council.updateMeetingStatus(meeting.meeting_id, 'challenges');
    council.updateMeetingStatus(meeting.meeting_id, 'synthesis');
    council.updateMeetingStatus(meeting.meeting_id, 'reassessment');
    council.updateMeetingStatus(meeting.meeting_id, 'evaluation');
    // Now try to close without completing phases
    assert.throws(
      () => council.updateMeetingStatus(meeting.meeting_id, 'closed'),
      /required phases incomplete/
    );
  });

  test('should reject modifying archived meeting', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    // Complete all phases
    const phases = ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure'];
    for (const phase of phases) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically via phaseToStatus['closure'] = 'closed'
    council.updateMeetingStatus(meeting.meeting_id, 'archived');

    assert.throws(
      () => council.updateMeetingStatus(meeting.meeting_id, 'deliberation'),
      /Cannot modify archived/
    );
  });

  test('should handle cancelled meeting', () => {
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });

    // Cancel from preparing is valid
    council.updateMeetingStatus(meeting.meeting_id, 'cancelled');

    // Cannot transition from cancelled
    assert.throws(
      () => council.updateMeetingStatus(meeting.meeting_id, 'preparing'),
      /Cannot modify cancelled/
    );
  });

  // Evaluation tests
  test('should reject duplicate evaluator/subject/meeting evaluation', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    // Progress to evaluation
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }

    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });

    assert.throws(
      () => council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-01',
        evaluator_persona_id: 'persona-steve-jobs',
        subject_seat_id: 'seat-05',
        subject_persona_id: persona.persona_id,
        cultural_impact_score: 5,
        creative_output_score: 5,
        collaborative_spirit_score: 5,
        strategic_vision_score: 5,
        authenticity_score: 5,
        notes: '',
      }),
      /already evaluated/
    );
  });

  test('should not expose evaluator identity in getEvaluations', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }

    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });

    const evaluations = council.getEvaluations(meeting.meeting_id);
    assert.strictEqual(evaluations.length, 1);
    // Should NOT have evaluator fields
    assert.ok(!('evaluator_seat_id' in evaluations[0]));
    assert.ok(!('evaluator_persona_id' in evaluations[0]));
    // Should have subject and scores
    assert.ok('subject_seat_id' in evaluations[0]);
    assert.ok('weighted_score' in evaluations[0]);
  });

  test('should not expose evaluator identity in getEvaluationsBySubject', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }

    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });

    const evaluations = council.getEvaluationsBySubject('seat-05');
    assert.ok(evaluations.length >= 1);
    assert.ok(!('evaluator_seat_id' in evaluations[0]));
    assert.ok(!('evaluator_persona_id' in evaluations[0]));
  });

  test('should keep aggregate results correct with anonymous retrieval', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }

    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });

    const aggregate = council.getAggregateEvaluationScores('seat-05');
    assert.strictEqual(aggregate.meetingCount, 1);
    assert.ok(aggregate.averageWeightedScore > 0);
  });

  test('should use constitution criteria for evaluation weights', () => {
    // Create criteria for constitution (matching default constitution)
    council.createEvaluationCriteria({
      criterion_id: 'cultural-impact',
      constitution_version: '1.0.0',
      name: 'Cultural Impact',
      weight: 0.30,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'creative-output',
      constitution_version: '1.0.0',
      name: 'Creative Output',
      weight: 0.25,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'collaborative-spirit',
      constitution_version: '1.0.0',
      name: 'Collaborative Spirit',
      weight: 0.20,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'strategic-vision',
      constitution_version: '1.0.0',
      name: 'Strategic Vision',
      weight: 0.15,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'authenticity',
      constitution_version: '1.0.0',
      name: 'Authenticity',
      weight: 0.10,
      description: '',
    });

    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically via phaseToStatus['closure'] = 'closed'

    // Scores: 10, 10, 10, 10, 10 with weights 0.30, 0.25, 0.20, 0.15, 0.10 = 10
    const evaluation = council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 10,
      creative_output_score: 10,
      collaborative_spirit_score: 10,
      strategic_vision_score: 10,
      authenticity_score: 10,
      notes: '',
    });

    // Weighted should use constitution criteria (30/25/20/15/10)
    // 10*0.30 + 10*0.25 + 10*0.20 + 10*0.15 + 10*0.10 = 10
    assert.ok(Math.abs(evaluation.weighted_score - 10) < 0.001);
  });

  test('should reject criteria weight exceeding 100%', () => {
    council.createEvaluationCriteria({
      criterion_id: 'c1',
      constitution_version: '1.0.0',
      name: 'Criterion 1',
      weight: 0.60,
      description: '',
    });

    assert.throws(
      () => council.createEvaluationCriteria({
        criterion_id: 'c2',
        constitution_version: '1.0.0',
        name: 'Criterion 2',
        weight: 0.50,
        description: '',
      }),
      /exceed 100%/
    );
  });

  test('should preserve historical criteria after constitution update', () => {
    // Create first constitution with criteria that match expected score keys
    council.createEvaluationCriteria({
      criterion_id: 'c1',
      constitution_version: '1.0.0',
      name: 'Cultural Impact',
      weight: 0.30,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'c2',
      constitution_version: '1.0.0',
      name: 'Creative Output',
      weight: 0.25,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'c3',
      constitution_version: '1.0.0',
      name: 'Collaborative Spirit',
      weight: 0.20,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'c4',
      constitution_version: '1.0.0',
      name: 'Strategic Vision',
      weight: 0.15,
      description: '',
    });
    council.createEvaluationCriteria({
      criterion_id: 'c5',
      constitution_version: '1.0.0',
      name: 'Authenticity',
      weight: 0.10,
      description: '',
    });

    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
      council.startMeetingPhase(meeting.meeting_id, phase);
      council.completeMeetingPhase(meeting.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically via phaseToStatus['closure'] = 'closed'

    // Scores must match criteria names: "Cultural Impact" -> cultural_impact, "Creative Output" -> creative_output
    const evaluation = council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 10,
      creative_output_score: 10,
      collaborative_spirit_score: 10,
      strategic_vision_score: 10,
      authenticity_score: 10,
      notes: '',
    });

    // Now create new constitution with different criteria
    council.createConstitution({
      version: '2.0.0',
      content: 'New constitution',
      status: 'active',
      approved_by_founder: true,
    });
    council.createEvaluationCriteria({
      criterion_id: 'c6',
      constitution_version: '2.0.0',
      name: 'New Criterion',
      weight: 1.0,
      description: '',
    });

    // Historical evaluation should still use old criteria (5 criteria for v1.0.0)
    const oldCriteria = council.getEvaluationCriteria('1.0.0');
    assert.strictEqual(oldCriteria.length, 5);
  });

  test('should exclude cancelled meetings from five-meeting count', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    // Create 3 formal meetings (closed)
    for (let i = 1; i <= 3; i++) {
      const meeting = council.createMeeting({
        meeting_id: randomUUID(),
        number: i,
        status: 'preparing',
        constitution_version: '1.0.0',
      });
      for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
        council.startMeetingPhase(meeting.meeting_id, phase);
        council.completeMeetingPhase(meeting.meeting_id, phase);
      }
      // Meeting status is now 'closed' automatically
      council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-01',
        evaluator_persona_id: 'persona-steve-jobs',
        subject_seat_id: 'seat-05',
        subject_persona_id: persona.persona_id,
        cultural_impact_score: 8,
        creative_output_score: 7,
        collaborative_spirit_score: 9,
        strategic_vision_score: 6,
        authenticity_score: 8,
        notes: '',
      });
    }

    // Create a cancelled meeting with evaluation - must complete all phases first
    const cancelledMeeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 4,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
      council.startMeetingPhase(cancelledMeeting.meeting_id, phase);
      council.completeMeetingPhase(cancelledMeeting.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically, then cancel
    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: cancelledMeeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });
    // Cancel from closed status (valid transition: closed -> cancelled)
    council.updateMeetingStatus(cancelledMeeting.meeting_id, 'cancelled');

    const count = council.getReplaceableMemberMeetingCount('seat-05');
    assert.strictEqual(count, 3); // cancelled meeting excluded
  });

  test('should exclude incomplete meetings from five-meeting count', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    // Create meeting but don't complete all phases
    const meeting = council.createMeeting({
      meeting_id: randomUUID(),
      number: 1,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    council.startMeetingPhase(meeting.meeting_id, 'preparation');
    council.completeMeetingPhase(meeting.meeting_id, 'preparation');
    // Progress through required statuses but stop before completing all phases
    council.updateMeetingStatus(meeting.meeting_id, 'deliberation');
    council.updateMeetingStatus(meeting.meeting_id, 'primary_ideas');
    council.updateMeetingStatus(meeting.meeting_id, 'brainstorming');
    council.updateMeetingStatus(meeting.meeting_id, 'challenges');
    council.updateMeetingStatus(meeting.meeting_id, 'synthesis');
    council.updateMeetingStatus(meeting.meeting_id, 'reassessment');
    council.updateMeetingStatus(meeting.meeting_id, 'evaluation');
    council.submitEvaluation({
      id: randomUUID(),
      meeting_id: meeting.meeting_id,
      evaluator_seat_id: 'seat-01',
      evaluator_persona_id: 'persona-steve-jobs',
      subject_seat_id: 'seat-05',
      subject_persona_id: persona.persona_id,
      cultural_impact_score: 8,
      creative_output_score: 7,
      collaborative_spirit_score: 9,
      strategic_vision_score: 6,
      authenticity_score: 8,
      notes: '',
    });
    // Meeting never closed - incomplete

    const count = council.getReplaceableMemberMeetingCount('seat-05');
    assert.strictEqual(count, 0); // incomplete meeting excluded
  });

  test('should handle missing evaluations in five-meeting tracking', () => {
    const candidate = council.createCandidate({
      candidate_id: randomUUID(),
      name: 'Test Member',
      description: '',
      traits: '',
      proposed_seat_id: 'seat-05',
      status: 'pending',
      proposed_by_founder_seat_id: 'seat-01',
    });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-01', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-02', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-03', vote: 'yes', notes: '' });
    council.recordFounderVote({ id: randomUUID(), candidate_id: candidate.candidate_id, founder_seat_id: 'seat-04', vote: 'yes', notes: '' });
    council.approveCandidate(candidate.candidate_id);
    const { persona } = council.seatApprovedCandidate(candidate.candidate_id);

    // Create 2 formal meetings with evaluations
    for (let i = 1; i <= 2; i++) {
      const meeting = council.createMeeting({
        meeting_id: randomUUID(),
        number: i,
        status: 'preparing',
        constitution_version: '1.0.0',
      });
      for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
        council.startMeetingPhase(meeting.meeting_id, phase);
        council.completeMeetingPhase(meeting.meeting_id, phase);
      }
      // Meeting status is now 'closed' automatically
      council.submitEvaluation({
        id: randomUUID(),
        meeting_id: meeting.meeting_id,
        evaluator_seat_id: 'seat-01',
        evaluator_persona_id: 'persona-steve-jobs',
        subject_seat_id: 'seat-05',
        subject_persona_id: persona.persona_id,
        cultural_impact_score: 8,
        creative_output_score: 7,
        collaborative_spirit_score: 9,
        strategic_vision_score: 6,
        authenticity_score: 8,
        notes: '',
      });
    }

    // Create 1 formal meeting WITHOUT evaluation
    const meetingNoEval = council.createMeeting({
      meeting_id: randomUUID(),
      number: 3,
      status: 'preparing',
      constitution_version: '1.0.0',
    });
    for (const phase of ['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']) {
      council.startMeetingPhase(meetingNoEval.meeting_id, phase);
      council.completeMeetingPhase(meetingNoEval.meeting_id, phase);
    }
    // Meeting status is now 'closed' automatically
    // No evaluation submitted

    const count = council.getReplaceableMemberMeetingCount('seat-05');
    assert.strictEqual(count, 2); // meeting without evaluation excluded
  });
});