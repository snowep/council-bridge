// PageLayout template - Consistent page structure
// Based on DESIGN.md layout and max-width conventions

import { Box, Container } from '@mui/material';
import { PageHeader } from '../primitives/PageHeader';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

export function PageLayout({
  title,
  subtitle,
  onRefresh,
  action,
  children,
  maxWidth = 'lg',
}: PageLayoutProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: 3 }}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        onRefresh={onRefresh}
        action={action}
      />
      <Box sx={{ mt: 3 }}>{children}</Box>
    </Container>
  );
}