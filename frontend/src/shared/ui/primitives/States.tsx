// States primitives - Loading, Empty, Error, Permission denied states
// Based on DESIGN.md state handling patterns

import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
}

export function LoadingState({ message = 'Loading...', fullHeight = false }: LoadingStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: fullHeight ? '60vh' : '200px',
      }}
    >
      <CircularProgress />
      <Typography variant="body2" sx={{ ml: 2 }}>{message}</Typography>
    </Box>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorStateProps) {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Alert severity="error" onClose={() => {}} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2">{message}</Typography>
          {onRetry && (
            <Button
              onClick={onRetry}
              startIcon={<RefreshIcon />}
              size="small"
              sx={{ mt: 2 }}
            >
              {retryLabel}
            </Button>
          )}
        </Box>
      </Alert>
    </Box>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {description || title}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

interface PermissionDeniedStateProps {
  message?: string;
  onGrantAccess?: () => void;
}

export function PermissionDeniedState({
  message = 'You do not have permission to access this resource.',
  onGrantAccess,
}: PermissionDeniedStateProps) {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        {message}
        {onGrantAccess && (
          <Button
            onClick={onGrantAccess}
            size="small"
            sx={{ mt: 2 }}
          >
            Request Access
          </Button>
        )}
      </Alert>
    </Box>
  );
}