import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Divider,
} from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import { useThemeStore } from '@shared/theme';
import { LOCAL_SINGLE_USER_MODE } from '@app/constants';

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  reminders: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  email: true,
  push: false, // Push notifications not currently implemented
  reminders: true,
};

export default function SettingsPage() {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const themeStore = useThemeStore();
  const isDarkMode = themeStore.mode === 'dark';

  // Load preferences from localStorage into state
  const [notifications, setNotifications] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('settings_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_NOTIFICATIONS, ...parsed };
      }
    } catch {}
    return DEFAULT_NOTIFICATIONS;
  });

  // Keep a copy of saved values for cancel functionality
  const [savedNotifications, setSavedNotifications] = useState<NotificationPreferences>(notifications);

  // Check for changes
  const hasChanges =
    notifications.email !== savedNotifications.email ||
    notifications.push !== savedNotifications.push ||
    notifications.reminders !== savedNotifications.reminders;

  const handleNotificationChange = (field: keyof NotificationPreferences) => {
    setNotifications(prev => {
      const updated = { ...prev, [field]: !prev[field] };
      setNotifications(updated);
      return updated;
    });
  };

  const handleSaveSettings = useCallback(() => {
    try {
      localStorage.setItem('settings_preferences', JSON.stringify(notifications));
      setSavedNotifications(notifications);
      setSnackbarMessage('Settings saved successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (e) {
      setSnackbarMessage('Failed to save settings');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [notifications]);

  const handleCancelSettings = useCallback(() => {
    setNotifications(savedNotifications);
    setSnackbarMessage('Changes cancelled');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  }, [savedNotifications]);

  // Load saved preferences on mount (for refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('settings_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSavedNotifications({ ...DEFAULT_NOTIFICATIONS, ...parsed });
      }
    } catch {}
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Settings</Typography>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Appearance"
          subheader="Theme and display preferences"
        />
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={isDarkMode}
                onChange={() => {
                  const newMode = isDarkMode ? 'light' : 'dark';
                  themeStore.setMode(newMode);
                  setSnackbarMessage(`Theme switched to ${newMode} mode`);
                  setSnackbarSeverity('success');
                  setSnackbarOpen(true);
                }}
                aria-label="Dark Mode"
              />
            }
            label="Dark Mode"
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => themeStore.setMode('light')}
              size="small"
            >
              Light
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => themeStore.setMode('dark')}
              size="small"
            >
              Dark
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Notifications"
          subheader="Local preferences (stored in browser)"
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">Email Notifications</Typography>
                <Typography variant="caption" color="text.secondary">Save preference for email alerts</Typography>
              </Box>
              <Switch
                checked={notifications.email}
                onChange={() => handleNotificationChange('email')}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">Push Notifications</Typography>
                <Typography variant="caption" color="text.secondary">Preference for push notifications (not yet implemented)</Typography>
              </Box>
              <Switch
                checked={notifications.push}
                onChange={() => handleNotificationChange('push')}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">Reminders</Typography>
                <Typography variant="caption" color="text.secondary">Task and deadline reminder preferences</Typography>
              </Box>
              <Switch
                checked={notifications.reminders}
                onChange={() => handleNotificationChange('reminders')}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Security"
          subheader="Manage your account security"
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

      <Card>
        <CardHeader
          title="Account"
          subheader="Save your preferences"
        />
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              onClick={handleSaveSettings}
              disabled={!hasChanges || LOCAL_SINGLE_USER_MODE && notifications.email === savedNotifications.email && notifications.push === savedNotifications.push && notifications.reminders === savedNotifications.reminders}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={handleCancelSettings}
              disabled={!hasChanges}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
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