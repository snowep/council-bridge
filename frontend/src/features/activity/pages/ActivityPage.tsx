import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Chip,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Pagination,
  Skeleton,
  InputAdornment,
} from '@mui/material';
import {
  History,
  Task,
  Description,
  Person,
  Business,
  HowToVote,
  PlayArrow,
  Message,
  Event,
  RefreshOutlined,
  SearchOutlined,
  FilterListOutlined,
  KeyboardArrowUp,
} from '@mui/icons-material';
import { apiClient } from '@shared/api/client';
import { useAppAuth } from '@app/use-app-auth';
import type { ActivityResponse, ActivityItem } from '@shared/types/api';

const ACTIVITY_TYPES: ActivityItem['type'][] = [
  'task',
  'deliverable',
  'staff',
  'division',
  'approval',
  'execution',
  'message',
  'meeting',
];

const TYPE_LABELS: Record<ActivityItem['type'], string> = {
  task: 'Task',
  deliverable: 'Deliverable',
  staff: 'Staff',
  division: 'Division',
  approval: 'Approval',
  execution: 'Execution',
  message: 'Message',
  meeting: 'Meeting',
};

const TYPE_ICONS: Record<ActivityItem['type'], React.ReactElement> = {
  task: <Task fontSize="small" />,
  deliverable: <Description fontSize="small" />,
  staff: <Person fontSize="small" />,
  division: <Business fontSize="small" />,
  approval: <HowToVote fontSize="small" />,
  execution: <PlayArrow fontSize="small" />,
  message: <Message fontSize="small" />,
  meeting: <Event fontSize="small" />,
};

const TYPE_COLORS: Record<ActivityItem['type'], 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  task: 'primary',
  deliverable: 'info',
  staff: 'secondary',
  division: 'primary',
  approval: 'warning',
  execution: 'success',
  message: 'default',
  meeting: 'default',
};

const DEFAULT_PAGE_SIZE = 20;

