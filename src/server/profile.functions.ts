import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex like #10b981");
const DISPLAY_NAME = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[a-zA-Z0-9 _-]+$/, "Letters, numbers, space, _ and - only");

export type Profile = {
  user_id: string;
  primary_color: string;
  display_name: string | null;
  tag: string | null;
};

function fail(message: string, error: unknown): never {
  console.error(`[profile] ${message}:`, error);
  throw new Error(message);
}

function randomTag(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, primary_color, display_name, tag")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail("Failed to load profile", error);
    if (data) return data as Profile;
    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert({ user_id: userId })
      .select("user_id, primary_color, display_name, tag")
      .single();
    if (insErr) fail("Failed to load profile", insErr);
    return inserted as Profile;
  });

export const updateProfileColor = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ primary_color: HEX }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ primary_color: data.primary_color })
      .eq("user_id", userId);
    if (error) fail("Failed to update color", error);
    return { ok: true };
  });

// Sets the user's display name. If they don't yet have a tag (or the new name
// collides with their current tag against someone else), assigns a fresh
// random 4-digit tag that's unique for that name. Retries on collision.
export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ display_name: DISPLAY_NAME }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const display_name = data.display_name;

    // Try up to 8 random tags before giving up.
    let lastErr: unknown = null;
    for (let i = 0; i < 8; i++) {
      const tag = randomTag();
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ display_name, tag })
        .eq("user_id", userId);
      if (!error) {
        return { ok: true, display_name, tag };
      }
      lastErr = error;
      if (!/duplicate|unique/i.test(error.message)) {
        fail("Failed to update display name", error);
      }
    }
    console.error("[profile] tag collision exhausted:", lastErr);
    throw new Error("Couldn't assign a unique tag. Try a different name.");
  });
