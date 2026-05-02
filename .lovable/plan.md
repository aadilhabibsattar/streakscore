## Habit Tracker — dark, GitHub-style grid

A full-stack habit tracker with email + Google sign-in, per-user habits, and a developer-style contribution grid showing the last 31 days of completions.

### Visual design

- Dark theme only (no toggle, no light mode).
- Background: deep midnight (`oklch(0.16 0.01 260)`), surface cards slightly lifted (`oklch(0.20 0.01 260)`), subtle 1px borders (`oklch(1 0 0 / 8%)`).
- High-contrast text: near-white primary, muted slate for secondary.
- Accent: GitHub green (`#39d353`) used for completed squares — easy to swap later via a single CSS variable.
- Typography: Inter for UI, JetBrains Mono for dates/streak counters to reinforce the developer aesthetic.

### Pages

1. **/login** — email/password + "Continue with Google" button. Sign-up via same form.
2. **/** (protected) — dashboard. Shows:
   - Header with app name, user email, sign-out.
   - "New habit" button.
   - For each habit, a row containing:
     - Left: habit name, category chip in habit color, current streak + longest streak (e.g. `🔥 7  •  best 21`).
     - Right: 31-column × 1-row grid of squares (last 31 days, oldest left, today right). Empty days = grey (`oklch(0.25 0.01 260)`); completed = vibrant green. Hovering a square shows a tooltip with the date. Clicking today's square toggles completion. Clicking past squares also toggles (so you can backfill).
   - Tiny month/day axis labels under the grid like GitHub's graph.
3. **/habits/new** (modal or page) — name, category (free text), color picker (preset swatches; default green).

### Data model (Lovable Cloud / Supabase)

- `profiles` (id → auth.users, email, created_at) auto-created on signup via trigger.
- `habits` (id, user_id, name, category, color, created_at, archived_at). RLS: owner only.
- `habit_completions` (id, habit_id, user_id, completed_on date, created_at, UNIQUE(habit_id, completed_on)). RLS: owner only.

Streaks computed server-side from completions.

### Behavior details

- Today's column is subtly outlined so users can spot it.
- Toggling a day is optimistic (square flips instantly, rolls back on error).
- Empty state: friendly prompt with a "Create your first habit" CTA.
- Mobile: grid scrolls horizontally; rest of layout stacks.

### Technical notes

- Auth: Lovable Cloud email/password + Google OAuth. `_authenticated` layout route guards the dashboard; redirects to `/login` otherwise.
- Server functions (`createServerFn` + `requireSupabaseAuth`) for: list habits with last-31-days completions and computed streaks, create habit, toggle completion, delete habit.
- One DB migration creates the three tables, the signup trigger, and RLS policies.
- Accent color exposed as `--habit-accent` CSS var for easy future swap.

### Out of scope (can add later)

- Daily completion %, notes per day, reminders, longer history views, habit editing/archiving UI (delete will be available).
