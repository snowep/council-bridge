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
  ListItemIcon,
  ListItemText,
  Box,
} from '@mui/material';
import { RefreshOutlined, CheckCircle, Info } from '@mui/icons-material';
import type { ReactNode } from 'react';

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'task' | 'deliverable' | 'staff' | 'division' | 'approval' | 'execution' | 'message' | 'meeting';
  href?: string;
  metadata?: Record<string, unknown>;
}

interface ActivityListProps {
  title: string;
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  maxItems?: number;
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityItem['type'], { icon: ReactNode; label: string; color: string }> = {
  task: { icon: <Info fontSize="small" color="info" />, label: 'Task', color: 'info' },
  deliverable: { icon: <CheckCircle fontSize="small" color="success" />, label: 'Deliverable', color: 'success' },
  staff: { icon: <CheckCircle fontSize="small" color="success" />, label: 'Staff', color: 'success' },
  division: { icon: <CheckCircle fontSize="small" color="primary" />, label: 'Division', color: 'primary' },
  approval: { icon: <CheckCircle fontSize="small" color="warning" />, label: 'Approval', color: 'warning' },
  execution: { icon: <CheckCircle fontSize="small" color="secondary" />, label: 'Execution', color: 'secondary' },
  message: { icon: <CheckCircle fontSize="small" color="primary" />, label: 'Message', color: 'primary' },
  meeting: { icon: <CheckCircle fontSize="small" color="warning" />, label: 'Meeting', color: 'warning' },
};

export default function ActivityList({
  title,
  items,
  loading,
  error,
  onRetry,
  maxItems = 10,
}: ActivityListProps) {
  if (loading) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} variant="rectangular" height={56} width="100%" />
            ))}
          </Box>
        </CardContent>
      </Card>
  );
  }

  if (error) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="error" gutterBottom>Failed to load activity</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>{error}</Typography>
            <Button size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>Retry</Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Info fontSize="large" sx={{ mb: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">No recent activity</Typography>
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
          {displayItems.map((item, idx) => {
            const config = ACTIVITY_TYPE_CONFIG[item.type];
            return (
              <ListItem
                key={item.id}
                disablePadding
                sx={{
                  borderBottom: idx < displayItems.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  onClick={() => item.href && (window.location.href = item.href || window.location.pathname)}
                  sx={{ py: 1.5, px: 1, cursor: item.href ? 'pointer' : 'default' }}
                  aria-label={item.href ? item.title : undefined}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: config.color, flexShrink: 0 }}>
                    {config.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" component="span">{item.title}</Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={config.label} size="small" color={config.color as any} variant="outlined" />
                        <Typography variant="caption" color="text.secondary">{item.time}</Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        {items.length > maxItems && (
          <Box sx={{ mt: 2 }}>
            <Button size="small" endIcon={<RefreshOutlined />}>
              View All Activity
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}