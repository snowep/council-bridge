// MUI Theme creation from design tokens

import { createTheme } from '@mui/material/styles';
import { colors, typography, radius, elevation } from './index';

export function createDesignSystemTheme(paletteMode: 'light' | 'dark' = 'light'): ReturnType<typeof createTheme> {
  const neutral = paletteMode === 'light' ? colors.neutral.light : colors.neutral.dark;

  return createTheme({
    palette: {
      mode: paletteMode,
      primary: colors.primary,
      secondary: colors.secondary,
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,
      background: {
        default: neutral.background.default,
        paper: neutral.background.paper,
      },
      text: {
        primary: neutral.text.primary,
        secondary: neutral.text.secondary,
      },
      divider: neutral.divider,
    },
    typography: {
      fontFamily: typography.fontFamily,
      h1: typography.display,
      h2: typography.headline,
      h3: typography.title,
      h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.4 },
      h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      body1: typography.body,
      body2: typography.bodySmall,
      button: {
        fontSize: typography.button.fontSize,
        fontWeight: typography.button.fontWeight,
        textTransform: 'none',
      },
    },
    spacing: 8,
    shape: {
      borderRadius: 8, // Using md radius as default
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
        defaultProps: {
          size: 'small',
          variant: 'contained',
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: elevation.ambientLow,
            border: `1px solid ${neutral.divider}`,
            borderRadius: radius.md,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: elevation.ambientLow,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: 'rgba(0,0,0,0.04)',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
          size: 'small',
        },
      },
      MuiSelect: {
        defaultProps: {
          variant: 'outlined',
          size: 'small',
        },
      },
      MuiInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: radius.sm,
            fontWeight: 500,
          },
        },
      },
    },
  });
}

// Export theme variants
export const lightTheme = createDesignSystemTheme('light');
export const darkTheme = createDesignSystemTheme('dark');