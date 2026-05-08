import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listGroups, type GroupSummary } from "@/server/groups.functions";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users } from "lucide-react";

export function GroupSwitcher({ activeGroupId }: { activeGroupId?: string }) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        if (!cancelled) setGroups([]);
        return;
      }
      listGroups()
        .then((r) => {
          if (!cancelled) setGroups(r.groups);
        })
        .catch(() => {
          if (!cancelled) setGroups([]);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (groups === null) return null;

  return (
    <div className="border-b bg-background/60">
      <div className="mx-auto max-w-6xl px-6 py-2">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {groups.length === 0 ? (
            <Link
              to="/groups"
              className="shrink-0 rounded-full border border-dashed bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Create or join a group →
            </Link>
          ) : (
            <>
              {groups.map((g) => {
                const active = g.id === activeGroupId;
                return (
                  <Link
                    key={g.id}
                    to="/groups/$groupId"
                    params={{ groupId: g.id }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "bg-card hover:border-foreground/30"
                    }`}
                  >
                    {g.name}
                  </Link>
                );
              })}
              <Link
                to="/groups"
                aria-label="New or join group"
                className="shrink-0 rounded-full border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
