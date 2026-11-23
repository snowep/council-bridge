// Button primitive - Foundation
// Based on DESIGN.md button specifications

import { Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { colors, radius } from '@shared/ui/tokens';

const StyledButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: radius.md,
  minHeight: '36px',
  padding: '8px 16px',
  fontFamily: theme.typography.fontFamily,
  transition: 'background-color 150ms ease, box-shadow 150ms ease',
  '&:hover': {
    boxShadow: 'none',
  },
}));

type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'ghost';

interface ButtonPrimitiveProps {
  variant?: ButtonVariant;
  color?: 'primary' | 'secondary' | 'inherit' | 'error' | 'info' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  type?: 'button' | 'reset' | 'submit';
}

export function ButtonPrimitive({
  variant = 'primary',
  color = 'primary',
  size = 'small',
  ...props
}: ButtonPrimitiveProps) {
  const muiVariant = variant === 'primary' ? 'contained' :
                     variant === 'secondary' ? 'contained' :
                     variant === 'outlined' ? 'outlined' : 'text';

  const backgroundColor = variant === 'primary' ? colors.primary.main :
                          variant === 'secondary' ? colors.secondary.main : undefined;

  const customSx = {
    ...(backgroundColor && { backgroundColor }),
    ...(variant === 'outlined' && { borderColor: colors.primary.main, color: colors.primary.main }),
    ...(variant === 'ghost' && { color: colors.primary.main }),
  };

  return (
    <StyledButton
      variant={muiVariant}
      color={color}
      size={size}
      sx={customSx}
      {...props}
    />
  );
}