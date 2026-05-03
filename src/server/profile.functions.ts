import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex like #10b981");
const USERNAME = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only");

export type Profile = {
  user_id: string;
  primary_color: string;
  username: string | null;
};

export const getProfile = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, primary_color, username")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as Profile;
    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert({ user_id: userId })
      .select("user_id, primary_color, username")
      .single();
    if (insErr) throw new Error(insErr.message);
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUsername = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ username: USERNAME }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const username = data.username.toLowerCase();
    // Check uniqueness using admin-free query (RLS limits us to own row, so try update and catch unique violation)
    const { error } = await supabase
      .from("profiles")
      .update({ username })
      .eq("user_id", userId);
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        throw new Error("That username is already taken");
      }
      throw new Error(error.message);
    }
    return { ok: true, username };
  });
