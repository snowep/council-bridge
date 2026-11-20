import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Drawer,
  useMediaQuery,
  Tooltip,
  IconButton,
  InputAdornment,
  Avatar,
} from '@mui/material';
import {
  ChatOutlined,
  SendOutlined,
  Menu as MenuIcon,
  AddOutlined,
} from '@mui/icons-material';
import { apiClient, getErrorMessage } from '@shared/api/client';
import type { Message as ApiMessage } from '@shared/types/api';
import { useAppAuth } from '@app/use-app-auth';
import { useTheme } from '@mui/material/styles';
import { AgentSelectionDialog } from '../components/AgentSelectionDialog';
import { ConversationList } from '../components/ConversationList';
import { MessageBubble } from '../components/MessageBubble';
import {
  ParticipantIcon,
  PARTICIPANT_COLORS,
  getParticipantType,
} from '../constants';
import type { Message, Conversation } from '../types';
import { transformMessage } from '../types';

// Polling configuration
const POLLING_INTERVAL = 3000;
const POLLING_BACKOFF_MAX = 30000;

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
  const [searchValue, setSearchValue] = useState('');
  const [pollingActive, setPollingActive] = useState(true);
  const [pollingErrorCount, setPollingErrorCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationListPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentOwnerId = authContext?.owner_id || 'founder';

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchConversations(value);
    }, 300);
  }, []);

  const fetchConversations = async (search?: string) => {
    try {
      setFetchError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await apiClient.get<{ conversations: Conversation[]; limit: number; offset: number }>(`/api/messages/conversations?${params.toString()}`);
      const list = Array.isArray(response?.conversations) ? response.conversations : [];
      setFilteredConversations(list);
      setPollingErrorCount(0);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to fetch conversations');
      setFetchError(msg);
      console.error('Failed to fetch conversations:', err);
      setFilteredConversations([]);
      setPollingErrorCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string, offset: number = 0) => {
    try {
      setFetchError(null);
      const response = await apiClient.get<{ messages: ApiMessage[]; limit: number; offset: number }>(`/api/messages/${conversationId}?limit=50&offset=${offset}`);
      const apiMessages = Array.isArray(response?.messages) ? response.messages : [];

      const transformedMessages = apiMessages.map(m => transformMessage(m, currentOwnerId));

      if (offset === 0) {
        setMessages(transformedMessages);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setMessages(prev => [...prev, ...transformedMessages]);
      }
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to fetch messages');
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

  const handleNewConversation = (agent: { id: string; name: string; type: string }) => {
    const existing = filteredConversations.find(c => c.participant_id === agent.id);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }
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

    const tempId = `temp-${crypto.randomUUID()}`;
    const tempMessage: Message = {
      message_id: tempId,
      sender_id: currentOwnerId,
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
      const realMessage = transformMessage(response, currentOwnerId);
      setMessages(prev => prev.map(m => m.message_id === tempId ? realMessage : m));
      setFilteredConversations(prev => prev.map(conv =>
        conv.participant_id === selectedConversation.participant_id
          ? { ...conv, last_message: response, unread_count: 0 }
          : conv
      ));
      setPendingFailedMessage(null);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
      const msg = getErrorMessage(err, 'Failed to send message');
      setSendError(msg);
      setPendingFailedMessage(content);
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const [pendingFailedMessage, setPendingFailedMessage] = useState<string | null>(null);

  const retrySend = async () => {
    if (!pendingFailedMessage || !selectedConversation) return;

    setSendError(null);
    try {
      const response = await apiClient.post<ApiMessage>('/api/messages', {
        recipient_id: selectedConversation.participant_id,
        content: pendingFailedMessage,
      });
      const realMessage = transformMessage(response, currentOwnerId);
      setMessages(prev => prev.map(m => m.message_id.startsWith('temp-') ? realMessage : m));
      setFilteredConversations(prev => prev.map(conv =>
        conv.participant_id === selectedConversation.participant_id
          ? { ...conv, last_message: response, unread_count: 0 }
          : conv
      ));
      setPendingFailedMessage(null);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Retry failed');
      setSendError(msg);
    }
  };

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      if (conversationPollRef.current) {
        clearTimeout(conversationPollRef.current);
      }
      if (conversationListPollRef.current) {
        clearTimeout(conversationListPollRef.current);
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Selected conversation polling with exponential backoff on errors
  useEffect(() => {
    if (conversationPollRef.current) {
      clearTimeout(conversationPollRef.current);
    }

    const poll = () => {
      if (selectedConversation && pollingActive) {
        fetchMessages(selectedConversation.participant_id);
        const delay = POLLING_INTERVAL * Math.min(Math.pow(2, pollingErrorCount), POLLING_BACKOFF_MAX / POLLING_INTERVAL);
        conversationPollRef.current = setTimeout(poll, delay);
      }
    };

    if (selectedConversation) {
      poll();
    }

    return () => {
      if (conversationPollRef.current) {
        clearTimeout(conversationPollRef.current);
      }
    };
  }, [selectedConversation, pollingActive, pollingErrorCount]);

  // Conversation list polling
  useEffect(() => {
    if (conversationListPollRef.current) {
      clearTimeout(conversationListPollRef.current);
    }

    const pollList = () => {
      if (!loading && pollingActive) {
        fetchConversations(searchValue);
        conversationListPollRef.current = setTimeout(pollList, POLLING_INTERVAL);
      }
    };

    conversationListPollRef.current = setTimeout(pollList, POLLING_INTERVAL);

    return () => {
      if (conversationListPollRef.current) {
        clearTimeout(conversationListPollRef.current);
      }
    };
  }, [loading, pollingActive, searchValue]);

  // Pause polling when tab hidden (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setPollingActive(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus handled by search input ref in ConversationList
      }
      // Cmd/Ctrl + N: New conversation
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewConversationDialog(true);
      }
      // Escape: Close dialogs/drawer
      if (e.key === 'Escape') {
        setShowNewConversationDialog(false);
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        <ConversationList
          conversations={filteredConversations}
          selectedConversation={selectedConversation}
          onSelect={handleSelectConversation}
          fetchError={fetchError}
          onRetry={() => fetchConversations(searchValue)}
          onNewConversation={() => setShowNewConversationDialog(true)}
          searchValue={searchValue}
          onSearchChange={handleSearch}
          loading={loading}
          variant="drawer"
          showHeader
          showSearch
        />
      </Drawer>

      {/* Desktop Conversation List */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: { sm: 320, md: 350 },
          borderRight: 1,
          borderColor: 'divider',
          flexDirection: 'column',
        }}
      >
        <ConversationList
          conversations={filteredConversations}
          selectedConversation={selectedConversation}
          onSelect={handleSelectConversation}
          fetchError={fetchError}
          onRetry={() => fetchConversations(searchValue)}
          onNewConversation={() => setShowNewConversationDialog(true)}
          searchValue={searchValue}
          onSearchChange={handleSearch}
          loading={loading}
          variant="sidebar"
          showHeader
          showSearch
        />
      </Box>

      {/* Mobile Toggle Button */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', top: 72, left: 16, zIndex: 1200 }}>
        <Tooltip title="Conversations">
          <IconButton onClick={() => setMobileDrawerOpen(true)} aria-label="Open conversations">
            <MenuIcon />
          </IconButton>
        </Tooltip>
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
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                  <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography color="text.secondary" variant="body1">No messages yet</Typography>
                  <Typography color="text.secondary" variant="body2">Send a message to start the conversation</Typography>
                </Box>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.message_id}
                    message={msg}
                    isOutgoing={msg.sender_id === currentOwnerId}
                  />
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
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
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
                    slotProps={{
                      input: {
                        'aria-label': 'Message input',
                        startAdornment: (
                          <InputAdornment position="start" sx={{ pr: 1, opacity: 0.5 }}>
                            <Typography variant="caption">⌘</Typography>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<SendOutlined />}
                  disabled={!newMessage.trim() || sending}
                  onClick={sendMessage}
                  size="large"
                >
                  {sending ? <CircularProgress size={20} color="inherit" /> : 'Send'}
                </Button>
              </Box>
            </Paper>
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <ChatOutlined sx={{ fontSize: 64, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary">Select a conversation to start messaging</Typography>
            <Typography variant="body2" color="text.secondary">Or start a new conversation</Typography>
            <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setShowNewConversationDialog(true)}>
              New Conversation
            </Button>
          </Box>
        )}
      </Box>

      {/* Agent Selection Dialog */}
      <AgentSelectionDialog
        open={showNewConversationDialog}
        onClose={() => setShowNewConversationDialog(false)}
        onSelect={handleNewConversation}
        currentUserId={currentOwnerId}
      />
    </Box>
  );
}