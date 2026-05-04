import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getGroup,
  type GroupMemberView,
} from "@/server/groups.functions";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { leaveGroup } from "@/server/groups.functions";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupDetail,
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function GroupDetail() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof getGroup>> | null>(
    null,
  );
  const [view, setView] = useState<ViewMode>("month");
  const todayISO = isoLocal(new Date());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
    });
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      const r = await getGroup({ data: { groupId } });
      setData(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }, [groupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLeave() {
    if (!confirm("Leave this group?")) return;
    try {
      await leaveGroup({ data: { groupId } });
      navigate({ to: "/groups" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const { group, members } = data;
  const days = view === "month" ? currentMonthDays() : last30Days();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/groups"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Groups
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLeave}>
            Leave group
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.member_count} member{group.member_count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Invite
              </p>
              <p
                className="text-lg font-semibold tracking-widest"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {group.invite_code}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label
                className="text-xs uppercase tracking-widest text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                View
              </Label>
              <Select
                value={view}
                onValueChange={(v) => setView(v as ViewMode)}
              >
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Current Month</SelectItem>
                  <SelectItem value="last30">Last 30 Days</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {members.map((m) => (
            <div key={m.user_id} className="rounded-xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  @{m.username ?? "unknown"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {m.habits.length} habit{m.habits.length === 1 ? "" : "s"}
                </span>
              </div>
              {m.habits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No habits yet.</p>
              ) : view === "year" ? (
                <MemberYearBoard
                  member={m}
                  color={primaryColor}
                  todayISO={todayISO}
                />
              ) : (
                <MemberRowBoard
                  member={m}
                  color={primaryColor}
                  todayISO={todayISO}
                  days={days}
                />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* -------------------- Member Row Board (read-only) -------------------- */

function MemberRowBoard({
  member,
  color,
  todayISO,
  days,
}: {
  member: GroupMemberView;
  color: string;
  todayISO: string;
  days: string[];
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div>
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
        </div>

        <div className="mt-2 space-y-1.5">
          {member.habits.map((h) => {
            const set = new Set(h.completedDates);
            return (
              <div key={h.id} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm">{h.name}</div>
                <div
                  className="grid min-w-0 flex-1"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                    gap: "3px",
                  }}
                >
                  {days.map((d) => {
                    const done = set.has(d);
                    return (
                      <Tooltip key={d}>
                        <TooltipTrigger asChild>
                          <div
                            className="aspect-square w-full rounded-[3px]"
                            style={{
                              backgroundColor: done
                                ? color
                                : "var(--color-grid-empty)",
                              boxShadow:
                                d === todayISO
                                  ? "0 0 0 1px oklch(1 0 0 / 35%)"
                                  : undefined,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {d}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {done ? "completed" : "—"}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* -------------------- Member Year Board (read-only) -------------------- */

function MemberYearBoard({
  member,
  color,
  todayISO,
}: {
  member: GroupMemberView;
  color: string;
  todayISO: string;
}) {
  const totalHabits = member.habits.length;
  const { r, g, b } = useMemo(() => hexToRgb(color), [color]);

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek - 52 * 7);

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
        if (d === 0 && date.getMonth() !== lastMonth) {
          monthLabels.push({
            col: w,
            label: date.toLocaleString(undefined, { month: "short" }),
          });
          lastMonth = date.getMonth();
        }
      }
      weeks.push(col);
    }
    return { weeks, monthLabels };
  }, [todayISO]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of member.habits) {
      for (const d of h.completedDates) {
        m.set(d, (m.get(d) ?? 0) + 1);
      }
    }
    return m;
  }, [member.habits]);

  function squareColor(date: string): string {
    if (totalHabits === 0) return "var(--color-grid-empty)";
    const c = counts.get(date) ?? 0;
    if (c === 0) return "var(--color-grid-empty)";
    const ratio = Math.min(1, c / totalHabits);
    const alpha = 0.2 + ratio * 0.8;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  const SQ = 12;
  const GAP = 2;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="overflow-x-auto">
        <div className="inline-block">
          <div
            className="grid text-[10px] text-muted-foreground"
            style={{
              gridTemplateColumns: `32px repeat(53, ${SQ}px)`,
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
            <div
              className="grid text-[10px] text-muted-foreground"
              style={{
                width: "32px",
                gridTemplateRows: `repeat(7, ${SQ}px)`,
                gap: `${GAP}px`,
                fontFamily: "var(--font-mono)",
              }}
            >
              {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
                <div
                  key={i}
                  className="pr-1 leading-none flex items-center"
                  style={{ height: `${SQ}px` }}
                >
                  {l}
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(53, ${SQ}px)`,
                gap: `${GAP}px`,
              }}
            >
              {weeks.map((col, ci) => (
                <div
                  key={ci}
                  className="grid"
                  style={{
                    gridTemplateRows: `repeat(7, ${SQ}px)`,
                    gap: `${GAP}px`,
                  }}
                >
                  {col.map((cell) => {
                    if (cell.inFuture) {
                      return (
                        <div
                          key={cell.date}
                          className="rounded-[3px] opacity-0"
                          style={{ width: SQ, height: SQ }}
                        />
                      );
                    }
                    const c = counts.get(cell.date) ?? 0;
                    return (
                      <Tooltip key={cell.date}>
                        <TooltipTrigger asChild>
                          <div
                            className="rounded-[3px]"
                            style={{
                              width: SQ,
                              height: SQ,
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
        </div>
      </div>
    </TooltipProvider>
  );
}
