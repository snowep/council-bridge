---
name: Council Bridge
description: Governance platform for AI-powered organizations
colors:
  primary-main: "#1976d2"
  primary-light: "#42a5f5"
  primary-dark: "#1565c0"
  secondary-main: "#9c27b0"
  secondary-light: "#ba68c8"
  secondary-dark: "#7b1fa2"
  light-bg-default: "#fafafa"
  light-bg-paper: "#ffffff"
  light-text-primary: "#1a1a2e"
  light-text-secondary: "#4a4a6a"
  light-divider: "rgba(0,0,0,0.12)"
  dark-bg-default: "#121212"
  dark-bg-paper: "#1e1e1e"
  dark-text-primary: "#ffffff"
  dark-text-secondary: "#b0b0b0"
  dark-divider: "rgba(255,255,255,0.12)"
  success-main: "#4caf50"
  warning-main: "#ff9800"
  error-main: "#f44336"
  info-main: "#2196f3"
typography:
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  display:
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontSize: "1rem"
    lineHeight: 1.6
  body-small:
    fontSize: "0.875rem"
    lineHeight: 1.5
  label:
    fontSize: "0.875rem"
    fontWeight: 500
    letterSpacing: "0.02em"
    textTransform: "none"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  base: "8px"
components:
  button-primary:
    backgroundColor: "{colors.primary-main}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary-main}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outlined-hover:
    backgroundColor: "rgba(25, 118, 210, 0.08)"
  card:
    backgroundColor: "{colors.light-bg-paper}"
    rounded: "{rounded.md}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.dark-bg-paper}"
  input:
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
---

# Design System: Council Bridge

## Overview

**Creative North Star: "The Governance Ledger"**

Council Bridge's visual system embodies organizational governance: structured, auditable, and trustworthy. It avoids consumer SaaS aesthetics in favor of a professional instrument panel where information density is purposeful, hierarchy is unambiguous, and every element serves oversight. The palette is restrained blue/purple — institutional without being cold. Inter provides clarity at all sizes. Shadows are subtle; depth comes from tonal layering and borders. Motion is functional (state transitions only). The system favors recognition over recall: persistent navigation, labeled icons, visible status chips.

**Key Characteristics:**
- Restrained institutional palette (blue primary, purple secondary)
- Inter font stack for maximum legibility
- Subtle elevation via borders + tonal layering, not heavy shadows
- 8px base spacing rhythm
- 8px border radius as default corner language
- Labeled icons everywhere — no icon-only affordances
- Status conveyed by chip color + text, never color alone

## Colors

The palette is built on two semantic accents (blue for governance actions, purple for organization/people) against a neutral foundation that adapts cleanly to light and dark modes.

