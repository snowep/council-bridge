import React from 'react';
import { Paper, Typography, Chip, Box, Tooltip, IconButton, Menu, MenuItem, Divider } from '@mui/material';
import { ContentCopyOutlined, ReplyOutlined, ForwardOutlined, DeleteOutlined, MoreVertOutlined } from '@mui/icons-material';
import type { Message } from '../types';
import { MESSAGE_STATUS_COLORS, type MessageStatusColor, MESSAGE_STATUS_LABELS, formatTime } from '../constants';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  onReply?: (message: Message) => void;
  onCopy?: (content: string) => void;
  onForward?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

const getStatusColor = (status: Message['status']): MessageStatusColor => {
  return status in MESSAGE_STATUS_COLORS ? MESSAGE_STATUS_COLORS[status as keyof typeof MESSAGE_STATUS_COLORS] : 'warning';
};

const getStatusLabel = (status: Message['status']): string => {
  return status in MESSAGE_STATUS_LABELS ? MESSAGE_STATUS_LABELS[status] : status;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  onReply,
  onCopy,
  onForward,
  onDelete,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: string) => {
    handleMenuClose();
    switch (action) {
      case 'reply':
        onReply?.(message);
        break;
      case 'copy':
        onCopy?.(message.content);
        break;
      case 'forward':
        onForward?.(message);
        break;
      case 'delete':
        onDelete?.(message.message_id);
        break;
    }
  };

  const statusColor = getStatusColor(message.status);
  const statusLabel = getStatusLabel(message.status);

  const bubbleStyle = {
    maxWidth: '75%',
    padding: '8px 12px',
    borderRadius: 2,
    boxShadow: 1,
    position: 'relative' as const,
    bgcolor: isOutgoing ? 'primary.main' : 'background.paper',
    color: isOutgoing ? 'primary.contrastText' : 'text.primary',
    alignSelf: isOutgoing ? 'flex-end' as const : 'flex-start' as const,
    minWidth: 60,
  };

  const chipStyles = {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    fontSize: '0.625rem',
    height: 18,
    '& .MuiChip-label': { padding: '0 6px' },
    '& .MuiChip-icon': { fontSize: 12 },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <Paper
        elevation={1}
        sx={bubbleStyle}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              opacity: isOutgoing ? 0.8 : 0.6,
              fontSize: '0.65rem',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {formatTime(message.created_at)}
          </Typography>

          {isOutgoing && message.status !== 'read' && message.status !== 'delivered' && (
            <Chip
              label={statusLabel}
              size="small"
              color={statusColor}
              variant="outlined"
              sx={chipStyles}
            />
          )}

          {isOutgoing && message.status === 'read' && (
            <Tooltip title="Read" arrow>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.7,
                  fontSize: '0.65rem',
                  color: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                ✓✓
              </Typography>
            </Tooltip>
          )}

          {!isOutgoing && message.status === 'replied' && (
            <Tooltip title="Replied" arrow>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.7,
                  fontSize: '0.65rem',
                  color: 'info.main',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                ↩
              </Typography>
            </Tooltip>
          )}

          {/* Actions menu for incoming messages */}
          {!isOutgoing && (
            <Tooltip title="Message options" arrow>
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                sx={{ p: 0, opacity: 0, transition: 'opacity 0.2s', ml: 0.5 }}
                aria-label="Message options"
              >
                <MoreVertOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: { sx: { minWidth: 160 } },
          }}
        >
          <MenuItem onClick={() => handleAction('reply')}>
            <ReplyOutlined fontSize="small" sx={{ mr: 1 }} />
            Reply
          </MenuItem>
          <MenuItem onClick={() => handleAction('copy')}>
            <ContentCopyOutlined fontSize="small" sx={{ mr: 1 }} />
            Copy
          </MenuItem>
          <MenuItem onClick={() => handleAction('forward')}>
            <ForwardOutlined fontSize="small" sx={{ mr: 1 }} />
            Forward
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
            <DeleteOutlined fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
            Delete
          </MenuItem>
        </Menu>
      </Paper>
    </Box>
  );
};