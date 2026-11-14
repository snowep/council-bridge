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

const OWNER_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'seat-1', label: 'Council Seat 1' },
  { value: 'seat-2', label: 'Council Seat 2' },
  { value: 'seat-3', label: 'Council Seat 3' },
  { value: 'seat-4', label: 'Council Seat 4' },
  { value: 'seat-5', label: 'Council Seat 5' },
  { value: 'seat-6', label: 'Council Seat 6' },
  { value: 'seat-7', label: 'Council Seat 7' },
  { value: 'seat-8', label: 'Council Seat 8' },
  { value: 'seat-9', label: 'Council Seat 9' },
  { value: 'seat-10', label: 'Council Seat 10' },
  { value: 'seat-11', label: 'Council Seat 11' },
  { value: 'division-engineering', label: 'Engineering Division' },
  { value: 'division-research', label: 'Research Division' },
  { value: 'division-operations', label: 'Operations Division' },
  { value: 'division-security', label: 'Security Division' },
  { value: 'division-product', label: 'Product Division' },
  { value: 'division-infrastructure', label: 'Infrastructure Division' },
];

export default function LoginPage() {
  const { login, isLoading } = useAppAuth();
  const [ownerType, setOwnerType] = useState('founder');
  const [ownerId, setOwnerId] = useState('founder');
  const [runtime, setRuntime] = useState<'claude' | 'hermes'>('claude');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(ownerType, ownerId, runtime);
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
                onChange={(e) => setOwnerType(e.target.value)}
              >
                {OWNER_OPTIONS.map((opt) => (
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
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {OWNER_OPTIONS.map((opt) => (
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
              Owner types: founder, seat-1 through seat-11, division-engineering, division-research, division-operations, division-security, division-product, division-infrastructure
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}