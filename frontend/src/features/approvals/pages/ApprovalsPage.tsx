import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import { VerifiedUserOutlined, RefreshOutlined, CheckCircleOutlined, CancelOutlined } from '@mui/icons-material';
import { useAppAuth } from '@app/use-app-auth';
import { apiClient } from '@shared/api/client';
import type { ApprovalRequest } from '@shared/types/api';

export default function ApprovalsPage() {
  const { authContext } = useAppAuth();
  const isFounder = authContext?.owner_type === 'founder';
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>('/api/approvals');
      const list = Array.isArray(res) ? res : res.data || [];
      setApprovals(list);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalRequestId: string) => {
    setProcessing(prev => new Set(prev).add(approvalRequestId));
    try {
      await apiClient.post('/api/executions/approve', {
        approval_request_id: approvalRequestId,
        approved: true,
      });
      fetchApprovals();
    } catch (err: any) {
      console.error('Failed to approve:', err);
      alert('Failed to approve: ' + (err?.response?.data?.error || err.message));
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(approvalRequestId); return next; });
    }
  };

  const handleReject = async (approvalRequestId: string) => {
    if (!window.confirm('Reject this approval request? This action cannot be undone.')) return;
    setProcessing(prev => new Set(prev).add(approvalRequestId));
    try {
      await apiClient.post('/api/executions/approve', {
        approval_request_id: approvalRequestId,
        approved: false,
        rejection_reason: 'Rejected by user',
      });
      fetchApprovals();
    } catch (err: any) {
      console.error('Failed to reject:', err);
      alert('Failed to reject: ' + (err?.response?.data?.error || err.message));
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(approvalRequestId); return next; });
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  if (loading) {
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
            Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Centralized Founder approvals interface
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchApprovals}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {approvals.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <VerifiedUserOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No approval requests found</Typography>
          <Typography variant="body2" color="text.secondary">
            There are no pending approval requests in the system.
          </Typography>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Pending Approvals ({approvals.filter(a => a.status === 'pending').length})</Typography>
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Approval ID</TableCell>
                    <TableCell>Execution</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.approval_request_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        #{approval.approval_request_id.slice(0, 8)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        #{approval.execution_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {approval.action_description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={approval.requested_by_type} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{approval.requested_by_id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={approval.priority} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={approval.status}
                          size="small"
                          color={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {approval.status === 'pending' && isFounder && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApprove(approval.approval_request_id)}
                                disabled={processing.has(approval.approval_request_id)}
                              >
                                {processing.has(approval.approval_request_id) ? (
                                  <CircularProgress size={18} color="inherit" />
                                ) : (
                                  <CheckCircleOutlined fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleReject(approval.approval_request_id)}
                                disabled={processing.has(approval.approval_request_id)}
                              >
                                <CancelOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                        {!isFounder && approval.status === 'pending' && (
                          <Typography variant="caption" color="text.secondary">
                            Founder action required
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}