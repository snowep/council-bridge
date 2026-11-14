import { Box, Typography, Paper } from '@mui/material';

export default function MemoryPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
        Memory
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Memory Browser</Typography>
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">Memory browsing and search will be implemented here.</Typography>
        </Box>
      </Paper>
    </Box>
  );
}