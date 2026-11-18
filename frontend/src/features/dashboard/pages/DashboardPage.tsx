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
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
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
  ChatOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import { useNavigate } from 'react-router-dom';
import type { Division, StaffAgent, ApprovalRequest } from '@shared/types/api';

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'deliverable' | 'task' | 'staff' | 'meeting' | 'execution' | 'approval' | 'message';
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
  message: { icon: <ChatOutlined fontSize="small" color="primary" />, label: 'Message', color: 'primary' },
};

interface DivisionForm {
  name: string;
  description: string;
}

interface StaffForm {
  name: string;
  role: string;
  division_id: string;
}

interface TaskForm {
  title: string;
  description: string;
  assigned_to_type: 'division' | 'staff';
  assigned_to_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';
  href?: string;
  onClick?: () => void;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  // Quick Actions - defined here to have access to dialog state
  const quickActions: QuickAction[] = [
    { label: 'Create Division', icon: <Business fontSize="small" />, color: 'primary', onClick: () => setCreateDivisionDialogOpen(true) },
    { label: 'Invite Staff', icon: <People fontSize="small" />, color: 'secondary', onClick: () => setInviteStaffDialogOpen(true) },
    { label: 'Review Approvals', icon: <Gavel fontSize="small" />, href: '/approvals', color: 'warning' },
    { label: 'New Task', icon: <Add fontSize="small" />, href: '/tasks?create', color: 'info' },
  ];

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

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Dialog states
  const [createDivisionDialogOpen, setCreateDivisionDialogOpen] = useState(false);
  const [inviteStaffDialogOpen, setInviteStaffDialogOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Form states
  const [divisionForm, setDivisionForm] = useState<DivisionForm>({ name: '', description: '' });
  const [staffForm, setStaffForm] = useState<StaffForm>({ name: '', role: '', division_id: '' });
  const [taskForm, setTaskForm] = useState<TaskForm>({
    title: '',
    description: '',
    assigned_to_type: 'division',
    assigned_to_id: '',
    priority: 'medium',
  });

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

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Create Division handler
  const handleCreateDivision = async () => {
    if (!divisionForm.name.trim()) {
      showSnackbar('Division name is required', 'error');
      return;
    }

    setSubmittingAction(true);
    try {
      await apiClient.post('/api/divisions', {
        name: divisionForm.name,
        description: divisionForm.description,
      });
      showSnackbar('Division created successfully');
      setCreateDivisionDialogOpen(false);
      setDivisionForm({ name: '', description: '' });
      fetchSection('divisions');
    } catch (err: any) {
      console.error('Failed to create division:', err);
      showSnackbar(err?.response?.data?.error || 'Failed to create division', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Invite Staff handler
  const handleInviteStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.role.trim() || !staffForm.division_id) {
      showSnackbar('Name, role, and division are required', 'error');
      return;
    }

    setSubmittingAction(true);
    try {
      await apiClient.post('/api/staff', {
        name: staffForm.name,
        role: staffForm.role,
        division_id: staffForm.division_id,
        status: 'pending',
        runtime_instances: [],
        permissions: [],
      });
      showSnackbar('Staff invitation sent successfully');
      setInviteStaffDialogOpen(false);
      setStaffForm({ name: '', role: '', division_id: '' });
      fetchSection('staff');
    } catch (err: any) {
      console.error('Failed to invite staff:', err);
      showSnackbar(err?.response?.data?.error || 'Failed to invite staff', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create Task handler
  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.assigned_to_id) {
      showSnackbar('Title and assignment are required', 'error');
      return;
    }

    setSubmittingAction(true);
    try {
      await apiClient.post('/api/tasks', {
        title: taskForm.title,
        description: taskForm.description,
        assigned_to_type: taskForm.assigned_to_type,
        assigned_to_id: taskForm.assigned_to_id,
        created_by_type: 'founder',
        created_by_id: 'founder',
        status: 'pending',
        priority: taskForm.priority,
      });
      showSnackbar('Task created successfully');
      setCreateTaskDialogOpen(false);
      setTaskForm({
        title: '',
        description: '',
        assigned_to_type: 'division',
        assigned_to_id: '',
        priority: 'medium',
      });
      navigate('/tasks');
    } catch (err: any) {
      console.error('Failed to create task:', err);
      showSnackbar(err?.response?.data?.error || 'Failed to create task', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Get division options for select
  const divisionOptions = divisions;
  const staffOptions = staff.filter(s => s.status === 'active' || s.status === 'pending');

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
    retryKey: keyof typeof loading;
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
      retryKey: 'divisions',
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
      retryKey: 'staff',
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
      retryKey: 'approvals',
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
            <StatCard stat={stat} onRetry={() => handleRetry(stat.retryKey)} />
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: config.color, flexShrink: 0 }}>
                          {config.icon}
                        </ListItemIcon>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" component="span">{item.title}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip label={config.label} size="small" color={config.color as any} variant="outlined" />
                            <Typography variant="caption" color="text.secondary" component="span">{item.time}</Typography>
                          </Box>
                        </Box>
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
              {quickActions.map((action, idx) => (
                <Tooltip key={idx} title={action.onClick ? undefined : (action.href ? 'Navigate' : '')}>
                  <Button
                    variant="outlined"
                    startIcon={action.icon}
                    onClick={action.onClick || (() => action.href && navigate(action.href))}
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
                </Tooltip>
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Need more? Visit the <Link underline="hover" onClick={() => navigate('/organization')}>Organization</Link> page for full management.
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Create Division Dialog */}
      <Dialog open={createDivisionDialogOpen} onClose={() => setCreateDivisionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Division</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateDivision(); }}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="Division Name"
                value={divisionForm.name}
                onChange={(e) => setDivisionForm(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Enter division name"
                autoFocus
              />
              <TextField
                fullWidth
                label="Description"
                value={divisionForm.description}
                onChange={(e) => setDivisionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter division description"
                multiline
                rows={3}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ pr: 2 }}>
            <Button onClick={() => setCreateDivisionDialogOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submittingAction}>
              {submittingAction ? 'Creating...' : 'Create Division'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Invite Staff Dialog */}
      <Dialog open={inviteStaffDialogOpen} onClose={() => setInviteStaffDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Staff</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); handleInviteStaff(); }}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="Staff Name"
                value={staffForm.name}
                onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Enter staff member name"
                autoFocus
              />
              <TextField
                fullWidth
                label="Role"
                value={staffForm.role}
                onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                required
                placeholder="Enter role/position"
              />
              <FormControl fullWidth>
                <InputLabel id="invite-division-label">Division</InputLabel>
                <Select
                  labelId="invite-division-label"
                  value={staffForm.division_id}
                  label="Division"
                  onChange={(e) => setStaffForm(prev => ({ ...prev, division_id: e.target.value as string }))}
                  required
                >
                  {divisionOptions.length > 0 ? (
                    divisionOptions.map((d) => (
                      <MenuItem key={d.division_id} value={d.division_id}>
                        {d.name}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>No divisions available</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ pr: 2 }}>
            <Button onClick={() => setInviteStaffDialogOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submittingAction}>
              {submittingAction ? 'Inviting...' : 'Invite Staff'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={createTaskDialogOpen} onClose={() => setCreateTaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Task</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTask(); }}>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="Task Title"
                value={taskForm.title}
                onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="Enter task title"
                autoFocus
              />
              <TextField
                fullWidth
                label="Description"
                value={taskForm.description}
                onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                multiline
                rows={3}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="task-type-label">Assign To</InputLabel>
                  <Select
                    labelId="task-type-label"
                    value={taskForm.assigned_to_type}
                    label="Assign To"
                    onChange={(e) => setTaskForm(prev => ({
                      ...prev,
                      assigned_to_type: e.target.value as 'division' | 'staff',
                      assigned_to_id: '',
                    }))}
                  >
                    <MenuItem value="division">Division</MenuItem>
                    <MenuItem value="staff">Staff Agent</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="task-assignee-label">Assignee</InputLabel>
                  <Select
                    labelId="task-assignee-label"
                    value={taskForm.assigned_to_id}
                    label="Assignee"
                    onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to_id: e.target.value as string }))}
                    required
                    disabled={!taskForm.assigned_to_type}
                  >
                    {taskForm.assigned_to_type === 'division' ? (
                      divisionOptions.map((d) => (
                        <MenuItem key={d.division_id} value={d.division_id}>
                          {d.name}
                        </MenuItem>
                      ))
                    ) : (
                      staffOptions.map((s) => (
                        <MenuItem key={s.staff_id} value={s.staff_id}>
                          {s.name} ({s.role})
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Box>
              <FormControl fullWidth>
                <InputLabel id="task-priority-label">Priority</InputLabel>
                <Select
                  labelId="task-priority-label"
                  value={taskForm.priority}
                  label="Priority"
                  onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ pr: 2 }}>
            <Button onClick={() => setCreateTaskDialogOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submittingAction}>
              {submittingAction ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} sx={{ width: '100%' }} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
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