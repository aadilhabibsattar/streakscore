import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listGroups,
  createGroup,
  joinGroup,
  type GroupSummary,
} from "@/server/groups.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/")({
  component: GroupsPage,
});

function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
    });
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      const { groups } = await listGroups();
      setGroups(groups);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
            groups
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your groups
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build streaks together. See your friends' grids.
            </p>
          </div>
          <div className="flex gap-2">
            <JoinGroupDialog onDone={refresh} />
            <CreateGroupDialog onDone={refresh} />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {groups === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No groups yet. Create one or join with an invite code.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.member_count} member{g.member_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    INVITE
                  </p>
                  <p
                    className="text-base font-semibold tracking-widest"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {g.invite_code}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function CreateGroupDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await createGroup({ data: { name: name.trim() } });
      toast.success(`Group created. Invite code: ${r.invite_code}`);
      setName("");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gname">Group name</Label>
            <Input
              id="gname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coding Squad"
              maxLength={60}
              required
              autoFocus
            />
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JoinGroupDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await joinGroup({ data: { code: code.trim() } });
      toast.success("Joined!");
      setCode("");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Join
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join with invite code</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              minLength={6}
              required
              autoFocus
              inputMode="numeric"
              className="font-mono tracking-widest text-center text-lg"
            />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Joining…" : "Join group"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
