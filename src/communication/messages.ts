import { z } from 'zod/v4';
import { DatabaseInstance } from '../database.js';
import { AgentService } from './agents.js';
import { randomUUID } from 'node:crypto';

export const SendMessageSchema = z.object({
  sender_id: z.string().min(1).max(255),
  recipient_id: z.string().min(1).max(255),
  content: z.string().min(1),
  reply_to: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const ReplyMessageSchema = z.object({
  agent_id: z.string().min(1).max(255),
  message_id: z.string().uuid(),
  content: z.string().min(1),
});

export type ReplyMessageInput = z.infer<typeof ReplyMessageSchema>;

export const ListMessagesSchema = z.object({
  agent_id: z.string().min(1).max(255),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  conversation_id: z.string().optional(),
  unread_only: z.boolean().default(false),
});

export type ListMessagesInput = z.infer<typeof ListMessagesSchema>;

export const ListConversationsSchema = z.object({
  agent_id: z.string().min(1).max(255),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  search: z.string().optional(),
});

export type ListConversationsInput = z.infer<typeof ListConversationsSchema>;

export interface Message {
  id: string; // Database primary key
  sender_id: string;
  recipient_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  participant_id: string;
  participant_name: string;
  last_message: Message | null;
  unread_count: number;
}

// Helper to determine message status based on read_at
function determineMessageStatus(row: any): 'sent' | 'read' {
  return row.read_at ? 'read' : 'sent';
}

// Helper to normalize database row to Message type
function normalizeMessage(row: any): Message {
  return {
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    content: row.content,
    reply_to: row.reply_to,
    created_at: row.created_at,
    read_at: row.read_at,
  };
}

export function createMessageService(
  dbInstance: DatabaseInstance,
  agentService: AgentService
) {
  return {
    sendMessage(input: SendMessageInput): Message {
      if (!agentService.agentExists(input.sender_id)) {
        throw new Error(`Sender agent '${input.sender_id}' not found`);
      }
      if (!agentService.agentExists(input.recipient_id)) {
        throw new Error(`Recipient agent '${input.recipient_id}' not found`);
      }

      if (input.reply_to) {
        const parentMsg = dbInstance.stmt.getMessageById.get(input.reply_to) as Message | undefined;
        if (!parentMsg) {
          throw new Error(`Reply-to message '${input.reply_to}' not found`);
        }
        if (parentMsg.recipient_id !== input.sender_id) {
          throw new Error('Only the recipient of a message may reply to it');
        }
      }

      const id = dbInstance.generateId();
      dbInstance.stmt.insertMessage.run(id, input.sender_id, input.recipient_id, input.content, input.reply_to ?? null);

      const msg = dbInstance.stmt.getMessageById.get(id) as any;
      return normalizeMessage(msg);
    },

    checkInbox(agentId: string, conversationId?: string): Message[] {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }

      // When conversationId is provided, filter by both participant
      if (conversationId) {
        // Messages where agent is sender or recipient, filtered to conversation
        const rawMessages = dbInstance.query(`
          SELECT * FROM messages
          WHERE (sender_id = ? OR recipient_id = ?)
          AND (sender_id = ? OR recipient_id = ?)
          ORDER BY created_at ASC
        `, [agentId, agentId, conversationId, conversationId]);

        return (rawMessages as any[]).map(normalizeMessage);
      }

      // Use listMessages to get BOTH sent and received messages for this agent
      const rawMessages = dbInstance.stmt.listMessages.all(agentId, agentId, 500) as any[];
      return rawMessages.map(normalizeMessage);
    },

    // Get messages for a specific conversation with pagination
    getConversationMessages(agentId: string, partnerId: string, limit: number = 50, offset: number = 0): Message[] {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      if (!agentService.agentExists(partnerId)) {
        throw new Error(`Partner agent '${partnerId}' not found`);
      }

      const rawMessages = dbInstance.query(`
        SELECT * FROM messages
        WHERE (sender_id = ? OR recipient_id = ?)
        AND (sender_id = ? OR recipient_id = ?)
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `, [agentId, partnerId, partnerId, agentId, limit, offset]);

      return (rawMessages as any[]).map(normalizeMessage);
    },

    replyMessage(input: ReplyMessageInput): Message {
      if (!agentService.agentExists(input.agent_id)) {
        throw new Error(`Agent '${input.agent_id}' not found`);
      }

      const parentMsg = dbInstance.stmt.getMessageById.get(input.message_id) as Message | undefined;
      if (!parentMsg) {
        throw new Error(`Message '${input.message_id}' not found`);
      }
      if (parentMsg.recipient_id !== input.agent_id) {
        throw new Error('Only the intended recipient may reply to this message');
      }

      return this.sendMessage({
        sender_id: input.agent_id,
        recipient_id: parentMsg.sender_id,
        content: input.content,
        reply_to: input.message_id,
      });
    },

    listMessages(input: ListMessagesInput): Message[] {
      if (!agentService.agentExists(input.agent_id)) {
        throw new Error(`Agent '${input.agent_id}' not found`);
      }

      // Filter by conversation if provided
      if (input.conversation_id) {
        return this.getConversationMessages(
          input.agent_id,
          input.conversation_id,
          input.limit,
          input.offset
        );
      }

      // Get all messages for this agent (sent or received) - use query for flexibility
      const rawMessages = dbInstance.query(`
        SELECT * FROM messages
        WHERE sender_id = ? OR recipient_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [input.agent_id, input.agent_id, input.limit, input.offset]) as any[];

      // Apply unread filter if needed
      let filtered = rawMessages.map(normalizeMessage);
      if (input.unread_only) {
        filtered = filtered.filter(m => m.recipient_id === input.agent_id && !m.read_at);
      }

      return filtered;
    },

    listConversations(input: ListConversationsInput): Conversation[] {
      if (!agentService.agentExists(input.agent_id)) {
        throw new Error(`Agent '${input.agent_id}' not found`);
      }

      // Get all messages for this agent (sent or received) from database
      const rawMessages = dbInstance.stmt.listMessages.all(input.agent_id, input.agent_id, 500) as any[];
      const allMessages = rawMessages.map(normalizeMessage);

      // Group by conversation partner
      const conversationsMap = new Map<string, { messages: Message[]; partnerId: string }>();

      for (const msg of allMessages) {
        const partnerId = msg.sender_id === input.agent_id ? msg.recipient_id : msg.sender_id;
        if (!conversationsMap.has(partnerId)) {
          conversationsMap.set(partnerId, { messages: [], partnerId });
        }
        conversationsMap.get(partnerId)!.messages.push(msg);
      }

      // Build conversation list
      const conversations: Conversation[] = [];
      for (const [partnerId, { messages }] of conversationsMap.entries()) {
        // Sort messages by created_at descending
        messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const lastMessage = messages[0] || null;
        const unreadCount = messages.filter(m => m.recipient_id === input.agent_id && !m.read_at).length;

        // Get partner display name
        const partnerAgent = agentService.getAgent(partnerId);
        const participantName = partnerAgent?.display_name || partnerId;

        conversations.push({
          participant_id: partnerId,
          participant_name: participantName,
          last_message: lastMessage,
          unread_count: unreadCount,
        });
      }

      // Sort by last message time descending
      conversations.sort((a, b) => {
        const aTime = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
        const bTime = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
        return bTime - aTime;
      });

      // Apply search filter
      let filtered = conversations;
      if (input.search) {
        const searchLower = input.search.toLowerCase();
        filtered = conversations.filter(c =>
          c.participant_id.toLowerCase().includes(searchLower) ||
          c.participant_name.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination in database order (after sorting)
      return filtered.slice(input.offset, input.offset + input.limit);
    },

    markAsRead(agentId: string, conversationId: string): number {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      if (!agentService.agentExists(conversationId)) {
        throw new Error(`Conversation partner '${conversationId}' not found`);
      }

      // Mark all unread messages from this conversation as read for this recipient
      // conversationId is the other participant, so we filter by:
      // - recipient is the current agent
      // - message is from the conversation partner (sender)
      const result = dbInstance.stmt.markMessagesAsRead.run(
        new Date().toISOString(),
        agentId,
        conversationId
      ) as { changes: number };

      return result.changes;
    },

    // Mark specific messages as read
    markMessagesAsRead(agentId: string, messageIds: string[]): number {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }

      let totalChanges = 0;
      for (const msgId of messageIds) {
        const result = dbInstance.query(`
          UPDATE messages SET read_at = datetime('now')
          WHERE id = ? AND recipient_id = ? AND read_at IS NULL
        `, [msgId, agentId]);
        totalChanges += (result as any).changes || 0;
      }
      return totalChanges;
    },

    // Get unread count for an agent
    getUnreadCount(agentId: string): number {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      const result = dbInstance.stmt.countMessagesByRecipient.all(agentId) as any[];
      // Count only unread messages (read_at IS NULL)
      const unreadResult = dbInstance.query(
        'SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read_at IS NULL',
        [agentId]
      );
      return (unreadResult[0] as any).count;
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;