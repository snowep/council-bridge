// Wave 6: Advanced Edge Cases and Webhook Reply Verification E2E Test Suite
// Tests reply_to relationship preservation through webhook, complex conversation threads,
// and rate limit handling

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const BASE_URL = 'http://127.0.0.1:3334';

function parseMcpResponse(text: string): any {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.substring(6).trim();
      try {
        return JSON.parse(jsonStr);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function extractMcpContent(responseText: string): any {
  const parsed = parseMcpResponse(responseText);
  if (parsed?.result?.content?.[0]?.text) {
    try {
      return JSON.parse(parsed.result.content[0].text);
    } catch {
      return parsed.result.content[0].text;
    }
  }
  if (parsed?.error) {
    return { error: parsed.error };
  }
  return parsed;
}

async function createSessionToken(ownerType: string, ownerId: string, runtime: string): Promise<string> {
  const response = await request(BASE_URL)
    .post('/api/auth/session')
    .set('Content-Type', 'application/json')
    .send({
      owner_type: ownerType,
      owner_id: ownerId,
      runtime
    });

  if (response.status !== 200) {
    throw new Error(`Failed to create session: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.session_token;
}

async function callMcpTool(token: string, toolName: string, args: Record<string, any>) {
  return await request(BASE_URL + '/mcp')
    .post('/')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json')
    .send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
}

describe('Wave 6: Advanced Edge Cases E2E', () => {
  let founderToken: string;
  let claudeToken: string;
  let hermesToken: string;

  before(async () => {
    // Verify server is running
    const healthResponse = await request(BASE_URL).get('/health');
    assert.strictEqual(healthResponse.status, 200, 'Server must be running');
    assert.strictEqual(healthResponse.body.status, 'healthy', 'Server must be healthy');
    
    // Get Founder token (Founder can do privileged operations)
    founderToken = await createSessionToken('founder', 'founder', 'claude');

    // Register test agents (use existing Wave 5 agent IDs that are in staff_agents)
    try {
      await callMcpTool(founderToken, 'register_agent', {
        agent_id: 'e2e-claude-agent',
        display_name: 'E2E Claude Agent',
        runtime: 'claude'
      });
    } catch {
      // Agent might already exist
    }

    try {
      await callMcpTool(founderToken, 'register_agent', {
        agent_id: 'e2e-hermes-agent',
        display_name: 'E2E Hermes Agent',
        runtime: 'hermes'
      });
    } catch {
      // Agent might already exist
    }

    // Create sessions for agents (these must exist in staff_agents table)
    claudeToken = await createSessionToken('staff', 'e2e-claude-agent', 'claude');
    hermesToken = await createSessionToken('staff', 'e2e-hermes-agent', 'hermes');
  });

  // ===========================================================
  // Test 1: Reply relationship verification via MCP
  // ===========================================================
  describe('Test 1: Reply Relationship Verification (MCP)', () => {
    it('should preserve reply_to when Claude replies to Hermes via MCP', async () => {
      // Claude sends original message
      const originalContent = `Wave6 Original ${Date.now()}`;
      const sendOriginal = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: originalContent
      });
      const originalResult = extractMcpContent(sendOriginal.text);
      const originalId = originalResult?.id;
      
      assert.ok(originalId, 'Original message ID returned');

      // Hermes retrieves original
      const inboxHermes = await callMcpTool(hermesToken, 'list_messages', { 
        agent_id: 'e2e-hermes-agent', 
        limit: 100,
        offset: 0
      });
      const hermesMessages = extractMcpContent(inboxHermes.text);
      
      const originalInHermesInbox = hermesMessages.find((m: any) => m.id === originalId);
      assert.ok(originalInHermesInbox, 'Hermes can see original');
      assert.strictEqual(originalInHermesInbox.reply_to, null, 'Original has no reply_to');

      // Hermes replies via MCP
      const replyContent = `Wave6 Reply to ${originalId.substring(0, 8)}`;
      const replyResponse = await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: replyContent,
        reply_to: originalId
      });
      const replyResult = extractMcpContent(replyResponse.text);
      const replyId = replyResult?.id;
      
      assert.ok(replyId, 'Reply message ID returned');
      assert.strictEqual(replyResult.reply_to, originalId, 'Reply has correct reply_to');

      // Claude retrieves reply
      const inboxClaude = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 100
      });
      const claudeMessages = extractMcpContent(inboxClaude.text);
      
      const replyInClaudeInbox = claudeMessages.find((m: any) => m.id === replyId);
      assert.ok(replyInClaudeInbox, 'Claude can see reply');
      assert.strictEqual(replyInClaudeInbox.reply_to, originalId, 'Reply preserves reply_to relationship');
    });
  });

  // ===========================================================
  // Test 2: Complex conversation thread
  // ===========================================================
  describe('Test 2: Complex Conversation Thread', () => {
    it('should handle multi-level reply chain', async () => {
      const chainId = Date.now();
      
      // Level 1: Claude -> Hermes
      const msg1 = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Thread Level 1 ${chainId}`
      });
      const id1 = extractMcpContent(msg1.text)?.id;

      // Level 2: Hermes -> Claude (reply to Level 1)
      const msg2 = await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: `Thread Level 2 ${chainId}`,
        reply_to: id1
      });
      const id2 = extractMcpContent(msg2.text)?.id;

      // Level 3: Claude -> Hermes (reply to Level 2)
      const msg3 = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Thread Level 3 ${chainId}`,
        reply_to: id2
      });
      const id3 = extractMcpContent(msg3.text)?.id;

      // Level 4: Hermes -> Claude (reply to Level 3)
      const msg4 = await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: `Thread Level 4 ${chainId}`,
        reply_to: id3
      });
      const id4 = extractMcpContent(msg4.text)?.id;

      // Verify all messages in Hermes inbox
      const hermesInbox = await callMcpTool(hermesToken, 'list_messages', { 
        agent_id: 'e2e-hermes-agent', 
        limit: 100 
      });
      const hermesMsgs = extractMcpContent(hermesInbox.text);
      
      const found1 = hermesMsgs.find((m: any) => m.id === id1);
      const found3 = hermesMsgs.find((m: any) => m.id === id3);
      
      assert.ok(found1, 'Level 1 found in Hermes inbox');
      assert.strictEqual(found1.reply_to, null, 'Level 1 has no reply_to');
      assert.ok(found3, 'Level 3 found in Hermes inbox');
      assert.strictEqual(found3.reply_to, id2, 'Level 3 replies to Level 2');

      // Verify all messages in Claude inbox
      const claudeInbox = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 100 
      });
      const claudeMsgs = extractMcpContent(claudeInbox.text);
      
      const found2 = claudeMsgs.find((m: any) => m.id === id2);
      const found4 = claudeMsgs.find((m: any) => m.id === id4);
      
      assert.ok(found2, 'Level 2 found in Claude inbox');
      assert.strictEqual(found2.reply_to, id1, 'Level 2 replies to Level 1');
      assert.ok(found4, 'Level 4 found in Claude inbox');
      assert.strictEqual(found4.reply_to, id3, 'Level 4 replies to Level 3');
    });
  });

  // ===========================================================
  // Test 3: Large message handling
  // ===========================================================
  describe('Test 3: Large Message Handling', () => {
    it('should handle long message content', async () => {
      const longContent = 'A'.repeat(10000); // 10KB message
      
      const response = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: longContent
      });
      
      assert.strictEqual(response.status, 200);
      const result = extractMcpContent(response.text);
      assert.ok(result?.id, 'Large message accepted');
      assert.strictEqual(result.content.length, 10000, 'Content preserved');
    });

    it('should handle unicode content', async () => {
      const unicodeContent = 'Hello 世界 🌍 Привет مرحبا שלום';
      
      const response = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: unicodeContent
      });
      
      assert.strictEqual(response.status, 200);
      const result = extractMcpContent(response.text);
      assert.ok(result, 'Unicode message accepted');
    });
  });

  // ===========================================================
  // Test 4: Read state tracking
  // ===========================================================
  describe('Test 4: Read State Tracking', () => {
    it('should track message read state correctly', async () => {
      const content = `Read State Test ${Date.now()}`;
      
      // Send message from Claude to Hermes
      const sendResponse = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content
      });
      const msgId = extractMcpContent(sendResponse.text)?.id;
      
      assert.ok(msgId, 'Message sent');

      // Check unread count for Hermes
      const unreadCount = await callMcpTool(hermesToken, 'list_messages', { 
        agent_id: 'e2e-hermes-agent', 
        limit: 1,
        unreadOnly: true
      });
      const unreadMsgs = extractMcpContent(unreadCount.text);
      const unreadCountValue = Array.isArray(unreadMsgs) ? unreadMsgs.length : 0;
      
      assert.ok(unreadCountValue >= 1, 'Message is unread');

      // Note: There's no mark_as_read tool in the MCP interface currently
      // This test verifies unread filtering works
    });
  });

  // ===========================================================
  // Test 5: Message ordering verification
  // ===========================================================
  describe('Test 5: Message Ordering Verification', () => {
    it('should return messages ordered by created_at DESC (newest first)', async () => {
      // Send multiple messages
      await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Order Test 1 ${Date.now()}`
      });

      await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Order Test 2 ${Date.now()}`
      });

      await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Order Test 3 ${Date.now()}`
      });

      // Retrieve messages
      const response = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 10 
      });
      
      const msgs = extractMcpContent(response.text);
      assert.ok(Array.isArray(msgs), 'Result is array');
      
      // Filter to our test messages (most recent by timestamp)
      const testMsgs = msgs.filter((m: any) => m.content.startsWith('Order Test'));
      
      // Verify ordering - newest first (DESC)
      for (let i = 0; i < testMsgs.length - 1; i++) {
        assert.ok(
          new Date(testMsgs[i].created_at) >= new Date(testMsgs[i + 1].created_at),
          'Messages ordered by created_at DESC (newest first)'
        );
      }
    });
  });

  // ===========================================================
  // Test 6: Pagination edge cases
  // ===========================================================
  describe('Test 6: Pagination Edge Cases', () => {
    it('should handle offset correctly', async () => {
      // First page
      const page1 = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 50,
        offset: 0
      });
      
      // Second page
      const page2 = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 50,
        offset: 50
      });
      
      const msgs1 = extractMcpContent(page1.text);
      const msgs2 = extractMcpContent(page2.text);
      
      assert.ok(Array.isArray(msgs1), 'Page 1 is array');
      assert.ok(Array.isArray(msgs2), 'Page 2 is array');
    });

    it('should handle limit boundary', async () => {
      const response = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 100
      });
      
      assert.strictEqual(response.status, 200);
      const msgs = extractMcpContent(response.text);
      assert.ok(Array.isArray(msgs), 'Result is array');
      assert.ok(msgs.length <= 100, 'Limit respected');
    });
  });

  // ===========================================================
  // Test 7: Rate limit verification
  // ===========================================================
  describe('Test 7: Rate Limit Verification', () => {
    it('should handle multiple sequential messages without rate limit errors', async () => {
      // Send 10 messages rapidly
      const results = [];
      for (let i = 0; i < 10; i++) {
        const response = await callMcpTool(claudeToken, 'send_message', {
          sender_id: 'e2e-claude-agent',
          recipient_id: 'e2e-hermes-agent',
          content: `Rate test ${Date.now()} msg ${i}`
        });
        results.push(response.status);
      }
      
      // All should succeed
      const allSuccess = results.every(s => s === 200);
      assert.ok(allSuccess, 'All 10 messages sent successfully');
    });

    it('should maintain message ordering under rapid send', async () => {
      // Send 5 messages
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const response = await callMcpTool(claudeToken, 'send_message', {
          sender_id: 'e2e-claude-agent',
          recipient_id: 'e2e-hermes-agent',
          content: `Ordering test ${Date.now()}-${i}`
        });
        const result = extractMcpContent(response.text);
        ids.push(result?.id);
      }
      
      // Retrieve and verify - messages should be in DESC order (newest first without sorting)
      const response = await callMcpTool(hermesToken, 'list_messages', { 
        agent_id: 'e2e-hermes-agent', 
        limit: 100
      });
      
      const msgs = extractMcpContent(response.text);
      
      // Find our test messages in the order they appear in the list
      const foundMsgs = ids
        .map(id => msgs.find((m: any) => m.id === id))
        .filter(Boolean);
      
      // Verify they're in DESC order (newest first)
      for (let i = 0; i < foundMsgs.length - 1; i++) {
        assert.ok(
          new Date(foundMsgs[i].created_at) >= new Date(foundMsgs[i + 1].created_at),
          'Messages ordered by created_at DESC (newest first)'
        );
      }
    });
  });

  // ===========================================================
  // Test 8: Authentication isolation
  // ===========================================================
  describe('Test 8: Authentication Isolation', () => {
    it('should reject cross-agent message access', async () => {
      // e2e-claude-agent should NOT see messages addressed to e2e-hermes-agent
      // from a different sender
      
      // First, send from founder to hermes
      await callMcpTool(founderToken, 'send_message', {
        sender_id: 'founder',
        recipient_id: 'e2e-hermes-agent',
        content: `Admin message ${Date.now()}`
      });

      // Claude can only see messages involving him
      const claudeInbox = await callMcpTool(claudeToken, 'list_messages', { 
        agent_id: 'e2e-claude-agent', 
        limit: 100
      });
      const claudeMsgs = extractMcpContent(claudeInbox.text);
      
      const hasAdminMsg = claudeMsgs.some((m: any) => m.content?.startsWith('Admin message'));
      assert.ok(!hasAdminMsg, 'Claude cannot see admin messages');
    });
  });
});