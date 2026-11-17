import { useState, useEffect, useRef, useCallback } from 'react';
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
  IconButton,
  Alert,
  Drawer,
  Divider,
  useMediaQuery,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  ChatOutlined,
  SendOutlined,
  PersonOutlined,
  AccountBalanceOutlined,
  BusinessOutlined,
  SearchOutlined,
  Menu as MenuIcon,
  CloseOutlined,
  RefreshOutlined,
  AddOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import type { Message as ApiMessage, Conversation } from '@shared/types/api';
import { useAppAuth } from '@app/use-app-auth';
import { useTheme } from '@mui/material/styles';
import { AgentSelectionDialog } from '../components/AgentSelectionDialog';

// Frontend Message type with message_id and status derived from read_at
interface Message {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied';
  created_at: string;
  read_at: string | null;
  reply_to?: string | null;
}

// Helper to derive status from read_at
const getMessageStatus = (msg: ApiMessage, isOutgoing: boolean): Message['status'] => {
  if (isOutgoing) {
    if (!msg.read_at) return 'sent';
    return 'delivered';
  }
  if (!msg.read_at) return 'replied';
  return 'read';
};

// Transform API message to frontend Message type
const transformMessage = (apiMsg: ApiMessage, currentOwnerId: string): Message => ({
  message_id: apiMsg.id,
  sender_id: apiMsg.sender_id,
  recipient_id: apiMsg.recipient_id,
  content: apiMsg.content,
  status: getMessageStatus(apiMsg, apiMsg.sender_id === currentOwnerId),
  created_at: apiMsg.created_at,
  read_at: apiMsg.read_at,
  reply_to: apiMsg.reply_to || null,
});

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
  return new Date(dateString + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

type ConversationListProps = {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelect: (conv: Conversation) => void;
  fetchError: string | null;
  onRetry: () => void;
};

const ConversationList = ({
  conversations,
  selectedConversation,
  onSelect,
  fetchError,
  onRetry
}: ConversationListProps) => {
  if (conversations.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          {fetchError ? 'Failed to load conversations' : 'No conversations yet'}
        </Typography>
        {fetchError && (
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={onRetry} sx={{ mt: 2 }}>
            Retry
          </Button>
        )}
      </Box>
    );
  }

  return (
    <List>
      {conversations.map((conv) => {
        const type = getParticipantType(conv.participant_id);
        return (
          <ListItem key={conv.participant_id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <ListItemButton
              selected={selectedConversation?.participant_id === conv.participant_id}
              onClick={() => onSelect(conv)}
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
  );
};

export default function ChatPage() {
  const { authContext } = useAppAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationListPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = async (search?: string) => {
    try {
      setFetchError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await apiClient.get<{ conversations: Conversation[]; limit: number; offset: number }>(`/api/messages/conversations?${params.toString()}`);
      const list = Array.isArray(response?.conversations) ? response.conversations : [];
      setFilteredConversations(list);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to fetch conversations';
      setFetchError(msg);
      console.error('Failed to fetch conversations:', err);
      setFilteredConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string, offset: number = 0) => {
    try {
      setFetchError(null);
      const response = await apiClient.get<{ messages: ApiMessage[]; limit: number; offset: number }>(`/api/messages/${conversationId}?limit=50&offset=${offset}`);
      const apiMessages = Array.isArray(response?.messages) ? response.messages : [];

      // Transform API messages to frontend Message type
      const currentOwnerId = authContext?.owner_id || 'founder';
      const transformedMessages = apiMessages.map(m => transformMessage(m, currentOwnerId));

      if (offset === 0) {
        // Initial load: replace all messages
        // Backend returns ASC order (oldest first), which matches our display order
        // Oldest at top, newest at bottom
        setMessages(transformedMessages);
        // Scroll to bottom to show the latest/newest messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        // Pagination: loading more messages from the API
        // Backend returns ASC order, so we append new messages to the existing ones
        setMessages(prev => [...prev, ...transformedMessages]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to fetch messages';
      setFetchError(msg);
      console.error('Failed to fetch messages:', err);
      if (offset === 0) setMessages([]);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.participant_id, 0);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const handleSearch = useCallback((value: string) => {
    fetchConversations(value);
  }, []);

  const handleNewConversation = (agent: { id: string; name: string; type: string }) => {
    // Check if conversation already exists
    const existing = filteredConversations.find(c => c.participant_id === agent.id);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }
    // Create a new conversation entry optimistically
    const newConv: Conversation = {
      participant_id: agent.id,
      participant_name: agent.name,
      last_message: null,
      unread_count: 0,
    };
    setFilteredConversations(prev => [newConv, ...prev]);
    handleSelectConversation(newConv);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedConversation || sending) return;

    // Optimistic update - use temp- prefixed ID that won't conflict with UUIDs
    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const tempMessage: Message = {
      message_id: tempId,
      sender_id: authContext?.owner_id || 'founder',
      recipient_id: selectedConversation.participant_id,
      content,
      status: 'pending',
      created_at: new Date().toISOString(),
      read_at: null,
      reply_to: null,
    };
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setSending(true);
    setSendError(null);

    try {
      const response = await apiClient.post<ApiMessage>('/api/messages', {
        recipient_id: selectedConversation.participant_id,
        content,
      });
      // Transform response and replace temp message
      const realMessage = transformMessage(response, authContext?.owner_id || 'founder');
      setMessages(prev => prev.map(m => m.message_id === tempId ? realMessage : m));
      // Update conversation list with new last message
      // Use the API message for last_message since Conversation type expects it
      setFilteredConversations(prev => prev.map(conv =>
        conv.participant_id === selectedConversation.participant_id
          ? { ...conv, last_message: response, unread_count: 0 }
          : conv
      ));
      setPendingFailedMessage(null);
    } catch (err: any) {
      // Revert optimistic update and store message for retry
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
      const msg = err?.response?.data?.error || err.message || 'Failed to send message';
      setSendError(msg);
      setPendingFailedMessage(content);
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Track failed message for retry
  const [pendingFailedMessage, setPendingFailedMessage] = useState<string | null>(null);

  const retrySend = async () => {
    if (!pendingFailedMessage || !selectedConversation) return;

    setSendError(null);
    try {
      const response = await apiClient.post<ApiMessage>('/api/messages', {
        recipient_id: selectedConversation.participant_id,
        content: pendingFailedMessage,
      });
      // Transform response and replace temp messages
      const realMessage = transformMessage(response, authContext?.owner_id || 'founder');
      setMessages(prev => prev.map(m => m.message_id.startsWith('temp-') ? realMessage : m));
      // Update conversation list with new last message
      setFilteredConversations(prev => prev.map(conv =>
        conv.participant_id === selectedConversation.participant_id
          ? { ...conv, last_message: response, unread_count: 0 }
          : conv
      ));
      setPendingFailedMessage(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Retry failed';
      setSendError(msg);
    }
  };

  useEffect(() => {
    // Selected conversation polling
    if (conversationPollRef.current) {
      clearInterval(conversationPollRef.current);
    }
    if (selectedConversation) {
      conversationPollRef.current = setInterval(() => {
        fetchMessages(selectedConversation.participant_id);
      }, 3000);
    }
    return () => {
      if (conversationPollRef.current) {
        clearInterval(conversationPollRef.current);
      }
    };
  }, [selectedConversation]);

  // Conversation list polling (every 3 seconds for unread counts - B2-T6)
  useEffect(() => {
    if (conversationListPollRef.current) {
      clearInterval(conversationListPollRef.current);
    }
    conversationListPollRef.current = setInterval(() => {
      if (!loading) {
        fetchConversations();
      }
    }, 3000);

    return () => {
      if (conversationListPollRef.current) {
        clearInterval(conversationListPollRef.current);
      }
    };
  }, [loading]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {/* Mobile Drawer for Conversation List */}
      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: 320, boxSizing: 'border-box' },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Conversations</Typography>
          <IconButton onClick={() => setMobileDrawerOpen(false)}><CloseOutlined /></IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <TextField
            placeholder="Search conversations..."
            size="small"
            fullWidth
            inputRef={searchRef}
            onChange={(e) => handleSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchOutlined color="action" /> } }}
          />
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <ConversationList
            conversations={filteredConversations}
            selectedConversation={selectedConversation}
            onSelect={handleSelectConversation}
            fetchError={fetchError}
            onRetry={fetchConversations}
          />
        </Box>
      </Drawer>

      {/* Desktop Conversation List */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: 380,
          borderRight: 1,
          borderColor: 'divider',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Conversations</Typography>
        </Box>
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            placeholder="Search conversations..."
            size="small"
            fullWidth
            inputRef={searchRef}
            onChange={(e) => handleSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchOutlined color="action" /> } }}
          />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <ConversationList
            conversations={filteredConversations}
            selectedConversation={selectedConversation}
            onSelect={handleSelectConversation}
            fetchError={fetchError}
            onRetry={fetchConversations}
          />
        </Box>
      </Box>

      {/* Mobile Toggle Button */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', top: 72, left: 16, zIndex: 1200 }}>
        <IconButton onClick={() => setMobileDrawerOpen(true)} aria-label="Open conversations">
          <MenuIcon />
        </IconButton>
      </Box>

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

            {fetchError && (
              <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setFetchError(null)}>
                {fetchError}
                <Button size="small" onClick={() => selectedConversation && fetchMessages(selectedConversation.participant_id)}>
                  Retry
                </Button>
              </Alert>
            )}

            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
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
                        position: 'relative',
                      }}
                    >
                      <Typography variant="body2">{msg.content}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5, textAlign: 'right' }}>
                        {formatTime(msg.created_at)}
                      </Typography>
                      {/* Status indicator */}
                      {msg.status === 'failed' && (
                        <Chip
                          label="Failed"
                          size="small"
                          color="error"
                          sx={{ position: 'absolute', top: 4, right: 4 }}
                        />
                      )}
                      {msg.status === 'pending' && (
                        <Chip
                          label="Pending"
                          size="small"
                          color="warning"
                          sx={{ position: 'absolute', top: 4, right: 4 }}
                        />
                      )}
                      {msg.status === 'read' && (
                        <Typography variant="caption" sx={{ position: 'absolute', top: 4, right: 4, color: 'success.main', opacity: 0.6 }}>
                          Read
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              {sendError && (
                <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSendError(null)}>
                  Failed to send: {sendError}
                  <Button size="small" variant="outlined" onClick={retrySend} sx={{ ml: 1 }}>
                    Retry
                  </Button>
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Enter to send, Shift+Enter for new line">
                  <TextField
                    fullWidth
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    multiline
                    rows={1}
                    maxRows={4}
                    size="small"
                    disabled={sending}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    slotProps={{ input: { 'aria-label': 'Message input' } }}
                  />
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<SendOutlined />}
                  disabled={!newMessage.trim() || sending}
                  onClick={sendMessage}
                >
                  {sending ? <CircularProgress size={20} color="inherit" /> : 'Send'}
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

      {/* Floating Action Button for new conversation */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1100 }}>
        <Fab
          color="primary"
          size="medium"
          onClick={() => setShowNewConversationDialog(true)}
          aria-label="Start new conversation"
          sx={{ boxShadow: 3 }}
        >
          <AddOutlined />
        </Fab>
      </Box>

      {/* Agent Selection Dialog */}
      <AgentSelectionDialog
        open={showNewConversationDialog}
        onClose={() => setShowNewConversationDialog(false)}
        onSelect={handleNewConversation}
        currentUserId={authContext?.owner_id || 'founder'}
      />
    </Box>
  );
}