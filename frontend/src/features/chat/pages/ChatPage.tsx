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
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import type { Message, Conversation } from '@shared/types/api';
import { useAppAuth } from '@app/use-app-auth';
import { useTheme } from '@mui/material/styles';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      setFetchError(null);
      const response = await apiClient.get<Conversation[]>('/api/messages/conversations');
      const list = Array.isArray(response) ? response : [];
      setConversations(list);
      setFilteredConversations(list);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to fetch conversations';
      setFetchError(msg);
      console.error('Failed to fetch conversations:', err);
      setConversations([]);
      setFilteredConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setFetchError(null);
      const response = await apiClient.get<Message[]>(`/api/messages/${conversationId}`);
      setMessages(Array.isArray(response) ? response : []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to fetch messages';
      setFetchError(msg);
      console.error('Failed to fetch messages:', err);
      setMessages([]);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.participant_id);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const handleSearch = useCallback((value: string) => {
    const filtered = conversations.filter(conv =>
      conv.participant_name.toLowerCase().includes(value.toLowerCase()) ||
      conv.participant_id.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredConversations(filtered);
  }, [conversations]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedConversation || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const response = await apiClient.post<Message>('/api/messages', {
        recipient_id: selectedConversation.participant_id,
        content,
      });
      setMessages(prev => [...prev, response]);
      setNewMessage('');
      // Update conversation list with new last message
      setConversations(prev => prev.map(conv =>
        conv.participant_id === selectedConversation.participant_id
          ? { ...conv, last_message: response }
          : conv
      ));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to send message';
      setSendError(msg);
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const retrySend = () => {
    sendMessage(new Event('submit') as unknown as React.FormEvent);
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    handleSearch('');
  }, [handleSearch]);

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
          {filteredConversations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                {fetchError ? 'Failed to load conversations' : 'No conversations yet'}
              </Typography>
              {fetchError && (
                <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchConversations} sx={{ mt: 2 }}>
                  Retry
                </Button>
              )}
            </Box>
          ) : (
            <List>
              {filteredConversations.map((conv) => {
                const type = getParticipantType(conv.participant_id);
                return (
                  <ListItem key={conv.participant_id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
      </Drawer>

      {/* Desktop Conversation List / Mobile Toggle Button */}
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
          {filteredConversations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                {fetchError ? 'Failed to load conversations' : 'No conversations yet'}
              </Typography>
              {fetchError && (
                <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchConversations} sx={{ mt: 2 }}>
                  Retry
                </Button>
              )}
            </Box>
          ) : (
            <List>
              {filteredConversations.map((conv) => {
                const type = getParticipantType(conv.participant_id);
                return (
                  <ListItem key={conv.participant_id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
    </Box>
  );
}