import {
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  Box,
} from '@mui/material';
import type { ReactNode } from 'react';

interface QuickAction {
  label: string;
  icon: ReactNode;
  color?: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success';
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
  onAction?: (label: string) => void;
}

export default function QuickActions({
  title,
  actions,
  onAction,
}: QuickActionsProps) {
  const handleClick = (action: QuickAction, label: string) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      window.location.href = action.href;
    }
    if (onAction) {
      onAction(label);
    }
  };

  return (
    <Card elevation={1}>
      <CardContent>
        {title && (
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
        )}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 1,
        }}>
          {actions.map((action, idx) => (
            <Tooltip key={idx} title={action.label}>
              <Button
                variant="outlined"
                startIcon={action.icon}
                onClick={() => handleClick(action, action.label)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  py: 1,
                  minWidth: 120,
                }}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}