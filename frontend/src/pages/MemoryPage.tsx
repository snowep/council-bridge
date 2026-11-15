import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Pagination,
} from '@mui/material';
import {
  RefreshOutlined,
  SearchOutlined,
  Memory as MemoryIcon,
  DescriptionOutlined,
  CategoryOutlined,
} from '@mui/icons-material';
import { apiClient } from '../services/api';

interface MemoryEntry {
  memory_id: string;
  owner_type: string;
  owner_id: string;
  category: string;
  memory_type: string;
  title: string;
  content: string;
  tags: string;
  confidence: number;
  version_num: number;
  supersedes_id: string | null;
  meeting_id: string | null;
  division_id: string | null;
  task_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'constitution', label: 'Constitution' },
  { value: 'decision', label: 'Decision' },
  { value: 'execution', label: 'Execution' },
  { value: 'task', label: 'Task' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'council', label: 'Council' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'research', label: 'Research' },
];

const OWNER_TYPES = [
  { value: '', label: 'All Owners' },
  { value: 'founder', label: 'Founder' },
  { value: 'staff', label: 'Staff' },
  { value: 'division', label: 'Division' },
  { value: 'seat', label: 'Seat' },
];

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [ownerType, setOwnerType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchMemory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        archived: false,
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (ownerType) params.owner_type = ownerType;

      const response = await apiClient.get<any>('/api/memory', params);
      const list = Array.isArray(response) ? response : (response.entries || response.data || []);
      setEntries(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch memory entries');
      console.error('Memory fetch error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (entry: MemoryEntry) => {
    setSelected(entry);
    setDetailOpen(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMemory();
  };

  useEffect(() => {
    fetchMemory();
  }, [page, category, ownerType]);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Memory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse and search institutional memory
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchMemory}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search memory..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 250 }}
            slotProps={{ input: { startAdornment: <SearchOutlined color="action" sx={{ mr: 1 }} /> } }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="category-filter-label">Category</InputLabel>
            <Select
              labelId="category-filter-label"
              value={category}
              label="Category"
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <MenuItem value="">All Categories</MenuItem>
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="owner-filter-label">Owner</InputLabel>
            <Select
              labelId="owner-filter-label"
              value={ownerType}
              label="Owner"
              onChange={(e) => { setOwnerType(e.target.value); setPage(1); }}
            >
              {OWNER_TYPES.map((owner) => (
                <MenuItem key={owner.value} value={owner.value}>{owner.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" startIcon={<SearchOutlined />}>
            Search
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
          <CircularProgress />
        </Box>
      ) : entries.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <MemoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No memory entries found</Typography>
          <Typography variant="body2" color="text.secondary">
            {search || category ? 'No entries match your filters. Try adjusting the search.' : 'No memory entries exist yet.'}
          </Typography>
        </Card>
      ) : (
        <>
          <Card>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.memory_id} hover onClick={() => openDetail(entry)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DescriptionOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.title}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {entry.memory_id.slice(0, 8)} • v{entry.version_num}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={entry.category} size="small" variant="outlined" icon={<CategoryOutlined />} />
                      </TableCell>
                      <TableCell>
                        <Chip label={`${entry.owner_type}:${entry.owner_id.slice(0, 12)}`} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.updated_at)}</TableCell>
                      <TableCell>
                        <Tooltip title="View details">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(entry); }}>
                            <DescriptionOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              count={Math.max(1, Math.ceil(entries.length / pageSize))}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              size="small"
            />
          </Box>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionOutlined />
                {selected.title}
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip label={`Category: ${selected.category}`} size="small" variant="outlined" />
                <Chip label={`Owner: ${selected.owner_type}:${selected.owner_id}`} size="small" variant="outlined" />
                <Chip label={`Version: ${selected.version_num}`} size="small" variant="outlined" />
                <Chip label={`Confidence: ${selected.confidence}`} size="small" variant="outlined" />
              </Box>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                {selected.content}
              </Typography>
              {selected.tags && JSON.parse(selected.tags).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {JSON.parse(selected.tags).map((tag: string, i: number) => (
                    <Chip key={i} label={tag} size="small" />
                  ))}
                </Box>
              )}
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Created: {formatDate(selected.created_at)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Updated: {formatDate(selected.updated_at)}
                </Typography>
                {selected.meeting_id && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Meeting: {selected.meeting_id}
                  </Typography>
                )}
                {selected.task_id && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Task: {selected.task_id}
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}