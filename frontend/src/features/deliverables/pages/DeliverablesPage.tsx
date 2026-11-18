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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Rating,
  Snackbar,
} from '@mui/material';
import {
  AssignmentOutlined,
  RefreshOutlined,
  VisibilityOutlined,
  AddOutlined,
  CheckCircleOutlined,
  CancelOutlined,
  GavelOutlined,
  HistoryOutlined,
  EditOutlined,
  StarOutlined,
  ArrowBackOutlined,
  ContentCopyOutlined,
  ExpandMore as ExpandMoreIcon,
  ArrowForwardOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import type {
  Deliverable,
  DeliverableStatus,
  DeliverableVersion,
  ReviewerType,
  QualityThreshold,
} from '@shared/types/api';
import { TabPanel } from '@shared/components/TabPanel';

const statusColors: Record<DeliverableStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  accepted: 'success',
  submitted: 'info',
  rejected: 'error',
  revision_requested: 'warning',
  draft: 'default',
};

const getStatusChip = (status: DeliverableStatus) => (
  <Chip
    label={status.replace(/_/g, ' ')}
    size="small"
    color={statusColors[status]}
    icon={
      status === 'accepted' ? <CheckCircleOutlined fontSize="small" /> :
      status === 'rejected' ? <CancelOutlined fontSize="small" /> :
      status === 'revision_requested' ? <EditOutlined fontSize="small" /> : undefined
    }
  />
);

const getReviewerChip = (type: ReviewerType | null, id: string | null) => {
  if (!type) return <Chip label="Unassigned" size="small" color="default" variant="outlined" />;
  return (
    <Chip
      label={`${type}: ${id}`}
      size="small"
      variant="outlined"
      color={type === 'founder' ? 'secondary' : type === 'council' ? 'primary' : 'success'}
    />
  );
};

