import type { Message as ApiMessage, Conversation as ApiConversation } from '@shared/types/api';

// Frontend Message type with message_id and status derived from read_at
export interface Message {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied';
  created_at: string;
  read_at: string | null;
  reply_to?: string | null;
}

// Conversation type (re-export from API with any extensions if needed)
export type Conversation = ApiConversation;

// Helper to derive status from read_at
export const getMessageStatus = (msg: ApiMessage, isOutgoing: boolean): Message['status'] => {
  if (isOutgoing) {
    if (!msg.read_at) return 'sent';
    return 'delivered';
  }
  if (!msg.read_at) return 'replied';
  return 'read';
};

// Transform API message to frontend Message type
export const transformMessage = (apiMsg: ApiMessage, currentOwnerId: string): Message => ({
  message_id: apiMsg.id,
  sender_id: apiMsg.sender_id,
  recipient_id: apiMsg.recipient_id,
  content: apiMsg.content,
  status: getMessageStatus(apiMsg, apiMsg.sender_id === currentOwnerId),
  created_at: apiMsg.created_at,
  read_at: apiMsg.read_at,
  reply_to: apiMsg.reply_to || null,
});