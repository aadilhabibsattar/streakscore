import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listHabits,
  createHabit,
  deleteHabit,
  toggleCompletion,
  type HabitWithStats,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Flame, LogOut, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate({ to: "/login" });
      } else {
        setEmail(session.user.email ?? null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/login" });
      } else {
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

  async function handleToggle(habitId: string, date: string, dayIndex: number) {
    setHabits((prev) =>
      prev
        ? prev.map((h) => {
            if (h.id !== habitId) return h;
            const completed = [...h.completed];
            completed[dayIndex] = !completed[dayIndex];
            return { ...h, completed };
          })
        : prev,
    );
    try {
      await toggleCompletion({ data: { habitId, date } });
      refresh();
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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
              <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            )}
            <NewHabitDialog onCreated={refresh} />
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Your habits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 31 days. Click a square to toggle completion.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading habits…</div>
        ) : habits && habits.length === 0 ? (
          <EmptyState onCreated={refresh} color={primaryColor} />
        ) : (
          <div className="space-y-3">
            {habits?.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                color={primaryColor}
                onToggle={(date, idx) => handleToggle(h.id, date, idx)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function HabitRow({
  habit,
  color,
  onToggle,
  onDelete,
}: {
  habit: HabitWithStats;
  color: string;
  onToggle: (date: string, dayIndex: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <h3 className="truncate text-base font-semibold">{habit.name}</h3>
            {habit.category && (
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {habit.category}
              </span>
            )}
          </div>
          <div
            className="mt-2 flex items-center gap-3 text-xs text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" style={{ color }} />
              {habit.currentStreak} day{habit.currentStreak === 1 ? "" : "s"}
            </span>
            <span className="opacity-50">•</span>
            <span>best {habit.longestStreak}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ContributionGrid habit={habit} color={color} onToggle={onToggle} />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Delete habit"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContributionGrid({
  habit,
  color,
  onToggle,
}: {
  habit: HabitWithStats;
  color: string;
  onToggle: (date: string, dayIndex: number) => void;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col items-end gap-1 overflow-x-auto">
        <div className="flex gap-[3px]">
          {habit.days.map((date, idx) => {
            const isToday = idx === habit.days.length - 1;
            const done = habit.completed[idx];
            return (
              <Tooltip key={date}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onToggle(date, idx)}
                    className="h-[14px] w-[14px] rounded-[3px] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    style={{
                      backgroundColor: done ? color : "var(--color-grid-empty)",
                      boxShadow: isToday ? "0 0 0 1px oklch(1 0 0 / 25%)" : undefined,
                    }}
                    aria-label={`${date} ${done ? "completed" : "not completed"}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <span style={{ fontFamily: "var(--font-mono)" }}>{date}</span>
                  <span className="ml-2 text-muted-foreground">
                    {done ? "completed" : "—"}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div
          className="flex w-full justify-between px-[1px] text-[10px] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>{formatShort(habit.days[0])}</span>
          <span>today</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function formatShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function EmptyState({ onCreated, color }: { onCreated: () => void; color: string }) {
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
