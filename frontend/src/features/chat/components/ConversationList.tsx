import React from 'react';
import { Box, List, ListItem, ListItemButton, Avatar, Chip, Typography, TextField, IconButton, Button, InputAdornment } from '@mui/material';
import { SearchOutlined, RefreshOutlined, AddOutlined, ChatOutlined } from '@mui/icons-material';
import type { Conversation } from '../types';
import { ParticipantIcon, PARTICIPANT_COLORS, getParticipantType, formatTime } from '../constants';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelect: (conv: Conversation) => void;
  fetchError: string | null;
  onRetry: () => void;
  onNewConversation: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
  showHeader?: boolean;
  showSearch?: boolean;
  variant?: 'sidebar' | 'drawer';
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversation,
  onSelect,
  fetchError,
  onRetry,
  onNewConversation,
  searchValue,
  onSearchChange,
  loading = false,
  showHeader = true,
  showSearch = true,
  variant = 'sidebar',
}) => {
  if (conversations.length === 0 && !loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <ChatOutlined sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="body1" color="text.secondary">
            {fetchError ? 'Unable to load conversations' : 'No conversations yet'}
          </Typography>
          {fetchError && (
            <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={onRetry}>
              Retry
            </Button>
          )}
          {!fetchError && (
            <Button variant="contained" startIcon={<AddOutlined />} onClick={onNewConversation}>
              Start Conversation
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {showHeader && (
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Conversations</Typography>
            {variant === 'drawer' && (
              <IconButton onClick={onNewConversation} aria-label="Start new conversation">
                <AddOutlined />
              </IconButton>
            )}
          </Box>
          {showSearch && (
            <TextField
              placeholder="Search conversations..."
              size="small"
              fullWidth
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchOutlined color="action" sx={{ mr: 1 }} /></InputAdornment> }
              }}
            />
          )}
          {!showSearch && variant === 'sidebar' && (
            <Button variant="outlined" fullWidth startIcon={<AddOutlined />} onClick={onNewConversation}>
              New Conversation
            </Button>
          )}
        </Box>
      )}

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 32, height: 32 }} role="status" aria-label="Loading conversations...">
              <svg viewBox="0 0 32 32" style={{ width: '100%', height: '100%', animation: 'spin 1s linear infinite' }}>
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="44, 44" style={{ opacity: 0.25 }} />
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="44, 44" style={{ animation: 'spin 1s linear infinite' }} />
              </svg>
            </Box>
            <Typography variant="body2" color="text.secondary">Loading conversations...</Typography>
          </Box>
        </Box>
      ) : (
        <List sx={{ flex: 1, overflow: 'auto', px: 1 }}>
          {conversations.map((conv) => {
            const type = getParticipantType(conv.participant_id);
            const isSelected = selectedConversation?.participant_id === conv.participant_id;
            const lastMessageTime = conv.last_message?.created_at ? formatTime(conv.last_message.created_at) : '';

            return (
              <ListItem key={conv.participant_id} sx={{ borderBottom: 1, borderColor: 'divider', borderRadius: 1, mx: 0.5, my: 0.25 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => onSelect(conv)}
                  sx={{
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      '&:hover': { bgcolor: 'action.hover' },
                    },
                  }}
                >
                  <Avatar sx={{ bgcolor: PARTICIPANT_COLORS[type] + '.main', width: 40, height: 40 }}>
                    <ParticipantIcon type={type} size="medium" />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.participant_name}
                      </Typography>
                      {lastMessageTime && (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {lastMessageTime}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {conv.last_message?.content || 'No messages yet'}
                      </Typography>
                      {conv.unread_count > 0 && (
                        <Chip
                          label={conv.unread_count > 999 ? '999+' : conv.unread_count > 99 ? '99+' : conv.unread_count}
                          size="small"
                          color="primary"
                          variant="filled"
                          sx={{ height: 20, fontSize: '0.65rem', minWidth: 22, borderRadius: 10 }}
                        />
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
      {variant === 'sidebar' && showSearch && (
        <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" fullWidth startIcon={<AddOutlined />} onClick={onNewConversation}>
            New Conversation
          </Button>
        </Box>
      )}
    </Box>
  );
};