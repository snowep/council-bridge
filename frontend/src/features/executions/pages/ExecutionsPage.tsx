import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  IconButton,
  Chip,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
} from '@mui/material';
import {
  PlayArrowOutlined,
  RefreshOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ErrorOutlined,
  ScheduleOutlined,
  CancelOutlined,
  AddOutlined,
  VisibilityOutlined,
  SecurityOutlined,
  GavelOutlined,
  ArrowBackOutlined,
} from '@mui/icons-material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { apiClient } from '@shared/api/client';
import type {
  ExecutionRequest,
  ExecutionStatus,
  AutonomyLevel,
  TaskAutonomyLevel,
  ExecutionHistory,
  ApprovalRequest,
} from '@shared/types/api';
import { TabPanel } from '@shared/components/TabPanel';

const statusColors: Record<ExecutionStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  completed: 'success',
  running: 'warning',
  approved: 'success',
  failed: 'error',
  proposed: 'info',
  permission_check: 'info',
  approval_required: 'warning',
  rejected: 'error',
  queued: 'info',
  cancelled: 'error',
};

const autonomyLevelLabels: Record<AutonomyLevel, string> = {
  1: 'Level 1 - Automated',
  2: 'Level 2 - Supervised',
  3: 'Level 3 - Full Approval Required',
};

const getStatusChip = (status: ExecutionStatus) => (
  <Chip
    label={status.replace(/_/g, ' ')}
    size="small"
    color={statusColors[status]}
    icon={
      status === 'completed' ? <CheckCircleOutlined fontSize="small" /> :
      status === 'running' ? <ScheduleOutlined fontSize="small" /> :
      status === 'failed' ? <ErrorOutlined fontSize="small" /> :
      status === 'cancelled' ? <CancelOutlined fontSize="small" /> : undefined
    }
  />
);

