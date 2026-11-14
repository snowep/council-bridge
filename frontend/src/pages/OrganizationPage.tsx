import React, { useState, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { apiClient } from '../services/api';
import type { Division, StaffAgent, DivisionMember } from '../types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`organization-tabpanel-${index}`}
      aria-labelledby={`organization-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OrganizationPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [staff, setStaff] = useState<StaffAgent[]>([]);
  const [members, setMembers] = useState<DivisionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [divRes, staffRes, memRes] = await Promise.all([
        apiClient.get<any>('/api/divisions'),
        apiClient.get<any>('/api/staff'),
        apiClient.get<any>('/api/divisions/members'),
      ]);
      setDivisions(Array.isArray(divRes) ? divRes : divRes.data || []);
      setStaff(Array.isArray(staffRes) ? staffRes : staffRes.data || []);
      setMembers(Array.isArray(memRes) ? memRes : memRes.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getDivisionName = (divisionId: string) => {
    const div = divisions.find(d => d.division_id === divisionId);
    return div?.name || divisionId;
  };

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
        <Typography color="error">{error}</Typography>
        <Button
          onClick={fetchData}
          startIcon={<RefreshOutlined />}
          variant="contained"
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Organization</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchData} disabled={loading} aria-label="Refresh">
            <RefreshOutlined />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={value} onChange={handleChange} aria-label="organization tabs" variant="scrollable" scrollButtons="auto">
          <Tab label="Divisions" />
          <Tab label="Staff" />
          <Tab label="Members" />
        </Tabs>
      </Box>

      {/* Tab 0: Divisions */}
      <TabPanel value={value} index={0}>
        <Typography variant="h6" gutterBottom>Divisions</Typography>
        {divisions.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No divisions found</Typography>
          </Card>
        ) : (
          <Box>
            {divisions.map((division) => (
              <Card key={division.division_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{division.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{division.description || 'No description'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={division.head_staff_id || 'No Head'} size="small" variant="outlined" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Tab 1: Staff */}
      <TabPanel value={value} index={1}>
        <Typography variant="h6" gutterBottom>Staff Agents</Typography>
        {staff.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No staff agents found</Typography>
          </Card>
        ) : (
          <Box>
            {staff.map((agent) => (
              <Card key={agent.staff_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{agent.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {agent.role} • {agent.runtime_instances.length} instances
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={agent.division_id || 'Unassigned'} size="small" variant="outlined" />
                      <Chip label={agent.status} size="small" color={agent.status === 'active' ? 'success' : 'default'} variant="outlined" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Tab 2: Members */}
      <TabPanel value={value} index={2}>
        <Typography variant="h6" gutterBottom>Division Members</Typography>
        {members.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No division members found</Typography>
          </Card>
        ) : (
          <Box>
            {members.map((member) => {
              const staffMember = staff.find(s => s.staff_id === member.staff_id);
              return (
                <Card key={`${member.division_id}-${member.staff_id}`} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {getDivisionName(member.division_id)} → {staffMember?.name || member.staff_id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Role: {staffMember?.role || 'N/A'} • Status: {staffMember?.status || 'N/A'}
                        </Typography>
                      </Box>
                      <Chip label={staffMember?.status || 'unknown'} size="small" color={staffMember?.status === 'active' ? 'success' : 'default'} variant="outlined" />
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </TabPanel>
    </Box>
  );
}