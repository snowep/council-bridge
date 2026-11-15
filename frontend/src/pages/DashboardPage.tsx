import { useState, useEffect } from 'react';
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
} from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { apiClient } from '../services/api';
import type { Division, StaffAgent, ApprovalRequest } from '../types/api';

export default function DashboardPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [staff, setStaff] = useState<StaffAgent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [divRes, staffRes, apprRes] = await Promise.all([
        apiClient.get<{ divisions: Division[] }>('/api/divisions'),
        apiClient.get<{ staff: StaffAgent[] }>('/api/staff'),
        apiClient.get<{ data: ApprovalRequest[] }>('/api/approvals'),
      ]);
      setDivisions(Array.isArray(divRes?.divisions) ? divRes.divisions : []);
      setStaff(Array.isArray(staffRes?.staff) ? staffRes.staff : []);
      const apprList = Array.isArray(apprRes?.data) ? apprRes.data : (Array.isArray(apprRes) ? apprRes : []);
      setApprovals(apprList);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const activeDivisions = divisions.filter(d => d.head_staff_id).length || divisions.length;
  const activeStaff = staff.filter(s => s.status === 'active').length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
          <Button
            onClick={fetchDashboardData}
            startIcon={<RefreshOutlined />}
            size="small"
            sx={{ ml: 2 }}
          >
            Retry
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Founder Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastRefreshed && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </Typography>
          )}
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchDashboardData} size="small">
            Refresh
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
            <Box sx={{ p: 2, textAlign: 'center' }}>
              {recentActivity.length > 0 ? (
                <>
                  {recentActivity.map((item, idx) => (
                    <Box key={idx} sx={{ py: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'left' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.time} • {item.type}
                      </Typography>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography color="text.secondary">No recent activity</Typography>
              )}
            </Box>
          </Paper>
        </Box>
        <Box sx={{ flex: '1 1 250px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Active Divisions</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{activeDivisions}</Typography>
              <Chip label={`${divisions.length} total`} size="small" variant="outlined" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Staff Agents</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{activeStaff}</Typography>
              <Chip label={`${staff.length} total`} size="small" variant="outlined" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Pending Approvals</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{pendingApprovals}</Typography>
              <Chip label={`${approvals.length} total`} size="small" variant="outlined" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

const recentActivity = [
  { title: 'Deliverable submitted for review', time: '2 min ago', type: 'deliverable' },
  { title: 'Task assigned to Engineering division', time: '15 min ago', type: 'task' },
  { title: 'New staff agent approved: Sarah Chen', time: '1 hour ago', type: 'staff' },
  { title: 'Council meeting #12 completed', time: '3 hours ago', type: 'meeting' },
  { title: 'Execution request approved by Founder', time: '5 hours ago', type: 'execution' },
];