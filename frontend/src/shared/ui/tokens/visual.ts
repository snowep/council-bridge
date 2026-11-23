// Border radius scale - consistent corner language

export const radius = {
  sm: '4px',   // Dense chips, badges
  md: '8px',   // Default - cards, buttons, inputs
  lg: '12px',  // Modals, drawers
} as const;

// Elevation scale - subtle depth via borders + tonal layering

export const elevation = {
  // Ambient Low - resting card elevation
  ambientLow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',

  // Hover Lift - card hover, dialog elevation
  hoverLift: '0 4px 12px rgba(0,0,0,0.15)',

  // Focus Ring - keyboard focus
  focusRing: '0 0 0 2px #1976d2',

  // Modal Overlay - dialog backdrop
  modalOverlay: '0 8px 32px rgba(0,0,0,0.24)',
} as const;

// Breakpoints - responsive design

export const breakpoints = {
  xs: 0,      // Mobile
  sm: 640,    // Tablet
  md: 1024,   // Desktop
  lg: 1280,   // Large
} as const;

// Z-index scale

export const zIndex = {
  drawer: 100,
  modal: 1300,
  tooltip: 1400,
  popover: 1500,
  fixed: 1600,
} as const;