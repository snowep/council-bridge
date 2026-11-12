import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import path from 'node:path';
import { createAgentService } from './agents.js';
import { createMessageService } from './messages.js';
import { createDatabase } from './database.js';

const PORT = 3334;
const HOST = '127.0.0.1';

import express from 'express';
const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessions: sessions.size,
  });
});

const sessions = new Map();

function createServices(dbInstance: any) {
  return {
    agentService: createAgentService(dbInstance),
    messageService: createMessageService(dbInstance, createAgentService(dbInstance)),
  };
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const isInitialize = req.body?.method === 'initialize';

  if (!sessionId && !isInitialize) {
    res.status(400).json({ error: 'Missing mcp-session-id header' });
    return;
  }

  console.log(
    `[server] POST /mcp received, sessionId=${sessionId ?? 'initializing'}`
  );

  console.log(`[server] POST /mcp received, sessionId=${sessionId}`);

  try {
    let session = sessions.get(sessionId);

    if (!session) {
      // New session - create fresh database, services, and MCP server
      const dbInstance = createDatabase(
        process.env.DB_PATH || path.join(process.cwd(), 'data', 'council.db')
      );
      const services = createServices(dbInstance);
      const mcpserver = new McpServer(
        { name: 'council-bridge', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      // Create transport and set up session callbacks
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: async (sid) => {
          console.log(`[${new Date().toISOString()}] Session initialized: ${sid}`);
          // Store session immediately in the map using the callback's sid
          session = {
            transport,
            agentService: services.agentService,
            messageService: services.messageService,
            mcpserver,
          };
          sessions.set(sid, session);
          // Also store under the original request sessionId if different
          if (sessionId && sessionId !== sid) {
            sessions.set(sessionId, session);
          }
          console.log(`[${new Date().toISOString()}] Session stored. Total sessions: ${sessions.size}`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          console.log(`[${new Date().toISOString()}] Transport closed for session ${sid}`);
          sessions.delete(sid);
        }
      };

      // Register tools on the new McpServer instance
      mcpserver.registerTool('register_agent', {
        title: 'Register Agent',
        description: 'Register a new agent in the council',
        inputSchema: {
          agent_id: z.string().min(1).max(255).describe('Unique identifier for the agent'),
          display_name: z.string().min(1).max(255).describe('Human-readable display name'),
          runtime: z.string().min(1).max(255).describe('Runtime environment (e.g., node, python, browser)'),
        },
      }, async ({ agent_id, display_name, runtime }) => {
        const agent = services.agentService.registerAgent({ agent_id, display_name, runtime });
        return {
          content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }],
        };
      });

      mcpserver.registerTool('list_agents', {
        title: 'List Agents',
        description: 'List all registered agents',
        inputSchema: {},
      }, async () => {
        const agents = services.agentService.listAgents();
        return {
          content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }],
        };
      });

      mcpserver.registerTool('send_message', {
        title: 'Send Message',
        description: 'Send a message from one agent to another',
        inputSchema: {
          sender_id: z.string().min(1).max(255).describe('Sender agent ID'),
          recipient_id: z.string().min(1).max(255).describe('Recipient agent ID'),
          content: z.string().min(1).describe('Message content'),
          reply_to: z.string().uuid().optional().describe('Optional message ID to reply to'),
        },
      }, async ({ sender_id, recipient_id, content, reply_to }) => {
        const message = services.messageService.sendMessage({ sender_id, recipient_id, content, reply_to });
        return {
          content: [{ type: 'text', text: JSON.stringify(message, null, 2) }],
        };
      });

      mcpserver.registerTool('check_inbox', {
        title: 'Check Inbox',
        description: 'Check messages for an agent',
        inputSchema: {
          agent_id: z.string().min(1).max(255).describe('Agent ID to check inbox for'),
        },
      }, async ({ agent_id }) => {
        const messages = services.messageService.checkInbox(agent_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      });

      mcpserver.registerTool('reply_message', {
        title: 'Reply Message',
        description: 'Reply to a specific message',
        inputSchema: {
          agent_id: z.string().min(1).max(255).describe('Agent ID (must be the recipient)'),
          message_id: z.string().uuid().describe('Message ID to reply to'),
          content: z.string().min(1).describe('Reply content'),
        },
      }, async ({ agent_id, message_id, content }) => {
        const message = services.messageService.replyMessage({ agent_id, message_id, content });
        return {
          content: [{ type: 'text', text: JSON.stringify(message, null, 2) }],
        };
      });

      mcpserver.registerTool('list_messages', {
        title: 'List Messages',
        description: 'List all messages sent or received by an agent',
        inputSchema: {
          agent_id: z.string().min(1).max(255).describe('Agent ID'),
          limit: z.number().int().positive().max(100).default(50).describe('Maximum messages to return'),
        },
      }, async ({ agent_id, limit }) => {
        const messages = services.messageService.listMessages({ agent_id, limit });
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      });

      // Connect first
      await mcpserver.connect(transport);

      // Now process the request - this will trigger onsessioninitialized for initialize requests
      await transport.handleRequest(req, res, req.body);

      // After handleRequest, the session should be stored by onsessioninitialized
      // The session might be stored under the generated sid, so look it up
      session = sessions.get(sessionId);
      if (!session) {
        // Try to find by transport
        for (const [, s] of sessions) {
          if (s.transport === transport) {
            session = s;
            break;
          }
        }
      }
    } else {
      // Existing session - just handle the request
      await session.transport.handleRequest(req, res, req.body);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error handling MCP request:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] Council Bridge MCP server listening on http://${HOST}:${PORT}`);
  console.log(`[${new Date().toISOString()}] MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`[${new Date().toISOString()}] Health endpoint: http://${HOST}:${PORT}/health`);
});