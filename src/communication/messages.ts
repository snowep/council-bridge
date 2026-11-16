import { z } from 'zod/v4';
import { DatabaseInstance } from '../database.js';
import { AgentService } from './agents.js';

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
  unreadOnly: z.boolean().default(false),
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
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  participant_id: string;
  participant_name: string;
  last_message: Message | null;
  unread_count: number;
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
      return msg ? { ...msg, message_id: msg.id, status: msg.read_at ? 'read' : 'sent' } : msg;
    },

    checkInbox(agentId: string, conversationId?: string): Message[] {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      // Use listMessages to get BOTH sent and received messages
      const rawMessages = dbInstance.stmt.listMessages.all(agentId, agentId, 50) as any[];
      const normalized = rawMessages.map(m => ({ ...m, message_id: m.id, status: m.read_at ? 'read' : 'sent' }));
      if (conversationId) {
        // Get messages for a specific conversation
        return normalized.filter((m: Message) =>
          m.sender_id === conversationId || m.recipient_id === conversationId
        );
      }
      return normalized;
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
      const messages = dbInstance.stmt.listMessages.all(input.agent_id, input.agent_id, input.limit) as any[];
      return messages.map(m => ({ ...m, message_id: m.id, status: m.read_at ? 'read' : 'sent' }));
    },

    listConversations(input: ListConversationsInput): Conversation[] {
      if (!agentService.agentExists(input.agent_id)) {
        throw new Error(`Agent '${input.agent_id}' not found`);
      }

      // Get all messages for this agent (sent or received)
      const rawMessages = dbInstance.stmt.listMessages.all(input.agent_id, input.agent_id, 500) as any[];
      const allMessages = rawMessages.map(m => ({ ...m, message_id: m.id, status: m.read_at ? 'read' : 'sent' }));

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

      // Apply pagination
      return filtered.slice(input.offset, input.offset + input.limit);
    },

    markAsRead(agentId: string, conversationId: string): void {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      // Mark all unread messages from this conversation as read
      dbInstance.stmt.markMessagesAsRead.run(agentId, conversationId, new Date().toISOString());
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;