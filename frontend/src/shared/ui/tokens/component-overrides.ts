// MUI Component overrides - consistent component styling

export const componentOverrides = {
  // Buttons
  button: {
    primary: {
      backgroundColor: '#1976d2',
      color: '#ffffff',
      borderRadius: '8px',
      padding: '8px 16px',
      height: '36px',
      fontWeight: 500,
    },
    primaryHover: {
      backgroundColor: '#1565c0',
    },
    outlined: {
      backgroundColor: 'transparent',
      color: '#1976d2',
      borderRadius: '8px',
      padding: '8px 16px',
      height: '36px',
      border: '1px solid #1976d2',
    },
    outlinedHover: {
      backgroundColor: 'rgba(25, 118, 210, 0.08)',
    },
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  },

  // Cards (Dark mode)
  cardDark: {
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  },

  // Inputs
  input: {
    borderRadius: '8px',
    padding: '8px 12px',
    height: '40px',
  },

  // Chips
  chip: {
    borderRadius: '4px',
    height: '24px',
    fontWeight: 500,
  },

  // Tabs
  tab: {
    borderRadius: '8px',
    marginRight: '8px',
  },
} as const;