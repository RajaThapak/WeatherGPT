# Design System — Overview & Core Tokens

This file defines the foundational design tokens for a **dark-themed dashboard UI**.
Every other `design.md` file in this system references these tokens. Copy this file
into any new project first, then add only the component files you need — each
component file is self-contained and does not require the others.

> Scope note: these tokens describe the **visual theme only** (color, type, spacing,
> radius, elevation, motion). They are content-agnostic and can be applied to any
> dashboard, admin panel, analytics tool, or data app.

---

## 1. Color Palette

### Base / Surface colors (dark neutral scale)
| Token | Hex | Usage |
|---|---|---|
| `color-bg-app` | `#161616` | Outermost page/app background |
| `color-bg-shell` | `#1C1C1E` | Main dashboard shell/container background |
| `color-surface-1` | `#232326` | Default card / panel background |
| `color-surface-2` | `#2A2A2D` | Nested elements, chips, secondary panels |
| `color-surface-3` | `#323235` | Hover state / raised surface |
| `color-border-subtle` | `#333336` | Hairline borders, dividers |
| `color-border-strong` | `#3F3F42` | Emphasized dividers, input borders |

### Text colors
| Token | Hex | Usage |
|---|---|---|
| `color-text-primary` | `#F5F5F7` | Headings, primary values, large numerals |
| `color-text-secondary` | `#A0A0A5` | Supporting labels, captions |
| `color-text-tertiary` | `#6E6E73` | Disabled/meta text, timestamps |
| `color-text-inverse` | `#1A1A1C` | Text placed on light-accent surfaces |

### Accent colors
| Token | Hex | Usage |
|---|---|---|
| `color-accent-primary` | `#5B9BD5` (sky blue) | Primary buttons, active tab pill, chart bars, links |
| `color-accent-primary-soft` | `#BFE0F5` | Featured/hero card background gradient start |
| `color-accent-primary-soft-2` | `#DCEEF9` | Featured/hero card gradient end |
| `color-accent-secondary` | `#C9B6EA` (lavender) | Secondary CTA buttons, promo highlights |
| `color-accent-warning` | `#F2B84B` (amber) | Sun/warm iconography, highlight badges |

### Semantic / status colors
| Token | Hex | Usage |
|---|---|---|
| `color-success` | `#4CAF6D` | Positive delta, "sunny/clear" status |
| `color-info` | `#5B9BD5` | Informational badges |
| `color-alert` | `#E0637A` | Storm/critical status accents (used sparingly) |

**Palette rules:**
- Dark neutrals dominate ~85% of the UI surface.
- Exactly one "hero" surface per screen may use the light accent gradient
  (`color-accent-primary-soft` → `color-accent-primary-soft-2`) to create a
  focal point against the dark shell.
- Accent colors are used only on interactive or data-bearing elements —
  never as decoration alone.

---

## 2. Typography

Font family: a rounded/geometric sans-serif (e.g. **Inter**, **SF Pro Rounded**, or
**General Sans**). Numerals should use tabular/lining figures for alignment in stats.

| Token | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| `text-display` | 40–48px | 600 | 1.05 | Hero numeral / primary stat |
| `text-h1` | 22px | 600 | 1.2 | Section titles ("Next 7 days", "Global map") |
| `text-h2` | 16px | 600 | 1.3 | Card titles, list item titles |
| `text-body` | 14px | 500 | 1.4 | Standard UI text, nav labels |
| `text-body-sm` | 13px | 400 | 1.4 | Secondary descriptions |
| `text-caption` | 11–12px | 400–500 | 1.3 | Meta labels, timestamps, axis labels |
| `text-stat-md` | 24–28px | 600 | 1.1 | Secondary numeral stats (grid cards) |

**Rules:**
- Only headings and primary stats use weight 600; body copy stays 400–500.
- Letter-spacing on captions/labels: +0.02em for a crisp, technical feel.
- Secondary text always uses `color-text-secondary`, never a smaller size of
  primary color — contrast comes from color, not just size.

---

## 3. Spacing Scale

4px base unit.

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |

- Card internal padding: `space-5` (20px) default, `space-4` (16px) for compact cards.
- Gap between sibling cards in a grid: `space-4` (16px).
- Section-to-section vertical gap: `space-8` (32px).

---

## 4. Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 8px | Chips, small icon buttons |
| `radius-md` | 14px | Small/compact cards |
| `radius-lg` | 20px | Primary cards, panels |
| `radius-xl` | 28px | Outer dashboard shell |
| `radius-pill` | 999px | Tabs, toggle pills, buttons, avatar frames |

Corners are consistently **large and soft** — this is a defining trait of the theme.
Never mix sharp (0–4px) corners into this system.

---

## 5. Elevation & Depth

No heavy drop shadows — depth is created through **surface layering**, not shadow blur.

| Token | Composition |
|---|---|
| `elevation-0` | Flat, same color as background |
| `elevation-1` | `color-surface-1` on `color-bg-shell`, 1px `color-border-subtle` outline |
| `elevation-2` | `color-surface-2`, optional 12px 24px soft black shadow at 20% opacity |
| `elevation-hero` | Light gradient surface, shadow `0 8px 24px rgba(0,0,0,0.35)` |

---

## 6. Iconography

- Line-style icons at `1.5px` stroke for UI chrome (search, gear, bell, arrows).
- Full-color illustrative icons (sun, cloud, etc.) only for data-representative
  glyphs — these are the one place saturated color is allowed to be playful.
- Icon buttons are always circular, `radius-pill`, 36–40px diameter, centered icon.

---

## 7. Motion (suggested)

| Token | Value |
|---|---|
| `duration-fast` | 120ms |
| `duration-base` | 200ms |
| `easing-standard` | cubic-bezier(0.4, 0, 0.2, 1) |

Hover: surface lightens one step (`surface-1` → `surface-2`). Active/pressed:
scale 0.98. No bounce/spring easing — motion stays subtle and utilitarian.

---

## 8. Grid & Layout

- Outer shell: max-width container, `radius-xl`, padded `space-6`–`space-8`,
  floating on `color-bg-app` with generous margin (simulates a "card within a
  browser").
- Content grid: 12-column, `space-4` gutters.
- Left/main zone ~70% width, right rail ~30% width for secondary widgets —
  a recurring two-zone dashboard layout.
