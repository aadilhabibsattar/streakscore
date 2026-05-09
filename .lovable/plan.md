## Goal

Two small improvements to the group view (`src/routes/groups.$groupId.tsx`):

1. One-click return to the personal habits home page from any group view.
2. Make the year-view squares fill the full card width — matching how the year view works on the home dashboard — instead of the current fixed 12px squares.

## 1. One-click home link

The header currently only shows `← Groups`. Add a `Home` link next to it so the user can jump straight to `/` (their personal habit board) without going via `/groups`.

```text
[ ← Groups ]   [ Home ]                          [ Leave group ]
```

- Use `<Link to="/">` with the same muted styling as the existing back link.
- Place it inline in the header's left cluster.

## 2. Year view sizing parity

The home dashboard renders the year heatmap with **fluid** columns (`repeat(53, minmax(0, 1fr))`, `aspect-square` cells, `gap: 2px`, `LABEL_W: 32px`). The group view's `MemberYearBoard` instead uses **fixed** `SQ = 12px` cells inside an `overflow-x-auto` wrapper, which makes the squares look smaller and forces horizontal scroll on narrow viewports.

Refactor `MemberYearBoard` to mirror the home implementation:

- Drop the `SQ = 12` fixed sizing and the `inline-block` + `overflow-x-auto` wrapper.
- Use `gridTemplateColumns: "${LABEL_W}px repeat(53, minmax(0, 1fr))"` for the month-label row.
- Use `gridTemplateColumns: "repeat(53, minmax(0, 1fr))"` and `gridTemplateRows: "repeat(7, 1fr)"` with `aspect-square w-full` cells for the heatmap grid.
- Keep the same weekday-label column (`LABEL_W = 32`, `GAP = 2`).
- Preserve existing color/tooltip/today-ring logic; only sizing changes.

Result: in the group year view the heatmap stretches to fill the card just like on `/`, with larger, properly proportioned squares at the current 674px viewport.

No backend or business-logic changes.