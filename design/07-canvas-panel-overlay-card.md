# Component — Large Canvas Panel with Floating Overlay Card

The big visual/interactive panel (map in the source) with a small promo card
floating on top of it. Independent — reusable for any large visual canvas:
a map, a graph/network view, an image workspace, a calendar canvas, etc.

## Outer panel

| Property | Value |
|---|---|
| Background | `color-surface-1`, or the canvas content itself (muted, low-saturation
  imagery/illustration so overlays stay legible) |
| Radius | `radius-lg` (20px) |
| Min height | large — roughly 2–2.5× the height of the compact card row above it |
| Padding | none (canvas bleeds to card edges); interior controls are
  independently positioned/floating |

## Floating controls (top corners)

- **Top-left:** single circular icon button (e.g. reset/undo view),
  `elevation-2`, `color-surface-2` background, positioned `space-4` from
  panel edges.
- **Top-right:** circular icon button, same treatment (e.g. layers toggle).

## Floating zoom/action cluster (side edge)

- Vertical stack of 2 circular buttons (+ / −), same 40px icon-button spec
  as navbar, `space-2` gap between them, positioned along the panel's
  vertical edge with `space-4` margin.
- A slim scrollbar-style capsule track may run alongside this cluster to
  indicate pan/scroll range.

## Floating bottom-right compound control

- A small pill/rounded-rect control anchored bottom-right showing a current
  context label (e.g. current location name) + a small circular action
  icon button — grouped as one visual unit with `elevation-2`.

## Floating overlay promo card (the key reusable pattern)

A **small card floats directly on top of the canvas**, anchored to one side
(bottom-left in source), fully opaque against the canvas so it reads as a
distinct layer:

| Element | Spec |
|---|---|
| Container | `color-surface-2` (slightly lighter than main panel for contrast against canvas), `radius-lg`, `elevation-2`, fixed width ~220–260px |
| Padding | `space-4` |
| Heading text | `text-body`, weight 600, `color-text-primary`, 2 short lines max |
| Media | rounded-corner image/illustration thumbnail, `radius-md`, full card width, aspect ~4:3, placed below heading text |
| CTA button | full-width pill button below media, `color-accent-secondary` (lavender) fill, `color-text-inverse` text, `radius-pill`, `space-3` vertical padding |

## Data markers on the canvas

- Small circular badge markers (icon + subtle drop shadow) scattered across
  the canvas to represent discrete data points — 32–36px diameter,
  `color-surface-1` or context-colored fill, white/light icon glyph.
- One marker may carry a distinct highlight ring or label callout to
  indicate the "current/selected" point.

## Reuse notes

The transferable pattern is: **large neutral canvas → floating chrome
controls in the corners → one distinct promo/info card overlaid on the
canvas itself (not in the layout grid).** This works for maps, dashboards
with a big chart canvas, whiteboard tools, or media viewers wanting to
surface a contextual tip/upsell card without leaving the canvas.
