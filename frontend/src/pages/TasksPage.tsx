import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Assignment,
  AssignmentTurnedIn,
  Person,
  Visibility,
  Add,
  History,
  PriorityHigh,
  Flag,
  CheckCircle,
  Cancel,
  Pending,
  Refresh,
  ArrowRight,
  LowPriority,
} from '@mui/icons-material';
import { apiClient } from '../services/api';
import type { Task, TaskStatus, TaskAssignedToType } from '../types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

interface TaskFormData {
  title: string;
  description: string;
  assigned_to_type: TaskAssignedToType;
  assigned_to_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AssignTaskData {
  assigned_to_type: TaskAssignedToType;
  assigned_to_id: string;
}

interface UpdateStatusData {
  status: TaskStatus;
}

const TasksPage: React.FC = () => {
  const [value, setValue] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState<TaskFormData>({
    title: '',
    description: '',
    assigned_to_type: 'division',
    assigned_to_id: '',
    priority: 'medium',
  });

  const [assignForm, setAssignForm] = useState<AssignTaskData>({
    assigned_to_type: 'division',
    assigned_to_id: '',
  });

  const [statusForm, setStatusForm] = useState<UpdateStatusData>({
    status: 'pending',
  });

  const [divisions, setDivisions] = useState<Array<{ division_id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ staff_id: string; name: string; division_id: string }>>([]);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ tasks: Task[], limit: number, offset: number }>('/api/tasks');
      setTasks(Array.isArray(response.tasks) ? response.tasks : []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('Failed to fetch tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisionsAndStaff = async () => {
    try {
      const [divisionsResponse, staffResponse] = await Promise.all([
        apiClient.get<{ divisions: Array<{ division_id: string; name: string }> }>('/api/organization/divisions'),
        apiClient.get<{ staff: Array<{ staff_id: string; name: string; division_id: string }> }>('/api/staff'),
      ]);
      setDivisions(Array.isArray(divisionsResponse.divisions) ? divisionsResponse.divisions : []);
      setStaff(Array.isArray(staffResponse.staff) ? staffResponse.staff : []);
    } catch (err) {
      console.error('Failed to fetch divisions/staff:', err);
      setDivisions([]);
      setStaff([]);
    }
  };

  const fetchTaskDetail = async (taskId: string) => {
    try {
      const response = await apiClient.get<{ task: Task }>(`/api/tasks/${taskId}`);
      setSelectedTask(response.task);
    } catch (err) {
      console.error('Failed to fetch task detail:', err);
      showSnackbar('Failed to fetch task detail', 'error');
      setSelectedTask(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/api/tasks', createForm);
      showSnackbar('Task created successfully');
      setCreateDialogOpen(false);
      setCreateForm({
        title: '',
        description: '',
        assigned_to_type: 'division',
        assigned_to_id: '',
        priority: 'medium',
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      showSnackbar('Failed to create task', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await apiClient.put(`/api/tasks/${selectedTask.task_id}/assign`, assignForm);
      showSnackbar('Task assigned successfully');
      setAssignDialogOpen(false);
      setAssignForm({ assigned_to_type: 'division', assigned_to_id: '' });
      fetchTasks();
      fetchTaskDetail(selectedTask.task_id);
    } catch (err) {
      console.error('Failed to assign task:', err);
      showSnackbar('Failed to assign task', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await apiClient.put(`/api/tasks/${selectedTask.task_id}/status`, statusForm);
      showSnackbar(`Task status updated to ${statusForm.status}`);
      setStatusDialogOpen(false);
      fetchTasks();
      fetchTaskDetail(selectedTask.task_id);
    } catch (err) {
      console.error('Failed to update status:', err);
      showSnackbar('Failed to update status', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setCreateDialogOpen(true);
  };

  const openAssignDialog = (task: Task) => {
    setSelectedTask(task);
    setAssignForm({ assigned_to_type: task.assigned_to_type, assigned_to_id: task.assigned_to_id });
    setAssignDialogOpen(true);
  };

  const openStatusDialog = (task: Task) => {
    setSelectedTask(task);
    setStatusForm({ status: task.status });
    setStatusDialogOpen(true);
  };

  const getAssignedToLabel = (task: Task) => {
    if (task.assigned_to_type === 'division') {
      const div = divisions.find(d => d.division_id === task.assigned_to_id);
      return div ? div.name : task.assigned_to_id;
    }
    const member = staff.find(s => s.staff_id === task.assigned_to_id);
    return member ? member.name : task.assigned_to_id;
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'review':
        return 'warning';
      case 'delegated':
        return 'info';
      case 'accepted':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'primary';
      default:
        return 'success';
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchDivisionsAndStaff();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  const getAssignedToOptions = (type: TaskAssignedToType) => {
    return type === 'division' ? divisions : staff;
  };

  const getOptionId = (option: { division_id?: string; staff_id?: string; name: string }) => {
    return (option as any).division_id || (option as any).staff_id || option.name;
  };

  return (
    <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={value} onChange={handleChange} aria-label="tasks tabs" variant="scrollable" scrollButtons="auto">
            <Tab label="Task List" icon={<Assignment />} />
            <Tab label="Task Detail" icon={<Visibility />} />
            <Tab label="Create Task" icon={<Add />} />
            <Tab label="Assign Task" icon={<Person />} />
            <Tab label="Task Progress" icon={<AssignmentTurnedIn />} />
            <Tab label="Task History" icon={<History />} />
          </Tabs>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreateDialog}
          sx={{ mb: 2 }}
        >
          Create Task
        </Button>

        {/* Tab 0: Task List */}
        <TabPanel value={value} index={0}>
          <Typography variant="h5" gutterBottom>Task List</Typography>
          <Typography variant="body2" color="text.secondary">
            All tasks with title, status, priority, assigned to, created by
          </Typography>

          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Updated At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map(task => (
                  <TableRow key={task.task_id} hover onClick={() => fetchTaskDetail(task.task_id)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{task.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Badge badgeContent={task.status} color={getStatusColor(task.status)} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={task.priority}
                        size="small"
                        color={getPriorityColor(task.priority)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={task.assigned_to_type === 'division' ? 'Division' : 'Staff'}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="body2">{getAssignedToLabel(task)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {task.created_by_type}: {task.created_by_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(task.created_at).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(task.updated_at).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Detail">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); fetchTaskDetail(task.task_id); }}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Assign">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openAssignDialog(task); }}>
                          <Person fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Update Status">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openStatusDialog(task); }}>
                          <Refresh fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {tasks.length === 0 && (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary">No tasks found</Typography>
              <Typography variant="body2" color="text.secondary">Click "Create Task" to add a new task</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Tab 1: Task Detail */}
        <TabPanel value={value} index={1}>
          <Typography variant="h5" gutterBottom>Task Detail</Typography>

          {selectedTask ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 50%', minWidth: '400px' }}>
                <Card elevation={2}>
                  <CardHeader
                    title={selectedTask.title}
                    subheader={selectedTask.description}
                    avatar={
                      <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                        <Assignment />
                      </Avatar>
                    }
                    action={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Assign">
                          <IconButton onClick={() => openAssignDialog(selectedTask)}><Person fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Update Status">
                          <IconButton onClick={() => openStatusDialog(selectedTask)}><Refresh fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Refresh">
                          <IconButton onClick={() => fetchTaskDetail(selectedTask.task_id)}><Refresh fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    }
                  />
                  <CardContent>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Status</Typography>
                        <Badge badgeContent={selectedTask.status} color={getStatusColor(selectedTask.status)} />
                      </Box>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Priority</Typography>
                        <Chip
                          label={selectedTask.priority}
                          size="small"
                          color={getPriorityColor(selectedTask.priority)}
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Assigned To</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={selectedTask.assigned_to_type === 'division' ? 'Division' : 'Staff'}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="body2">{getAssignedToLabel(selectedTask)}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Created By</Typography>
                        <Typography variant="body2">
                          {selectedTask.created_by_type}: {selectedTask.created_by_id}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Created At</Typography>
                        <Typography variant="body2">{new Date(selectedTask.created_at).toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Updated At</Typography>
                        <Typography variant="body2">{new Date(selectedTask.updated_at).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>Description</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedTask.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ flex: '1 1 50%', minWidth: '300px' }}>
                <Card elevation={2}>
                  <CardHeader title="Quick Actions" />
                  <CardContent>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Person />}
                      onClick={() => openAssignDialog(selectedTask!)}
                      sx={{ mb: 1 }}
                    >
                      Assign Task
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => openStatusDialog(selectedTask!)}
                      sx={{ mb: 1 }}
                    >
                      Update Status
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<History />}
                      onClick={() => setValue(5)}
                      sx={{ mb: 1 }}
                    >
                      View History
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AssignmentTurnedIn />}
                      onClick={() => setValue(4)}
                    >
                      View Progress
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary">No task selected</Typography>
              <Typography variant="body2" color="text.secondary">Click on a task in the Task List tab to view details</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Tab 2: Create Task */}
        <TabPanel value={value} index={2}>
          <Typography variant="h5" gutterBottom>Create New Task</Typography>

          <Card elevation={2} sx={{ maxWidth: 800 }}>
            <CardContent>
              <form onSubmit={handleCreateTask}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  <Box sx={{ flex: '1 1 100%' }}>
                    <TextField
                      fullWidth
                      label="Title"
                      value={createForm.title}
                      onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      required
                      placeholder="Enter task title"
                    />
                  </Box>
                  <Box sx={{ flex: '1 1 100%' }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description"
                      value={createForm.description}
                      onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      required
                      placeholder="Enter task description"
                    />
                  </Box>
                  <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                    <FormControl fullWidth>
                      <InputLabel id="assigned-type-label">Assigned To Type</InputLabel>
                      <Select
                        labelId="assigned-type-label"
                        value={createForm.assigned_to_type}
                        label="Assigned To Type"
                        onChange={e => setCreateForm(prev => ({ ...prev, assigned_to_type: e.target.value as TaskAssignedToType, assigned_to_id: '' }))}
                      >
                        <MenuItem value="division">Division</MenuItem>
                        <MenuItem value="staff">Staff Agent</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                    <FormControl fullWidth>
                      <InputLabel id="assigned-id-label">Assigned To</InputLabel>
                      <Select
                        labelId="assigned-id-label"
                        value={createForm.assigned_to_id}
                        label="Assigned To"
                        onChange={e => setCreateForm(prev => ({ ...prev, assigned_to_id: e.target.value }))}
                        disabled={!createForm.assigned_to_type}
                      >
                        {getAssignedToOptions(createForm.assigned_to_type).map(option => (
                          <MenuItem key={getOptionId(option)} value={getOptionId(option)}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                    <FormControl fullWidth>
                      <InputLabel id="priority-label">Priority</InputLabel>
                      <Select
                        labelId="priority-label"
                        value={createForm.priority}
                        label="Priority"
                        onChange={e => setCreateForm(prev => ({ ...prev, priority: e.target.value as TaskFormData['priority'] }))}
                      >
                        <MenuItem value="low">
                          <LowPriority fontSize="small" sx={{ mr: 1 }} /> Low
                        </MenuItem>
                        <MenuItem value="medium">
                          <Flag fontSize="small" sx={{ mr: 1, color: 'primary.main' }} /> Medium
                        </MenuItem>
                        <MenuItem value="high">
                          <PriorityHigh fontSize="small" sx={{ mr: 1, color: 'warning.main' }} /> High
                        </MenuItem>
                        <MenuItem value="critical">
                          <PriorityHigh fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Critical
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ flex: '1 1 100%', display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {submitting ? 'Creating...' : 'Create Task'}
                    </Button>
                  </Box>
                </Box>
              </form>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Tab 3: Assign Task */}
        <TabPanel value={value} index={3}>
          <Typography variant="h5" gutterBottom>Assign Task</Typography>

          {selectedTask ? (
            <Card elevation={2} sx={{ maxWidth: 600 }}>
              <CardHeader title={`Assign: ${selectedTask.title}`} />
              <CardContent>
                <form onSubmit={handleAssignTask}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                      <FormControl fullWidth>
                        <InputLabel id="assign-type-label">Assign To Type</InputLabel>
                        <Select
                          labelId="assign-type-label"
                          value={assignForm.assigned_to_type}
                          label="Assign To Type"
                          onChange={e => setAssignForm(prev => ({ ...prev, assigned_to_type: e.target.value as TaskAssignedToType, assigned_to_id: '' }))}
                        >
                          <MenuItem value="division">Division</MenuItem>
                          <MenuItem value="staff">Staff Agent</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                      <FormControl fullWidth>
                        <InputLabel id="assign-id-label">Assign To</InputLabel>
                        <Select
                          labelId="assign-id-label"
                          value={assignForm.assigned_to_id}
                          label="Assign To"
                          onChange={e => setAssignForm(prev => ({ ...prev, assigned_to_id: e.target.value }))}
                          disabled={!assignForm.assigned_to_type}
                        >
                          {getAssignedToOptions(assignForm.assigned_to_type).map(option => (
                            <MenuItem key={getOptionId(option)} value={getOptionId(option)}>
                              {option.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ flex: '1 1 100%', display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={() => setAssignDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                      >
                        {submitting ? 'Assigning...' : 'Assign Task'}
                      </Button>
                    </Box>
                  </Box>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary">No task selected</Typography>
              <Typography variant="body2" color="text.secondary">Select a task from the Task List tab, then use the "Assign" action</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Tab 4: Task Progress */}
        <TabPanel value={value} index={4}>
          <Typography variant="h5" gutterBottom>Task Progress</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Status history and delegation history
          </Typography>

          {selectedTask ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
                <Card elevation={2}>
                  <CardHeader title="Status History" />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Status progression for task: {selectedTask.title}
                    </Typography>
                    <Divider />
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        Status history tracking requires backend implementation
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
                <Card elevation={2}>
                  <CardHeader title="Delegation History" />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Delegation chain for task: {selectedTask.title}
                    </Typography>
                    <Divider />
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        Delegation history tracking requires backend implementation
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary">No task selected</Typography>
              <Typography variant="body2" color="text.secondary">Select a task from the Task List tab to view progress</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Tab 5: Task History */}
        <TabPanel value={value} index={5}>
          <Typography variant="h5" gutterBottom>Task History</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            All task changes: created, updated, delegated, accepted, rejected
          </Typography>

          {selectedTask ? (
            <Card elevation={2}>
              <CardHeader title={`History: ${selectedTask.title}`} />
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Task history tracking requires backend implementation
                </Typography>
                <Divider />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Performed By</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No history data available - backend endpoint needed
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary">No task selected</Typography>
              <Typography variant="body2" color="text.secondary">Select a task from the Task List tab to view history</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Create Task Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Task</DialogTitle>
          <form onSubmit={handleCreateTask}>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, p: 2, minWidth: 500 }}>
                <Box sx={{ flex: '1 1 100%' }}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={createForm.title}
                    onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    placeholder="Enter task title"
                    autoFocus
                  />
                </Box>
                <Box sx={{ flex: '1 1 100%' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Description"
                    value={createForm.description}
                    onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    placeholder="Enter task description"
                  />
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <FormControl fullWidth>
                    <InputLabel id="dialog-assigned-type-label">Assigned To Type</InputLabel>
                    <Select
                      labelId="dialog-assigned-type-label"
                      value={createForm.assigned_to_type}
                      label="Assigned To Type"
                      onChange={e => setCreateForm(prev => ({ ...prev, assigned_to_type: e.target.value as TaskAssignedToType, assigned_to_id: '' }))}
                    >
                      <MenuItem value="division">Division</MenuItem>
                      <MenuItem value="staff">Staff Agent</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <FormControl fullWidth>
                    <InputLabel id="dialog-assigned-id-label">Assigned To</InputLabel>
                    <Select
                      labelId="dialog-assigned-id-label"
                      value={createForm.assigned_to_id}
                      label="Assigned To"
                      onChange={e => setCreateForm(prev => ({ ...prev, assigned_to_id: e.target.value }))}
                      disabled={!createForm.assigned_to_type}
                    >
                      {getAssignedToOptions(createForm.assigned_to_type).map(option => (
                        <MenuItem key={getOptionId(option)} value={getOptionId(option)}>
                          {option.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <FormControl fullWidth>
                    <InputLabel id="dialog-priority-label">Priority</InputLabel>
                    <Select
                      labelId="dialog-priority-label"
                      value={createForm.priority}
                      label="Priority"
                      onChange={e => setCreateForm(prev => ({ ...prev, priority: e.target.value as TaskFormData['priority'] }))}
                    >
                      <MenuItem value="low"><LowPriority fontSize="small" sx={{ mr: 1 }} /> Low</MenuItem>
                      <MenuItem value="medium"><Flag fontSize="small" sx={{ mr: 1, color: 'primary.main' }} /> Medium</MenuItem>
                      <MenuItem value="high"><PriorityHigh fontSize="small" sx={{ mr: 1, color: 'warning.main' }} /> High</MenuItem>
                      <MenuItem value="critical"><PriorityHigh fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}>
                {submitting ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Assign Task Dialog */}
        <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Assign Task</DialogTitle>
          <form onSubmit={handleAssignTask}>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, p: 2, minWidth: 400 }}>
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <FormControl fullWidth>
                    <InputLabel id="dialog-assign-type-label">Assign To Type</InputLabel>
                    <Select
                      labelId="dialog-assign-type-label"
                      value={assignForm.assigned_to_type}
                      label="Assign To Type"
                      onChange={e => setAssignForm(prev => ({ ...prev, assigned_to_type: e.target.value as TaskAssignedToType, assigned_to_id: '' }))}
                    >
                      <MenuItem value="division">Division</MenuItem>
                      <MenuItem value="staff">Staff Agent</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                  <FormControl fullWidth>
                    <InputLabel id="dialog-assign-id-label">Assign To</InputLabel>
                    <Select
                      labelId="dialog-assign-id-label"
                      value={assignForm.assigned_to_id}
                      label="Assign To"
                      onChange={e => setAssignForm(prev => ({ ...prev, assigned_to_id: e.target.value }))}
                      disabled={!assignForm.assigned_to_type}
                    >
                      {getAssignedToOptions(assignForm.assigned_to_type).map(option => (
                        <MenuItem key={getOptionId(option)} value={getOptionId(option)}>
                          {option.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}>
                {submitting ? 'Assigning...' : 'Assign Task'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Update Task Status</DialogTitle>
          <form onSubmit={handleUpdateStatus}>
            <DialogContent dividers>
              <FormControl fullWidth sx={{ p: 2, minWidth: 300 }}>
                <InputLabel id="dialog-status-label">New Status</InputLabel>
                <Select
                  labelId="dialog-status-label"
                  value={statusForm.status}
                  label="New Status"
                  onChange={e => setStatusForm(prev => ({ ...prev, status: e.target.value as TaskStatus }))}
                >
                  <MenuItem value="pending"><Pending fontSize="small" sx={{ mr: 1 }} /> Pending</MenuItem>
                  <MenuItem value="in_progress"><Refresh fontSize="small" sx={{ mr: 1, color: 'primary.main' }} /> In Progress</MenuItem>
                  <MenuItem value="review"><Visibility fontSize="small" sx={{ mr: 1, color: 'warning.main' }} /> Review</MenuItem>
                  <MenuItem value="completed"><CheckCircle fontSize="small" sx={{ mr: 1, color: 'success.main' }} /> Completed</MenuItem>
                  <MenuItem value="cancelled"><Cancel fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Cancelled</MenuItem>
                  <MenuItem value="delegated"><ArrowRight fontSize="small" sx={{ mr: 1, color: 'info.main' }} /> Delegated</MenuItem>
                  <MenuItem value="accepted"><CheckCircle fontSize="small" sx={{ mr: 1, color: 'success.main' }} /> Accepted</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}>
                {submitting ? 'Updating...' : 'Update Status'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
          <Alert severity={snackbarSeverity} sx={{ width: '100%' }} onClose={() => setSnackbarOpen(false)}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
  );
};

export default TasksPage;