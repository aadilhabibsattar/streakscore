import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGroup, leaveGroup } from "@/server/groups.functions";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId")({
  component: GroupDetail,
});

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function GroupDetail() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof getGroup>> | null>(
    null,
  );
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

  const { group, members, days } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.member_count} member{group.member_count === 1 ? "" : "s"} ·
              30-day view
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              INVITE CODE
            </p>
            <p
              className="text-2xl font-semibold tracking-widest"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {group.invite_code}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {members.map((m) => (
            <div key={m.user_id} className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  @{m.username ?? "unknown"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {m.habits.length} habit{m.habits.length === 1 ? "" : "s"}
                </span>
              </div>
              {m.habits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No habits yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {m.habits.map((h) => {
                    const set = new Set(h.completedDates);
                    return (
                      <div
                        key={h.id}
                        className="flex items-center gap-3"
                      >
                        <div className="w-40 shrink-0 truncate text-sm">
                          {h.name}
                        </div>
                        <div
                          className="grid min-w-0 flex-1"
                          style={{
                            gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                            gap: "3px",
                          }}
                        >
                          {days.map((d) => (
                            <div
                              key={d}
                              className="aspect-square w-full rounded-[3px]"
                              style={{
                                backgroundColor: set.has(d)
                                  ? primaryColor
                                  : "var(--color-grid-empty)",
                                boxShadow:
                                  d === todayISO
                                    ? "0 0 0 1px oklch(1 0 0 / 35%)"
                                    : undefined,
                              }}
                              title={d}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
