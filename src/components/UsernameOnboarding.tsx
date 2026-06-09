import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getProfile, updateDisplayName } from "@/lib/profile.functions";
import { toast } from "sonner";

export function UsernameOnboarding({ onSet }: { onSet?: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (cancelled) return;
        if (!p.display_name) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await updateDisplayName({
        data: { display_name: value.trim() },
      });
      toast.success(`Welcome, ${r.display_name}#${r.tag}`);
      setOpen(false);
      onSet?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Pick a display name</DialogTitle>
          <DialogDescription>
            This is how friends see you. You'll also get a short tag (like
            #0042) so two people can share the same name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Alex"
              minLength={2}
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <Button type="submit" disabled={busy || value.trim().length < 2}>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
