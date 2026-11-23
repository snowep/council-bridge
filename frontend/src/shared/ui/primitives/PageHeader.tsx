// PageHeader primitive - Standard page header with title and actions
// Based on DESIGN.md page header conventions

import { Typography, Box, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  onRefresh,
  refreshLabel = 'Refresh',
  action,
}: PageHeaderProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: subtitle ? 1 : 0 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {onRefresh && (
          <Tooltip title={refreshLabel}>
            <IconButton onClick={onRefresh} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}
        {action}
      </Box>
    </Box>
  );
}