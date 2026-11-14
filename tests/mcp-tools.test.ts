// MCP Tool Registration Tests - Phase 9 Pre-Batch 3 Gate 2 Task 3
// Tests tool discovery, Phase 1 tools, tool execution with auth, and authorization

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance, closeDatabase } from '../src/database.js';
import { generateSessionToken } from '../src/auth/session.js';
import { getAuthConfig, authMiddleware, getAuthContext } from '../src/auth/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerMcpTools } from '../src/mcp/tools.js';

// Helper to parse SSE response
function parseSSEResponse(text: string): any {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.substring(6);
      try {
        return JSON.parse(jsonStr);
      } catch {
        continue;
      }
    }
  }
  return null;
}

let db: DatabaseInstance;
let app: express.Express;
let server: any;
let founderToken: string;
let staffToken: string;
let divisionToken: string;

describe('MCP Tool Registration - Phase 9 Task 3', () => {
  before(async () => {
    // Set production auth mode for tests
    process.env.AUTH_MODE = 'production';
    process.env.SESSION_SECRET = 'test-secret-32-characters-minimum-length';

    db = createDatabase(':memory:');

    app = express();
    app.use(express.json());

    // Apply auth middleware to /mcp endpoint - create new transport per request (matching server.ts)
    app.all('/mcp', authMiddleware, async (req, res) => {
      const requestTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const requestMcpServer = new McpServer({ name: 'council-bridge', version: '1.0.0' }, { capabilities: { tools: {} } });
      await requestMcpServer.connect(requestTransport);
      // Pass the authenticated context directly to tools
      const authContext = getAuthContext(req);
      registerMcpTools(requestMcpServer, db, () => authContext);
      await requestTransport.handleRequest(req, res, req.body);
    });

    // Also add auth session endpoint for test token generation
    app.post('/api/auth/session', async (req, res) => {
      const { owner_type, owner_id, runtime } = req.body;
      const token = generateSessionToken({
        owner_type,
        owner_id,
        runtime,
        client_ip: req.ip,
        user_agent: req.get('user-agent')
      });
      res.json({ session_token: token });
    });

    server = app.listen(0);

    // Generate test tokens
    process.env.AUTH_MODE = 'production';

    const founderRes = await request(server)
      .post('/api/auth/session')
      .send({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
    founderToken = founderRes.body.session_token;

    // Register test agents using MCP tool (via founder)
    const registerStaff = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${founderToken}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'register_agent', arguments: { agent_id: 'staff-001', display_name: 'Staff Agent', runtime: 'claude' } },
        id: 1
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    const registerDiv = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${founderToken}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'register_agent', arguments: { agent_id: 'div-001', display_name: 'Division Agent', runtime: 'claude' } },
        id: 1
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    const registerOther = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${founderToken}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'register_agent', arguments: { agent_id: 'other-agent', display_name: 'Other Agent', runtime: 'claude' } },
        id: 1
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    // Register founder agent for messaging tests
    const registerFounder = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${founderToken}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'register_agent', arguments: { agent_id: 'founder', display_name: 'Founder', runtime: 'claude' } },
        id: 1
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    const staffRes = await request(server)
      .post('/api/auth/session')
      .send({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });
    staffToken = staffRes.body.session_token;

    const divisionRes = await request(server)
      .post('/api/auth/session')
      .send({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });
    divisionToken = divisionRes.body.session_token;
  });

  after(() => {
    server.close();
    db.close();
  });

  beforeEach(() => {
    process.env.AUTH_MODE = 'production';
  });

  describe('Tool Discovery', () => {
    it('should return registered tools via tools/list', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      // Parse SSE response
      const parsed = parseSSEResponse(response.text);
      assert.ok(parsed);
      assert.ok(parsed.result);
      assert.ok(parsed.result.tools);
      assert.ok(Array.isArray(parsed.result.tools));
      assert.ok(parsed.result.tools.length > 0);
    });

    it('should have expected number of tools registered', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const tools = parsed.result.tools;
      // Phase 1 (6): register_agent, send_message, get_messages, check_inbox, reply_message, list_messages, list_agents
      // Phase 7/9 (13): create_task_autonomy_level, update_task_autonomy_level, get_task_autonomy_level, list_task_autonomy_levels,
      // request_execution, get_execution_request, list_execution_requests, execute_execution_request, cancel_execution_request,
      // approve_execution, list_approval_requests, get_execution_history
      // Total: 19 tools
      assert.strictEqual(tools.length, 19);
    });
  });

  describe('Phase 1 Communication Tools', () => {
    it('should register send_message tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('send_message'));
    });

    it('should register get_messages tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('get_messages'));
    });

    it('should register list_agents tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('list_agents'));
    });

    it('should register register_agent tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('register_agent'));
    });

    it('should register check_inbox tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('check_inbox'));
    });

    it('should register reply_message tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('reply_message'));
    });

    it('should register list_messages tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('list_messages'));
    });

    it('should have all 6 original Phase 1 tool names', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      const phase1Tools = ['register_agent', 'list_agents', 'send_message', 'check_inbox', 'reply_message', 'list_messages'];
      for (const tool of phase1Tools) {
        assert.ok(toolNames.includes(tool), `Missing Phase 1 tool: ${tool}`);
      }
    });
  });

  describe('Phase 7/9 Operation Tools', () => {
    it('should register task autonomy level tools', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('create_task_autonomy_level'));
      assert.ok(toolNames.includes('update_task_autonomy_level'));
      assert.ok(toolNames.includes('get_task_autonomy_level'));
      assert.ok(toolNames.includes('list_task_autonomy_levels'));
    });

    it('should register execution request tools', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('request_execution'));
      assert.ok(toolNames.includes('get_execution_request'));
      assert.ok(toolNames.includes('list_execution_requests'));
      assert.ok(toolNames.includes('execute_execution_request'));
      assert.ok(toolNames.includes('cancel_execution_request'));
    });

    it('should register approval tools', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('approve_execution'));
      assert.ok(toolNames.includes('list_approval_requests'));
    });

    it('should register execution history tool', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes('get_execution_history'));
    });
  });

  describe('Tool Execution with Auth', () => {
    it('should execute list_agents tool successfully', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_agents', arguments: {} },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.ok(parsed.result);
      assert.ok(parsed.result.content);
      assert.ok(Array.isArray(parsed.result.content));
    });

    it('should reject unauthenticated tool calls', async () => {
      const response = await request(server)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .set('Content-Type', 'application/json')
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .set('Content-Type', 'application/json')
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_INVALID_TOKEN');
    });
  });

  describe('Authorization Tests', () => {
    it('should enforce Founder-only for create_task_autonomy_level', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'create_task_autonomy_level',
            arguments: { task_type: 'test_task', autonomy_level: 1 }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      // Should fail with authorization error (isError: true)
      const parsed = parseSSEResponse(response.text);
      console.log('DEBUG create_task_autonomy_level error:', parsed.result.content[0].text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('Founder'));
    });

    it('should enforce Founder-only for approve_execution', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'approve_execution',
            arguments: { approval_request_id: 'test-approval', approved: true }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('Only Founder can approve execution requests'));
    });

    it('should enforce Founder-only for list_approval_requests', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_approval_requests', arguments: {} },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('Only Founder can list approval requests'));
    });

    it('should allow staff to call request_execution', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'request_execution',
            arguments: {
              task_id: 'test-task-1',
              action_description: 'Test execution',
              action_payload: {}
            }
          },
          id: 1
        })
        .set('Content-Type', 'application/json');

      // May fail with "task not found" but NOT with auth error
      const parsed = parseSSEResponse(response.text);
      if (parsed.result.isError) {
        const errorText = parsed.result.content[0].text;
        assert.ok(!errorText.includes('Authorization denied'));
        assert.ok(!errorText.includes('Authentication required'));
      }
    });

    it('should allow division to call request_execution', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${divisionToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'request_execution',
            arguments: {
              task_id: 'test-task-1',
              action_description: 'Test execution',
              action_payload: {}
            }
          },
          id: 1
        })
        .set('Content-Type', 'application/json');

      const parsed = parseSSEResponse(response.text);
      if (parsed.result.isError) {
        const errorText = parsed.result.content[0].text;
        assert.ok(!errorText.includes('Authorization denied'));
        assert.ok(!errorText.includes('Authentication required'));
      }
    });

    it('should allow founder to call any tool', async () => {
      // Founder should be able to call all tools (though may fail on business logic)
      const tools = [
        'create_task_autonomy_level',
        'approve_execution',
        'list_approval_requests',
        'request_execution',
        'list_execution_requests',
      ];

      for (const toolName of tools) {
        const response = await request(server)
          .post('/mcp')
          .set('Authorization', `Bearer ${founderToken}`)
          .set('Accept', 'application/json, text/event-stream')
          .send({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: toolName, arguments: {} },
            id: 1
          })
          .set('Content-Type', 'application/json')
          .expect(200);

        // Founder calls should not fail with auth errors
        const parsed = parseSSEResponse(response.text);
        if (parsed.result.isError) {
          const errorText = parsed.result.content[0].text;
          assert.ok(!errorText.includes('Authorization denied'));
          assert.ok(!errorText.includes('Authentication required'));
          assert.ok(!errorText.includes('Founder authorization required'));
        }
      }
    });
  });

  describe('Phase 1 Tool Execution Tests', () => {
    let testAgentId: string;

    beforeEach(async () => {
      // Register a test agent using founder
      const registerRes = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'register_agent',
            arguments: { agent_id: 'test-agent-001', display_name: 'Test Agent', runtime: 'claude' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(registerRes.text);
      if (!parsed.result.isError) {
        const result = JSON.parse(parsed.result.content[0].text);
        testAgentId = result.agent_id;
      }
    });

    it('should register agent via register_agent tool (founder only)', async () => {
      const uniqueId = `new-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'register_agent',
            arguments: { agent_id: uniqueId, display_name: 'New Agent', runtime: 'hermes' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      // Successful responses don't have isError field (or it's falsy)
      assert.ok(!parsed.result.isError);
      const result = JSON.parse(parsed.result.content[0].text);
      assert.ok(result.agent_id);
      assert.strictEqual(result.display_name, 'New Agent');
      assert.strictEqual(result.runtime, 'hermes');
    });

    it('should reject duplicate agent registration', async () => {
      // Try to register same agent_id again
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'register_agent',
            arguments: { agent_id: 'test-agent-001', display_name: 'Test Agent', runtime: 'claude' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('already exists'));
    });

    it('should reject register_agent from non-founder', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'register_agent',
            arguments: { agent_id: 'staff-agent', display_name: 'Staff Agent', runtime: 'claude' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('Founder'));
    });

    it('should check inbox via check_inbox tool (own inbox only)', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'check_inbox', arguments: { agent_id: 'staff-001' } },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.ok(!parsed.result.isError);
      const result = JSON.parse(parsed.result.content[0].text);
      assert.ok(Array.isArray(result));
    });

    it('should reject check_inbox for another agent', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'check_inbox', arguments: { agent_id: 'other-agent' } },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('authenticated agent'));
    });

    it('should allow founder to check any inbox', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'check_inbox', arguments: { agent_id: 'staff-001' } },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      console.log('DEBUG founder check_inbox response:', JSON.stringify(parsed, null, 2));
      assert.ok(!parsed.result.isError);
    });

    it('should list messages via list_messages tool (own messages only)', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_messages', arguments: { agent_id: 'staff-001', limit: 10 } },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      console.log('DEBUG list_messages response:', JSON.stringify(parsed, null, 2));
      assert.ok(!parsed.result.isError);
      const result = JSON.parse(parsed.result.content[0].text);
      assert.ok(Array.isArray(result));
    });

    it('should reject list_messages for another agent', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_messages', arguments: { agent_id: 'other-agent' } },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('authenticated agent'));
    });

    it('should reply to message via reply_message tool (recipient only)', async () => {
      // First send a message from founder to staff
      const sendRes = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'send_message',
            arguments: { sender_id: 'founder', recipient_id: 'staff-001', content: 'Hello from founder' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const sendParsed = parseSSEResponse(sendRes.text);
      console.log('DEBUG send_message response:', JSON.stringify(sendParsed, null, 2));
      const sentMsg = JSON.parse(sendParsed.result.content[0].text);
      const messageId = sentMsg.id;

      // Now reply as the recipient (staff)
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'reply_message',
            arguments: { agent_id: 'staff-001', message_id: messageId, content: 'Reply from staff' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      console.log('DEBUG reply_message response:', JSON.stringify(parsed, null, 2));
      assert.ok(!parsed.result.isError);
      const result = JSON.parse(parsed.result.content[0].text);
      assert.ok(result.id);
      assert.strictEqual(result.sender_id, 'staff-001');
      assert.strictEqual(result.recipient_id, 'founder');
      assert.strictEqual(result.reply_to, messageId);
    });

    it('should reject reply_message from non-recipient', async () => {
      // Send a message from founder to staff
      const sendRes = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'send_message',
            arguments: { sender_id: 'founder', recipient_id: 'staff-001', content: 'Hello from founder' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const sendParsed = parseSSEResponse(sendRes.text);
      const sentMsg = JSON.parse(sendParsed.result.content[0].text);
      const messageId = sentMsg.id;

      // Try to reply as founder (not the recipient)
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'reply_message',
            arguments: { agent_id: 'founder', message_id: messageId, content: 'Invalid reply' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('intended recipient'));
    });

    it('should reject send_message with wrong sender_id', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'send_message',
            arguments: { sender_id: 'other-agent', recipient_id: 'staff-001', content: 'Impersonation attempt' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      assert.ok(parsed.result.content[0].text.includes('Sender ID must match'));
    });
  });

  describe('Structured Error Responses', () => {
    it('should return structured errors with code and message', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'create_task_autonomy_level',
            arguments: { task_type: 'test', autonomy_level: 1 }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      const errorData = JSON.parse(parsed.result.content[0].text);
      assert.ok(errorData.error);
      assert.ok(errorData.code);
      // Error is authorization denied, but wrapper catches it as MCP_ERROR
      // The actual service error is 'Only Founder can define task autonomy levels'
      assert.ok(['AUTH_DENIED', 'MCP_ERROR'].includes(errorData.code));
    });

    it('should return MCP_ERROR for unknown tool errors', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get_execution_request',
            arguments: { execution_id: 'nonexistent' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      assert.strictEqual(parsed.result.isError, true);
      const errorData = JSON.parse(parsed.result.content[0].text);
      assert.ok(errorData.error);
      assert.ok(errorData.code);
      assert.strictEqual(errorData.code, 'MCP_ERROR');
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have proper schemas for all tools', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const tools = parsed.result.tools;

      for (const tool of tools) {
        assert.ok(tool.name, 'Tool must have name');
        assert.ok(tool.description, 'Tool must have description');
        assert.ok(tool.inputSchema, 'Tool must have inputSchema');
        assert.strictEqual(tool.inputSchema.type, 'object', 'Input schema must be object type');
      }
    });

    it('should have specific schemas for Phase 1 tools', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const tools = parsed.result.tools;
      const sendMessage = tools.find((t: any) => t.name === 'send_message');
      const getMessages = tools.find((t: any) => t.name === 'get_messages');
      const listAgents = tools.find((t: any) => t.name === 'list_agents');

      assert.ok(sendMessage.inputSchema.properties.sender_id);
      assert.ok(sendMessage.inputSchema.properties.recipient_id);
      assert.ok(sendMessage.inputSchema.properties.content);

      assert.ok(getMessages.inputSchema.properties.agent_id);

      assert.ok(listAgents.inputSchema);
    });
  });

  describe('No Duplicate Tool Registration', () => {
    it('should not have duplicate tool names', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${founderToken}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        .set('Content-Type', 'application/json')
        .expect(200);

      const parsed = parseSSEResponse(response.text);
      const toolNames = parsed.result.tools.map((t: any) => t.name);
      const uniqueNames = new Set(toolNames);
      assert.strictEqual(toolNames.length, uniqueNames.size, 'No duplicate tool names');
    });
  });
});