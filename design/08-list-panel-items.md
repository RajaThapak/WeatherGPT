# Component — Right-Rail List Panel (repeated row items)

The vertical list of items in the right sidebar (source: "Other large
cities"). Independent, reusable for any short list of entities with an
icon/thumbnail, title, subtitle, and a trailing stat.

## Panel container

| Property | Value |
|---|---|
| Background | transparent (sits directly on shell bg) or `color-surface-1` if visually grouped |
| Header row | title (`text-h1`) + trailing "Show All" link (see `05-pill-buttons.md` Variant 2) |
| List gap | `space-3` between rows |

## Row item anatomy (left → right)

1. **Thumbnail/icon** — 40–44px, circular or `radius-md` square,
   `color-surface-2` background, full-color icon or small image centered
2. **Text stack** (vertical, left-aligned):
   - Eyebrow: `text-caption`, `color-text-tertiary` (e.g. region/category tag)
   - Title: `text-h2`, `color-text-primary`, weight 600
   - Subtitle: `text-body-sm`, `color-text-secondary`
3. **Trailing stat** — right-aligned, `text-stat-md` or `text-h1` size,
   weight 600, `color-text-primary` — vertically centered against the whole row

## Row container

| Property | Value |
|---|---|
| Background | `color-surface-1` |
| Radius | `radius-lg` |
| Padding | `space-4` |
| Border | none |
| Height | fixed, consistent across all rows (~72–80px) |

## Selection / scroll indicator

- A thin vertical accent bar (`color-accent-primary`, 3–4px wide,
  `radius-pill`) may run alongside the list as a scroll-position indicator,
  positioned outside the row cards on their trailing edge.

## States

- Hover: row steps to `color-surface-2`.
- Active/selected row: 1.5px `color-accent-primary` border added, background
  unchanged.

## Reuse notes

This is a generic **"icon + 2-line text + trailing metric"** list row —
directly reusable for contact lists, notification feeds, leaderboard rows,
transaction lists, or product lists. The consistent row height and identical
internal padding across all rows is what gives the list its clean, scannable
rhythm — preserve that even when content differs wildly.
