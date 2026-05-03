import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex like #10b981");

export type Profile = {
  user_id: string;
  primary_color: string;
};

export const getProfile = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, primary_color")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as Profile;

    // Fallback: ensure a profile exists
    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert({ user_id: userId })
      .select("user_id, primary_color")
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
    return { ok: true, primary_color: data.primary_color };
  });
