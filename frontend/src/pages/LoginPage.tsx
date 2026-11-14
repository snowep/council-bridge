import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Alert,
  InputLabel,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
} from '@mui/material';
import { useAppAuth } from '../app/App';

const RUNTIME_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'hermes', label: 'Hermes' },
];

const OWNER_TYPE_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'seat', label: 'Council Seat' },
  { value: 'staff', label: 'Staff Agent' },
  { value: 'division', label: 'Division' },
];

const SEAT_OPTIONS = [
  { value: 'seat-01', label: 'Council Seat 01 (Steve Jobs)' },
  { value: 'seat-02', label: 'Council Seat 02 (Virgil Abloh)' },
  { value: 'seat-03', label: 'Council Seat 03 (Shawn Stüssy)' },
  { value: 'seat-04', label: 'Council Seat 04 (G-Dragon)' },
  { value: 'seat-05', label: 'Council Seat 05 (Vacant)' },
  { value: 'seat-06', label: 'Council Seat 06 (Vacant)' },
  { value: 'seat-07', label: 'Council Seat 07 (Vacant)' },
  { value: 'seat-08', label: 'Council Seat 08 (Vacant)' },
  { value: 'seat-09', label: 'Council Seat 09 (Vacant)' },
  { value: 'seat-10', label: 'Council Seat 10 (Vacant)' },
  { value: 'seat-11', label: 'Council Seat 11 (Vacant)' },
];

const STAFF_OPTIONS = [
  { value: 'staff-dev-head-001', label: 'Staff: Developer Division Head' },
  { value: 'staff-marketing-head-001', label: 'Staff: Marketing Division Head' },
  { value: 'staff-finance-head-001', label: 'Staff: Finance Division Head' },
  { value: 'staff-creative-head-001', label: 'Staff: Creative Division Head' },
  { value: 'staff-research-head-001', label: 'Staff: Research Division Head' },
];

const DIVISION_OPTIONS = [
  { value: 'developer', label: 'Division: Developer' },
  { value: 'marketing', label: 'Division: Marketing' },
  { value: 'finance', label: 'Division: Finance' },
  { value: 'creative', label: 'Division: Creative' },
  { value: 'research-intelligence', label: 'Division: Research & Intelligence' },
  { value: 'business-operations', label: 'Division: Business Operations' },
];

function getOwnerIdOptions(ownerType: string) {
  switch (ownerType) {
    case 'founder':
      return [{ value: 'founder', label: 'Founder' }];
    case 'seat':
      return SEAT_OPTIONS;
    case 'staff':
      return STAFF_OPTIONS;
    case 'division':
      return DIVISION_OPTIONS;
    default:
      return [];
  }
}

export default function LoginPage() {
  const { login, isLoading, navigateAfterLogin } = useAppAuth();
  const [ownerType, setOwnerType] = useState<'founder' | 'seat' | 'staff' | 'division'>('founder');
  const [ownerId, setOwnerId] = useState('founder');
  const [runtime, setRuntime] = useState<'claude' | 'hermes'>('claude');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset ownerId when ownerType changes
  React.useEffect(() => {
    const options = getOwnerIdOptions(ownerType);
    if (options.length > 0) {
      setOwnerId(options[0].value);
    }
  }, [ownerType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(ownerType, ownerId, runtime);
      navigateAfterLogin();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'grey.50' }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
              Council Bridge
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to access the command center
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
            )}

            <FormControl fullWidth sx={{ mb: 2 }} size="small">
              <InputLabel id="owner-type-label">Account Type</InputLabel>
              <Select
                labelId="owner-type-label"
                value={ownerType}
                label="Account Type"
                name="owner_type"
                onChange={(e) => setOwnerType(e.target.value as 'founder' | 'seat' | 'staff' | 'division')}
              >
                {OWNER_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }} size="small">
              <InputLabel id="owner-id-label">Account ID</InputLabel>
              <Select
                labelId="owner-id-label"
                value={ownerId}
                label="Account ID"
                name="owner_id"
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {getOwnerIdOptions(ownerType).map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }} size="small">
              <InputLabel id="runtime-label">Runtime</InputLabel>
              <Select
                labelId="runtime-label"
                value={runtime}
                label="Runtime"
                name="runtime"
                onChange={(e) => setRuntime(e.target.value as 'claude' | 'hermes')}
              >
                {RUNTIME_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting || isLoading}
              startIcon={submitting || isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {submitting || isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Preset development accounts — no credentials required
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Account Types: founder, seat, staff, division
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}