// Typography scale - Inter font stack

export const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

  // Display - page titles only (one per page)
  display: {
    fontSize: '2.5rem',  // 40px
    fontWeight: 600 as const,
    lineHeight: 1.2,
  },

  // Headline - section headers
  headline: {
    fontSize: '2rem',    // 32px
    fontWeight: 600 as const,
    lineHeight: 1.3,
  },

  // Title - card/dialog titles
  title: {
    fontSize: '1.75rem', // 28px
    fontWeight: 600 as const,
    lineHeight: 1.4,
  },

  // Body - default reading text
  body: {
    fontSize: '1rem',    // 16px
    fontWeight: 400 as const,
    lineHeight: 1.6,
  },

  // Body Small - metadata, timestamps
  bodySmall: {
    fontSize: '0.875rem', // 14px
    fontWeight: 400 as const,
    lineHeight: 1.5,
  },

  // Label - buttons, tabs, chips
  label: {
    fontSize: '0.875rem', // 14px
    fontWeight: 500 as const,
    lineHeight: 1.4,
    letterSpacing: '0.02em',
    textTransform: 'none' as const,
  },

  // Button - interactive labels
  button: {
    fontSize: '0.875rem',
    fontWeight: 500 as const,
    textTransform: 'none' as const,
  },
} as const;