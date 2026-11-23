import {
  Card,
  CardContent,
  Typography,
  Button,
  Skeleton,
  Box,
} from '@mui/material';
import { RefreshOutlined, Add, ErrorOutlined } from '@mui/icons-material';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  secondary: string;
  icon: ReactNode;
  color: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';
  loading: boolean;
  error: string | null;
  onClick: () => void;
  emptyAction?: { label: string; onClick: () => void } | null;
  onRetry: () => void;
}

export default function StatCard({
  label,
  value,
  secondary,
  icon,
  color,
  loading,
  error,
  emptyAction,
  onClick,
  onRetry
}: StatCardProps) {
  if (loading) {
    return (
      <Card
        elevation={2}
        sx={{
          height: '100%',
          minHeight: 160,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
          cursor: 'pointer',
        }}
        onClick={onClick}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
          <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={16} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        elevation={2}
        sx={{
          height: '100%',
          minHeight: 160,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
          cursor: 'pointer',
        }}
        onClick={onClick}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 2 }}>
          <ErrorOutlined fontSize="large" color="error" sx={{ mb: 1 }} />
          <Typography variant="body2" color="error" gutterBottom>{label}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, maxWidth: 200 }}>{error}</Typography>
          <Button size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        minHeight: 160,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: `${color}.100`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{secondary}</Typography>
          </Box>
        </Box>
        {emptyAction && (
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button
              size="small"
              variant="outlined"
              fullWidth
              startIcon={<Add fontSize="small" />}
              onClick={(e) => { e.stopPropagation(); emptyAction.onClick(); }}
            >
              {emptyAction.label}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}