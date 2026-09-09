# Dark Dashboard Design System — File Index

Extracted purely as a **reusable visual theme** from a reference dashboard
screenshot. None of these files reference the original app's subject matter —
every component is described generically so it can be dropped into any
project (admin panel, analytics tool, SaaS dashboard, etc.).

## How to use this system

1. Always start with **`00-overview-tokens.md`** — it defines colors,
   type scale, spacing, radius, elevation, and motion tokens every other
   file assumes.
2. Add only the component files relevant to what you're building. Each is
   fully independent and can be implemented on its own.
3. Where a file says "Reuse notes," that's the generalized pattern —
   use it as the spec, ignore any residual reference to the original
   screenshot's content.

## Files in this system

| File | Component |
|---|---|
| `00-overview-tokens.md` | Color palette, typography, spacing, radius, elevation, motion — the foundation |
| `01-navbar.md` | Top navigation bar (icon clusters + centered search + avatar) |
| `02-tabs-segmented-control.md` | Borderless text tabs + filled pill segmented toggle |
| `03-hero-featured-card.md` | Light-gradient spotlight card for one emphasized stat |
| `04-compact-card-grid.md` | Row of equal-width neutral mini-stat cards |
| `05-pill-buttons.md` | Section header trailing actions (ghost pill / chevron link) |
| `06-bar-chart-widget.md` | Qualitative-band vertical bar chart |
| `07-canvas-panel-overlay-card.md` | Large canvas panel with floating chrome + overlay promo card |
| `08-list-panel-items.md` | Right-rail repeated list rows (icon + text stack + trailing stat) |

## Defining traits of this theme (quick reference)

- **Near-black neutral surfaces** (`#1C1C1E`–`#2A2A2D`) with **one light
  gradient "hero" surface** per screen for focal contrast.
- **Large, consistent corner radii** (14–28px) everywhere; pill shapes
  (999px) for anything interactive/toggleable.
- **Flat surfaces over shadows** — depth via layered surface color, not
  heavy blur.
- **Sky-blue primary accent + lavender secondary accent**, used sparingly
  and only on interactive/data elements.
- **Full-color illustrative icons** as the one place saturated, playful
  color appears against the otherwise muted neutral palette.
- Consistent **equal-height card rows**, **equal-height list rows**, and
  generous internal padding — rhythm and alignment carry the polish more
  than ornamentation does.
