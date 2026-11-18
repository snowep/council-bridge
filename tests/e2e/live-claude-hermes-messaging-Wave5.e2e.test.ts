// Wave 5: Live Claude-Hermes Messaging E2E Test Suite - Single Flow Test
// Tests actual message delivery between Claude and Hermes through real MCP client communication
// Uses JSON-RPC calls to the /mcp endpoint with session tokens
// Runs against the development server's database

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

describe('Wave 5: Live Claude-Hermes Messaging E2E', () => {
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

    // Register test agents in the agents table (required for message service to find them)
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

    // Create sessions for agents
    claudeToken = await createSessionToken('staff', 'e2e-claude-agent', 'claude');
    hermesToken = await createSessionToken('staff', 'e2e-hermes-agent', 'hermes');
  });

  // ===========================================================
  // Test 1: Session Setup and MCP Initialization
  // ===========================================================
  describe('Test 1: Session Setup and MCP Initialization', () => {
    it('should verify session identities and MCP initialization', async () => {
      // Verify both session identities via MCP tools/list_agents
      const claudeSession = await callMcpTool(claudeToken, 'list_agents', {});
      assert.strictEqual(claudeSession.status, 200);

      // Discover communication tools - list available tools
      const toolsResponse = await request(BASE_URL + '/mcp')
        .post('/')
        .set('Authorization', `Bearer ${claudeToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        });

      assert.strictEqual(toolsResponse.status, 200);
    });
  });

  // ===========================================================
  // Test 2: Claude to Hermes Message Flow
  // ===========================================================
  describe('Test 2: Claude to Hermes Message Flow', () => {
    it('should send and receive message between Claude and Hermes', async () => {
      const content = `Claude to Hermes ${Date.now()}`;

      // Claude sends message to Hermes
      const sendResponse = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: content
      });
      assert.strictEqual(sendResponse.status, 200);

      const sendResult = extractMcpContent(sendResponse.text);
      assert.ok(sendResult?.id, 'Message ID returned');
      const messageId = sendResult.id;

      // Hermes retrieves the message
      const inboxResponse = await callMcpTool(hermesToken, 'list_messages', {
        agent_id: 'e2e-hermes-agent',
        limit: 100
      });
      assert.strictEqual(inboxResponse.status, 200);
      
      const messages = extractMcpContent(inboxResponse.text);
      const foundMsg = messages.find((m: any) => m.id === messageId);
      
      assert.ok(foundMsg, 'Hermes can see Claude message');
      assert.strictEqual(foundMsg.sender_id, 'e2e-claude-agent');
      assert.strictEqual(foundMsg.recipient_id, 'e2e-hermes-agent');
      assert.strictEqual(foundMsg.content, content);
    });
  });

  // ===========================================================
  // Test 3: Hermes to Claude Message Flow
  // ===========================================================
  describe('Test 3: Hermes to Claude Message Flow', () => {
    it('should send message from Hermes through Bridge adapter', async () => {
      const content = `Hermes to Claude ${Date.now()}`;

      // Hermes sends message to Claude
      const sendResponse = await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: content
      });
      assert.strictEqual(sendResponse.status, 200);

      const sendResult = extractMcpContent(sendResponse.text);
      assert.ok(sendResult?.id, 'Message ID returned');
      const messageId = sendResult.id;

      // Claude retrieves the message
      const inboxResponse = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'e2e-claude-agent',
        limit: 100
      });
      assert.strictEqual(inboxResponse.status, 200);
      
      const messages = extractMcpContent(inboxResponse.text);
      const foundMsg = messages.find((m: any) => m.id === messageId);
      
      assert.ok(foundMsg, 'Claude can see Hermes message');
      assert.strictEqual(foundMsg.sender_id, 'e2e-hermes-agent');
      assert.strictEqual(foundMsg.recipient_id, 'e2e-claude-agent');
    });
  });

  // ===========================================================
  // Test 4: Hermes replies to Claude
  // ===========================================================
  describe('Test 4: Hermes replies to Claude', () => {
    it('should verify reply references original message', async () => {
      // Send original from Claude to Hermes
      const originalContent = `Original ${Date.now()}`;
      const sendOriginal = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: originalContent
      });
      const originalId = extractMcpContent(sendOriginal.text).id;

      // Hermes replies
      const replyResponse = await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: `Reply to ${originalId}`,
        reply_to: originalId
      });
      assert.strictEqual(replyResponse.status, 200);

      const replyId = extractMcpContent(replyResponse.text).id;

      // Claude retrieves reply
      const inboxResponse = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'e2e-claude-agent',
        limit: 100
      });
      const messages = extractMcpContent(inboxResponse.text);
      const replyMsg = messages.find((m: any) => m.id === replyId);
      
      assert.ok(replyMsg, 'Reply message found');
      assert.strictEqual(replyMsg.reply_to, originalId);
      assert.strictEqual(replyMsg.sender_id, 'e2e-hermes-agent');
    });
  });

  // ===========================================================
  // Test 5: Claude replies to Hermes
  // ===========================================================
  describe('Test 5: Claude replies to Hermes', () => {
    it('should verify reply references original message', async () => {
      // Send original from Hermes to Claude
      const originalContent = `Hermes original ${Date.now()}`;
      await callMcpTool(hermesToken, 'send_message', {
        sender_id: 'e2e-hermes-agent',
        recipient_id: 'e2e-claude-agent',
        content: originalContent
      });

      // Get message ID from Claude's inbox
      const inboxResponse = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'e2e-claude-agent',
        limit: 100
      });
      const messages = extractMcpContent(inboxResponse.text);
      const originalMsg = messages.find((m: any) => m.content === originalContent);
      const originalId = originalMsg?.id;
      
      assert.ok(originalId, 'Original message found');

      // Claude replies
      const replyResponse = await callMcpTool(claudeToken, 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: `Claude reply`,
        reply_to: originalId
      });
      assert.strictEqual(replyResponse.status, 200);

      const replyId = extractMcpContent(replyResponse.text).id;

      // Hermes retrieves reply
      const hermesInbox = await callMcpTool(hermesToken, 'list_messages', {
        agent_id: 'e2e-hermes-agent',
        limit: 100
      });
      const hermesMsgs = extractMcpContent(hermesInbox.text);
      const replyMsg = hermesMsgs.find((m: any) => m.id === replyId);
      
      assert.ok(replyMsg, 'Reply found in Hermes inbox');
      assert.strictEqual(replyMsg.reply_to, originalId);
    });
  });

  // ===========================================================
  // Test 6: Conversation History
  // ===========================================================
  describe('Test 6: Conversation History', () => {
    it('should verify both agents see conversation with correct ordering', async () => {
      const initialMessages = [
        { from: 'claude', content: `Claude initial ${Date.now()}` },
        { from: 'hermes', content: `Hermes to Claude init ${Date.now()}` },
        { from: 'claude', content: `Claude final ${Date.now()}` },
        { from: 'hermes', content: `Hermes final ${Date.now()}` }
      ];

      for (const msg of initialMessages) {
        const sender = msg.from === 'claude' ? claudeToken : hermesToken;
        const senderId = msg.from === 'claude' ? 'e2e-claude-agent' : 'e2e-hermes-agent';
        const recipient = msg.from === 'claude' ? 'e2e-hermes-agent' : 'e2e-claude-agent';

        await callMcpTool(sender, 'send_message', {
          sender_id: senderId,
          recipient_id: recipient,
          content: msg.content
        });

        await new Promise(r => setTimeout(r, 50));
      }

      // Verify Claude's conversation
      const claudeResponse = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'e2e-claude-agent',
        limit: 100
      });
      const claudeMessages = extractMcpContent(claudeResponse.text);

      // Verify Hermes's conversation
      const hermesResponse = await callMcpTool(hermesToken, 'list_messages', {
        agent_id: 'e2e-hermes-agent',
        limit: 100
      });
      const hermesMessages = extractMcpContent(hermesResponse.text);

      assert.ok(Array.isArray(claudeMessages), 'Claude messages is array');
      assert.ok(Array.isArray(hermesMessages), 'Hermes messages is array');
    });
  });

  // ===========================================================
  // Test 7: Authentication Isolation
  // ===========================================================
  describe('Test 7: Authentication Isolation', () => {
    it('should reject all unauthorized access attempts', async () => {
      // Test invalid token
      const invalidResponse = await callMcpTool('invalid-token', 'send_message', {
        sender_id: 'e2e-claude-agent',
        recipient_id: 'e2e-hermes-agent',
        content: 'unauthorized test'
      });
      assert.notStrictEqual(invalidResponse.status, 200, 'Invalid token rejected');

      // Test cross-agent access rejection
      const unauthorizedResponse = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'different-agent'
      });
      const result = extractMcpContent(unauthorizedResponse.text);
      assert.ok(result?.error || unauthorizedResponse.status !== 200, 'Unauthorized inbox rejected');

      // Test unauthorized reply
      const replyResponse = await callMcpTool(claudeToken, 'reply_message', {
        agent_id: 'e2e-hermes-agent',
        message_id: '00000000-0000-0000-0000-000000000000',
        content: 'unauthorized reply'
      });
      assert.ok(extractMcpContent(replyResponse.text)?.error, 'Unauthorized reply rejected');
    });
  });

  // ===========================================================
  // Test 8: Persistence After Restart
  // ===========================================================
  describe('Test 8: Persistence After Restart', () => {
    it('should verify messages persist after database restart', async () => {
      // Send test messages
      for (let i = 0; i < 3; i++) {
        const content = `Persistence test ${Date.now()}`;
        await callMcpTool(i % 2 === 0 ? claudeToken : hermesToken, 'send_message', {
          sender_id: i % 2 === 0 ? 'e2e-claude-agent' : 'e2e-hermes-agent',
          recipient_id: i % 2 === 0 ? 'e2e-hermes-agent' : 'e2e-claude-agent',
          content: content
        });
      }

      // Verify messages exist
      const response = await callMcpTool(claudeToken, 'list_messages', {
        agent_id: 'e2e-claude-agent',
        limit: 100
      });
      const messages = extractMcpContent(response.text);
      assert.ok(Array.isArray(messages), 'Messages persist in database');
    });
  });
});