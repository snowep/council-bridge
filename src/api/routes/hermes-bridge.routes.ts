// Hermes Bridge Routes
// Provides HTTP endpoints for Hermes agents to communicate with Council Bridge
// This enables two-way integration between Hermes and the Council Bridge ecosystem

import { Router, Request, Response } from 'express';
import { databaseInstance as db } from '../../database.js';
import { createHermesBridgeAdapter } from '../../mcp/hermes-bridge.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';

const router = Router();
const hermesAdapter = createHermesBridgeAdapter(db);

// POST /api/hermes/webhook - Receive messages from Hermes webhook
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const event = req.body;

  if (!event || !event.type) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  // Verify webhook signature - REQUIRED for all environments
  const signature = req.headers['x-hermes-signature'] as string;
  const secret = process.env.HERMES_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'Hermes webhook secret not configured' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Webhook signature required' });
  }

  const crypto = await import('crypto');
  const expected = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(event))
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  switch (event.type) {
    case 'hermes_message':
      try {
        const result = await hermesAdapter.hermesSendMessage(
          event.from_hermes_id,
          event.to_council_id,
          event.content
        );
        res.json({ success: true, message_id: result?.id || 'created' });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Failed to send message'
        });
      }
      break;

    case 'hermes_register':
      try {
        const agentId = await hermesAdapter.registerHermesAgent(
          event.hermes_id,
          event.display_name
        );
        res.json({ success: true, agent_id: agentId });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Failed to register agent'
        });
      }
      break;

    case 'hermes_poll_messages':
      try {
        const messages = await hermesAdapter.getMessagesForHermes(
          event.hermes_id,
          event.limit || 50
        );
        res.json({
          success: true,
          messages: messages.map((m: any) => ({
            id: m.id,
            sender_id: m.sender_id,
            recipient_id: m.recipient_id,
            content: m.content,
            created_at: m.created_at,
            read_at: m.read_at,
            status: m.status
          }))
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Failed to fetch messages'
        });
      }
      break;

    default:
      res.status(400).json({ error: `Unknown event type: ${event.type}` });
  }
}));

// POST /api/hermes/session - Exchange Hermes session for Council Bridge token
router.post('/session', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { hermes_session_id } = req.body;

  if (!hermes_session_id) {
    return res.status(400).json({ error: 'hermes_session_id required' });
  }

  try {
    const token = await hermesAdapter.hermesSessionToToken(hermes_session_id);
    res.json({
      success: true,
      session_token: token,
      hermes_session_id
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create session'
    });
  }
}));

// GET /api/hermes/agents - List registered Hermes agents
router.get('/agents', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, offset = 0 } = req.query;

  // Query actual agents from database
  const agents = db.stmt.listAgents.all().slice(Number(offset), Number(offset) + Number(limit)) as any[];

  res.json({
    success: true,
    agents: agents.map((agent: any) => ({
      agent_id: agent.agent_id,
      display_name: agent.display_name,
      runtime: agent.runtime,
      created_at: agent.created_at
    })),
    limit: Number(limit),
    offset: Number(offset),
    total: agents.length
  });
}));

export default router;