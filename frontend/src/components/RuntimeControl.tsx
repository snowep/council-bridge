// Runtime Control Component
// Phase 10: Allows Founder to see and switch between runtimes

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Chip, Alert, Divider } from '@mui/material';
import { RefreshOutlined, PlayArrow, ArrowForward } from '@mui/icons-material';

const RUNTIME_TYPES = ['claude', 'hermes'] as const;

export type RuntimeInfo = {
  activeRuntime: typeof RUNTIME_TYPES[number] | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'switching' | 'error';
  sessionId: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
};

export default function RuntimeControl() {
  const [runtimeState, setRuntimeState] = useState<RuntimeInfo>({
    activeRuntime: null,
    connectionStatus: 'disconnected',
    sessionId: null,
    connectedAt: null,
    lastHeartbeatAt: null,
    leaseExpiresAt: null,
    lastError: null
  });
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRuntimeState = useCallback(async () => {
    try {
      const res = await fetch('/api/runtime', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch runtime state');
      const data = await res.json();
      setRuntimeState({
        activeRuntime: data.data?.activeRuntime ?? null,
        connectionStatus: data.data?.connectionStatus ?? 'disconnected',
        sessionId: data.data?.sessionId ?? null,
        connectedAt: data.data?.connectedAt ?? null,
        lastHeartbeatAt: data.data?.lastHeartbeatAt ?? null,
        leaseExpiresAt: data.data?.leaseExpiresAt ?? null,
        lastError: data.data?.lastError ?? null
      });
      setShowError(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch runtime state');
      setShowError(true);
    }
  }, []);

  useEffect(() => {
    fetchRuntimeState();
    const interval = setInterval(fetchRuntimeState, 5000);
    return () => clearInterval(interval);
  }, [fetchRuntimeState]);

  const handleConnect = async (runtime: typeof RUNTIME_TYPES[number]) => {
    try {
      const res = await fetch('/api/runtime/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ runtime })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to connect');
      }
      fetchRuntimeState();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect runtime');
      setShowError(true);
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/runtime/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: runtimeState.sessionId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disconnect');
      }
      fetchRuntimeState();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect');
      setShowError(true);
    }
  };

  const handleSwitch = async (newRuntime: typeof RUNTIME_TYPES[number]) => {
    try {
      const res = await fetch('/api/runtime/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_runtime: newRuntime })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to switch');
      }
      fetchRuntimeState();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to switch runtime');
      setShowError(true);
    }
  };

  const statusLabels: Record<string, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting',
    connected: 'Connected',
    disconnecting: 'Disconnecting',
    switching: 'Switching',
    error: 'Error'
  };

  return (
    <Box sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          label={runtimeState.activeRuntime ?? 'None'}
          color={runtimeState.activeRuntime ? 'primary' : 'default'}
          variant={runtimeState.connectionStatus === 'connected' ? 'filled' : 'outlined'}
        />
        <Typography variant="body2" color="text.secondary">
          {statusLabels[runtimeState.connectionStatus]}
        </Typography>
      </Box>

      {runtimeState.sessionId && (
        <Typography variant="caption" color="text.secondary">
          Session: {runtimeState.sessionId?.slice(0, 8)}...
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />

      {runtimeState.activeRuntime ? (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshOutlined />}
              onClick={handleDisconnect}
              disabled={runtimeState.connectionStatus !== 'connected'}
            >
              Disconnect
            </Button>
            {runtimeState.activeRuntime !== 'claude' && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowForward />}
                onClick={() => handleSwitch('claude')}
              >
                Cl. Code
              </Button>
            )}
            {runtimeState.activeRuntime !== 'hermes' && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowForward />}
                onClick={() => handleSwitch('hermes')}
              >
                Hermes
              </Button>
            )}
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrow />}
            onClick={() => handleConnect('claude')}
          >
            Connect Claude
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlayArrow />}
            onClick={() => handleConnect('hermes')}
          >
            Connect Hermes
          </Button>
        </Box>
      )}

      {showError && (
        <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>
          {errorMessage}
        </Alert>
      )}
    </Box>
  );
}