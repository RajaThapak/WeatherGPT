# Component — Top Navigation Bar

Independent component spec. Pairs with `00-overview-tokens.md` but can be used alone.

## Structure (left → right)

1. **Grid/menu icon button** — circular, dark surface, 3x3 dot-grid icon (app launcher affordance)
2. **Secondary icon button** — circular, notification/bell icon
3. **Location/context pill** — pin icon + label text, plain text button style (no fill)
4. **Search bar** — flexible width, centered in bar, pill-shaped
5. *(spacer / flex-grow)*
6. **Small icon toggle button** — sun/theme icon, circular, dark
7. **Small icon toggle button (active)** — moon/dark-mode icon, circular, **filled with `color-accent-primary`**, indicates current selection
8. **User avatar** — circular profile image, 40px, sits at far right, slightly larger than other icon buttons

## Specs

| Element | Size | Background | Border | Notes |
|---|---|---|---|---|
| Icon button (default) | 40×40px | `color-surface-1` | none | icon centered, `color-text-secondary` icon fill |
| Icon button (active/selected) | 40×40px | `color-accent-primary` | none | icon fill becomes `color-text-inverse` or white |
| Search bar | height 40px, flexible width (~280–360px) | `color-surface-1` | none | `radius-pill`, search icon + placeholder text `color-text-tertiary`, left-aligned icon with `space-3` padding |
| Location pill | auto width, height 40px | transparent | none | pin icon in `color-text-secondary`, label in `text-body` primary color |
| Avatar | 44×44px | image fill | 2px optional ring in `color-surface-2` | fully circular |

## Layout rules

- All elements vertically centered on a single row.
- Horizontal gap between icon buttons: `space-2` (8px).
- Search bar is visually centered in the overall bar (not left-anchored),
  creating symmetry between the left icon cluster and right icon cluster.
- The whole navbar sits inside the outer shell padding — it is **not** a
  full-bleed bar; it respects the same side margins as content below it.

## States

- **Default icon button:** flat dark surface, no border.
- **Hover:** surface steps up one level (`elevation-1` → `elevation-2`).
- **Active/selected (e.g. dark-mode toggle):** solid accent-primary fill —
  this is the only saturated-color element in the nav, drawing the eye.
- **Search focused:** subtle 1px `color-border-strong` outline appears, no glow.

## Reuse notes

This pattern generalizes to **any top bar**: swap the location pill for a
breadcrumb, swap avatar for a settings icon, keep the icon-cluster + centered
search + icon-cluster + avatar rhythm — that rhythm is the reusable part.
