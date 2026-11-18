import React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  History,
  Task,
  Description,
  Person,
  Business,
  HowToVote,
  PlayArrow,
  Message,
  Event,
  RefreshOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import { useAppAuth } from '@app/use-app-auth';
import type { ActivityResponse } from '@shared/types/api';

interface ActivityType {
  id: string;
  title: string;
  time: string;
  type: 'task' | 'deliverable' | 'staff' | 'division' | 'approval' | 'execution' | 'message' | 'meeting';
  href?: string;
  metadata?: Record<string, unknown>;
}

const typeIcons: Record<ActivityType['type'], React.ReactElement> = {
  task: <Task fontSize="small" />,
  deliverable: <Description fontSize="small" />,
  staff: <Person fontSize="small" />,
  division: <Business fontSize="small" />,
  approval: <HowToVote fontSize="small" />,
  execution: <PlayArrow fontSize="small" />,
  message: <Message fontSize="small" />,
  meeting: <Event fontSize="small" />,
};

const typeColors: Record<ActivityType['type'], 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'default'> = {
  task: 'primary',
  deliverable: 'info',
  staff: 'secondary',
  division: 'primary',
  approval: 'warning',
  execution: 'success',
  message: 'default',
  meeting: 'default',
};

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { authContext } = useAppAuth();

  const limit = 20;

  const fetchActivity = async (pageNum: number) => {
    try {
      setError(null);
      const response = await apiClient.get<ActivityResponse>('/api/activity', {
        limit,
        offset: pageNum * limit,
      });

      if (pageNum === 0) {
        setActivity(response.activity);
      } else {
        setActivity(prev => [...prev, ...response.activity]);
      }

      setHasMore(response.activity.length === limit);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity(0);
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      fetchActivity(page + 1);
    }
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Activity</Typography>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <History color="action" />
            <Typography variant="h6">Recent Activity</Typography>
            <Chip
              label={authContext?.owner_type === 'founder' ? 'Founder View' : 'User View'}
              size="small"
              color="info"
            />
          </Box>

          {loading && page === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
              <Button
                startIcon={<RefreshOutlined />}
                onClick={() => { setLoading(true); fetchActivity(0); }}
                size="small"
                sx={{ ml: 1 }}
              >
                Retry
              </Button>
            </Alert>
          ) : activity.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No recent activity found
              </Typography>
            </Box>
          ) : (
            <List>
              {activity.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <ListItem
                    disablePadding
                    component={item.href ? ListItemButton : 'div'}
                  >
                    <ListItemIcon>
                      <Chip icon={typeIcons[item.type]} color={typeColors[item.type]} variant="filled" size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(item.time)}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < activity.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}

          {hasMore && !loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                startIcon={<History />}
              >
                Load More
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}