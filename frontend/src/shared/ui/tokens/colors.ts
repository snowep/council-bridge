// Color tokens - semantic design system
// Based on DESIGN.md governance ledger aesthetic

export const colors = {
  // Primary - Governance Blue
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  // Secondary - Organization Purple
  secondary: {
    main: '#9c27b0',
    light: '#ba68c8',
    dark: '#7b1fa2',
    contrastText: '#ffffff',
  },
  // Semantic status colors
  success: {
    main: '#4caf50',
    light: '#81c784',
    dark: '#388e3c',
  },
  warning: {
    main: '#ff9800',
    light: '#ffb74d',
    dark: '#f57c00',
  },
  error: {
    main: '#f44336',
    light: '#e57373',
    dark: '#d32f2f',
  },
  info: {
    main: '#2196f3',
    light: '#64b5f6',
    dark: '#1976d2',
  },
  // Neutrals (Light mode)
  neutral: {
    // Light
    light: {
      background: {
        default: '#fafafa',
        paper: '#ffffff',
      },
      text: {
        primary: '#1a1a2e',
        secondary: '#4a4a6a',
      },
      divider: 'rgba(0,0,0,0.12)',
    },
    // Dark
    dark: {
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
      text: {
        primary: '#ffffff',
        secondary: '#b0b0b0',
      },
      divider: 'rgba(255,255,255,0.12)',
    },
  },
} as const;

// Light mode aliases
export const lightColors = colors.neutral.light;
export const darkColors = colors.neutral.dark;