### Primary
- **Governance Blue** (#1976d2 / oklch(56% 0.18 260)): Primary actions, key metrics, active navigation, focus rings. Used sparingly — ≤10% of screen area — so its presence signals importance.

### Secondary
- **Organization Purple** (#9c27b0 / oklch(58% 0.25 310)): Division/staff management, people-related actions, secondary navigation. Complements blue without competing.

### Neutral (Light)
- **Cool Paper** (#fafafa): Default page background
- **Pure White** (#ffffff): Card/paper surfaces
- **Deep Charcoal** (#1a1a2e): Primary text
- **Muted Slate** (#4a4a6a): Secondary text, placeholders
- **Hairline** (rgba(0,0,0,0.12)): Dividers, borders, subtle shadows

### Neutral (Dark)
- **True Black** (#121212): Default page background
- **Elevated Dark** (#1e1e1e): Card/paper surfaces
- **Pure White** (#ffffff): Primary text
- **Muted Silver** (#b0b0b0): Secondary text
- **Hairline Dark** (rgba(255,255,255,0.12)): Dividers, borders

### Semantic
- **Success Green** (#4caf50): Approved, active, completed states
- **Warning Amber** (#ff9800): Pending, review required
- **Error Red** (#f44336): Rejected, failed, critical
- **Info Blue** (#2196f3): Informational, neutral actions

### Named Rules
**The One Voice Rule.** Primary blue appears on ≤10% of any screen. Its rarity is the point — when it appears, the user acts.

**The Dual-Accent Rule.** Blue governs actions; purple governs structure. Never swap them.

**The Color+Text Rule.** Status is never conveyed by color alone. Chips, badges, and indicators always pair color with text label.

## Typography

**Display Font:** Inter (with Roboto, Helvetica, Arial fallbacks)
**Body Font:** Inter (with Roboto, Helvetica, Arial fallbacks)
**Label/Mono Font:** JetBrains Mono for code, IDs, technical data

**Character:** Inter's neutral geometry and generous x-height serve governance content: long division names, staff IDs, task titles, audit logs. No display face — headings use Inter at weight 600 for authority without flair.

### Hierarchy
- **Display** (600, 2.5rem/40px, 1.2): Page titles only (Dashboard, Organization, Settings)
- **Headline** (600, 2rem/32px, 1.3): Section headers within pages
- **Title** (600, 1.75rem/28px, 1.4): Card titles, dialog titles
- **Body** (400, 1rem/16px, 1.6): Default reading text, descriptions, table cells
- **Body Small** (400, 0.875rem/14px, 1.5): Metadata, timestamps, helper text
- **Label** (500, 0.875rem/14px, 0.02em tracking, no transform): Buttons, tabs, chip labels, form labels

### Named Rules
**The Single Display Rule.** One Display-level heading per page. All other headings are Title or below.

**The Label Weight Rule.** Buttons and interactive labels use weight 500. Body text stays 400. This distinction is the primary affordance signal.

## Layout

**Spatial Model:** 12-column fluid grid with 24px gutters on desktop, 16px on tablet, 16px on mobile. Max container width 1200px.

**Container Behavior:** Pages center in viewport with symmetric padding. Cards use 24px internal padding. Dense areas (tables, lists) reduce to 16px.

**Breakpoints:**
- Mobile: <640px (single column, drawer navigation)
- Tablet: 640–1023px (two-column where appropriate)
- Desktop: 1024–1279px (full layout, persistent sidebar)
- Large: ≥1280px (max-width constrained)

**Density:** Three tiers — Comfortable (default, 8px base), Compact (tables, 4px base), Spacious (empty states, 16px base).

**Spacing Rhythm:** All spacing derives from 8px base unit. 4px (0.5×), 8px (1×), 16px (2×), 24px (3×), 32px (4×), 48px (6×), 64px (8×).

**Navigation:** Persistent left sidebar (260px) on desktop. Mobile: hamburger drawer. Active item highlighted with primary background + white text.

### Named Rules
**The Sidebar Rule.** Primary navigation never collapses to icons-only on desktop. Labels are mandatory.

**The Max-Width Rule.** Content never exceeds 1200px. Whitespace is not wasted space — it's scanability.

## Elevation & Depth

This system uses **tonal layering with hairline borders** as its primary depth mechanism. Shadows are ambient accents on hover/focus, not structural.

### Shadow Vocabulary
- **Ambient Low** (`0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)`): Resting card elevation, paper surfaces
- **Hover Lift** (`0 4px 12px rgba(0,0,0,0.15)`): Card hover, dialog elevation
- **Focus Ring** (`0 0 0 2px #1976d2`): Keyboard focus on all interactive elements
- **Modal Overlay** (`0 8px 32px rgba(0,0,0,0.24)`): Dialog, drawer backdrop

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest (border only). Shadows appear only as response to state: hover, focus, modal.

**The Border-First Rule.** Depth is communicated by 1px borders in the neutral divider color. Shadows are secondary reinforcement.

## Shapes

**Corner Language:** 8px radius (md) is the default for cards, buttons, inputs, chips, dialogs. 4px (sm) for dense chips, badges. 12px (lg) for modals, drawers. No sharp corners anywhere.

**Borders:** 1px solid, always in divider color (neutral). No colored borders except focus rings.

**Form Language:** Rectangular with consistent radius. No pill shapes, no asymmetric radii. Dialogs and drawers use lg radius for visual distinction from cards.

### Named Rules
**The Consistent Corner Rule.** One radius scale (sm/md/lg) for the entire system. No per-component exceptions.

**The Border Transparency Rule.** Borders use the divider token, never hardcoded rgba. This guarantees light/dark consistency.

## Components

### Buttons
- **Shape:** 8px radius, 36px height (comfortable), 32px (compact)
- **Primary:** Governance Blue background, white text, weight 500. Hover: Primary Dark. Focus: 2px blue ring.
- **Outlined:** Transparent background, Governance Blue text, 1px blue border. Hover: 8% blue tint. Focus: 2px blue ring.
- **Contained Secondary:** Organization Purple background, white text. Used for "Invite Staff", "Create Division".
- **Ghost:** Text-only, used in toolbars. Hover: 8% neutral tint.

### Chips
- **Style:** 4px radius, 24px height, weight 500 label. Background: 10% tint of semantic color. Text: semantic color main.
- **Variants:** Default (status), Outlined (filter), Deletable (with × icon).
- **Status Mapping:** Success=green, Warning=amber, Error=red, Info=blue, Default=neutral.

### Cards / Containers
- **Corner:** 8px radius
- **Background:** Light=White, Dark=Elevated Dark (#1e1e1e)
- **Shadow:** Ambient Low at rest. Hover Lift on interactive cards.
- **Border:** 1px Hairline (always)
- **Internal Padding:** 24px (16px for dense)

### Inputs / Fields
- **Style:** Outlined variant, 8px radius, 40px height, 16px horizontal padding
- **Focus:** 2px Governance Blue border + 2px focus ring, label floats
- **Error:** Error Red border, helper text in Error Red
- **Disabled:** Neutral background, 38% opacity text

### Navigation
- **Sidebar Items:** 48px height, 16px horizontal padding, 8px radius on hover/active
- **Active State:** Governance Blue 10% background, Blue text, weight 500
- **Hover:** Neutral 8% background
- **Icon:** 20px, aligned with label baseline
- **Mobile:** Drawer full-height, same item styling

### Tables
- **Header:** 4% neutral background, weight 600, 12px vertical padding
- **Row Hover:** Neutral 4% background
- **Divider:** Hairline between rows
- **Density:** 12px vertical padding (comfortable), 8px (compact)

### Dialogs
- **Corner:** 12px radius
- **Backdrop:** Modal Overlay shadow
- **Padding:** 24px content, 16px actions
- **Focus Trap:** Required, initial focus on first field or close button

### Signature Component: Stat Card
- **Character:** Governance metric at a glance — icon + large value + label + secondary metric
- **Shape:** 8px radius, Hairline border, Ambient Low shadow, Hover Lift
- **Icon Badge:** 40px circle, 10% semantic tint background, semantic color icon
- **Typography:** Label (Body Small, Muted), Value (Title/Headline, weight 700), Secondary (Body Small, Muted)
- **Emphasis Variant:** 2px semantic border + subtle glow when metric requires attention (e.g., pending approvals > 0)
- **Accessibility:** role="button", tabIndex=0, Enter/Space activates, focus ring matches semantic color

## Do's and Don'ts

### Do:
- **Do** use the 8px base spacing unit for all margins, padding, gaps
- **Do** pair every status color with a text label (chips, badges, icons)
- **Do** use weight 500 for all interactive labels (buttons, tabs, chips)
- **Do** apply focus-visible rings (2px Governance Blue) on every keyboard-focusable element
- **Do** keep primary blue to ≤10% of screen area
- **Do** use tonal layering (background tints) for hover states, not scale transforms
- **Do** reserve Display (2.5rem) for page titles only — one per page
- **Do** use 8px radius as default; 4px only for dense chips; 12px for modals/drawers
- **Do** test at 200% browser zoom — no horizontal scroll, touch targets ≥44×44px

### Don't:
- **Don't** use color alone to convey status, state, or meaning
- **Don't** use icon-only buttons or navigation without visible text labels
- **Don't** exceed 1200px content width
- **Don't** use shadows as primary depth — borders first, shadows second
- **Don't** mix radius values outside sm/md/lg scale
- **Don't** use text-transform: uppercase anywhere (buttons use weight 500 instead)
- **Don't** use decorative gradients, glassmorphism, or blur effects
- **Don't** invent new semantic colors — use the four established (success/warning/error/info)
- **Don't** put interactive elements in the bottom-center mobile thumb zone (snackbars go top-right)
- **Don't** exceed three button variants on a single screen (primary, outlined, ghost max)