const formatTime = (timeStr: string): string => {
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

interface FilterState {
  types: ActivityItem['type'][];
  search: string;
  dateFrom: string;
  dateTo: string;
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    types: [],
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const { authContext } = useAppAuth();
  const isFounder = authContext?.owner_type === 'founder';

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  const fetchActivity = useCallback(async (pageNum: number) => {
    try {
      setError(null);
      if (pageNum === 1) setLoading(true);

      const params: Record<string, string | number> = {
        limit: DEFAULT_PAGE_SIZE,
        offset: (pageNum - 1) * DEFAULT_PAGE_SIZE,
      };

      if (filters.types.length > 0) {
        params.types = filters.types.join(',');
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const response = await apiClient.get<ActivityResponse>('/api/activity', params);

      if (pageNum === 1) {
        setActivity(response.activity);
      } else {
        setActivity(prev => [...prev, ...response.activity]);
      }

      // Calculate total from available data; backend doesn't return total_count yet
      // Use limit * (totalPages - 1) + current page items as approximation
      setTotalCount(response.limit * Math.max(1, Math.ceil((response.offset + response.activity.length) / response.limit)));
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setPage(1);
    fetchActivity(1);
  }, [fetchActivity]);

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
    fetchActivity(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchActivity(1);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ types: [], search: '', dateFrom: '', dateTo: '' });
    setPage(1);
    fetchActivity(1);
  };

  const hasActiveFilters = filters.types.length > 0 || filters.search || filters.dateFrom || filters.dateTo;

  const renderSkeletonRow = () => (
    <TableRow>
      <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
      <TableCell><Skeleton variant="text" width="60%" /></TableCell>
      <TableCell><Skeleton variant="text" width="80%" /></TableCell>
      <TableCell><Skeleton variant="text" width="40%" /></TableCell>
    </TableRow>
  );

  const handleRowClick = (href?: string) => {
    if (href) {
      window.location.href = href;
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, href?: string) => {
    if (href && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      window.location.href = href;
    }
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isFounder ? 'Organization-wide activity feed' : 'Your recent activity'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip title={filterOpen ? 'Hide filters' : 'Show filters'}>
            <IconButton
              onClick={() => setFilterOpen(!filterOpen)}
              color={hasActiveFilters ? 'primary' : 'inherit'}
              aria-label={filterOpen ? 'Hide filters' : 'Show filters'}
              aria-expanded={filterOpen}
            >
              <FilterListOutlined />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => fetchActivity(page)}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filter Panel */}
      {filterOpen && (
        <Paper sx={{ p: 2, mb: 3, border: hasActiveFilters ? '1px solid' : 0, borderColor: 'primary.main' }}>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}
          >
            <TextField
              placeholder="Search activity..."
              size="small"
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchOutlined color="action" sx={{ mr: 1 }} /></InputAdornment> }
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="type-filter-label">Type</InputLabel>
              <Select
                labelId="type-filter-label"
                value={filters.types}
                label="Type"
                multiple
                onChange={e => handleFilterChange('types', Array.isArray(e.target.value) ? e.target.value : [])}
                renderValue={selected => selected.join(', ') || 'All types'}
              >
                {ACTIVITY_TYPES.map(type => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {TYPE_ICONS[type]}
                      <Typography variant="body2">{TYPE_LABELS[type]}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="date-from-label">From</InputLabel>
              <Select
                labelId="date-from-label"
                value={filters.dateFrom}
                label="From"
                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                displayEmpty
              >
                <MenuItem value="">{'—'}</MenuItem>
                <MenuItem value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>Yesterday</MenuItem>
                <MenuItem value={new Date(Date.now() - 604800000).toISOString().split('T')[0]}>Last 7 days</MenuItem>
                <MenuItem value={new Date(Date.now() - 2592000000).toISOString().split('T')[0]}>Last 30 days</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="date-to-label">To</InputLabel>
              <Select
                labelId="date-to-label"
                value={filters.dateTo}
                label="To"
                onChange={e => handleFilterChange('dateTo', e.target.value)}
                displayEmpty
              >
                <MenuItem value="">{'—'}</MenuItem>
                <MenuItem value={new Date().toISOString().split('T')[0]}>Today</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button type="submit" variant="contained" startIcon={<SearchOutlined />}>
                Apply
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="outlined" onClick={clearFilters} startIcon={<KeyboardArrowUp />}>
                  Clear
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
          <Button
            startIcon={<RefreshOutlined />}
            onClick={() => { setLoading(true); fetchActivity(page); }}
            size="small"
            sx={{ mx: 1 }}
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Activity Table */}
      <Card>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 48 }}>Type</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell style={{ width: 140, whiteSpace: 'nowrap' }}>Time</TableCell>
                <TableCell style={{ width: 200 }}>Context</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && page === 1 ? (
                Array.from({ length: 5 }).map(() => renderSkeletonRow())
              ) : activity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <History sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" gutterBottom color="text.secondary">
                        {hasActiveFilters ? 'No activity matches your filters' : 'No recent activity found'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {hasActiveFilters ? 'Try adjusting your search or filter criteria.' : 'Activity will appear here as actions occur.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                activity.map(item => (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => handleRowClick(item.href)}
                    onKeyDown={e => handleRowKeyDown(e, item.href)}
                    tabIndex={item.href ? 0 : -1}
                    sx={{ cursor: item.href ? 'pointer' : 'default' }}
                  >
                    <TableCell>
                      <Tooltip title={TYPE_LABELS[item.type]} arrow>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                            bgcolor: (theme) => {
                              const colorMap: Record<string, string> = {
                                primary: theme.palette.primary.light,
                                secondary: theme.palette.secondary.light,
                                info: theme.palette.info.light,
                                success: theme.palette.success.light,
                                warning: theme.palette.warning.light,
                                error: theme.palette.error.light,
                                default: theme.palette.grey[300],
                              };
                              return colorMap[TYPE_COLORS[item.type]] || theme.palette.grey[300];
                            },
                            color: (theme) => {
                              const colorMap: Record<string, string> = {
                                primary: theme.palette.primary.contrastText,
                                secondary: theme.palette.secondary.contrastText,
                                info: theme.palette.info.contrastText,
                                success: theme.palette.success.contrastText,
                                warning: theme.palette.warning.contrastText,
                                error: theme.palette.error.contrastText,
                                default: theme.palette.getContrastText(theme.palette.grey[300]),
                              };
                              return colorMap[TYPE_COLORS[item.type]] || theme.palette.getContrastText(theme.palette.grey[300]);
                            },
                          }}
                          aria-label={`${TYPE_LABELS[item.type]} activity`}
                        >
                          {TYPE_ICONS[item.type]}
                        </Avatar>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500, display: 'block' }}>
                        {item.title}
                      </Typography>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {Object.entries(item.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTime(item.time)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const meta = item.metadata as Record<string, unknown> | undefined;
                        const actorType = meta?.actor_type;
                        const actorName = meta?.actor_name;
                        return (actorType && actorName) ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={String(actorType)}
                              size="small"
                              variant="outlined"
                              sx={{ textTransform: 'capitalize' }}
                            />
                            <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(actorName)}
                            </Typography>
                          </Box>
                        ) : null;
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="small"
              shape="rounded"
              showFirstButton
              showLastButton
              boundaryCount={1}
              siblingCount={1}
              aria-label="Activity pagination"
            />
          </Box>
        )}
      </Card>
    </Box>
  );
}