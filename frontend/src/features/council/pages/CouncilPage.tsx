import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
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
  CircularProgress,
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

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const CouncilPage: React.FC = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const [seats, setSeats] = useState<SectionState<CouncilSeat[]>>({ data: [], loading: true, error: null });
  const [personas, setPersonas] = useState<SectionState<Persona[]>>({ data: [], loading: true, error: null });
  const [runtimeAssignments, setRuntimeAssignments] = useState<SectionState<RuntimePersonaAssignment[]>>({ data: [], loading: true, error: null });
  const [constitution, setConstitution] = useState<SectionState<Constitution | null>>({ data: null, loading: true, error: null });
  const [approvals, setApprovals] = useState<SectionState<ApprovalRequest[]>>({ data: [], loading: true, error: null });

  const fetchSeats = useCallback(async () => {
    setSeats(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<{ seats: CouncilSeat[] }>('/api/council/seats');
      setSeats({ data: Array.isArray(response.seats) ? response.seats : [], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch seats';
      setSeats(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const fetchPersonas = useCallback(async () => {
    setPersonas(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<{ data: Persona[] }>('/api/council/personas');
      setPersonas({ data: Array.isArray(response.data) ? response.data : [], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch personas';
      setPersonas(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const fetchRuntimeAssignments = useCallback(async () => {
    setRuntimeAssignments(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<{ data: RuntimePersonaAssignment[] }>('/api/council/runtime-assignments');
      setRuntimeAssignments({ data: Array.isArray(response.data) ? response.data : [], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch runtime assignments';
      setRuntimeAssignments(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const fetchConstitution = useCallback(async () => {
    setConstitution(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<{ data: Constitution }>('/api/council/constitution');
      setConstitution({ data: response.data, loading: false, error: null });
    } catch (err) {
      // Constitution 404 is expected when not yet active - show empty state
      const errorAny = err as any;
      const statusCode = errorAny?.response?.status;
      if (statusCode === 404 || errorAny?.code === 'NOT_FOUND') {
        setConstitution({ data: null, loading: false, error: null });
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch constitution';
        setConstitution(prev => ({ ...prev, loading: false, error: message }));
      }
    }
  }, []);

  const fetchApprovals = useCallback(async () => {
    setApprovals(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await apiClient.get<{ data: ApprovalRequest[]; limit: number; offset: number }>('/api/approvals');
      setApprovals({ data: Array.isArray(response.data) ? response.data : [], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch approvals';
      setApprovals(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchSeats();
    fetchPersonas();
    fetchRuntimeAssignments();
    fetchConstitution();
    fetchApprovals();
  }, [fetchSeats, fetchPersonas, fetchRuntimeAssignments, fetchConstitution, fetchApprovals]);

  useEffect(() => {
    fetchSeats();
    fetchPersonas();
    fetchRuntimeAssignments();
    fetchConstitution();
    fetchApprovals();
  }, [fetchSeats, fetchPersonas, fetchRuntimeAssignments, fetchConstitution, fetchApprovals]);

  const getPersonaForSeat = (seatId: string) => {
    return personas.data.find(p => p.seat_id === seatId);
  };

  const getRuntimeForPersona = (personaId: string) => {
    return runtimeAssignments.data.find(a => a.persona_id === personaId);
  };

  const anyLoading = seats.loading || personas.loading || runtimeAssignments.loading || constitution.loading || approvals.loading;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Council Membership
        </Typography>
        <Tooltip title="Refresh council data">
          <IconButton onClick={handleRefresh} disabled={anyLoading} aria-label="Refresh">
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
        {seats.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : seats.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load seats: {seats.error}
            <Button size="small" startIcon={<RefreshOutlined />} onClick={fetchSeats} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        ) : seats.data.length === 0 ? (
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
                {seats.data.map((seat) => {
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
        {personas.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : personas.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load personas: {personas.error}
            <Button size="small" startIcon={<RefreshOutlined />} onClick={fetchPersonas} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        ) : personas.data.length === 0 ? (
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
                {personas.data.map((persona) => {
                  const seat = seats.data.find(s => s.seat_id === persona.seat_id);
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
        {runtimeAssignments.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : runtimeAssignments.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load runtime assignments: {runtimeAssignments.error}
            <Button size="small" startIcon={<RefreshOutlined />} onClick={fetchRuntimeAssignments} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        ) : runtimeAssignments.data.length === 0 ? (
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
                  {runtimeAssignments.data
                    .filter(a => a.runtime === 'claude')
                    .map((assignment) => {
                      const persona = personas.data.find(p => p.persona_id === assignment.persona_id);
                      const seat = persona ? seats.data.find(s => s.seat_id === persona.seat_id) : null;

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
                  {runtimeAssignments.data
                    .filter(a => a.runtime === 'hermes')
                    .map((assignment) => {
                      const persona = personas.data.find(p => p.persona_id === assignment.persona_id);
                      const seat = persona ? seats.data.find(s => s.seat_id === persona.seat_id) : null;

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
        {constitution.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : constitution.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load constitution: {constitution.error}
            <Button size="small" startIcon={<RefreshOutlined />} onClick={fetchConstitution} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        ) : constitution.data ? (
          <Card sx={{ maxWidth: 800, mx: 'auto' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h5" gutterBottom>Constitution</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Version: {constitution.data.version} • Status: {constitution.data.status}
                  </Typography>
                </Box>
                <Chip
                  label={constitution.data.status}
                  color={
                    constitution.data.status === 'active' ? 'success' :
                    constitution.data.status === 'draft' ? 'warning' : 'default'
                  }
                  size="small"
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {constitution.data.content}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Created: {new Date(constitution.data.created_at).toLocaleString()} • Updated: {new Date(constitution.data.updated_at).toLocaleString()} • ID: {constitution.data.constitution_id}
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
        {approvals.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : approvals.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load approvals: {approvals.error}
            <Button size="small" startIcon={<RefreshOutlined />} onClick={fetchApprovals} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        ) : approvals.data.length === 0 ? (
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
                {approvals.data.map((approval) => (
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