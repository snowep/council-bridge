// CardWithActions organism - Card with header, actions, and content
// Common pattern for detail views

import { Card, CardContent, Typography, Box } from '@mui/material';
import { radius } from '@shared/ui/tokens';

interface CardWithActionsProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  elevation?: boolean;
  outlined?: boolean;
}

export function CardWithActions({
  title,
  subtitle,
  actions,
  children,
  elevation = true,
  outlined = false,
}: CardWithActionsProps) {
  return (
    <Card
      sx={{
        borderRadius: radius.md,
        boxShadow: elevation ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' : 'none',
        border: outlined ? '1px solid rgba(0,0,0,0.12)' : undefined,
      }}
    >
      {(title || actions) && (
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              {title && <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>}
              {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
            </Box>
            {actions && <Box>{actions}</Box>}
          </Box>
        </CardContent>
      )}
      <CardContent sx={{ pt: 0 }}>
        {children}
      </CardContent>
    </Card>
  );
}