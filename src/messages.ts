import { z } from 'zod/v4';
import { DatabaseInstance } from './database.js';
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
});

export type ListMessagesInput = z.infer<typeof ListMessagesSchema>;

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
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

      return dbInstance.stmt.getMessageById.get(id) as Message;
    },

    checkInbox(agentId: string): Message[] {
      if (!agentService.agentExists(agentId)) {
        throw new Error(`Agent '${agentId}' not found`);
      }
      return dbInstance.stmt.getMessagesByRecipient.all(agentId, 50) as Message[];
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
      return dbInstance.stmt.listMessages.all(input.agent_id, input.agent_id, input.limit) as Message[];
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;