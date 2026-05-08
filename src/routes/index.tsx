import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listHabits,
  createHabit,
  deleteHabit,
  toggleCompletion,
  reorderHabits,
  type HabitRecord,
} from "@/server/habits.functions";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, LogOut, Settings as SettingsIcon, Users, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { UsernameOnboarding } from "@/components/UsernameOnboarding";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type ViewMode = "month" | "last30" | "year";

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthDays(): string[] {
  const out: string[] = [];
  const t = new Date();
  const year = t.getFullYear();
  const month = t.getMonth();
  const n = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= n; d++) out.push(isoLocal(new Date(year, month, d)));
  return out;
}

function last30Days(): string[] {
  const out: string[] = [];
  const t = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    out.push(isoLocal(d));
  }
  return out;
}

function Dashboard() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/login" });
      else setEmail(session.user.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else {
        setEmail(data.session.user.email ?? null);
        setAuthChecked(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      const res = await listHabits();
      setHabits(res.habits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load habits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) refresh();
  }, [authChecked, refresh]);

  const todayISO = isoLocal(new Date());

  async function handleToggle(habitId: string, date: string) {
    setHabits((prev) =>
      prev
        ? prev.map((h) => {
            if (h.id !== habitId) return h;
            const has = h.completedDates.includes(date);
            return {
              ...h,
              completedDates: has
                ? h.completedDates.filter((d) => d !== date)
                : [...h.completedDates, date],
            };
          })
        : prev,
    );
    try {
      await toggleCompletion({ data: { habitId, date } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      refresh();
    }
  }

  async function handleDelete(habitId: string) {
    if (!confirm("Delete this habit and all its history?")) return;
    try {
      await deleteHabit({ data: { habitId } });
      toast.success("Habit deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleMove(habitId: string, dir: -1 | 1) {
    if (!habits) return;
    const idx = habits.findIndex((h) => h.id === habitId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= habits.length) return;
    const next = [...habits];
    [next[idx], next[target]] = [next[target], next[idx]];
    setHabits(next);
    try {
      await reorderHabits({ data: { orderedIds: next.map((h) => h.id) } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder");
      refresh();
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UsernameOnboarding />
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: primaryColor }}
            />
            <span
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              streaks
            </span>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            <NewHabitDialog onCreated={refresh} />
            <Link to="/groups">
              <Button variant="ghost" size="icon" title="Groups">
                <Users className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-xs uppercase tracking-widest text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Today
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {todayLabel}
            </h1>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            {([
              { v: "month", label: "Month" },
              { v: "last30", label: "Last 30" },
              { v: "year", label: "Year" },
            ] as { v: ViewMode; label: string }[]).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setView(opt.v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading habits…</div>
        ) : habits && habits.length === 0 ? (
          <EmptyState onCreated={refresh} color={primaryColor} />
        ) : view === "year" ? (
          <YearBoard
            habits={habits ?? []}
            color={primaryColor}
            todayISO={todayISO}
          />
        ) : (
          <RowBoard
            habits={habits ?? []}
            color={primaryColor}
            todayISO={todayISO}
            days={view === "month" ? currentMonthDays() : last30Days()}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------- Row Board (Month / Last 30) -------------------- */

function RowBoard({
  habits,
  color,
  todayISO,
  days,
  onToggle,
  onDelete,
  onMove,
}: {
  habits: HabitRecord[];
  color: string;
  todayISO: string;
  days: string[];
  onToggle: (habitId: string, date: string) => void;
  onDelete: (habitId: string) => void;
  onMove: (habitId: string, dir: -1 | 1) => void;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="rounded-xl border bg-card p-4">
        {/* Day-number header */}
        <div className="flex items-center gap-3">
          <div className="w-40 shrink-0" />
          <div
            className="grid min-w-0 flex-1 text-[9px] text-muted-foreground"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              fontFamily: "var(--font-mono)",
              gap: "3px",
            }}
          >
            {days.map((date) => {
              const day = Number(date.slice(-2));
              const show = day % 5 === 0 || day === 1;
              return (
                <div key={`h-${date}`} className="text-center leading-none">
                  {show ? day : ""}
                </div>
              );
            })}
          </div>
          <div className="w-7 shrink-0" />
        </div>

        <div className="mt-2">
          {habits.map((h, idx) => {
            const set = new Set(h.completedDates);
            return (
              <div key={h.id} className="group flex items-center gap-3 py-1.5">
                <div className="flex w-40 shrink-0 items-center gap-1">
                  <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onMove(h.id, -1)}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(h.id, 1)}
                      disabled={idx === habits.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="truncate text-sm font-medium">{h.name}</div>
                </div>
                <div
                  className="grid min-w-0 flex-1"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                    gap: "3px",
                  }}
                >
                  {days.map((date) => {
                    const done = set.has(date);
                    const isFuture = date > todayISO;
                    const isToday = date === todayISO;
                    return (
                      <Tooltip key={date}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={isFuture}
                            onClick={() => onToggle(h.id, date)}
                            className="aspect-square w-full rounded-[3px] transition-transform hover:scale-110 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              backgroundColor: done
                                ? color
                                : "var(--color-grid-empty)",
                              boxShadow: isToday
                                ? "0 0 0 1px oklch(1 0 0 / 35%)"
                                : undefined,
                            }}
                            aria-label={`${h.name} ${date} ${done ? "done" : "not done"}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {date}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {done ? "completed" : "—"}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(h.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  title="Delete habit"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* -------------------- Year Board (52 weeks, GitHub-style) -------------------- */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function YearBoard({
  habits,
  color,
  todayISO,
}: {
  habits: HabitRecord[];
  color: string;
  todayISO: string;
}) {
  const totalHabits = habits.length;
  const { r, g, b } = useMemo(() => hexToRgb(color), [color]);

  // Build 53-week grid ending today (Sun..Sat rows). Start 52 weeks back at the Sunday of that week.
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find this week's Saturday as the last column anchor
    const end = new Date(today);
    // We'll just build columns going backwards 53 weeks from current week's Sunday.
    const dayOfWeek = end.getDay(); // 0..6 (Sun..Sat)
    // Start = Sunday 52 weeks before current week's Sunday
    const start = new Date(end);
    start.setDate(end.getDate() - dayOfWeek - 52 * 7);

    const weeks: { date: string; inFuture: boolean }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < 53; w++) {
      const col: { date: string; inFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const iso = isoLocal(date);
        col.push({ date: iso, inFuture: iso > todayISO });
        if (d === 0) {
          if (date.getMonth() !== lastMonth) {
            monthLabels.push({
              col: w,
              label: date.toLocaleString(undefined, { month: "short" }),
            });
            lastMonth = date.getMonth();
          }
        }
      }
      weeks.push(col);
    }
    return { weeks, monthLabels };
  }, [todayISO]);

  // Count completions per date across all habits
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of habits) {
      for (const d of h.completedDates) {
        m.set(d, (m.get(d) ?? 0) + 1);
      }
    }
    return m;
  }, [habits]);

  function squareColor(date: string): string {
    if (totalHabits === 0) return "var(--color-grid-empty)";
    const c = counts.get(date) ?? 0;
    if (c === 0) return "var(--color-grid-empty)";
    const ratio = Math.min(1, c / totalHabits);
    // Map ratio to 4 buckets like GitHub for crisper steps
    const alpha = 0.2 + ratio * 0.8; // 0.2..1.0
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  const GAP = 2;
  const LABEL_W = 32;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-xs text-muted-foreground">
          {totalHabits} habit{totalHabits === 1 ? "" : "s"} · square brightness
          = % completed that day
        </div>

        {/* Month labels — offset by weekday-label column width + gap */}
        <div
          className="grid text-[10px] text-muted-foreground"
          style={{
            gridTemplateColumns: `${LABEL_W}px repeat(53, minmax(0, 1fr))`,
            gap: `${GAP}px`,
            fontFamily: "var(--font-mono)",
          }}
        >
          <div />
          {Array.from({ length: 53 }).map((_, i) => {
            const m = monthLabels.find((x) => x.col === i);
            return (
              <div key={i} className="h-3 leading-none">
                {m ? m.label : ""}
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex" style={{ gap: `${GAP}px` }}>
          {/* Weekday labels */}
          <div
            className="grid text-[10px] text-muted-foreground"
            style={{
              width: `${LABEL_W}px`,
              gridTemplateRows: `repeat(7, 1fr)`,
              gap: `${GAP}px`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
              <div
                key={i}
                className="pr-1 leading-none flex items-center"
              >
                {l}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div
            className="grid min-w-0 flex-1"
            style={{
              gridTemplateColumns: `repeat(53, minmax(0, 1fr))`,
              gap: `${GAP}px`,
            }}
          >
            {weeks.map((col, ci) => (
              <div
                key={ci}
                className="grid"
                style={{
                  gridTemplateRows: `repeat(7, 1fr)`,
                  gap: `${GAP}px`,
                }}
              >
                {col.map((cell) => {
                  if (cell.inFuture) {
                    return (
                      <div
                        key={cell.date}
                        className="aspect-square w-full rounded-[3px] opacity-0"
                      />
                    );
                  }
                  const c = counts.get(cell.date) ?? 0;
                  return (
                    <Tooltip key={cell.date}>
                      <TooltipTrigger asChild>
                        <div
                          className="aspect-square w-full rounded-[3px]"
                          style={{
                            backgroundColor: squareColor(cell.date),
                            boxShadow:
                              cell.date === todayISO
                                ? "0 0 0 1px oklch(1 0 0 / 40%)"
                                : undefined,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {cell.date}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {c}/{totalHabits}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div
          className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground"
          style={{ paddingLeft: `${LABEL_W + GAP}px` }}
        >
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((a, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-[2px]"
              style={{
                backgroundColor:
                  a === 0
                    ? "var(--color-grid-empty)"
                    : `rgba(${r}, ${g}, ${b}, ${(0.2 + a * 0.8).toFixed(3)})`,
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* -------------------- Empty + New Habit -------------------- */

function EmptyState({
  onCreated,
  color,
}: {
  onCreated: () => void;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
      <div
        className="mx-auto mb-4 grid grid-cols-7 gap-[3px]"
        style={{ width: "fit-content" }}
      >
        {Array.from({ length: 21 }).map((_, i) => (
          <span
            key={i}
            className="h-[12px] w-[12px] rounded-[3px]"
            style={{
              backgroundColor: i % 4 === 0 ? color : "var(--color-grid-empty)",
            }}
          />
        ))}
      </div>
      <h2 className="text-lg font-semibold">No habits yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first habit and start filling in the grid.
      </p>
      <div className="mt-5">
        <NewHabitDialog onCreated={onCreated} />
      </div>
    </div>
  );
}

function NewHabitDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await createHabit({
        data: {
          name: name.trim(),
          category: category.trim() ? category.trim() : null,
        },
      });
      setName("");
      setCategory("");
      setOpen(false);
      toast.success("Habit created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New habit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 minutes"
              maxLength={80}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="habit-cat">Category (optional)</Label>
            <Input
              id="habit-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Health, Learning"
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
