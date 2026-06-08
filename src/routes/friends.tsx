import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  findUserByHandle,
  sendFriendRequest,
  listIncomingRequests,
  respondToRequest,
  listFriends,
  removeFriend,
  type FoundUser,
  type FriendRequestView,
  type FriendView,
} from "@/server/friends.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Search, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Streaks" },
      { name: "description", content: "Find friends and share your streaks." },
    ],
  }),
  component: FriendsPage,
});

type Tab = "find" | "requests" | "mine";

function FriendsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("find");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else setAuthed(true);
    });
  }, [navigate]);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
            friends
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find people by their handle (like <span className="font-mono">Alex#0042</span>).
        </p>

        <div className="mt-6 inline-flex items-center gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { v: "find", label: "Find users" },
              { v: "requests", label: "Requests" },
              { v: "mine", label: "My friends" },
            ] as { v: Tab; label: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTab(opt.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === opt.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "find" ? <FindTab /> : null}
          {tab === "requests" ? <RequestsTab /> : null}
          {tab === "mine" ? <FriendsTab /> : null}
        </div>
      </main>
    </div>
  );
}

function FindTab() {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FoundUser | null | undefined>(undefined);
  const [sending, setSending] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(undefined);
    try {
      const { user } = await findUserByHandle({
        data: { handle: handle.trim() },
      });
      setResult(user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!result) return;
    setSending(true);
    try {
      const r = await sendFriendRequest({
        data: { addressee_id: result.user_id },
      });
      toast.success(
        r.status === "accepted" ? "You're now friends" : "Request sent",
      );
      setResult(null);
      setHandle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex items-center gap-2">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Alex#0042"
          className="max-w-[280px] font-mono"
        />
        <Button type="submit" disabled={busy || !handle.includes("#")}>
          <Search className="mr-1.5 h-4 w-4" /> Search
        </Button>
      </form>

      <div className="mt-6">
        {result === undefined ? null : result === null ? (
          <p className="text-sm text-muted-foreground">No one matches that handle.</p>
        ) : (
          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{result.display_name}</p>
              <p
                className="text-xs text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                #{result.tag}
              </p>
            </div>
            <Button size="sm" onClick={send} disabled={sending}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {sending ? "Sending…" : "Add friend"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestsTab() {
  const [requests, setRequests] = useState<FriendRequestView[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listIncomingRequests();
      setRequests(r.requests);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function respond(id: string, action: "accept" | "decline") {
    try {
      await respondToRequest({ data: { request_id: id, action } });
      toast.success(action === "accept" ? "Friend added" : "Request declined");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (requests === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending requests.</p>;
  }
  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-xl border bg-card p-4"
        >
          <div>
            <p className="text-sm font-medium">{r.display_name ?? "Unknown"}</p>
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              #{r.tag ?? "????"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => respond(r.id, "accept")}>
              <Check className="mr-1.5 h-4 w-4" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => respond(r.id, "decline")}
            >
              <X className="mr-1.5 h-4 w-4" /> Decline
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FriendsTab() {
  const [friends, setFriends] = useState<FriendView[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listFriends();
      setFriends(r.friends);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function drop(id: string) {
    try {
      await removeFriend({ data: { friendship_id: id } });
      toast.success("Removed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (friends === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (friends.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No friends yet. Find someone on the first tab.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {friends.map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between rounded-xl border bg-card p-4"
        >
          <div>
            <p className="text-sm font-medium">{f.display_name ?? "Unknown"}</p>
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              #{f.tag ?? "????"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => drop(f.id)}>
            <UserMinus className="mr-1.5 h-4 w-4" /> Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}
