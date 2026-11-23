import {
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Skeleton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
} from '@mui/material';
import { RefreshOutlined, CheckCircle, ReportProblem } from '@mui/icons-material';
import type { ReactNode } from 'react';

interface AttentionItem {
  id: string;
  title: string;
  description?: string;
  type: 'approval' | 'execution';
  status: string;
  created_at?: string;
  href?: string;
}

interface AttentionQueueProps {
  title: string;
  items: AttentionItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  renderItem?: (item: AttentionItem) => ReactNode;
}

export default function AttentionQueue({
  title,
  items,
  loading,
  error,
  onRetry,
  renderItem,
}: AttentionQueueProps) {
  const getStatusColor = (status: string): 'primary' | 'secondary' | 'warning' | 'error' | 'success' => {
    if (status === 'pending') return 'warning';
    if (status === 'approved' || status === 'completed') return 'success';
    if (status === 'rejected' || status === 'failed') return 'error';
    return 'primary';
  };

  const getTypeLabel = (type: string) => (type === 'approval' ? 'Approval' : 'Execution');

  if (loading) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} variant="rectangular" height={64} width="100%" />
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={1}>
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <ReportProblem fontSize="large" color="error" sx={{ mb: 1 }} />
          <Typography variant="body2" color="error" gutterBottom>{title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>{error}</Typography>
          <Button size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CheckCircle fontSize="large" sx={{ mb: 1, color: 'success.main' }} />
            <Typography variant="body2" color="text.secondary">No pending items</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
        <List dense sx={{ p: 0 }}>
          {items.map((item) => (
            <div key={item.id}>
              {renderItem ? (
                renderItem(item)
              ) : (
                <ListItem disablePadding sx={{ '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } } }>
                  <ListItemButton
                    onClick={() => item.href && (window.location.href = item.href || window.location.pathname)}
                    sx={{ py: 1.5, px: 1 }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.title}</Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={getTypeLabel(item.type)}
                            size="small"
                            color={getStatusColor(item.status)}
                            variant="outlined"
                          />
                          {item.description && (
                            <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </div>
          ))}
        </List>
        {items.length > 5 && (
          <Box sx={{ mt: 2 }}>
            <Button size="small" endIcon={<RefreshOutlined />}>
              View All
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}