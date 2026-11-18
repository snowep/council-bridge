import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Snackbar,
  Alert,
  Avatar,
  Button,
} from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { useAppAuth } from '@app/use-app-auth';
import { LOCAL_SINGLE_USER_MODE } from '@app/constants';

export default function ProfilePage() {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');

  const { authContext } = useAppAuth();

  const ownerType = authContext?.owner_type || 'founder';
  const ownerId = authContext?.owner_id || 'founder';
  const runtime = authContext?.runtime || 'claude';

  useEffect(() => {
    if (LOCAL_SINGLE_USER_MODE) {
      setSnackbarMessage('Profile information is read-only in local development mode');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    }
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Profile</Typography>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Account Information"
          action={
            LOCAL_SINGLE_USER_MODE ? null : (
              <Typography variant="caption" color="text.secondary">
                Read-only
              </Typography>
            )
          }
        />
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Avatar
              sx={{ width: 80, height: 80, fontSize: 32, bgcolor: 'primary.main' }}
            >
              {ownerType === 'founder' ? 'F' : ownerType.charAt(0).toUpperCase()}
            </Avatar>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={ownerId}
              disabled
            />

            <TextField
              label="Email"
              value={`${ownerId}@councilbridge.local`}
              disabled
            />

            <TextField
              label="Account Type"
              value={ownerType}
              disabled
            />

            <TextField
              label="Account ID"
              value={ownerId}
              disabled
            />

            <TextField
              label="Runtime"
              value={runtime}
              disabled
            />

            {LOCAL_SINGLE_USER_MODE && (
              <TextField
                label="Mode"
                value="Local Development (Single User)"
                disabled
                sx={{ backgroundColor: 'warning.light', borderRadius: 1 }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Password"
          subheader="Manage your password"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => {}}
              disabled
            >
              Change Password
            </Button>
            <Typography variant="caption" color="text.secondary">
              Password change requires re-authentication
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Developer Information"
          subheader="Development and configuration details"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2">
              <strong>Session Runtime:</strong> {runtime}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Authentication Mode:</strong> {LOCAL_SINGLE_USER_MODE ? 'Local Single User Mode' : 'Production'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Owner Type:</strong> {ownerType}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Profile information is read-only and sourced from the authentication session.
              No profile persistence API is currently available.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} sx={{ width: '100%' }} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}