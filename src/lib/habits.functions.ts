import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const HABIT_NAME = z.string().trim().min(1).max(80);
const HABIT_CATEGORY = z.string().trim().max(40).optional().nullable();

export type HabitRecord = {
  id: string;
  name: string;
  category: string | null;
  color: string;
  created_at: string;
  /** All ISO dates (YYYY-MM-DD) on which this habit was completed. */
  completedDates: string[];
};

export type HabitsPayload = {
  habits: HabitRecord[];
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fail(message: string, error: unknown): never {
  console.error(`[habits] ${message}:`, error);
  throw new Error(message);
}

export const listHabits = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: habits, error: habitsErr } = await supabase
      .from("habits")
      .select("id, name, category, color, created_at, position")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (habitsErr) fail("Failed to load habits", habitsErr);

    if (!habits || habits.length === 0) {
      return { habits: [] as HabitRecord[] } satisfies HabitsPayload;
    }

    const { data: completions, error: compErr } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on")
      .eq("user_id", userId);
    if (compErr) fail("Failed to load habits", compErr);

    const byHabit = new Map<string, string[]>();
    for (const c of completions ?? []) {
      const arr = byHabit.get(c.habit_id) ?? [];
      arr.push(c.completed_on as string);
      byHabit.set(c.habit_id, arr);
    }

    const enriched: HabitRecord[] = habits.map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category,
      color: h.color,
      created_at: h.created_at,
      completedDates: byHabit.get(h.id) ?? [],
    }));

    return { habits: enriched } satisfies HabitsPayload;
  });

export const createHabit = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: HABIT_NAME,
        category: HABIT_CATEGORY,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: maxRow } = await supabase
      .from("habits")
      .select("position")
      .eq("user_id", userId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? -1) + 1;
    const { error } = await supabase.from("habits").insert({
      name: data.name,
      category: data.category ?? null,
      user_id: userId,
      position: nextPos,
    });
    if (error) fail("Failed to create habit", error);
    return { ok: true };
  });

export const reorderHabits = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Update each habit's position
    await Promise.all(
      data.orderedIds.map((id, idx) =>
        supabase
          .from("habits")
          .update({ position: idx })
          .eq("id", id)
          .eq("user_id", userId),
      ),
    );
    return { ok: true };
  });

export const renameHabit = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ habitId: z.string().uuid(), name: HABIT_NAME })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("habits")
      .update({ name: data.name })
      .eq("id", data.habitId)
      .eq("user_id", userId);
    if (error) fail("Failed to rename habit", error);
    return { ok: true };
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ habitId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", data.habitId)
      .eq("user_id", userId);
    if (error) fail("Failed to delete habit", error);
    return { ok: true };
  });

export const toggleCompletion = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        habitId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: habit, error: habitErr } = await supabase
      .from("habits")
      .select("id")
      .eq("id", data.habitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (habitErr) fail("Failed to update completion", habitErr);
    if (!habit) throw new Error("Habit not found");

    if (data.date > todayISO()) {
      throw new Error("Cannot mark future dates");
    }

    const { data: existing, error: exErr } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("habit_id", data.habitId)
      .eq("completed_on", data.date)
      .maybeSingle();
    if (exErr) fail("Failed to update completion", exErr);

    if (existing) {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("id", existing.id);
      if (error) fail("Failed to update completion", error);
      return { ok: true, completed: false };
    } else {
      const { error } = await supabase.from("habit_completions").insert({
        habit_id: data.habitId,
        user_id: userId,
        completed_on: data.date,
      });
      if (error) fail("Failed to update completion", error);
      return { ok: true, completed: true };
    }
  });
