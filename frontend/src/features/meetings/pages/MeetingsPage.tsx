import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Card,
  CardContent,
  Divider,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  MeetingRoomOutlined,
  DescriptionOutlined,
  GavelOutlined,
  AssignmentOutlined,
  RefreshOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import type { Meeting, MeetingPhase } from '@shared/types/api';

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
      id={`meetings-tabpanel-${index}`}
      aria-labelledby={`meetings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MeetingsPage: React.FC = () => {
  const [value, setValue] = useState(0);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [phases, setPhases] = useState<MeetingPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ meetings: Meeting[], limit: number, offset: number }>('/api/meetings');
      setMeetings(Array.isArray(response.meetings) ? response.meetings : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch meetings';
      setError(message);
      console.error('Meetings fetch error:', err);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingDetails = async (meetingId: string) => {
    try {
      const [meetingRes, phasesRes] = await Promise.all([
        apiClient.get<{ meeting: Meeting }>(`/api/meetings/${meetingId}`),
        apiClient.get<{ phases: MeetingPhase[] }>(`/api/meetings/${meetingId}/phases`),
      ]);
      setSelectedMeeting(meetingRes.meeting);
      setPhases(Array.isArray(phasesRes.phases) ? phasesRes.phases : []);
      setViewDialogOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch meeting details';
      setError(message);
      console.error('Meeting details fetch error:', err);
    }
  };

  const handleRefresh = () => {
    fetchMeetings();
    if (selectedMeeting) {
      fetchMeetingDetails(selectedMeeting.meeting_id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Meetings</Typography>
          <Tooltip title="Refresh meetings">
            <IconButton onClick={handleRefresh} disabled={loading} aria-label="Refresh">
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="meetings tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minWidth: '100%' }}
          >
            <Tab
              id="meetings-tab-0"
              label="All Meetings"
              icon={<MeetingRoomOutlined />}
              aria-controls="meetings-tabpanel-0"
            />
            <Tab
              id="meetings-tab-1"
              label="Agenda & Phases"
              icon={<DescriptionOutlined />}
              aria-controls="meetings-tabpanel-1"
            />
            <Tab
              id="meetings-tab-2"
              label="Decisions"
              icon={<GavelOutlined />}
              aria-controls="meetings-tabpanel-2"
            />
            <Tab
              id="meetings-tab-3"
              label="Action Items"
              icon={<AssignmentOutlined />}
              aria-controls="meetings-tabpanel-3"
            />
          </Tabs>
        </Box>

        {/* All Meetings Tab */}
        <TabPanel value={value} index={0}>
          {meetings.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No meetings found
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Meeting ID</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow key={meeting.meeting_id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {meeting.meeting_id}
                      </TableCell>
                      <TableCell>{meeting.title}</TableCell>
                      <TableCell>
                        <Chip
                          label={meeting.status}
                          size="small"
                          color={
                            meeting.status === 'completed' ? 'success' :
                            meeting.status === 'in_progress' ? 'primary' :
                            meeting.status === 'scheduled' ? 'info' : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                        {formatDate(meeting.created_at)}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            onClick={() => fetchMeetingDetails(meeting.meeting_id)}
                            aria-label="View details"
                            size="small"
                          >
                            <VisibilityOutlined />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Agenda & Phases Tab */}
        <TabPanel value={value} index={1}>
          {selectedMeeting ? (
            <Box>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>{selectedMeeting.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(selectedMeeting.created_at)}
                      </Typography>
                    </Box>
                    <Chip
                      label={selectedMeeting.status}
                      size="small"
                      color={
                        selectedMeeting.status === 'completed' ? 'success' :
                        selectedMeeting.status === 'in_progress' ? 'primary' :
                        selectedMeeting.status === 'scheduled' ? 'info' : 'default'
                      }
                      variant="outlined"
                    />
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {phases.length === 0 ? (
                    <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No phases found for this meeting
                    </Typography>
                  ) : (
                    <Box>
                      {phases.map((phase) => (
                        <Card key={phase.phase_id} sx={{ mb: 2 }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                              Phase: {phase.phase}
                            </Typography>
                            <Typography variant="body2">
                              Status: {phase.status}
                            </Typography>
                            {phase.started_at && phase.completed_at && (
                              <Typography variant="body2" color="text.secondary">
                                Started: {formatDate(phase.started_at)} - Completed: {formatDate(phase.completed_at)}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Select a meeting from the "All Meetings" tab to view agenda and phases
            </Typography>
          )}
        </TabPanel>

        {/* Decisions Tab */}
        <TabPanel value={value} index={2}>
          {selectedMeeting ? (
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Decisions for: {selectedMeeting.title}</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Decision records for this meeting will be displayed here when data is available.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Select a meeting from the "All Meetings" tab to view decisions
            </Typography>
          )}
        </TabPanel>

        {/* Action Items Tab */}
        <TabPanel value={value} index={3}>
          {selectedMeeting ? (
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Action Items for: {selectedMeeting.title}</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Action items tracked from this meeting.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Select a meeting from the "All Meetings" tab to view action items
            </Typography>
          )}
        </TabPanel>

        {/* View Meeting Details Dialog */}
        <Dialog
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          maxWidth="md"
          fullWidth
          sx={{ '& .MuiDialog-paper': { maxHeight: '80vh', overflow: 'auto' } }}
        >
          {selectedMeeting && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6">{selectedMeeting.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedMeeting.meeting_id} • {selectedMeeting.status}
                  </Typography>
                </Box>
                <Chip
                  label={selectedMeeting.status}
                  size="small"
                  color={
                    selectedMeeting.status === 'completed' ? 'success' :
                    selectedMeeting.status === 'in_progress' ? 'primary' :
                    selectedMeeting.status === 'scheduled' ? 'info' : 'default'
                  }
                  variant="outlined"
                />
              </DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Meeting Info */}
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Meeting Information</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Meeting ID</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {selectedMeeting.meeting_id}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Title</Typography>
                          <Typography variant="body1">{selectedMeeting.title}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Typography variant="body1">{selectedMeeting.status}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Created</Typography>
                          <Typography variant="body1">{formatDate(selectedMeeting.created_at)}</Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Phases */}
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Phases ({phases.length})</Typography>
                      {phases.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                          No phases
                        </Typography>
                      ) : (
                        <Box>
                          {phases.map((phase) => (
                            <Paper key={phase.phase_id} sx={{ p: 2, mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{phase.phase}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {phase.status} • Phase ID: {phase.phase_id}
                              </Typography>
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>

                  {/* Decisions */}
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Decisions (0)</Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                        No decisions recorded yet
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
  );
};

export default MeetingsPage;