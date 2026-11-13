import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import { createAgentService, AgentService } from '../src/agents.js';
import { createMessageService, MessageService } from '../src/messages.js';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'council-test.db');

let testDbInstance: DatabaseInstance;
let agentService: AgentService;
let messageService: MessageService;

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

describe('Database', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
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

  test('should create tables and indexes', () => {
    const tables = testDbInstance.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);
    assert.ok(tableNames.includes('agents'));
    assert.ok(tableNames.includes('messages'));

    const indexes = testDbInstance.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    const indexNames = indexes.map((i: any) => i.name);
    assert.ok(indexNames.includes('idx_messages_recipient'));
    assert.ok(indexNames.includes('idx_messages_sender'));
    assert.ok(indexNames.includes('idx_messages_reply_to'));
    assert.ok(indexNames.includes('idx_messages_created_at'));
  });
});

describe('Agents', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    agentService = createAgentService(testDbInstance);
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

  test('should register a new agent', () => {
    const agent = agentService.registerAgent({
      agent_id: 'agent-1',
      display_name: 'Test Agent',
      runtime: 'node',
    });
    assert.strictEqual(agent.agent_id, 'agent-1');
    assert.strictEqual(agent.display_name, 'Test Agent');
    assert.strictEqual(agent.runtime, 'node');
    assert.ok(agent.id);
    assert.ok(agent.created_at);
  });

  test('should reject duplicate agent_id', () => {
    agentService.registerAgent({ agent_id: 'agent-1', display_name: 'Test', runtime: 'node' });
    assert.throws(
      () => agentService.registerAgent({ agent_id: 'agent-1', display_name: 'Test2', runtime: 'python' }),
      /Agent with ID 'agent-1' already exists/
    );
  });

  test('should list agents', () => {
    agentService.registerAgent({ agent_id: 'a1', display_name: 'Agent 1', runtime: 'node' });
    agentService.registerAgent({ agent_id: 'a2', display_name: 'Agent 2', runtime: 'python' });
    const agents = agentService.listAgents();
    assert.strictEqual(agents.length, 2);
  });

  test('should get agent by ID', () => {
    agentService.registerAgent({ agent_id: 'a1', display_name: 'Agent 1', runtime: 'node' });
    const agent = agentService.getAgent('a1');
    assert.ok(agent);
    assert.strictEqual(agent!.agent_id, 'a1');
  });

  test('should return undefined for non-existent agent', () => {
    const agent = agentService.getAgent('nonexistent');
    assert.strictEqual(agent, undefined);
  });

  test('should check agent existence', () => {
    agentService.registerAgent({ agent_id: 'a1', display_name: 'Agent 1', runtime: 'node' });
    assert.strictEqual(agentService.agentExists('a1'), true);
    assert.strictEqual(agentService.agentExists('nonexistent'), false);
  });
});

describe('Messages', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    agentService = createAgentService(testDbInstance);
    messageService = createMessageService(testDbInstance, agentService);
    agentService.registerAgent({ agent_id: 'sender', display_name: 'Sender', runtime: 'node' });
    agentService.registerAgent({ agent_id: 'recipient', display_name: 'Recipient', runtime: 'node' });
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

  test('should send a message', () => {
    const msg = messageService.sendMessage({
      sender_id: 'sender',
      recipient_id: 'recipient',
      content: 'Hello!',
    });
    assert.ok(msg.id);
    assert.strictEqual(msg.sender_id, 'sender');
    assert.strictEqual(msg.recipient_id, 'recipient');
    assert.strictEqual(msg.content, 'Hello!');
    assert.strictEqual(msg.reply_to, null);
  });

  test('should reject message from non-existent sender', () => {
    assert.throws(
      () => messageService.sendMessage({ sender_id: 'nonexistent', recipient_id: 'recipient', content: 'Hi' }),
      /Sender agent 'nonexistent' not found/
    );
  });

  test('should reject message to non-existent recipient', () => {
    assert.throws(
      () => messageService.sendMessage({ sender_id: 'sender', recipient_id: 'nonexistent', content: 'Hi' }),
      /Recipient agent 'nonexistent' not found/
    );
  });

  test('should check inbox', () => {
    messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: 'Msg 1' });
    messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: 'Msg 2' });
    const inbox = messageService.checkInbox('recipient');
    assert.strictEqual(inbox.length, 2);
    const contents = inbox.map(m => m.content).sort();
    assert.deepStrictEqual(contents, ['Msg 1', 'Msg 2']);
  });

  test('should reject inbox check for non-existent agent', () => {
    assert.throws(
      () => messageService.checkInbox('nonexistent'),
      /Agent 'nonexistent' not found/
    );
  });

  test('should reply to a message', () => {
    const original = messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: 'Original' });
    const reply = messageService.replyMessage({ agent_id: 'recipient', message_id: original.id, content: 'Reply!' });
    assert.strictEqual(reply.sender_id, 'recipient');
    assert.strictEqual(reply.recipient_id, 'sender');
    assert.strictEqual(reply.content, 'Reply!');
    assert.strictEqual(reply.reply_to, original.id);
  });

  test('should reject reply from non-recipient', () => {
    const original = messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: 'Original' });
    agentService.registerAgent({ agent_id: 'third', display_name: 'Third', runtime: 'node' });
    assert.throws(
      () => messageService.replyMessage({ agent_id: 'third', message_id: original.id, content: 'Reply' }),
      /Only the intended recipient may reply to this message/
    );
  });

  test('should reject reply to non-existent message', () => {
    const fakeId = randomUUID();
    assert.throws(
      () => messageService.replyMessage({ agent_id: 'recipient', message_id: fakeId, content: 'Reply' }),
      new RegExp(`Message '${fakeId}' not found`)
    );
  });

  test('should list messages for an agent', () => {
    messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: 'Msg 1' });
    messageService.sendMessage({ sender_id: 'recipient', recipient_id: 'sender', content: 'Msg 2' });
    const messages = messageService.listMessages({ agent_id: 'sender', limit: 10 });
    assert.strictEqual(messages.length, 2);
  });

  test('should respect limit in list_messages', () => {
    for (let i = 0; i < 5; i++) {
      messageService.sendMessage({ sender_id: 'sender', recipient_id: 'recipient', content: `Msg ${i}` });
    }
    const messages = messageService.listMessages({ agent_id: 'sender', limit: 3 });
    assert.strictEqual(messages.length, 3);
  });
});

describe('Reply chain', () => {
  beforeEach(() => {
    testDbInstance = setupTestDb();
    agentService = createAgentService(testDbInstance);
    messageService = createMessageService(testDbInstance, agentService);
    agentService.registerAgent({ agent_id: 'a1', display_name: 'Agent 1', runtime: 'node' });
    agentService.registerAgent({ agent_id: 'a2', display_name: 'Agent 2', runtime: 'node' });
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

  test('should maintain reply chain', () => {
    const msg1 = messageService.sendMessage({ sender_id: 'a1', recipient_id: 'a2', content: 'First' });
    const msg2 = messageService.replyMessage({ agent_id: 'a2', message_id: msg1.id, content: 'Reply to first' });
    const msg3 = messageService.replyMessage({ agent_id: 'a1', message_id: msg2.id, content: 'Reply to reply' });

    assert.strictEqual(msg2.reply_to, msg1.id);
    assert.strictEqual(msg3.reply_to, msg2.id);

    const allMsgs = messageService.listMessages({ agent_id: 'a1', limit: 10 });
    assert.strictEqual(allMsgs.length, 3);
  });
});