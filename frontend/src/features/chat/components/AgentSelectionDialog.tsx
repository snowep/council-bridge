import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Avatar,
  Typography,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  SearchOutlined,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiClient, getErrorMessage } from '@shared/api/client';
import type { StaffAgent, Division } from '@shared/types/api';
import { ParticipantIcon, PARTICIPANT_COLORS } from '../constants';

interface AgentOption {
  id: string;
  name: string;
  type: 'founder' | 'staff' | 'division';
  runtime?: string;
  status?: string;
}

interface AgentSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (agent: AgentOption) => void;
  currentUserId: string;
}

export function AgentSelectionDialog({
  open,
  onClose,
  onSelect,
  currentUserId,
}: AgentSelectionDialogProps) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentOption[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch staff agents
      const staffResponse = await apiClient.get<{ staff: StaffAgent[] }>('/api/staff');
      const staffAgents: AgentOption[] = (staffResponse?.staff || [])
        .filter(s => s.status === 'active' && s.staff_id !== currentUserId)
        .map(s => ({
          id: s.staff_id,
          name: s.name,
          type: 'staff' as const,
          runtime: Array.isArray(s.runtime_instances) ? s.runtime_instances.join(', ') : s.runtime_instances,
          status: s.status,
        }));

      // Fetch divisions
      const divResponse = await apiClient.get<{ divisions: Division[] }>('/api/divisions');
      const divisionAgents: AgentOption[] = (divResponse?.divisions || []).map(d => ({
        id: d.division_id,
        name: d.name,
        type: 'division' as const,
      }));

      // Add founder if not current user
      const allAgents: AgentOption[] = [];
      if (currentUserId !== 'founder') {
        allAgents.push({
          id: 'founder',
          name: 'Founder',
          type: 'founder',
        });
      }

      const combined = [...allAgents, ...staffAgents, ...divisionAgents];
      setAgents(combined);
      setFilteredAgents(combined);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to load agents');
      setError(msg);
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (open) {
      setSearchValue('');
      setFilteredAgents(agents);
      searchRef.current?.focus();
    }
  }, [open, agents]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    const lower = value.toLowerCase();
    setFilteredAgents(
      agents.filter(
        a => a.name.toLowerCase().includes(lower) || a.id.toLowerCase().includes(lower)
      )
    );
  };

  const handleSelect = (agent: AgentOption) => {
    onSelect(agent);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ '& .MuiDialog-paper': { maxHeight: '80vh', overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Start New Conversation</Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, maxHeight: '60vh', overflow: 'auto' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            placeholder="Search agents..."
            size="small"
            fullWidth
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            inputRef={searchRef}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchOutlined color="action" sx={{ mr: 1 }} /></InputAdornment> }
            }}
          />
        </Box>
        {error && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography variant="body2">{error}</Typography>
            <Button variant="outlined" size="small" onClick={fetchAgents}>
              Retry
            </Button>
          </Box>
        )}
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Loading agents...
            </Typography>
          </Box>
        ) : filteredAgents.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {searchValue ? 'No matching agents found' : 'No available agents'}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredAgents.map((agent) => (
              <ListItem key={agent.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <ListItemButton onClick={() => handleSelect(agent)}>
                  <Avatar sx={{ bgcolor: PARTICIPANT_COLORS[agent.type] + '.main' }}>
                    <ParticipantIcon type={agent.type} size="small" />
                  </Avatar>
                  <ListItemText primary={agent.name} secondary={agent.id} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={agent.type} size="small" variant="outlined" color={PARTICIPANT_COLORS[agent.type] as any} />
                    {agent.runtime && <Chip label={agent.runtime} size="small" variant="outlined" color="default" />}
                    {agent.status && <Chip label={agent.status} size="small" variant="outlined" color={agent.status === 'active' ? 'success' : 'default'} />}
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
        <Divider />
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}