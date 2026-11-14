import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
} from '@mui/material';

export default function DashboardPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
        Founder Dashboard
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">Activity feed will show recent operations here.</Typography>
            </Box>
          </Paper>
        </Box>
        <Box sx={{ flex: '1 1 250px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Active Divisions</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>6</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Staff Agents</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>45</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Pending Approvals</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>0</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}