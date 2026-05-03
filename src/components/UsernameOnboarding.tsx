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
import { getProfile, updateUsername } from "@/server/profile.functions";
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
        if (!p.username) setOpen(true);
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
      await updateUsername({ data: { username: value.trim() } });
      toast.success("Username set");
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
          <DialogTitle>Set your username</DialogTitle>
          <DialogDescription>
            Pick a unique username. This is how friends will find and see you in
            groups.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. coding_squad42"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              3–20 characters. Letters, numbers, underscore.
            </p>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