export default function ExecutionsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [executions, setExecutions] = useState<ExecutionRequest[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRequest | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [autonomyLevels, setAutonomyLevels] = useState<TaskAutonomyLevel[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newExecution, setNewExecution] = useState({
    task_id: '',
    autonomy_level: 1 as AutonomyLevel,
    action_description: '',
    action_payload: {} as Record<string, any>,
  });
  const [tasks, setTasks] = useState<any[]>([]);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>('/api/executions');
      const list = Array.isArray(res) ? res : res.data || [];
      setExecutions(list);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch executions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutonomyLevels = async () => {
    try {
      const res = await apiClient.get<any>('/api/executions/autonomy-levels');
      setAutonomyLevels(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to fetch autonomy levels:', err);
    }
  };

  const fetchApprovalRequests = async () => {
    try {
      const res = await apiClient.get<any>('/api/approvals');
      setApprovalRequests(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to fetch approval requests:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await apiClient.get<any>('/api/tasks');
      setTasks(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchExecutionDetail = async (executionId: string) => {
    try {
      setDetailLoading(true);
      const [detailRes, historyRes] = await Promise.all([
        apiClient.get<any>(`/api/executions/${executionId}`),
        apiClient.get<any>(`/api/executions/${executionId}/history`).catch(() => ({ data: [] })),
      ]);
      setSelectedExecution(detailRes);
      setExecutionHistory(Array.isArray(historyRes) ? historyRes : historyRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch execution detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateExecution = async () => {
    if (!newExecution.task_id || !newExecution.action_description.trim()) return;
    try {
      setCreating(true);
      await apiClient.post('/api/executions', newExecution);
      setShowCreateDialog(false);
      setNewExecution({ task_id: '', autonomy_level: 1, action_description: '', action_payload: {} });
      fetchExecutions();
      showSnackbar('Execution request created successfully');
    } catch (err: any) {
      console.error('Failed to create execution:', err);
      showSnackbar('Failed to create execution: ' + (err?.response?.data?.error || err.message), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleExecute = async (executionId: string) => {
    try {
      await apiClient.post(`/api/executions/${executionId}/execute`);
      fetchExecutions();
      if (selectedExecution?.execution_id === executionId) fetchExecutionDetail(executionId);
      showSnackbar('Execution started');
    } catch (err: any) {
      console.error('Failed to execute:', err);
      showSnackbar('Failed to execute: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleCancel = async (executionId: string) => {
    try {
      await apiClient.post(`/api/executions/${executionId}/cancel`);
      fetchExecutions();
      if (selectedExecution?.execution_id === executionId) fetchExecutionDetail(executionId);
      showSnackbar('Execution cancelled');
    } catch (err: any) {
      console.error('Failed to cancel:', err);
      showSnackbar('Failed to cancel: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleApprove = async (executionId: string) => {
    try {
      // Find the approval request for this execution
      const approval = approvalRequests.find(a => a.execution_id === executionId && a.status === 'pending');
      if (!approval) {
        showSnackbar('No pending approval request found for this execution', 'error');
        return;
      }
      await apiClient.post('/api/executions/approve', {
        approval_request_id: approval.approval_request_id,
        approved: true,
      });
      fetchExecutions();
      fetchApprovalRequests();
      if (selectedExecution?.execution_id === executionId) fetchExecutionDetail(executionId);
      showSnackbar('Execution approved');
    } catch (err: any) {
      console.error('Failed to approve:', err);
      showSnackbar('Failed to approve: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleReject = async (approvalRequestId: string) => {
    if (!window.confirm('Reject this execution request? This action cannot be undone.')) return;
    try {
      await apiClient.post('/api/executions/approve', {
        approval_request_id: approvalRequestId,
        approved: false,
        rejection_reason: 'Rejected by user',
      });
      fetchExecutions();
      fetchApprovalRequests();
      showSnackbar('Execution request rejected');
    } catch (err: any) {
      console.error('Failed to reject:', err);
      showSnackbar('Failed to reject: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleSelectExecution = (execution: ExecutionRequest) => {
    setSelectedExecution(execution);
    fetchExecutionDetail(execution.execution_id);
    setTabValue(1);
  };

  useEffect(() => {
    fetchExecutions();
    fetchAutonomyLevels();
    fetchApprovalRequests();
    fetchTasks();
  }, []);

  if (loading && executions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
            Executions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execution requests, autonomy levels, approval requirements, status, history, errors
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchExecutions}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => { setShowCreateDialog(true); fetchTasks(); }}>
            Request Execution
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleChange} aria-label="executions tabs" variant="scrollable" scrollButtons="auto">
          <Tab icon={<PlayArrowOutlined />} iconPosition="start" label={`Execution Requests (${executions.length})`} />
          <Tab icon={<VisibilityOutlined />} iconPosition="start" label="Execution Detail" disabled={!selectedExecution} />
          <Tab icon={<SecurityOutlined />} iconPosition="start" label={`Autonomy Levels (${autonomyLevels.length})`} />
          <Tab icon={<GavelOutlined />} iconPosition="start" label={`Approvals (${approvalRequests.length})`} />
          <Tab icon={<HistoryOutlined />} iconPosition="start" label="History" disabled={!selectedExecution} />
          <Tab icon={<ErrorOutlined />} iconPosition="start" label="Errors" />
        </Tabs>
      </Box>

      {/* Tab 0: Execution Requests */}
      <TabPanel value={tabValue} index={0}>
        {executions.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <PlayArrowOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No execution requests found</Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first execution request to get started.
            </Typography>
            <Button variant="contained" startIcon={<AddOutlined />} sx={{ mt: 2 }} onClick={() => { setShowCreateDialog(true); fetchTasks(); }}>
              Request Execution
            </Button>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Execution ID</TableCell>
                  <TableCell>Task ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Autonomy</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow
                    key={execution.execution_id}
                    hover
                    onClick={() => handleSelectExecution(execution)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectExecution(execution);
                      }
                    }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{execution.execution_id.slice(0, 8)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{execution.task_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {execution.action_description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`L${execution.autonomy_level}`}
                        size="small"
                        variant="outlined"
                        color={execution.autonomy_level === 3 ? 'error' : execution.autonomy_level === 2 ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell>{getStatusChip(execution.status)}</TableCell>
                    <TableCell>
                      <Chip label={execution.requested_by_type} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{execution.requested_by_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(execution.created_at).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{execution.completed_at ? new Date(execution.completed_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton color="primary" size="small" aria-label="View execution details" onClick={(e) => { e.stopPropagation(); handleSelectExecution(execution); }}>
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {execution.status === 'approval_required' && (
                        <Tooltip title="Approve">
                          <IconButton color="success" size="small" aria-label="Approve execution" onClick={(e) => { e.stopPropagation(); handleApprove(execution.execution_id); }}>
                            <CheckCircleOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {['proposed', 'permission_check', 'approval_required', 'approved', 'queued'].includes(execution.status) && (
                        <Tooltip title="Execute">
                          <IconButton color="primary" size="small" aria-label="Execute now" onClick={(e) => { e.stopPropagation(); handleExecute(execution.execution_id); }}>
                            <PlayArrowOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {['proposed', 'permission_check', 'approval_required', 'approved', 'queued', 'running'].includes(execution.status) && (
                        <Tooltip title="Cancel">
                          <IconButton color="error" size="small" aria-label="Cancel execution" onClick={(e) => { e.stopPropagation(); handleCancel(execution.execution_id); }}>
                            <CancelOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 1: Execution Detail */}
      <TabPanel value={tabValue} index={1}>
        {!selectedExecution ? (
          <Alert severity="info">Please select an execution from the Execution Requests tab first.</Alert>
        ) : detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Button startIcon={<ArrowBackOutlined />} onClick={() => setTabValue(0)} sx={{ mb: 3 }}>
              Back to Execution Requests
            </Button>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Chip label={`Execution #${selectedExecution.execution_id.slice(0, 8)}`} color="primary" size="small" sx={{ mb: 1 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{selectedExecution.action_description}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {getStatusChip(selectedExecution.status)}
                        <Chip label={`L${selectedExecution.autonomy_level}`} size="small" color={selectedExecution.autonomy_level === 3 ? 'error' : selectedExecution.autonomy_level === 2 ? 'warning' : 'success'} variant="outlined" />
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Action Payload</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small', whiteSpace: 'pre-wrap', bgcolor: 'background.default', p: 2, borderRadius: 1, display: 'block', maxHeight: 300, overflow: 'auto' }}>
                      {JSON.stringify(selectedExecution.action_payload, null, 2)}
                    </Typography>

                    {selectedExecution.result_payload && Object.keys(selectedExecution.result_payload).length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Result Payload</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small', whiteSpace: 'pre-wrap', bgcolor: 'success.light', p: 2, borderRadius: 1, display: 'block', maxHeight: 300, overflow: 'auto' }}>
                          {JSON.stringify(selectedExecution.result_payload, null, 2)}
                        </Typography>
                      </>
                    )}

                    {selectedExecution.error_message && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" color="error.main" gutterBottom>Error</Typography>
                        <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'pre-wrap', bgcolor: 'error.light', p: 2, borderRadius: 1, display: 'block' }}>
                          {selectedExecution.error_message}
                        </Typography>
                      </>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Task ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small' }}>{selectedExecution.task_id}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Requested By</Typography>
                        <Typography variant="body2">{selectedExecution.requested_by_type}: {selectedExecution.requested_by_id}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Permission Grants</Typography>
                        <Typography variant="body2">{selectedExecution.permission_grants?.length || 0} grants</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Approval ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small' }}>{selectedExecution.approval_id || '—'}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Created</Typography>
                        <Typography variant="body2">{new Date(selectedExecution.created_at).toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Started</Typography>
                        <Typography variant="body2">{selectedExecution.started_at ? new Date(selectedExecution.started_at).toLocaleString() : '—'}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">Completed</Typography>
                        <Typography variant="body2">{selectedExecution.completed_at ? new Date(selectedExecution.completed_at).toLocaleString() : '—'}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* History */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Execution History</Typography>
                    {executionHistory.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No history available</Typography>
                    ) : (
                      <div>
                        {executionHistory.map((entry, idx) => (
                          <Accordion key={entry.history_id || idx}>
                            <AccordionSummary
                              expandIcon={<ExpandMore />}
                              aria-controls={`exec-history-details-${idx}`}
                              id={`exec-history-header-${idx}`}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <Box>
                                  <Typography variant="subtitle1">{entry.status_after}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {entry.status_before} → {entry.status_after} • {new Date(entry.recorded_at).toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Typography variant="caption" color="text.secondary">
                                By {entry.executed_by_type}: {entry.executed_by_id} • Approval: {entry.approval_reference || '—'}
                              </Typography>
                              {entry.error_message && (
                                <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>{entry.error_message}</Typography>
                              )}
                              {entry.result_payload && Object.keys(entry.result_payload).length > 0 && (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small', mt: 1, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(entry.result_payload, null, 2)}
                                </Typography>
                              )}
                            </AccordionDetails>
                          </Accordion>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      {selectedExecution.status === 'approval_required' && (
                        <>
                          <Button variant="contained" color="success" startIcon={<CheckCircleOutlined />} onClick={() => handleApprove(selectedExecution.execution_id)} fullWidth>
                            Approve Execution
                          </Button>
                          <Button variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => {
                            const approval = approvalRequests.find(a => a.execution_id === selectedExecution.execution_id && a.status === 'pending');
                            if (approval) handleReject(approval.approval_request_id);
                          }} fullWidth>
                            Reject Execution
                          </Button>
                        </>
                      )}
                      {['proposed', 'permission_check', 'approval_required', 'approved', 'queued'].includes(selectedExecution.status) && (
                        <Button variant="contained" startIcon={<PlayArrowOutlined />} onClick={() => handleExecute(selectedExecution.execution_id)} fullWidth>
                          Execute Now
                        </Button>
                      )}
                      {['proposed', 'permission_check', 'approval_required', 'approved', 'queued', 'running'].includes(selectedExecution.status) && (
                        <Button variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => handleCancel(selectedExecution.execution_id)} fullWidth>
                          Cancel Execution
                        </Button>
                      )}
                      <Button variant="outlined" onClick={() => { navigator.clipboard.writeText(selectedExecution.execution_id); }} fullWidth>
                        Copy Execution ID
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        )}
      </TabPanel>

      {/* Tab 2: Autonomy Levels */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>Task Autonomy Levels</Typography>
        <Typography variant="body2" color="text.secondary">
          Autonomy levels determine the approval requirements for task executions.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
          {[
            { level: 1, label: 'Level 1 - Automated', desc: 'Executes automatically without approval. Suitable for routine, low-risk operations.', icon: <PlayArrowOutlined />, color: 'success' },
            { level: 2, label: 'Level 2 - Supervised', desc: 'Requires permission check but no founder approval. Suitable for standard operations with monitoring.', icon: <SecurityOutlined />, color: 'warning' },
            { level: 3, label: 'Level 3 - Full Approval Required', desc: 'Requires explicit founder approval before execution. For high-risk or sensitive operations.', icon: <GavelOutlined />, color: 'error' },
          ].map((item) => (
            <Box key={item.level} sx={{ flex: '1 1 300px', minWidth: 250 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${item.color}.light`, color: `${item.color}.main`, flexShrink: 0 }}>
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h6" gutterBottom>Configured Autonomy Levels</Typography>
        {autonomyLevels.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <SecurityOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No autonomy levels configured</Typography>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Task Type</TableCell>
                  <TableCell>Autonomy Level</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {autonomyLevels.map((level) => (
                  <TableRow key={level.task_type} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{level.task_type}</TableCell>
                    <TableCell>
                      <Chip
                        label={autonomyLevelLabels[level.autonomy_level] || `Level ${level.autonomy_level}`}
                        size="small"
                        color={level.autonomy_level === 3 ? 'error' : level.autonomy_level === 2 ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{level.description}</TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(level.created_at).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(level.updated_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 3: Approvals */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>Pending Approval Requests</Typography>
        <Typography variant="body2" color="text.secondary">
          Execution requests requiring founder approval.
        </Typography>
        {approvalRequests.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <GavelOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No pending approvals</Typography>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Approval ID</TableCell>
                  <TableCell>Execution</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Deadline</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {approvalRequests.map((approval) => (
                  <TableRow key={approval.approval_request_id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{approval.approval_request_id.slice(0, 8)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{approval.execution_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {approval.action_description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={approval.requested_by_type} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{approval.requested_by_id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={approval.priority} size="small" color={approval.priority === 'critical' ? 'error' : approval.priority === 'high' ? 'error' : approval.priority === 'medium' ? 'warning' : 'info'} variant="outlined" />
                    </TableCell>
                    <TableCell>{approval.deadline ? new Date(approval.deadline).toLocaleString() : 'No deadline'}</TableCell>
                    <TableCell>
                      <Chip
                        label={approval.status}
                        size="small"
                        color={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'error' : approval.status === 'pending' ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {approval.status === 'pending' && (
                        <>
                          <IconButton color="success" size="small" onClick={() => handleApprove(approval.execution_id)}>
                            <CheckCircleOutlined fontSize="small" />
                          </IconButton>
                          <IconButton color="error" size="small" onClick={() => handleReject(approval.approval_request_id)}>
                            <CancelOutlined fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 4: History */}
      <TabPanel value={tabValue} index={4}>
        {!selectedExecution ? (
          <Alert severity="info">Please select an execution from the Execution Requests tab first.</Alert>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>Complete Execution History</Typography>
            {executionHistory.length === 0 ? (
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <HistoryOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>No history available</Typography>
              </Card>
            ) : (
              <List dense>
                {executionHistory.map((entry, idx) => (
                  <ListItem key={entry.history_id || idx} disablePadding sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                            {entry.executed_by_type?.charAt(0) || '?'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {entry.status_before} → {entry.status_after}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              By {entry.executed_by_type}: {entry.executed_by_id}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(entry.recorded_at).toLocaleString()}
                          </Typography>
                          {entry.approval_reference && (
                            <Typography variant="caption" color="text.secondary">
                              Approval: {entry.approval_reference}
                            </Typography>
                          )}
                          {entry.error_message && (
                            <Typography variant="caption" color="error.main">
                              Error: {entry.error_message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Tab 5: Errors */}
      <TabPanel value={tabValue} index={5}>
        <Typography variant="h6" gutterBottom>Failed Executions</Typography>
        <Typography variant="body2" color="text.secondary">
          Executions that have failed with error details.
        </Typography>
        {executions.filter(e => e.status === 'failed').length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <ErrorOutlined sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No failed executions</Typography>
            <Typography variant="body2" color="text.secondary">All executions completed successfully!</Typography>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Execution ID</TableCell>
                  <TableCell>Task ID</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Error Message</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Failed At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.filter(e => e.status === 'failed').map((execution) => (
                  <TableRow key={execution.execution_id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{execution.execution_id.slice(0, 8)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{execution.task_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {execution.action_description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="error.main" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {execution.error_message || 'Unknown error'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={execution.requested_by_type} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{execution.requested_by_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{execution.completed_at ? new Date(execution.completed_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Create Execution Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Request New Execution</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="exec-task-label">Task</InputLabel>
              <Select
                labelId="exec-task-label"
                value={newExecution.task_id}
                label="Task"
                onChange={(e) => setNewExecution(prev => ({ ...prev, task_id: e.target.value }))}
              >
                {tasks.map((task: any) => (
                  <MenuItem key={task.task_id} value={task.task_id}>
                    {task.title} (#{task.task_id.slice(0, 8)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="exec-autonomy-label">Autonomy Level</InputLabel>
              <Select
                labelId="exec-autonomy-label"
                value={String(newExecution.autonomy_level)}
                label="Autonomy Level"
                onChange={(e) => setNewExecution(prev => ({ ...prev, autonomy_level: parseInt(e.target.value) as AutonomyLevel }))}
              >
                <MenuItem value="1">Level 1 - Automated (No approval needed)</MenuItem>
                <MenuItem value="2">Level 2 - Supervised (Permission check only)</MenuItem>
                <MenuItem value="3">Level 3 - Full Approval Required (Founder approval)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Action Description"
              value={newExecution.action_description}
              onChange={(e) => setNewExecution(prev => ({ ...prev, action_description: e.target.value }))}
              required
              placeholder="Describe what this execution will do"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Action Payload (JSON)"
              value={JSON.stringify(newExecution.action_payload, null, 2)}
              onChange={(e) => {
                try {
                  setNewExecution(prev => ({ ...prev, action_payload: JSON.parse(e.target.value) }));
                } catch {
                  // Invalid JSON, keep previous
                }
              }}
              placeholder='{"key": "value"}'
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={handleCreateExecution} disabled={creating}>
            {creating ? 'Creating...' : 'Request Execution'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={snackbarSeverity} sx={{ width: '100%' }} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}