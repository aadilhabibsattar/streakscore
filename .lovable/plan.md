## Goal

Reduce group navigation from 2+ clicks to 1 by adding a horizontal row of group "pills" directly under the header on the home dashboard. Each pill links straight to that group's view.

## UX

- A thin row beneath the existing header on `/` showing all groups as pills.
- Each pill = group name; clicking it navigates to `/groups/$groupId`.
- Trailing `+` pill opens the existing "New group" / "Join" flow (links to `/groups`, which already has those dialogs).
- If the user has no groups, show a single subtle CTA pill: "Create or join a group →" linking to `/groups`.
- Horizontally scrollable on narrow viewports (current preview is 674px wide), no wrap.
- Active state styling reserved for when the user is inside a group page (not active on `/`).

```text
[ Coding Squad ] [ Gym Bros ] [ Readers ] [ + ]
```

## Implementation

- New component `src/components/GroupSwitcher.tsx`:
  - Calls `listGroups()` from `@/server/groups.functions` on mount (only when authenticated).
  - Renders pills as `<Link to="/groups/$groupId" params={{ groupId: g.id }}>`.
  - Renders trailing `+` as `<Link to="/groups">`.
  - Styled with semantic tokens (`bg-card`, `border`, `hover:border-foreground/20`, rounded-full, px-3 py-1, text-sm).
  - Overflow: `flex gap-2 overflow-x-auto` with no scrollbar chrome.
- Mount it in `src/routes/index.tsx` just below the header bar, above the main content.
- Optional follow-up (not in this plan): also mount on `/groups/$groupId` with active-pill highlight — ask after this lands.

No backend changes; reuses the existing `listGroups` server function.