import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  AccountBalanceOutlined,
  PersonOutlined,
  MemoryOutlined,
  DescriptionOutlined,
  GavelOutlined,
  HowToVoteOutlined,
  RefreshOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import type { CouncilSeat, Persona, RuntimePersonaAssignment, Constitution, ApprovalRequest } from '@shared/types/api';
import { TabPanel } from '@shared/components/TabPanel';

const statusChipColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  permanent: 'primary',
  replaceable: 'info',
  vacant: 'default',
  candidate: 'warning',
  approved: 'success',
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    permanent: 'Permanent',
    replaceable: 'Replaceable',
    vacant: 'Vacant',
    candidate: 'Candidate',
    approved: 'Approved',
  };
  return labels[status] || status;
};

const CouncilPage: React.FC = () => {
  const [value, setValue] = useState(0);
  const [seats, setSeats] = useState<CouncilSeat[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [runtimeAssignments, setRuntimeAssignments] = useState<RuntimePersonaAssignment[]>([]);
  const [constitution, setConstitution] = useState<Constitution | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        seatsResponse,
        personasResponse,
        assignmentsResponse,
        constitutionResponse,
        approvalsResponse,
      ] = await Promise.all([
        apiClient.get<{ seats: CouncilSeat[] }>('/api/council/seats'),
        apiClient.get<{ data: Persona[] }>('/api/council/personas'),
        apiClient.get<{ data: RuntimePersonaAssignment[] }>('/api/council/runtime-assignments'),
        apiClient.get<{ data: Constitution }>('/api/council/constitution'),
        apiClient.get<{ data: ApprovalRequest[]; limit: number; offset: number }>('/api/approvals'),
      ]);

      setSeats(Array.isArray(seatsResponse.seats) ? seatsResponse.seats : []);
      setPersonas(Array.isArray(personasResponse.data) ? personasResponse.data : []);
      setRuntimeAssignments(Array.isArray(assignmentsResponse.data) ? assignmentsResponse.data : []);
      setConstitution(constitutionResponse.data);
      setApprovals(Array.isArray(approvalsResponse.data) ? approvalsResponse.data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch council data';
      setError(message);
      console.error('Council data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAllData();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const getPersonaForSeat = (seatId: string) => {
    return personas.find(p => p.seat_id === seatId);
  };

  const getRuntimeForPersona = (personaId: string) => {
    return runtimeAssignments.find(a => a.persona_id === personaId);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
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
            onClick={handleRefresh}
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
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Council Membership
        </Typography>
        <Tooltip title="Refresh council data">
          <IconButton onClick={handleRefresh} disabled={loading} aria-label="Refresh">
            <RefreshOutlined />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={value} onChange={handleChange} aria-label="council tabs" variant="scrollable" scrollButtons="auto" sx={{ minWidth: '100%' }}>
          <Tab id="council-tab-0" label="Seats" icon={<AccountBalanceOutlined />} aria-controls="council-tabpanel-0" />
          <Tab id="council-tab-1" label="Personas" icon={<PersonOutlined />} aria-controls="council-tabpanel-1" />
          <Tab id="council-tab-2" label="Runtime Assignments" icon={<MemoryOutlined />} aria-controls="council-tabpanel-2" />
          <Tab id="council-tab-3" label="Constitution" icon={<DescriptionOutlined />} aria-controls="council-tabpanel-3" />
          <Tab id="council-tab-4" label="Approvals" icon={<GavelOutlined />} aria-controls="council-tabpanel-4" />
          <Tab id="council-tab-5" label="Voting" icon={<HowToVoteOutlined />} aria-controls="council-tabpanel-5" />
        </Tabs>
      </Box>

      {/* Seats Tab */}
      <TabPanel value={value} index={0}>
        {seats.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No council seats found
          </Typography>
        ) : (
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Seat ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Founder</TableCell>
                  <TableCell>Persona</TableCell>
                  <TableCell>Runtime</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {seats.map((seat) => {
                  const persona = getPersonaForSeat(seat.seat_id);
                  const runtimeAssignment = persona ? getRuntimeForPersona(persona.persona_id) : null;

                  return (
                    <TableRow key={seat.seat_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {seat.seat_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{seat.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(seat.status)}
                          size="small"
                          color={statusChipColors[seat.status]}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={seat.is_founder ? 'Founder' : 'Regular'}
                          size="small"
                          color={seat.is_founder ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {seat.is_founder ? (
                          <Chip label="Yes" size="small" color="success" icon={<AccountBalanceOutlined fontSize="small" />} />
                        ) : (
                          <Chip label="No" size="small" color="default" />
                        )}
                      </TableCell>
                      <TableCell>
                        {persona ? (
                          <Typography variant="body2">{persona.name}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Unassigned</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {runtimeAssignment ? (
                          <Chip
                            label={runtimeAssignment.runtime.toUpperCase()}
                            size="small"
                            color={runtimeAssignment.runtime === 'claude' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                        {new Date(seat.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Personas Tab */}
      <TabPanel value={value} index={1}>
        {personas.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No personas found
          </Typography>
        ) : (
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Persona ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Seat</TableCell>
                  <TableCell>Traits</TableCell>
                  <TableCell>Runtime</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {personas.map((persona) => {
                  const seat = seats.find(s => s.seat_id === persona.seat_id);
                  const runtimeAssignment = getRuntimeForPersona(persona.persona_id);

                  return (
                    <TableRow key={persona.persona_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {persona.persona_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{persona.name}</TableCell>
                      <TableCell>
                        {seat ? (
                          <Chip label={seat.name} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="body2" color="text.secondary">Unassigned</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {persona.traits || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {runtimeAssignment ? (
                          <Chip
                            label={runtimeAssignment.runtime.toUpperCase()}
                            size="small"
                            color={runtimeAssignment.runtime === 'claude' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">Unassigned</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                        {new Date(persona.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Runtime Assignments Tab */}
      <TabPanel value={value} index={2}>
        {runtimeAssignments.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No runtime assignments found
          </Typography>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>Claude Runtime</Typography>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Persona</TableCell>
                    <TableCell>Persona ID</TableCell>
                    <TableCell>Seat</TableCell>
                    <TableCell>Seat Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runtimeAssignments
                    .filter(a => a.runtime === 'claude')
                    .map((assignment) => {
                      const persona = personas.find(p => p.persona_id === assignment.persona_id);
                      const seat = persona ? seats.find(s => s.seat_id === persona.seat_id) : null;

                      return (
                        <TableRow key={assignment.persona_id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{persona?.name || 'Unknown'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{assignment.persona_id}</TableCell>
                          <TableCell>{seat?.name || 'Unassigned'}</TableCell>
                          <TableCell>
                            {seat ? (
                              <Chip
                                label={getStatusLabel(seat.status)}
                                size="small"
                                color={statusChipColors[seat.status]}
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>Hermes Runtime</Typography>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Persona</TableCell>
                    <TableCell>Persona ID</TableCell>
                    <TableCell>Seat</TableCell>
                    <TableCell>Seat Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runtimeAssignments
                    .filter(a => a.runtime === 'hermes')
                    .map((assignment) => {
                      const persona = personas.find(p => p.persona_id === assignment.persona_id);
                      const seat = persona ? seats.find(s => s.seat_id === persona.seat_id) : null;

                      return (
                        <TableRow key={assignment.persona_id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{persona?.name || 'Unknown'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{assignment.persona_id}</TableCell>
                          <TableCell>{seat?.name || 'Unassigned'}</TableCell>
                          <TableCell>
                            {seat ? (
                              <Chip
                                label={getStatusLabel(seat.status)}
                                size="small"
                                color={statusChipColors[seat.status]}
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </TabPanel>

      {/* Constitution Tab */}
      <TabPanel value={value} index={3}>
        {constitution ? (
          <Card sx={{ maxWidth: 800, mx: 'auto' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h5" gutterBottom>Constitution</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Version: {constitution.version} • Status: {constitution.status}
                  </Typography>
                </Box>
                <Chip
                  label={constitution.status}
                  color={
                    constitution.status === 'active' ? 'success' :
                    constitution.status === 'draft' ? 'warning' : 'default'
                  }
                  size="small"
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {constitution.content}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Created: {new Date(constitution.created_at).toLocaleString()} • Updated: {new Date(constitution.updated_at).toLocaleString()} • ID: {constitution.constitution_id}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No constitution found
          </Typography>
        )}
      </TabPanel>

      {/* Approvals Tab */}
      <TabPanel value={value} index={4}>
        {approvals.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No approval requests found
          </Typography>
        ) : (
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Approval ID</TableCell>
                  <TableCell>Execution ID</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
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
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {approval.action_description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={approval.status}
                        size="small"
                        color={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'error' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                      {new Date(approval.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Voting Tab */}
      <TabPanel value={value} index={5}>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Voting Records - Coming Soon
        </Typography>
      </TabPanel>
    </Box>
  );
};

export default CouncilPage;