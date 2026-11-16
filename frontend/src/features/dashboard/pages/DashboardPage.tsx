import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Link,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  RefreshOutlined,
  Add,
  People,
  Business,
  Gavel,
  Assignment,
  TrendingUp,
  Visibility,
  ErrorOutlined,
  Info,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import { useNavigate } from 'react-router-dom';
import type { Division, StaffAgent, ApprovalRequest } from '@shared/types/api';

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'deliverable' | 'task' | 'staff' | 'meeting' | 'execution' | 'approval';
  href?: string;
  metadata?: Record<string, string>;
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityItem['type'], { icon: React.ReactNode; label: string; color: string }> = {
  deliverable: { icon: <Assignment fontSize="small" color="primary" />, label: 'Deliverable', color: 'primary' },
  task: { icon: <TrendingUp fontSize="small" color="secondary" />, label: 'Task', color: 'secondary' },
  staff: { icon: <People fontSize="small" color="success" />, label: 'Staff', color: 'success' },
  meeting: { icon: <Gavel fontSize="small" color="warning" />, label: 'Meeting', color: 'warning' },
  execution: { icon: <Visibility fontSize="small" color="info" />, label: 'Execution', color: 'info' },
  approval: { icon: <Business fontSize="small" color="error" />, label: 'Approval', color: 'error' },
};

