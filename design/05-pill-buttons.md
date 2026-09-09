# Component — Utility Pill Buttons & Section Header Actions

Small secondary-action buttons that appear at the right edge of section
headers (e.g. "View wide", "Show All"). Independent, reusable anywhere a
section needs a low-emphasis trailing action.

## Section header pattern

Every content section follows the same header row:

```
[ Section Title — text-h1 ]                [ optional pill action → ]
```

- Title: `text-h1`, `color-text-primary`, left-aligned.
- Action: right-aligned on the same row, vertically centered with the title.
- Bottom margin after header row before content: `space-4` (16px).

## Pill button variants

### Variant 1 — Ghost pill with icon
| Property | Value |
|---|---|
| Background | `color-surface-1` |
| Text | `color-text-secondary`, `text-body-sm`, weight 500 |
| Radius | `radius-pill` |
| Padding | `space-2` vertical, `space-4` horizontal |
| Icon | trailing small expand/arrow icon, `space-1` gap from text |
| Border | none |

### Variant 2 — Text link with chevron
| Property | Value |
|---|---|
| Background | none (transparent) |
| Text | `color-text-secondary`, `text-body-sm` |
| Trailing icon | small chevron-right, same color as text |
| Padding | minimal, `space-1` |

## States

- **Hover:** Variant 1 background steps to `color-surface-2`; Variant 2 text
  brightens to `color-text-primary`.
- **Active/pressed:** scale 0.97, `duration-fast`.
- **Focus (keyboard):** 1px `color-accent-primary` outline offset 2px.

## Reuse notes

Use Variant 1 when the action changes the section's *display mode*
(expand, view wide, switch layout). Use Variant 2 when the action *navigates
away* to a fuller list/page ("Show All", "See more"). This distinction —
filled-pill for in-place actions, plain-chevron-link for navigation — is the
reusable rule, independent of what the section contains.
