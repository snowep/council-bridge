// Spacing scale - 8px base rhythm

export const spacing = {
  // Multipliers of base 8px
  xs: '4px',    // 0.5x - dense chips, badges
  sm: '8px',    // 1x - base spacing
  md: '16px',   // 2x - component padding
  lg: '24px',   // 3x - card padding
  xl: '32px',   // 4x - section spacing
  xxl: '48px',  // 6x - major sections
  xxxl: '64px', // 8x - hero sections
} as const;

// Gap utilities for flex/grid
export const gap = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
}