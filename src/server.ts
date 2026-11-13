import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import path from 'node:path';
import { createAgentService } from './agents.js';
import { createMessageService } from './messages.js';
import { createDatabase } from './database.js';
import { createCouncilService } from './council.js';

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
    councilService: createCouncilService(dbInstance),
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

      // Phase 4: Memory Tools
      mcpserver.registerTool('create_memory', {
        title: 'Create Memory',
        description: 'Create a new memory entry (owner/identity derived from session)',
        inputSchema: {
          category: z.enum([
            'individual_persona', 'council_shared', 'meeting_history', 'decision_resolution',
            'idea_proposal', 'research_evidence', 'lesson_learned', 'unresolved_question',
            'division_shared', 'division_private', 'staff_private', 'business_context',
            'task_history', 'cross_division'
          ]).describe('Memory category'),
          memory_type: z.string().min(1).max(255).describe('Discriminator for structured content'),
          title: z.string().min(1).max(500).describe('Memory title'),
          content: z.record(z.string(), z.any()).describe('Structured JSON content'),
          tags: z.array(z.string()).default([]).describe('Tags for categorization'),
          confidence: z.number().min(0).max(1).default(1.0).describe('Confidence score 0-1'),
          meeting_id: z.string().optional().describe('Optional meeting ID'),
          division_id: z.string().optional().describe('Optional division ID'),
          task_id: z.string().optional().describe('Optional task ID'),
        },
      }, async ({ category, memory_type, title, content, tags, confidence, meeting_id, division_id, task_id }) => {
        // In production, ctx comes from session middleware
        // For now, we'll extract from session or use defaults
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const memory = services.councilService.createMemory(ctx, { category, memory_type, title, content, tags, confidence, meeting_id, division_id, task_id });
        return {
          content: [{ type: 'text', text: JSON.stringify(memory, null, 2) }],
        };
      });

      mcpserver.registerTool('get_memory', {
        title: 'Get Memory',
        description: 'Fetch a memory by ID with optional versions and links',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Memory ID'),
          include_versions: z.boolean().default(false).describe('Include version history'),
          include_links: z.boolean().default(false).describe('Include links'),
          version: z.number().int().positive().optional().describe('Specific version to fetch'),
        },
      }, async ({ memory_id, include_versions, include_links, version }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const result = services.councilService.getMemory(ctx, memory_id, { include_versions, include_links, version });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      });

      mcpserver.registerTool('update_memory', {
        title: 'Update Memory',
        description: 'Create a new version of a memory (immutable history preserved)',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Memory ID'),
          title: z.string().min(1).max(500).optional().describe('New title'),
          content: z.record(z.string(), z.any()).optional().describe('New content'),
          tags: z.array(z.string()).optional().describe('New tags'),
          confidence: z.number().min(0).max(1).optional().describe('New confidence'),
          change_summary: z.string().min(1).max(1000).describe('Reason for change'),
        },
      }, async ({ memory_id, title, content, tags, confidence, change_summary }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const memory = services.councilService.updateMemory(ctx, { memory_id, title, content, tags, confidence, change_summary });
        return {
          content: [{ type: 'text', text: JSON.stringify(memory, null, 2) }],
        };
      });

      mcpserver.registerTool('search_memory', {
        title: 'Search Memory',
        description: 'Full-text search with filters and privacy enforcement',
        inputSchema: {
          query: z.string().optional().describe('FTS5 search query'),
          category: z.enum([
            'individual_persona', 'council_shared', 'meeting_history', 'decision_resolution',
            'idea_proposal', 'research_evidence', 'lesson_learned', 'unresolved_question',
            'division_shared', 'division_private', 'staff_private', 'business_context',
            'task_history', 'cross_division'
          ]).optional().describe('Filter by category'),
          memory_type: z.string().optional().describe('Filter by memory type'),
          meeting_id: z.string().optional().describe('Filter by meeting'),
          division_id: z.string().optional().describe('Filter by division'),
          task_id: z.string().optional().describe('Filter by task'),
          tags: z.array(z.string()).optional().describe('Filter by tags'),
          min_confidence: z.number().min(0).max(1).optional().describe('Minimum confidence'),
          limit: z.number().int().positive().max(1000).default(50).describe('Result limit'),
          offset: z.number().int().nonnegative().default(0).describe('Result offset'),
          include_archived: z.boolean().default(false).describe('Include archived entries'),
        },
      }, async ({ query, category, memory_type, meeting_id, division_id, task_id, tags, min_confidence, limit, offset, include_archived }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const results = services.councilService.searchMemory(ctx, { query, category, memory_type, meeting_id, division_id, task_id, tags, min_confidence, limit, offset, include_archived });
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      });

      mcpserver.registerTool('link_memory', {
        title: 'Link Memory',
        description: 'Create a relationship between two memories',
        inputSchema: {
          source_memory_id: z.string().min(1).max(255).describe('Source memory ID'),
          target_memory_id: z.string().min(1).max(255).describe('Target memory ID'),
          link_type: z.enum(['supports', 'contradicts', 'extends', 'references', 'supersedes', 'derived_from']).describe('Relationship type'),
          strength: z.number().min(0).max(1).default(1.0).describe('Relationship strength 0-1'),
          notes: z.string().default('').describe('Optional notes'),
        },
      }, async ({ source_memory_id, target_memory_id, link_type, strength, notes }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const link = services.councilService.linkMemory(ctx, { source_memory_id, target_memory_id, link_type, strength, notes });
        return {
          content: [{ type: 'text', text: JSON.stringify(link, null, 2) }],
        };
      });

      mcpserver.registerTool('get_related', {
        title: 'Get Related Memories',
        description: 'Graph traversal to find related memories with privacy enforcement',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Starting memory ID'),
          link_type: z.enum(['supports', 'contradicts', 'extends', 'references', 'supersedes', 'derived_from']).optional().describe('Filter by link type'),
          direction: z.enum(['out', 'in', 'both']).default('out').describe('Traversal direction'),
          depth: z.number().int().positive().max(5).default(1).describe('Current depth'),
          max_depth: z.number().int().positive().max(5).default(3).describe('Maximum traversal depth'),
        },
      }, async ({ memory_id, link_type, direction, depth, max_depth }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const results = services.councilService.getRelated(ctx, { memory_id, link_type, direction, depth, max_depth });
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      });

      mcpserver.registerTool('get_memory_versions', {
        title: 'Get Memory Versions',
        description: 'Get version history for a memory',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Memory ID'),
          limit: z.number().int().positive().max(100).default(50).describe('Maximum versions to return'),
        },
      }, async ({ memory_id, limit }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const versions = services.councilService.getMemoryVersions(ctx, memory_id, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }],
        };
      });

      mcpserver.registerTool('get_cross_division_shares', {
        title: 'Get Cross-Division Shares',
        description: 'List cross-division sharing grants',
        inputSchema: {
          memory_id: z.string().optional().describe('Filter by memory'),
          division_id: z.string().optional().describe('Filter by division'),
        },
      }, async ({ memory_id, division_id }) => {
        const ctx = {
          owner_type: 'seat' as const,
          owner_id: 'seat-001',
          runtime: 'claude' as const,
        };
        const shares = services.councilService.getCrossDivisionShares(ctx, memory_id, division_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(shares, null, 2) }],
        };
      });

      mcpserver.registerTool('grant_cross_division_access', {
        title: 'Grant Cross-Division Access',
        description: 'Grant a division access to a cross-division memory',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Memory ID'),
          division_id: z.string().min(1).max(255).describe('Division ID to grant access'),
        },
      }, async ({ memory_id, division_id }) => {
        const ctx = {
          owner_type: 'division' as const,
          owner_id: 'div-001',
          runtime: 'claude' as const,
        };
        const share = services.councilService.grantCrossDivisionAccess(ctx, { memory_id, division_id });
        return {
          content: [{ type: 'text', text: JSON.stringify(share, null, 2) }],
        };
      });

      mcpserver.registerTool('revoke_cross_division_access', {
        title: 'Revoke Cross-Division Access',
        description: 'Revoke a division access to a cross-division memory',
        inputSchema: {
          memory_id: z.string().min(1).max(255).describe('Memory ID'),
          division_id: z.string().min(1).max(255).describe('Division ID to revoke access'),
        },
      }, async ({ memory_id, division_id }) => {
        const ctx = {
          owner_type: 'division' as const,
          owner_id: 'div-001',
          runtime: 'claude' as const,
        };
        const result = services.councilService.revokeCrossDivisionAccess(ctx, { memory_id, division_id });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: result }, null, 2) }],
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