import React, { useState, useEffect } from 'react';
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
import { useAppAuth } from '@app/use-app-auth';
import { apiClient, getErrorMessage } from '@shared/api/client';

interface SeatOption { value: string; label: string; }
interface StaffOption { value: string; label: string; }
interface DivisionOption { value: string; label: string; }

const OWNER_TYPE_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'seat', label: 'Council Seat' },
  { value: 'staff', label: 'Staff Agent' },
  { value: 'division', label: 'Division' },
];

const RUNTIME_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'hermes', label: 'Hermes' },
];

export default function LoginPage() {
  const { login, isLoading, navigateAfterLogin } = useAppAuth();
  const [ownerType, setOwnerType] = useState<'founder' | 'seat' | 'staff' | 'division'>('founder');
  const [ownerId, setOwnerId] = useState('founder');
  const [runtime, setRuntime] = useState<'claude' | 'hermes'>('claude');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seatOptions, setSeatOptions] = useState<SeatOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<DivisionOption[]>([]);
  
  const getOwnerIdOptions = (type: string, seats: SeatOption[], staff: StaffOption[], divisions: DivisionOption[]) => {
    switch (type) {
      case 'founder': return [{ value: 'founder', label: 'Founder' }];
      case 'seat': return seats;
      case 'staff': return staff;
      case 'division': return divisions;
      default: return [];
    }
  };

  // Fetch available accounts from API
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [seatsRes, staffRes, divisionsRes] = await Promise.allSettled([
          apiClient.get<{ data: SeatOption[] }>('/api/council/seats').catch(() => ({ data: [] })),
          apiClient.get<{ staff: StaffOption[] }>('/api/staff').catch(() => ({ staff: [] })),
          apiClient.get<{ divisions: DivisionOption[] }>('/api/divisions').catch(() => ({ divisions: [] })),
        ]);
        setSeatOptions((seatsRes.status === 'fulfilled' ? seatsRes.value.data : []).map(s => ({ value: s.value, label: s.value })));
        setStaffOptions(staffRes.status === 'fulfilled' ? staffRes.value.staff || [] : []);
        setDivisionOptions(divisionsRes.status === 'fulfilled' ? divisionsRes.value.divisions || [] : []);
      } catch {
        // Keep empty arrays on error - user can manually enter
      }
    };
    fetchOptions();
  }, []);

  // Reset ownerId when ownerType changes
  React.useEffect(() => {
    const options = getOwnerIdOptions(ownerType, seatOptions, staffOptions, divisionOptions);
    if (options.length > 0) {
      setOwnerId(options[0].value);
    }
  }, [ownerType, seatOptions, staffOptions, divisionOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(ownerType, ownerId, runtime);
      navigateAfterLogin();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Login failed'));
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
                {getOwnerIdOptions(ownerType, seatOptions, staffOptions, divisionOptions).map((opt) => (
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