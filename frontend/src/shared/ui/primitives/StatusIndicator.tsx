// StatusIndicator primitive - Non-color status indicators
// Pairs color with text label (Color+Text Rule from DESIGN.md)

import { Chip, type ChipProps } from '@mui/material';
import { radius } from '@shared/ui/tokens';

const statusLabels: Record<string, string> = {
  permanent: 'Permanent',
  replaceable: 'Replaceable',
  vacant: 'Vacant',
  candidate: 'Candidate',
  approved: 'Approved',
  pending: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  completed: 'Completed',
  failed: 'Failed',
  draft: 'Draft',
  archived: 'Archived',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

interface StatusIndicatorProps extends Omit<ChipProps, 'color' | 'label'> {
  status: string;
  showLabel?: boolean;
  size?: 'small' | 'medium';
}

export function StatusIndicator({
  status,
  showLabel = true,
  size = 'small',
  ...props
}: StatusIndicatorProps) {
  const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    permanent: 'primary',
    replaceable: 'info',
    vacant: 'default',
    candidate: 'warning',
    approved: 'success',
    pending: 'warning',
    active: 'primary',
    inactive: 'default',
    completed: 'success',
    failed: 'error',
    draft: 'warning',
    archived: 'default',
    cancelled: 'default',
    closed: 'success',
  };

  const chipColor = colorMap[status] || 'default';
  const label = statusLabels[status] || status;

  return (
    <Chip
      label={showLabel ? label : undefined}
      color={chipColor}
      size={size}
      variant="outlined"
      sx={{
        borderRadius: radius.sm,
        fontWeight: 500,
        '& .MuiChip-label': {
          minWidth: '60px',
        },
      }}
      {...props}
    />
  );
}