# Component — Text Tabs & Pill Toggle Groups

Two related but distinct patterns appear in this theme. Both are independent
and reusable outside the source layout.

---

## A. Underline-free Text Tabs

Used for primary view-switching (e.g. "Today / Tomorrow / Next 7 days").

### Structure
Flat row of text labels, no container, no border, no underline.

| State | Color | Weight |
|---|---|---|
| Inactive tab | `color-text-secondary` | 500 |
| Active tab | `color-text-primary` | 600 |

- Active tab is distinguished **purely by weight + color shift** — no pill
  background, no underline, no icon.
- Horizontal gap between tabs: `space-5` (20px).
- Font size: `text-body` (14px).
- Click target padding: `space-2` vertical for accessibility, even though
  visually borderless.

### Reuse
Use this pattern for lightweight, low-emphasis navigation where tabs sit
directly on the page background (not inside a card).

---

## B. Filled Pill Toggle (two-option switch)

Used for secondary mode-switching (e.g. "Forecast / Air quality").

### Structure
A single pill-shaped container (`radius-pill`) holds two (or more) options
as internal segments — similar to an iOS segmented control.

| Element | Spec |
|---|---|
| Outer container | `color-surface-2` background, `radius-pill`, padding `4px` |
| Selected segment | `color-accent-primary` fill, `radius-pill`, `color-text-inverse` text |
| Unselected segment | transparent, `color-text-secondary` text |
| Segment padding | `space-3` vertical, `space-4` horizontal |
| Font | `text-body-sm`, weight 600 |

### Behavior
- Selection indicator (accent fill) slides between segments on change
  (`duration-base` / `easing-standard`).
- Only one segment may be active at a time.
- Whole control sits at fixed height ~36px regardless of number of segments.

### Reuse
This is a general-purpose **binary/tri-state mode switch** — usable for
list/grid view toggles, unit switches (metric/imperial), light/dark previews,
or any two-to-three-option exclusive choice that needs higher visual weight
than plain text tabs.
