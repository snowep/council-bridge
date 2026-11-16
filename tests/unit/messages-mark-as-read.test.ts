import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import { createAgentService, AgentService } from '../src/communication/agents.js';
import { createMessageService, MessageService } from '../src/communication/messages.js';

let testDbInstance: DatabaseInstance;
let agentService: AgentService;
let messageService: MessageService;
let testDbPath: string;

function setupTestDb() {
  const dbPath = path.join(process.cwd(), 'data', `council-test-${randomUUID()}.db`);
  const instance = createDatabase(dbPath);
  return { instance, testDbPath: dbPath };
}

describe('Message Mark-as-Read Regression Tests', () => {
  beforeEach(() => {
    const result = setupTestDb();
    testDbInstance = result.instance;
    testDbPath = result.testDbPath;
    agentService = createAgentService(testDbInstance);
    messageService = createMessageService(testDbInstance, agentService);

    // Register test agents
    agentService.registerAgent({ agent_id: 'agent-a', display_name: 'Agent A', runtime: 'node' });
    agentService.registerAgent({ agent_id: 'agent-b', display_name: 'Agent B', runtime: 'node' });
    agentService.registerAgent({ agent_id: 'agent-c', display_name: 'Agent C', runtime: 'node' });
  });

  afterEach(() => {
    testDbInstance.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
        const shmPath = testDbPath + '-shm';
        const walPath = testDbPath + '-wal';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        // Ignore if locked by another process
      }
    }
  });

  test('markAsRead marks messages from conversation partner as read', () => {
    // Send messages from agent-a to agent-b
    const msg1 = messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Hello from A to B',
    });
    const msg2 = messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Second message from A to B',
    });

    // Verify both messages are unread
    let unread = messageService.listMessages({ agent_id: 'agent-b', unread_only: true });
    assert.strictEqual(unread.length, 2, 'Should have 2 unread messages');

    // Mark agent-a's conversation as read
    const changes = messageService.markAsRead('agent-b', 'agent-a');
    assert.strictEqual(changes, 2, 'Should mark 2 messages as read');

    // Verify no unread messages
    unread = messageService.listMessages({ agent_id: 'agent-b', unread_only: true });
    assert.strictEqual(unread.length, 0, 'Should have 0 unread messages');
  });

  test('markAsRead only marks messages from specified conversation', () => {
    // Send messages from agent-a to agent-b
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message from A to B',
    });

    // Send messages from agent-c to agent-b
    messageService.sendMessage({
      sender_id: 'agent-c',
      recipient_id: 'agent-b',
      content: 'Message from C to B',
    });

    // Mark only agent-a's conversation as read
    const changes = messageService.markAsRead('agent-b', 'agent-a');
    assert.strictEqual(changes, 1, 'Should mark 1 message as read');

    // Verify agent-b still has unread message from agent-c
    const unread = messageService.listMessages({ agent_id: 'agent-b', unread_only: true });
    assert.strictEqual(unread.length, 1, 'Should still have 1 unread message');
    assert.strictEqual(unread[0].sender_id, 'agent-c', 'Unread message should be from agent-c');
  });

  test('checkInbox with conversationId filters by participant pair', () => {
    // Send messages between agent-a and agent-b
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'A to B message 1',
    });
    messageService.sendMessage({
      sender_id: 'agent-b',
      recipient_id: 'agent-a',
      content: 'B to A message 1',
    });

    // Send messages between agent-a and agent-c
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-c',
      content: 'A to C message 1',
    });

    // Check agent-a's inbox for conversation with agent-b
    const inboxAb = messageService.checkInbox('agent-a', 'agent-b');
    assert.strictEqual(inboxAb.length, 2, 'Should have 2 messages in A-B conversation');

    // Check agent-a's inbox for conversation with agent-c
    const inboxAc = messageService.checkInbox('agent-a', 'agent-c');
    assert.strictEqual(inboxAc.length, 1, 'Should have 1 message in A-C conversation');
  });

  test('getConversationMessages retrieves messages by participant pair', () => {
    // Send messages between agent-a and agent-b
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'A to B message',
    });

    const messages = messageService.getConversationMessages('agent-a', 'agent-b');
    assert.strictEqual(messages.length, 1, 'Should retrieve 1 message');
    assert.strictEqual(messages[0].sender_id, 'agent-a');
    assert.strictEqual(messages[0].recipient_id, 'agent-b');
  });

  test('listMessages with conversation_id filters correctly', () => {
    // Send messages between agent-a and agent-b
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message 1',
    });
    messageService.sendMessage({
      sender_id: 'agent-b',
      recipient_id: 'agent-a',
      content: 'Message 2',
    });

    // Send message from agent-a to agent-c
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-c',
      content: 'Message from A to C',
    });

    const messages = messageService.listMessages({
      agent_id: 'agent-a',
      conversation_id: 'agent-b',
      limit: 10,
    });

    assert.strictEqual(messages.length, 2, 'Should have 2 messages in A-B conversation');
  });

  test('getUnreadCount returns correct count', () => {
    // Send 2 messages to agent-b from agent-a
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message 1',
    });
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message 2',
    });

    const count = messageService.getUnreadCount('agent-b');
    assert.strictEqual(count, 2, 'Should have 2 unread messages');

    // Mark as read
    messageService.markAsRead('agent-b', 'agent-a');

    const countAfter = messageService.getUnreadCount('agent-b');
    assert.strictEqual(countAfter, 0, 'Should have 0 unread messages after mark');
  });

  test('markMessagesAsRead marks specific messages by ID', () => {
    const msg1 = messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message 1 to mark',
    });
    messageService.sendMessage({
      sender_id: 'agent-a',
      recipient_id: 'agent-b',
      content: 'Message 2',
    });

    let unread = messageService.listMessages({ agent_id: 'agent-b', unread_only: true });
    assert.strictEqual(unread.length, 2, 'Should have 2 unread messages');

    const changes = messageService.markMessagesAsRead('agent-b', [msg1.id]);
    assert.strictEqual(changes, 1, 'Should mark 1 message as read');

    unread = messageService.listMessages({ agent_id: 'agent-b', unread_only: true });
    assert.strictEqual(unread.length, 1, 'Should have 1 unread message');
  });
});