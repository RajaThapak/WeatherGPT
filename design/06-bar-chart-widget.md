# Component — Vertical Bar Chart Widget

A compact, label-annotated bar chart used in a side panel. Independent —
usable for any small time-series or categorical dataset, not just the
source domain.

## Container

| Property | Value |
|---|---|
| Background | `color-surface-1` |
| Radius | `radius-lg` |
| Padding | `space-5` |
| Title | `text-h2`, `color-text-primary`, top-left, `space-4` bottom margin |

## Y-axis (qualitative labels, not numbers)

Rather than numeric gridlines, the y-axis uses **3 qualitative bands** stacked
top to bottom (e.g. "Heavy / Sunny / Rainy" in the source):

- Each band label: `text-caption`, `color-text-tertiary`, right-aligned
  against the chart's left gutter.
- Faint horizontal guide line per band, `color-border-subtle`, 1px, spans
  chart width behind bars.

## Bars

| Property | Value |
|---|---|
| Fill | `color-accent-primary`, or a top-to-bottom opacity fade
  (100% → 40%) for a "glass" feel |
| Width | ~40–50% of the per-category column width (generous gap between bars) |
| Radius | top corners only, `radius-sm` (8px), flat bottom |
| Min height | small nub (~6px) shown even for near-zero values so every
  category stays visible |
| Gap between bars | `space-3` |

## X-axis

- Category labels below each bar: `text-caption`, `color-text-tertiary`,
  centered under bar, e.g. time-of-day or category short codes.
- No axis line; labels float directly under bars.

## Interaction (optional)

- Hover on a bar: bar brightens to full-opacity accent, small tooltip
  (`color-surface-2` bg, `radius-sm`, `text-caption`) appears above showing
  exact value.

## Reuse notes

This is a generic **"3-band qualitative bar chart"** — swap band labels
(Low/Medium/High, Cold/Mild/Hot, any tertile system) and swap x-axis
categories (hours, days, product names) freely. The defining visual traits
to preserve: no numeric y-axis, soft top-rounded bars, generous bar spacing,
faint horizontal guide bands instead of gridlines.