export default function DeliverablesPage() {
  const [tabValue, setTabValue] = useState(0);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [versions, setVersions] = useState<DeliverableVersion[]>([]);
  const [qualityThresholds, setQualityThresholds] = useState<QualityThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [newDeliverable, setNewDeliverable] = useState({
    task_id: '',
    content: '',
    version: 1,
  });
  const [reviewData, setReviewData] = useState({
    status: 'accepted' as DeliverableStatus,
    quality_score: 0,
    reviewer_type: 'founder' as ReviewerType,
    reviewer_id: '',
    revision_notes: '',
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<{ type: ReviewerType; id: string; label: string }[]>([
    { type: 'founder', id: 'founder', label: 'Founder' },
  ]);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const fetchDeliverables = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>('/api/deliverables');
      const list = Array.isArray(res) ? res : res.data || [];
      setDeliverables(list);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch deliverables');
    } finally {
      setLoading(false);
    }
  };

  const fetchQualityThresholds = async () => {
    try {
      const res = await apiClient.get<any>('/api/quality-thresholds');
      setQualityThresholds(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to fetch quality thresholds:', err);
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

  const fetchReviewers = async () => {
    try {
      const seatsRes = await apiClient.get<{ data: any[] }>('/api/council/seats').catch(() => ({ data: [] }));
      const staffRes = await apiClient.get<{ staff: any[] }>('/api/staff').catch(() => ({ staff: [] }));
      const foundersRes = await apiClient.get<{ founders: string[] }>('/api/founders').catch(() => ({ founders: [] }));

      const reviewerList: { type: ReviewerType; id: string; label: string }[] = [
        { type: 'founder', id: 'founder', label: 'Founder' },
      ];

      (foundersRes.founders || []).forEach((f: string) => {
        reviewerList.push({ type: 'founder', id: f, label: f });
      });

      (seatsRes.data || []).map((s: any) => ({
        type: 'council' as ReviewerType,
        id: s.seat_id,
        label: s.name || s.seat_id,
      })).forEach(r => reviewerList.push(r));

      (staffRes.staff || []).map((s: any) => ({
        type: 'division_head' as ReviewerType,
        id: s.staff_id,
        label: s.name || `Staff: ${s.role}`,
      })).forEach(r => reviewerList.push(r));

      setReviewers(reviewerList);
    } catch (err) {
      console.error('Failed to fetch reviewers:', err);
    }
  };

  const fetchDeliverableDetail = async (deliverableId: string) => {
    try {
      setDetailLoading(true);
      const [detailRes, versionsRes] = await Promise.all([
        apiClient.get<any>(`/api/deliverables/${deliverableId}`),
        apiClient.get<any>(`/api/deliverables/${deliverableId}/versions`).catch(() => ({ data: [] })),
      ]);
      setSelectedDeliverable(detailRes);
      setVersions(Array.isArray(versionsRes) ? versionsRes : versionsRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch deliverable detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateDeliverable = async () => {
    if (!newDeliverable.task_id || !newDeliverable.content.trim()) return;
    try {
      setCreating(true);
      await apiClient.post('/api/deliverables', newDeliverable);
      setShowCreateDialog(false);
      setNewDeliverable({ task_id: '', content: '', version: 1 });
      fetchDeliverables();
      showSnackbar('Deliverable created successfully');
    } catch (err: any) {
      console.error('Failed to create deliverable:', err);
      showSnackbar('Failed to create deliverable: ' + (err?.response?.data?.error || err.message), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (deliverableId: string) => {
    try {
      await apiClient.put(`/api/deliverables/${deliverableId}/submit`);
      fetchDeliverables();
      if (selectedDeliverable?.deliverable_id === deliverableId) fetchDeliverableDetail(deliverableId);
      showSnackbar('Submitted for review');
    } catch (err: any) {
      console.error('Failed to submit:', err);
      showSnackbar('Failed to submit: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleReview = async (deliverableId: string, status: DeliverableStatus) => {
    try {
      await apiClient.put(`/api/deliverables/${deliverableId}/review`, {
        status,
        quality_score: reviewData.quality_score,
        reviewer_type: reviewData.reviewer_type,
        reviewer_id: reviewData.reviewer_id,
        revision_notes: reviewData.revision_notes,
      });
      setShowReviewDialog(false);
      fetchDeliverables();
      if (selectedDeliverable?.deliverable_id === deliverableId) fetchDeliverableDetail(deliverableId);
      showSnackbar('Review submitted successfully');
    } catch (err: any) {
      console.error('Failed to review:', err);
      showSnackbar('Failed to review: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleRevision = async (deliverableId: string) => {
    try {
      await apiClient.put(`/api/deliverables/${deliverableId}/revision`, {
        revision_notes: reviewData.revision_notes,
      });
      setShowRevisionDialog(false);
      fetchDeliverables();
      if (selectedDeliverable?.deliverable_id === deliverableId) fetchDeliverableDetail(deliverableId);
      showSnackbar('Revision requested successfully');
    } catch (err: any) {
      console.error('Failed to request revision:', err);
      showSnackbar('Failed to request revision: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleAssignReviewer = async () => {
    if (!selectedDeliverable || !reviewData.reviewer_type || !reviewData.reviewer_id) return;
    try {
      await apiClient.put(`/api/deliverables/${selectedDeliverable.deliverable_id}/assign-reviewer`, {
        reviewer_type: reviewData.reviewer_type,
        reviewer_id: reviewData.reviewer_id,
      });
      fetchDeliverables();
      fetchDeliverableDetail(selectedDeliverable.deliverable_id);
      showSnackbar('Reviewer assigned successfully');
    } catch (err: any) {
      console.error('Failed to assign reviewer:', err);
      showSnackbar('Failed to assign reviewer: ' + (err?.response?.data?.error || err.message), 'error');
    }
  };

  const handleSelectDeliverable = (deliverable: Deliverable) => {
    setSelectedDeliverable(deliverable);
    fetchDeliverableDetail(deliverable.deliverable_id);
    setTabValue(1);
  };

  useEffect(() => {
    fetchDeliverables();
    fetchQualityThresholds();
    fetchTasks();
    fetchReviewers();
  }, []);

  if (loading && deliverables.length === 0) {
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
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Deliverables
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submission, version history, reviewer assignment, review status, quality scores, revisions
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchDeliverables}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => { setShowCreateDialog(true); fetchTasks(); }}>
            Create Deliverable
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleChange} aria-label="deliverables tabs" variant="scrollable" scrollButtons="auto">
          <Tab icon={<AssignmentOutlined />} iconPosition="start" label={`Deliverable List (${deliverables.length})`} />
          <Tab icon={<VisibilityOutlined />} iconPosition="start" label="Deliverable Detail" disabled={!selectedDeliverable} />
          <Tab icon={<HistoryOutlined />} iconPosition="start" label="Version History" disabled={!selectedDeliverable} />
          <Tab icon={<GavelOutlined />} iconPosition="start" label="Reviewer Assignment" disabled={!selectedDeliverable} />
          <Tab icon={<StarOutlined />} iconPosition="start" label={`Quality Scores (${qualityThresholds.length})`} />
        </Tabs>
      </Box>

      {/* Tab 0: Deliverable List */}
      <TabPanel value={tabValue} index={0}>
        {deliverables.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <AssignmentOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No deliverables found</Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first deliverable to get started.
            </Typography>
            <Button variant="contained" startIcon={<AddOutlined />} sx={{ mt: 2 }} onClick={() => { setShowCreateDialog(true); fetchTasks(); }}>
              Create Deliverable
            </Button>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Deliverable ID</TableCell>
                  <TableCell>Task ID</TableCell>
                  <TableCell>Content Preview</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Quality Score</TableCell>
                  <TableCell>Reviewer</TableCell>
                  <TableCell>Submitted By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliverables.map((deliverable) => (
                  <TableRow
                    key={deliverable.deliverable_id}
                    hover
                    onClick={() => handleSelectDeliverable(deliverable)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectDeliverable(deliverable);
                      }
                    }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{deliverable.deliverable_id.slice(0, 8)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{deliverable.task_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deliverable.content}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={`v${deliverable.version}`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{getStatusChip(deliverable.status)}</TableCell>
                    <TableCell>
                      {deliverable.quality_score !== null ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Rating
                            value={Math.round(deliverable.quality_score / 20)}
                            precision={0.5}
                            readOnly
                            size="small"
                            emptyIcon={<StarOutlined fontSize="small" />}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600, color: deliverable.quality_score >= 80 ? 'success.main' : deliverable.quality_score >= 60 ? 'warning.main' : 'error.main' }}>
                            {deliverable.quality_score}%
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{getReviewerChip(deliverable.reviewer_type, deliverable.reviewer_id)}</TableCell>
                    <TableCell>
                      <Chip label={deliverable.submitted_by_type} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{deliverable.submitted_by_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(deliverable.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton color="primary" size="small" aria-label="View deliverable details" onClick={(e) => { e.stopPropagation(); handleSelectDeliverable(deliverable); }}>
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {deliverable.status === 'draft' && (
                        <Tooltip title="Submit for Review">
                          <IconButton color="primary" size="small" aria-label="Submit deliverable for review" onClick={(e) => { e.stopPropagation(); handleSubmit(deliverable.deliverable_id); }}>
                            <ArrowForwardOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {deliverable.status === 'submitted' && (
                        <Tooltip title="Review">
                          <IconButton color="success" size="small" aria-label="Review deliverable" onClick={(e) => { e.stopPropagation(); setReviewData({ status: 'accepted', quality_score: 80, reviewer_type: 'founder', reviewer_id: '', revision_notes: '' }); setShowReviewDialog(true); }}>
                            <GavelOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {deliverable.status === 'revision_requested' && (
                        <Tooltip title="Resubmit">
                          <IconButton color="primary" size="small" aria-label="Resubmit deliverable" onClick={(e) => { e.stopPropagation(); handleSubmit(deliverable.deliverable_id); }}>
                            <ContentCopyOutlined fontSize="small" />
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

      {/* Tab 1: Deliverable Detail */}
      <TabPanel value={tabValue} index={1}>
        {!selectedDeliverable ? (
          <Alert severity="info">Please select a deliverable from the Deliverable List tab first.</Alert>
        ) : detailLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Button startIcon={<ArrowBackOutlined />} onClick={() => setTabValue(0)} sx={{ mb: 3 }}>
              Back to Deliverable List
            </Button>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Chip label={`Deliverable #${selectedDeliverable.deliverable_id.slice(0, 8)}`} color="primary" size="small" sx={{ mb: 1 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>v{selectedDeliverable.version}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {getStatusChip(selectedDeliverable.status)}
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Content</Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedDeliverable.content}
                    </Typography>

                    {selectedDeliverable.revision_notes && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                          <Typography variant="subtitle2" color="warning.main" gutterBottom>Revision Notes</Typography>
                          <Typography variant="body2">{selectedDeliverable.revision_notes}</Typography>
                        </Box>
                      </>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Quality Score</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: selectedDeliverable.quality_score !== null && selectedDeliverable.quality_score >= 80 ? 'success.main' : selectedDeliverable.quality_score !== null && selectedDeliverable.quality_score >= 60 ? 'warning.main' : selectedDeliverable.quality_score !== null ? 'error.main' : 'text.secondary' }}>
                          {selectedDeliverable.quality_score !== null ? `${selectedDeliverable.quality_score}%` : 'Not scored'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Reviewer</Typography>
                        <Typography variant="body2">
                          {selectedDeliverable.reviewer_type ? `${selectedDeliverable.reviewer_type}: ${selectedDeliverable.reviewer_id}` : 'Unassigned'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Approved By</Typography>
                        <Typography variant="body2">
                          {selectedDeliverable.approved_by_type ? `${selectedDeliverable.approved_by_type}: ${selectedDeliverable.approved_by_id}` : '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Approved At</Typography>
                        <Typography variant="body2">{selectedDeliverable.founder_signed_at ? new Date(selectedDeliverable.founder_signed_at).toLocaleString() : '—'}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Created</Typography>
                        <Typography variant="body2">{new Date(selectedDeliverable.created_at).toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Updated</Typography>
                        <Typography variant="body2">{new Date(selectedDeliverable.updated_at).toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Submitted By</Typography>
                        <Typography variant="body2">{selectedDeliverable.submitted_by_type}: {selectedDeliverable.submitted_by_id}</Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 200px', minWidth: 150 }}>
                        <Typography variant="caption" color="text.secondary">Deliverable ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 'small' }}>{selectedDeliverable.deliverable_id}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Versions in detail tab */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Version History</Typography>
                    {versions.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No version history available</Typography>
                    ) : (
                      <Box>
                        {versions.map((version, idx) => (
                          <Accordion key={version.version_id || idx}>
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              aria-controls={`version-details-${idx}`}
                              id={`version-header-${idx}`}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <Box>
                                  <Typography variant="subtitle1">Version {version.version_num}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {version.status} • {version.submitted_by_type}: {version.submitted_by_id} • {new Date(version.created_at).toLocaleString()}
                                  </Typography>
                                </Box>
                                {version.quality_score !== null && (
                                  <Chip
                                    label={`${version.quality_score}%`}
                                    size="small"
                                    color={version.quality_score >= 80 ? 'success' : version.quality_score >= 60 ? 'warning' : 'error'}
                                  />
                                )}
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{version.content}</Typography>
                              {version.revision_notes && (
                                <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                                  <Typography variant="caption" color="warning.main">Revision Notes: {version.revision_notes}</Typography>
                                </Box>
                              )}
                            </AccordionDetails>
                          </Accordion>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ flex: '1 1 250px', minWidth: 200 }}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      {selectedDeliverable.status === 'draft' && (
                        <Button variant="contained" startIcon={<ArrowForwardOutlined />} onClick={() => handleSubmit(selectedDeliverable.deliverable_id)} fullWidth>
                          Submit for Review
                        </Button>
                      )}
                      {selectedDeliverable.status === 'submitted' && (
                        <Button variant="contained" startIcon={<GavelOutlined />} onClick={() => { setReviewData({ status: 'accepted', quality_score: 80, reviewer_type: 'founder', reviewer_id: '', revision_notes: '' }); setShowReviewDialog(true); }} fullWidth>
                          Review Deliverable
                        </Button>
                      )}
                      {selectedDeliverable.status === 'revision_requested' && (
                        <Button variant="contained" startIcon={<ContentCopyOutlined />} onClick={() => handleSubmit(selectedDeliverable.deliverable_id)} fullWidth>
                          Resubmit
                        </Button>
                      )}
                      <Button variant="outlined" onClick={() => { navigator.clipboard.writeText(selectedDeliverable.deliverable_id); }} fullWidth>
                        Copy Deliverable ID
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        )}
      </TabPanel>

      {/* Tab 2: Version History */}
      <TabPanel value={tabValue} index={2}>
        {!selectedDeliverable ? (
          <Alert severity="info">Please select a deliverable from the Deliverable List tab first.</Alert>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>Version History</Typography>
            {versions.length === 0 ? (
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <HistoryOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>No version history available</Typography>
              </Card>
            ) : (
              <List dense>
                {versions.map((version, idx) => (
                  <ListItem key={version.version_id || idx} disablePadding sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Version {version.version_num}</Typography>
                          <Chip label={version.status} size="small" color={statusColors[version.status as DeliverableStatus] || 'default'} variant="outlined" />
                          {version.quality_score !== null && (
                            <Chip label={`${version.quality_score}%`} size="small" color={version.quality_score >= 80 ? 'success' : version.quality_score >= 60 ? 'warning' : 'error'} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            By {version.submitted_by_type}: {version.submitted_by_id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(version.created_at).toLocaleString()}
                          </Typography>
                          {version.revision_notes && (
                            <Typography variant="caption" color="warning.main">
                              Revision: {version.revision_notes}
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

      {/* Tab 3: Reviewer Assignment */}
      <TabPanel value={tabValue} index={3}>
        {!selectedDeliverable ? (
          <Alert severity="info">Please select a deliverable from the Deliverable List tab first.</Alert>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>Reviewer Assignment & Review</Typography>
            <Typography variant="body2" color="text.secondary">
              Current reviewer: {selectedDeliverable.reviewer_type ? `${selectedDeliverable.reviewer_type}: ${selectedDeliverable.reviewer_id}` : 'Unassigned'}
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Card sx={{ maxWidth: 600, mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Assign Reviewer</Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="reviewer-type-label">Reviewer Type</InputLabel>
                  <Select
                    labelId="reviewer-type-label"
                    value={reviewData.reviewer_type}
                    label="Reviewer Type"
                    onChange={(e) => setReviewData(prev => ({ ...prev, reviewer_type: e.target.value as ReviewerType, reviewer_id: '' }))}
                  >
                    <MenuItem value="founder">Founder</MenuItem>
                    <MenuItem value="council">Council</MenuItem>
                    <MenuItem value="division_head">Division Head</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="reviewer-id-label">Reviewer ID</InputLabel>
                  <Select
                    labelId="reviewer-id-label"
                    value={reviewData.reviewer_id}
                    label="Reviewer ID"
                    onChange={(e) => setReviewData(prev => ({ ...prev, reviewer_id: e.target.value }))}
                  >
                    {reviewers
                      .filter(r => r.type === reviewData.reviewer_type)
                      .map((reviewer) => (
                        <MenuItem key={reviewer.id} value={reviewer.id}>
                          {reviewer.label}
                        </MenuItem>
                      ))
                    }
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={<GavelOutlined />}
                  onClick={handleAssignReviewer}
                  disabled={!reviewData.reviewer_type || !reviewData.reviewer_id}
                  fullWidth
                >
                  Assign Reviewer
                </Button>
              </CardContent>
            </Card>

            <Divider sx={{ mb: 3 }} />

            {selectedDeliverable.status === 'submitted' && (
              <Card sx={{ maxWidth: 600 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Review Deliverable</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="review-status-label">Review Status</InputLabel>
                    <Select
                      labelId="review-status-label"
                      value={reviewData.status}
                      label="Review Status"
                      onChange={(e) => setReviewData(prev => ({ ...prev, status: e.target.value as DeliverableStatus }))}
                    >
                      <MenuItem value="accepted">Accept</MenuItem>
                      <MenuItem value="rejected">Reject</MenuItem>
                      <MenuItem value="revision_requested">Request Revision</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Quality Score (0-100)"
                    type="number"
                    value={reviewData.quality_score}
                    onChange={(e) => setReviewData(prev => ({ ...prev, quality_score: parseInt(e.target.value) || 0 }))}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">%</Typography>
                    <Rating
                      value={Math.round(reviewData.quality_score / 20)}
                      precision={0.5}
                      readOnly
                      size="small"
                      emptyIcon={<StarOutlined fontSize="small" />}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Revision Notes (if requesting revision)"
                    value={reviewData.revision_notes}
                    onChange={(e) => setReviewData(prev => ({ ...prev, revision_notes: e.target.value }))}
                    placeholder="Enter revision notes..."
                    sx={{ mb: 2 }}
                  />

                  <Button variant="contained" startIcon={<GavelOutlined />} onClick={() => handleReview(selectedDeliverable.deliverable_id, reviewData.status)} fullWidth>
                    Submit Review
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedDeliverable.status === 'revision_requested' && (
              <Card sx={{ maxWidth: 600, mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Request Revision</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Revision Notes"
                    value={reviewData.revision_notes}
                    onChange={(e) => setReviewData(prev => ({ ...prev, revision_notes: e.target.value }))}
                    placeholder="Enter revision notes..."
                    sx={{ mb: 2 }}
                  />
                  <Button variant="outlined" color="warning" startIcon={<EditOutlined />} onClick={() => handleRevision(selectedDeliverable.deliverable_id)} fullWidth>
                    Request Revision
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Tab 4: Quality Scores */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom>Quality Thresholds</Typography>
        <Typography variant="body2" color="text.secondary">
          Quality thresholds define minimum scores and review requirements for deliverables.
        </Typography>
        {qualityThresholds.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <StarOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No quality thresholds configured</Typography>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Threshold ID</TableCell>
                  <TableCell>Division</TableCell>
                  <TableCell>Task Type</TableCell>
                  <TableCell>Min Quality Score</TableCell>
                  <TableCell>Requires Review</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {qualityThresholds.map((threshold) => (
                  <TableRow
                    key={threshold.threshold_id}
                    hover
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                      }
                    }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 'small' }}>#{threshold.threshold_id.slice(0, 8)}</TableCell>
                    <TableCell>{threshold.division_id || 'Global'}</TableCell>
                    <TableCell>{threshold.task_type || 'All Types'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Rating
                          value={Math.round(threshold.min_quality_score / 20)}
                          precision={0.5}
                          readOnly
                          size="small"
                          emptyIcon={<StarOutlined fontSize="small" />}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{threshold.min_quality_score}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={threshold.requires_review ? 'Yes' : 'No'}
                        size="small"
                        color={threshold.requires_review ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(threshold.created_at).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontSize: 'small', color: 'text.secondary' }}>{new Date(threshold.updated_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Create Deliverable Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Deliverable</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="del-task-label">Task</InputLabel>
              <Select
                labelId="del-task-label"
                value={newDeliverable.task_id}
                label="Task"
                onChange={(e) => setNewDeliverable(prev => ({ ...prev, task_id: e.target.value }))}
              >
                {tasks.map((task: any) => (
                  <MenuItem key={task.task_id} value={task.task_id}>
                    {task.title} (#{task.task_id.slice(0, 8)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={6}
              label="Content"
              value={newDeliverable.content}
              onChange={(e) => setNewDeliverable(prev => ({ ...prev, content: e.target.value }))}
              required
              placeholder="Enter deliverable content..."
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={handleCreateDeliverable} disabled={creating}>
            {creating ? 'Creating...' : 'Create Deliverable'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onClose={() => setShowReviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Review Deliverable</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="dialog-review-status-label">Review Status</InputLabel>
              <Select
                labelId="dialog-review-status-label"
                value={reviewData.status}
                label="Review Status"
                onChange={(e) => setReviewData(prev => ({ ...prev, status: e.target.value as DeliverableStatus }))}
              >
                <MenuItem value="accepted">Accept</MenuItem>
                <MenuItem value="rejected">Reject</MenuItem>
                <MenuItem value="revision_requested">Request Revision</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Quality Score (0-100)"
              value={reviewData.quality_score}
              onChange={(e) => setReviewData(prev => ({ ...prev, quality_score: parseInt(e.target.value) || 0 }))}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">%</Typography>
              <Rating
                value={Math.round(reviewData.quality_score / 20)}
                precision={0.5}
                readOnly
                size="small"
                emptyIcon={<StarOutlined fontSize="small" />}
              />
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="dialog-reviewer-type-label">Reviewer Type</InputLabel>
              <Select
                labelId="dialog-reviewer-type-label"
                value={reviewData.reviewer_type}
                label="Reviewer Type"
                onChange={(e) => setReviewData(prev => ({ ...prev, reviewer_type: e.target.value as ReviewerType }))}
              >
                <MenuItem value="founder">Founder</MenuItem>
                <MenuItem value="council">Council</MenuItem>
                <MenuItem value="division_head">Division Head</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="dialog-reviewer-id-label">Reviewer ID</InputLabel>
              <Select
                labelId="dialog-reviewer-id-label"
                value={reviewData.reviewer_id}
                label="Reviewer ID"
                onChange={(e) => setReviewData(prev => ({ ...prev, reviewer_id: e.target.value }))}
              >
                {reviewers
                  .filter(r => r.type === reviewData.reviewer_type)
                  .map((reviewer) => (
                    <MenuItem key={reviewer.id} value={reviewer.id}>
                      {reviewer.label}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Revision Notes (if requesting revision)"
              value={reviewData.revision_notes}
              onChange={(e) => setReviewData(prev => ({ ...prev, revision_notes: e.target.value }))}
              placeholder="Enter revision notes..."
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReviewDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<GavelOutlined />} onClick={() => handleReview(selectedDeliverable?.deliverable_id || '', reviewData.status)}>
            Submit Review
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={showRevisionDialog} onClose={() => setShowRevisionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Request Revision</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%' }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Revision Notes"
              value={reviewData.revision_notes}
              onChange={(e) => setReviewData(prev => ({ ...prev, revision_notes: e.target.value }))}
              placeholder="Enter revision notes..."
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRevisionDialog(false)}>Cancel</Button>
          <Button variant="outlined" color="warning" startIcon={<EditOutlined />} onClick={() => handleRevision(selectedDeliverable?.deliverable_id || '')}>
            Request Revision
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