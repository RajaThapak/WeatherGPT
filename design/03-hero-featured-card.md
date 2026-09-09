# Component — Hero / Featured Card

The single "spotlight" card in the layout — the one element that breaks from
the dark palette to draw immediate attention. Fully independent; usable
anywhere a dashboard needs one emphasized stat block inside a row of neutral
cards.

## Visual identity

- Background: soft **light gradient**, `color-accent-primary-soft` (top-left)
  → `color-accent-primary-soft-2` (bottom-right), diagonal ~135°.
- All text inside switches to **dark ink** (`color-text-inverse` /
  near-black), since it sits on a light surface — this is the only card in
  the system with light-surface/dark-text polarity.
- Corner radius: `radius-lg` (20px), matching sibling cards for grid alignment.
- Padding: `space-5` (20px) all sides.
- Elevation: `elevation-hero` — a soft, wide, low-opacity shadow lifts it
  slightly off the dark shell.

## Anatomy (top → bottom)

1. **Eyebrow row:** small label (e.g. day/context name) left-aligned,
   `text-body`, medium weight + a secondary meta value (e.g. time) right-aligned,
   `text-caption`, lower opacity ink.
2. **Primary stat row:** oversized numeral, `text-display` (40–48px, weight
   600), paired inline or beside it with a **full-color illustrative icon**
   (the one place saturated icon color is allowed against the light bg).
3. **Micro-detail line:** a small duplicate/secondary numeral directly under
   the primary stat, `text-caption`, reduced opacity — a "feels like /
   secondary reading" convention.
4. **Meta stat cluster (bottom):** 2–4 short label:value pairs in a tight
   vertical stack, `text-caption` size, `color-text-inverse` at 65% opacity.
   Left-aligned, single column, line-height tight (1.5).

## Sizing

- This card is sized as **one unit in a horizontal card row** — same height
  as its sibling compact cards, but roughly **1.4–1.6× their width**, acting
  as the anchor/first item in the row.

## Reuse notes

Generalize as: *"first item in a horizontal stat-card row gets a light
gradient hero treatment; all following items stay neutral dark."* Works for
KPI rows, weather rows, financial summary rows — any place one item deserves
primary visual weight and the rest are supporting detail.
