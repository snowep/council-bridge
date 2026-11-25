// Messages/Chat Routes
// Implements: GET /api/messages/conversations, GET /api/messages/:conversationId, POST /api/messages

import { Router, Request, Response } from 'express';
import { createMessageService } from '../../communication/messages.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler.js';
import { SendMessageSchema, ListConversationsSchema, ListMessagesInConversationSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';
import { createAgentService } from '../../communication/agents.js';
const agentService = createAgentService(db);
const messageService = createMessageService(db, agentService);

// Apply auth middleware to all routes
router.use(authMiddleware);

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/messages/conversations - List conversations for authenticated user
router.get('/conversations', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, search } = ListConversationsSchema.parse(req.query);

  const conversations = messageService.listConversations({
    agent_id: ctx.owner_id,
    limit,
    offset,
    search,
  });

  // Set X-Total-Count header for pagination
  res.set('X-Total-Count', String(conversations.length));

  res.json({ conversations, total_count: conversations.length, limit, offset });
}));

// GET /api/messages/:conversationId - Get messages in a conversation with pagination
router.get('/:conversationId', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const conversationId = getParamId(req.params, 'conversationId');
  const { limit, offset } = ListMessagesInConversationSchema.parse(req.query);

  if (!conversationId) {
    throw new ValidationError('Conversation ID required', { conversationId });
  }

  const allMessages = messageService.checkInbox(ctx.owner_id, conversationId);

  // Check if user is part of this conversation
  const isParticipant = allMessages.some(m =>
    m.sender_id === ctx.owner_id || m.recipient_id === ctx.owner_id
  );

  if (!isParticipant && ctx.owner_type !== 'founder') {
    throw new NotFoundError('Conversation not found');
  }

  // Apply pagination
  const messages = allMessages.slice(offset, offset + limit);

  // Mark as read (only for first page)
  if (offset === 0) {
    messageService.markAsRead(ctx.owner_id, conversationId);
  }

  // Set X-Total-Count header for pagination
  res.set('X-Total-Count', String(allMessages.length));

  res.json({ messages, total_count: allMessages.length, limit, offset });
}));

// POST /api/messages - Send a message
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const input = SendMessageSchema.parse(req.body);

  const message = messageService.sendMessage({
    sender_id: ctx.owner_id,
    recipient_id: input.recipient_id,
    content: input.content,
    reply_to: input.reply_to,
  });

  res.status(201).json(message);
}));

export default router;