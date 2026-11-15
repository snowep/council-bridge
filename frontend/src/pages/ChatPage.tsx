import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Avatar,
  Chip,
} from '@mui/material';
import { ChatOutlined, SendOutlined, PersonOutlined, AccountBalanceOutlined, BusinessOutlined } from '@mui/icons-material';
import { apiClient } from '../services/api';
import type { Message, Conversation } from '../types/api';
import { useAppAuth } from '../app/App';

const ParticipantIcon = ({ type, size = 'small' }: { type: string; size?: 'small' | 'medium' | 'large' }) => {
  switch (type) {
    case 'founder':
    case 'council':
      return <AccountBalanceOutlined fontSize={size} />;
    case 'staff':
      return <PersonOutlined fontSize={size} />;
    case 'division':
      return <BusinessOutlined fontSize={size} />;
    default:
      return <PersonOutlined fontSize={size} />;
  }
};

const PARTICIPANT_COLORS = {
  founder: 'secondary',
  council: 'primary',
  staff: 'default',
  division: 'success',
};

const getParticipantType = (id: string) => {
  if (id === 'founder') return 'founder';
  if (id.startsWith('seat-') || id.startsWith('council-')) return 'council';
  if (id.startsWith('staff-')) return 'staff';
  if (id.startsWith('division-')) return 'division';
  return 'staff';
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatPage() {
  const { authContext } = useAppAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  const fetchConversations = async () => {
    try {
      const response = await apiClient.get<Conversation[]>('/api/messages/conversations');
      // Handle response that might be an object with error or empty array
      setConversations(Array.isArray(response) ? response : []);
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await apiClient.get<Message[]>(`/api/messages/${conversationId}`);
      setMessages(Array.isArray(response) ? response : []);
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.participant_id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      const response = await apiClient.post<Message>('/api/messages', {
        recipient_id: selectedConversation.participant_id,
        content,
      });
      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      console.error('Failed to send message:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {/* Conversation List */}
      <Paper sx={{ width: 380, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Conversations</Typography>
        </Box>
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            placeholder="Search conversations..."
            size="small"
            fullWidth
          />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {conversations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">No conversations yet</Typography>
            </Box>
          ) : (
            <List>
              {conversations.map((conv) => {
                const type = getParticipantType(conv.participant_id);
                return (
                  <ListItem
                    key={conv.participant_id}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <ListItemButton
                      selected={selectedConversation?.participant_id === conv.participant_id}
                      onClick={() => handleSelectConversation(conv)}
                    >
                      <Avatar sx={{ bgcolor: PARTICIPANT_COLORS[type] + '.main' }}>
                        <ParticipantIcon type={type} size="small" />
                      </Avatar>
                      <ListItemText
                        primary={conv.participant_name}
                        secondary={conv.last_message?.content || 'No messages yet'}
                      />
                      {conv.unread_count > 0 && (
                        <Chip label={conv.unread_count} size="small" color="primary" variant="outlined" />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Paper>

      {/* Message View */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedConversation ? (
          <>
            <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: PARTICIPANT_COLORS[getParticipantType(selectedConversation.participant_id)] + '.main' }}>
                  <ParticipantIcon type={getParticipantType(selectedConversation.participant_id)} size="small" />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{selectedConversation.participant_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedConversation.participant_id}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {messages.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
                </Box>
              ) : (
                messages.map((msg) => (
                  <Box
                    key={msg.message_id}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.sender_id === authContext?.owner_id ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      sx={{
                        maxWidth: '70%',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: msg.sender_id === authContext?.owner_id ? 'primary.main' : 'background.paper',
                        color: msg.sender_id === authContext?.owner_id ? 'primary.contrastText' : 'text.primary',
                        boxShadow: 1,
                      }}
                    >
                      <Typography variant="body2">{msg.content}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5, textAlign: 'right' }}>
                        {formatTime(msg.created_at)}
                      </Typography>
                    </Paper>
                  </Box>
                ))
              )}
            </Box>

            <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  multiline
                  rows={1}
                  maxRows={4}
                  size="small"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                />
                <Button variant="contained" startIcon={<SendOutlined />} disabled={!newMessage.trim()} onClick={sendMessage}>
                  Send
                </Button>
              </Box>
            </Paper>
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h6" color="text.secondary">Select a conversation to start messaging</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}