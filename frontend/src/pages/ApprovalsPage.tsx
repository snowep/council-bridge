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
} from '@mui/material';
import { VerifiedUserOutlined, RefreshOutlined } from '@mui/icons-material';
import { apiClient } from '../services/api';
import type { ApprovalRequest } from '../types/api';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Approval ID</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Execution</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Requested By</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Priority</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((approval) => (
                    <tr key={approval.approval_request_id} style={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        #{approval.approval_request_id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        #{approval.execution_id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {approval.action_description}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Chip label={approval.requested_by_type} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{approval.requested_by_id}</Typography>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Chip label={approval.priority} size="small" variant="outlined" />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Chip label={approval.status} size="small" color={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'error' : 'warning'} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {approval.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="contained" color="success" onClick={() => alert('Approve: ' + approval.approval_request_id)}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => alert('Reject: ' + approval.approval_request_id)}>
                              Reject
                            </Button>
                          </Box>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}