const QUICK_ACTIONS = [
  { label: 'Create Division', icon: <Business fontSize="small" />, href: '/organization', color: 'primary' },
  { label: 'Invite Staff', icon: <People fontSize="small" />, href: '/organization?tab=staff', color: 'secondary' },
  { label: 'Review Approvals', icon: <Gavel fontSize="small" />, href: '/approvals', color: 'warning' },
  { label: 'New Task', icon: <Add fontSize="small" />, href: '/tasks?create', color: 'info' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [staff, setStaff] = useState<StaffAgent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({
    divisions: true,
    staff: true,
    approvals: true,
    activity: true,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({
    divisions: null,
    staff: null,
    approvals: null,
    activity: null,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchSection = useCallback(async (section: keyof typeof loading) => {
    setLoading(prev => ({ ...prev, [section]: true }));
    setErrors(prev => ({ ...prev, [section]: null }));

    try {
      switch (section) {
        case 'divisions': {
          const res = await apiClient.get<{ divisions: Division[] }>('/api/divisions');
          setDivisions(Array.isArray(res?.divisions) ? res.divisions : []);
          break;
        }
        case 'staff': {
          const res = await apiClient.get<{ staff: StaffAgent[] }>('/api/staff');
          setStaff(Array.isArray(res?.staff) ? res.staff : []);
          break;
        }
        case 'approvals': {
          const res = await apiClient.get<{ data: ApprovalRequest[] }>('/api/approvals');
          const apprList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          setApprovals(apprList);
          break;
        }
        case 'activity': {
          try {
            const res = await apiClient.get<{ activity: ActivityItem[] }>('/api/activity');
            setActivity(Array.isArray(res?.activity) ? res.activity : []);
          } catch {
            setActivity([]);
          }
          break;
        }
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || err.message || `Failed to fetch ${section}`;
      setErrors(prev => ({ ...prev, [section]: message }));
      console.error(`Dashboard fetch error (${section}):`, err);
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }));
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    await Promise.all([
      fetchSection('divisions'),
      fetchSection('staff'),
      fetchSection('approvals'),
      fetchSection('activity'),
    ]);
    setLastRefreshed(new Date());
  }, [fetchSection]);

  const handleRetry = (section: keyof typeof loading) => {
    fetchSection(section);
  };

  const handleQuickAction = (href: string) => {
    navigate(href);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const activeDivisions = divisions.filter(d => d.head_staff_id).length;
  const totalDivisions = divisions.length;
  const activeStaff = staff.filter(s => s.status === 'active').length;
  const totalStaff = staff.length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const totalApprovals = approvals.length;

  type MuiColor = 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';

  const stats: Array<{
    label: string;
    value: number;
    secondary: string;
    icon: React.ReactNode;
    color: MuiColor;
    loading: boolean;
    error: string | null;
    onClick: () => void;
    emptyAction: { label: string; href: string } | null;
  }> = [
    {
      label: 'Active Divisions',
      value: activeDivisions,
      secondary: `${totalDivisions} total`,
      icon: <Business fontSize="large" />,
      color: 'primary',
      loading: loading.divisions,
      error: errors.divisions,
      onClick: () => navigate('/organization'),
      emptyAction: totalDivisions === 0 ? { label: 'Create Division', href: '/organization' } : null,
    },
    {
      label: 'Staff Agents',
      value: activeStaff,
      secondary: `${totalStaff} total`,
      icon: <People fontSize="large" />,
      color: 'secondary',
      loading: loading.staff,
      error: errors.staff,
      onClick: () => navigate('/organization?tab=staff'),
      emptyAction: totalStaff === 0 ? { label: 'Invite Staff', href: '/organization?tab=staff' } : null,
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals,
      secondary: `${totalApprovals} total`,
      icon: <Gavel fontSize="large" />,
      color: 'warning',
      loading: loading.approvals,
      error: errors.approvals,
      onClick: () => navigate('/approvals'),
      emptyAction: totalApprovals === 0 && totalStaff > 0 ? { label: 'No pending approvals', href: '/approvals' } : null,
    },
  ];

  const isFullyLoaded = Object.values(loading).every(v => !v);
  const hasAnyError = Object.values(errors).some(e => e !== null);

  if (!isFullyLoaded && divisions.length === 0 && staff.length === 0 && approvals.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Founder Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time overview of your organization — click any stat to take action
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastRefreshed && (
            <Tooltip title={lastRefreshed.toLocaleString()}>
              <Typography variant="caption" color="text.secondary">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </Typography>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={fetchDashboardData}
            size="small"
            disabled={Object.values(loading).some(v => v)}
            aria-label="Refresh all dashboard data"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {hasAnyError && (
        <Alert severity="warning" sx={{ mb: 3 }} action={
          <Button size="small" onClick={fetchDashboardData} startIcon={<RefreshOutlined />}>
            Retry Failed
          </Button>
        }>
          Some sections failed to load. Data shown may be incomplete.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3, mb: 4 }}>
        {stats.map((stat, index) => (
          <Box key={index}>
            <StatCard stat={stat} onRetry={() => handleRetry(stat.label.toLowerCase().replace(' ', '') as keyof typeof loading)} />
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, '@media (min-width: 1024px)': { gridTemplateColumns: '2fr 1fr' } }}>
        <Box>
          <Paper elevation={1} sx={{ p: 3, height: '100%', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Activity</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="text" size="small" onClick={() => navigate('/activity')}>
                  View All
                </Button>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {loading.activity ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} variant="rectangular" height={56} width="100%" />
                ))}
              </Box>
            ) : activity.length > 0 ? (
              <List dense sx={{ flex: 1, overflow: 'auto' }}>
                {activity.slice(0, 10).map((item, idx) => {
                  const config = ACTIVITY_TYPE_CONFIG[item.type];
                  return (
                    <ListItem key={item.id || idx} disablePadding sx={{ borderBottom: idx < 9 ? '1px solid' : 'none', borderColor: 'divider' }}>
                      <ListItemButton
                        onClick={() => item.href && navigate(item.href)}
                        sx={{
                          px: 0,
                          py: 1,
                          cursor: item.href ? 'pointer' : 'default',
                          '&:hover': item.href ? { bgcolor: 'action.hover' } : {},
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: config.color }}>
                          {config.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.title}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Chip label={config.label} size="small" color={config.color as any} variant="outlined" />
                              <Typography variant="caption" color="text.secondary">{item.time}</Typography>
                            </Box>
                          }
                        />
                        {item.href && (
                          <ListItemSecondaryAction>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(item.href!); }} aria-label="View details">
                              <Visibility fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
                <Info fontSize="large" sx={{ mb: 2, color: 'text.secondary' }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>No recent activity</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                  Activity appears here when tasks, approvals, meetings, and executions happen across your organization.
                </Typography>
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => navigate('/tasks?create')} sx={{ mt: 2 }}>
                  Create your first task
                </Button>
              </Box>
            )}
          </Paper>
        </Box>

        <Box>
          <Paper elevation={1} sx={{ p: 3, height: '100%', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Quick Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
              {QUICK_ACTIONS.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outlined"
                  startIcon={action.icon}
                  onClick={() => handleQuickAction(action.href)}
                  fullWidth
                  size="large"
                  sx={{
                    justifyContent: 'flex-start',
                    px: 2,
                    py: 1.5,
                    borderColor: `${action.color}.main`,
                    color: `${action.color}.main`,
                    '&:hover': {
                      bgcolor: `${action.color}.50`,
                      borderColor: `${action.color}.dark`,
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Need more? Visit the <Link underline="hover" onClick={() => navigate('/organization')}>Organization</Link> page for full management.
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

interface StatCardProps {
  stat: {
    label: string;
    value: number;
    secondary: string;
    icon: React.ReactNode;
    color: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';
    loading: boolean;
    error: string | null;
    onClick: () => void;
    emptyAction?: { label: string; href: string } | null;
  };
  onRetry: () => void;
}

function StatCard({ stat, onRetry }: StatCardProps) {
  const { label, value, secondary, icon, color, loading, error, onClick, emptyAction } = stat;

  if (loading) {
    return (
      <Card elevation={1} sx={{ height: '100%', minHeight: 160 }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={16} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={1} sx={{ height: '100%', minHeight: 160 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 2 }}>
            <ErrorOutlined fontSize="large" color="error" sx={{ mb: 1 }} />
            <Typography variant="body2" color="error" gutterBottom>{label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, maxWidth: 200 }}>{error}</Typography>
            <Button size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>Retry</Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={1}
      sx={{
        height: '100%',
        minHeight: 160,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: `${color}.50`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{secondary}</Typography>
        {emptyAction && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              size="small"
              variant="outlined"
              fullWidth
              startIcon={<Add fontSize="small" />}
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              {emptyAction.label}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}