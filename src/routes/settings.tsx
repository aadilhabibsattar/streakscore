import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getProfile, updateUsername } from "@/server/profile.functions";

const PRESETS = [
  { name: "Emerald", hex: "#10b981" },
  { name: "GitHub", hex: "#39d353" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Violet", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Red", hex: "#ef4444" },
];

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { primaryColor, setPrimaryColor } = useTheme();
  const [draft, setDraft] = useState(primaryColor);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setUsername(p.username ?? "");
      setUsernameDraft(p.username ?? "");
    }).catch(() => {});
  }, []);

  async function saveUsername(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const r = await updateUsername({ data: { username: usernameDraft.trim() } });
      setUsername(r.username);
      toast.success("Username updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    setDraft(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
    });
  }, [navigate]);

  const valid = /^#[0-9a-fA-F]{6}$/.test(draft);

  async function save(hex: string) {
    setBusy(true);
    try {
      await setPrimaryColor(hex);
      toast.success("Theme updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>settings</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your primary theme color. Used for habit squares, buttons, and accents.
        </p>

        <section className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Username</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Current: <span className="font-mono">{username ? `@${username}` : "not set"}</span>
          </p>
          <form onSubmit={saveUsername} className="mt-3 flex items-center gap-3">
            <Input
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              placeholder="username"
              className="max-w-[260px] font-mono"
              required
            />
            <Button type="submit" disabled={savingName || !usernameDraft.trim() || usernameDraft.trim().toLowerCase() === username.toLowerCase()}>
              {savingName ? "Saving…" : "Update"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">3–20 chars. Letters, numbers, underscore.</p>
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Presets</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                disabled={busy}
                onClick={() => save(p.hex)}
                className="group flex flex-col items-center gap-1.5"
                title={p.name}
              >
                <span
                  className="h-10 w-10 rounded-lg border-2 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: p.hex,
                    borderColor: primaryColor.toLowerCase() === p.hex.toLowerCase() ? "oklch(1 0 0 / 70%)" : "transparent",
                  }}
                />
                <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <Label htmlFor="hex">Custom hex</Label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="color"
                value={valid ? draft : "#10b981"}
                onChange={(e) => setDraft(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border bg-transparent"
              />
              <Input
                id="hex"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="#10b981"
                maxLength={7}
                className="max-w-[160px] font-mono"
              />
              <Button disabled={!valid || busy || draft.toLowerCase() === primaryColor.toLowerCase()} onClick={() => save(draft)}>
                Apply
              </Button>
            </div>
            {!valid && draft.length > 0 && (
              <p className="mt-2 text-xs text-destructive">Use a 6-digit hex like #10b981.</p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preview</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid grid-cols-10 gap-[3px]">
              {Array.from({ length: 30 }).map((_, i) => (
                <span
                  key={i}
                  className="h-[14px] w-[14px] rounded-[3px]"
                  style={{
                    backgroundColor: i % 3 === 0 ? "var(--habit-accent)" : "var(--color-grid-empty)",
                  }}
                />
              ))}
            </div>
            <Button>Primary button</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
