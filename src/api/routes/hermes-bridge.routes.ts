// Hermes Bridge Routes
// Provides HTTP endpoints for Hermes agents to communicate with Council Bridge
// This enables two-way integration between Hermes and the Council Bridge ecosystem

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { databaseInstance as db } from '../../database.js';
import { createHermesBridgeAdapter } from '../../mcp/hermes-bridge.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';
import { authMiddleware, requireAuth, getAuthContext } from '../middleware/authentication.js';

const router = Router();
const hermesAdapter = createHermesBridgeAdapter(db);

// Canonical serialization: sort object keys recursively for consistent hashing
// This MUST match the exact algorithm used by the Hermes sender
// See: docs/specs/hermes-webhook-contract.md for the serialization contract
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

// Generate correlation ID for response tracking
function generateCorrelationId(): string {
  return randomUUID();
}

// Validate hex signature format
// Hermes signatures are HMAC-SHA256 hex digests (64 characters)
function isValidHexSignature(signature: string): boolean {
  // HMAC-SHA256 in hex is exactly 64 characters
  if (typeof signature !== 'string' || signature.length !== 64) {
    return false;
  }
  // Must be valid hexadecimal
  return /^[a-fA-F0-9]{64}$/.test(signature);
}

// POST /api/hermes/webhook - Receive messages from Hermes webhook
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const event = req.body;

  if (!event || !event.type) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid webhook payload' },
      correlationId
    });
  }

  // Verify webhook signature - REQUIRED for all environments
  // Use canonical JSON serialization to ensure consistent key ordering
  const signature = req.headers['x-hermes-signature'] as string;
  const secret = process.env.HERMES_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Hermes webhook secret not configured' },
      correlationId
    });
  }

  // Validate signature is present
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: { code: 'SIGNATURE_REQUIRED', message: 'Webhook signature required' },
      correlationId
    });
  }

  // Validate signature format before processing
  // Reject malformed, empty, or incorrectly sized signatures
  if (!isValidHexSignature(signature)) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature format' },
      correlationId
    });
  }

  const crypto = await import('crypto');

  // Compute expected signature using canonical serialization
  const canonicalized = canonicalize(event);
  const payload = JSON.stringify(canonicalized);
  const expected = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  // Both buffers must have equal length (guaranteed by hex validation above)
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' },
        correlationId
      });
    }
  } catch (error) {
    // Should never reach here due to hex validation, but handle defensively
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' },
      correlationId
    });
  }

  switch (event.type) {
    case 'hermes_message':
      try {
        const result = await hermesAdapter.hermesSendMessage(
          event.from_hermes_id,
          event.to_council_id,
          event.content
        );
        res.json({
          success: true,
          data: { message_id: result?.id || 'created' },
          correlationId
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MESSAGE_FAILED',
            message: error instanceof Error ? error.message : 'Failed to send message'
          },
          correlationId
        });
      }
      break;

    case 'hermes_register':
      try {
        const agentId = await hermesAdapter.registerHermesAgent(
          event.hermes_id,
          event.display_name
        );
        res.json({
          success: true,
          data: { agent_id: agentId },
          correlationId
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to register agent'
          },
          correlationId
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
          data: {
            messages: messages.map((m: any) => ({
              id: m.id,
              sender_id: m.sender_id,
              recipient_id: m.recipient_id,
              content: m.content,
              created_at: m.created_at,
              read_at: m.read_at,
              status: m.status
            }))
          },
          correlationId
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: error instanceof Error ? error.message : 'Failed to fetch messages'
          },
          correlationId
        });
      }
      break;

    default:
      res.status(400).json({
        success: false,
        error: { code: 'UNKNOWN_EVENT', message: `Unknown event type: ${event.type}` },
        correlationId
      });
  }
}));

// POST /api/hermes/session - Exchange Hermes session for Council Bridge token
router.post('/session', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const { hermes_session_id } = req.body;

  if (!hermes_session_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'hermes_session_id required' },
      correlationId
    });
  }

  try {
    const token = await hermesAdapter.hermesSessionToToken(hermes_session_id);
    res.json({
      success: true,
      data: { session_token: token, hermes_session_id },
      correlationId
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SESSION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create session'
      },
      correlationId
    });
  }
}));

// GET /api/hermes/agents - List registered Hermes agents
router.get('/agents', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const { limit = 50, offset = 0 } = req.query;

  // Query actual agents from database
  const agents = db.stmt.listAgents.all().slice(Number(offset), Number(offset) + Number(limit)) as any[];

  res.json({
    success: true,
    data: {
      agents: agents.map((agent: any) => ({
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        runtime: agent.runtime,
        created_at: agent.created_at
      })),
      limit: Number(limit),
      offset: Number(offset),
      total: agents.length
    },
    correlationId
  });
}));

export default router;