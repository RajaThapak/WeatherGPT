# Component — Compact Card Grid (repeating mini-stat cards)

The row of small, identical dark cards that sit beside the hero card.
Independent, reusable for any repeating small-stat list (days, categories,
metrics, products, etc.).

## Card anatomy (top → bottom, vertically centered content)

1. **Label** — short text, `text-body-sm`, `color-text-secondary`, top of card
2. **Icon** — full-color illustrative icon, medium size (~28–32px), centered,
   generous breathing room above/below (`space-3`)
3. **Primary value** — `text-stat-md` (24–28px), weight 600,
   `color-text-primary`, centered

## Card container

| Property | Value |
|---|---|
| Background | `color-surface-1` |
| Radius | `radius-lg` (20px) |
| Padding | `space-4` (16px) vertical, `space-3` (12px) horizontal |
| Border | none (flat fill differentiates it from page bg) |
| Width | equal-width, flex-1 within row |
| Height | matches hero card height exactly |
| Content alignment | centered horizontally, stacked vertically, equal internal gaps |

## Grid behavior

- All cards in the row are **equal width and equal height**, laid out with
  `space-3`–`space-4` gaps.
- Row scrolls horizontally on overflow (mobile) or wraps to a second row
  on very narrow viewports; on desktop it fits fully within the content width
  alongside the hero card.
- No card in this grid ever uses the light hero treatment — visual hierarchy
  is: **1 hero card, N neutral cards**, never more than one hero.

## States

- Default: flat `color-surface-1`.
- Hover (if interactive/clickable): steps to `color-surface-2`, optional
  1px `color-border-subtle` outline appears.
- Selected (if used as a selector, e.g. day picker): border in
  `color-accent-primary`, 1.5px, background unchanged.

## Reuse notes

This is a general **"icon + label + value" tile** pattern. Swap the icon
category and it becomes a category picker, a metrics summary strip, a
payment-method selector, or a day/date selector — the card chrome, spacing,
and centered-stack anatomy stay identical.
