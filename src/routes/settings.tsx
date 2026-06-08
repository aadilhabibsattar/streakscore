import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getProfile, updateDisplayName } from "@/server/profile.functions";

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
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setDisplayName(p.display_name ?? "");
        setTag(p.tag ?? "");
        setNameDraft(p.display_name ?? "");
      })
      .catch(() => {});
  }, []);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const r = await updateDisplayName({
        data: { display_name: nameDraft.trim() },
      });
      setDisplayName(r.display_name);
      setTag(r.tag);
      toast.success(`Updated to ${r.display_name}#${r.tag}`);
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

  const handle = displayName && tag ? `${displayName}#${tag}` : "not set";
  const nameUnchanged =
    nameDraft.trim().toLowerCase() === displayName.toLowerCase();

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
            settings
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your display name and theme color.
        </p>

        <section className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Display name
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Handle:{" "}
            <span className="font-mono">{handle}</span>
            {tag ? (
              <span className="ml-2 text-[10px]">
                (the tag stays unique so friends can find you)
              </span>
            ) : null}
          </p>
          <form onSubmit={saveName} className="mt-3 flex items-center gap-3">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              minLength={2}
              maxLength={20}
              placeholder="Alex"
              className="max-w-[260px]"
              required
            />
            <Button
              type="submit"
              disabled={savingName || nameDraft.trim().length < 2 || nameUnchanged}
            >
              {savingName ? "Saving…" : "Update"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            2–20 chars. Changing your name gives you a new tag.
          </p>
        </section>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used for habit squares, buttons, and accents.
        </p>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Presets
          </h2>
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
                    borderColor:
                      primaryColor.toLowerCase() === p.hex.toLowerCase()
                        ? "oklch(1 0 0 / 70%)"
                        : "transparent",
                  }}
                />
                <span
                  className="text-[11px] text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
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
              <Button
                disabled={
                  !valid ||
                  busy ||
                  draft.toLowerCase() === primaryColor.toLowerCase()
                }
                onClick={() => save(draft)}
              >
                Apply
              </Button>
            </div>
            {!valid && draft.length > 0 && (
              <p className="mt-2 text-xs text-destructive">
                Use a 6-digit hex like #10b981.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
