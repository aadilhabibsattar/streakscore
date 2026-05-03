import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const HABIT_NAME = z.string().trim().min(1).max(80);
const HABIT_CATEGORY = z.string().trim().max(40).optional().nullable();

export type HabitWithStats = {
  id: string;
  name: string;
  category: string | null;
  color: string;
  created_at: string;
  // ISO date strings (YYYY-MM-DD) for the last 31 days, oldest first
  days: string[];
  // For each day in `days`, true if completed
  completed: boolean[];
  currentStreak: number;
  longestStreak: number;
};

function todayISO(): string {
  // Use local date — habit completion is per local day.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthDays(): string[] {
  const out: string[] = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    out.push(`${year}-${m}-${day}`);
  }
  return out;
}

function computeStreaks(allCompletedDates: Set<string>): {
  currentStreak: number;
  longestStreak: number;
} {
  // Current streak: consecutive days ending today (or yesterday if today not done yet)
  let current = 0;
  const cursor = new Date();
  // Allow starting from today if completed, else from yesterday
  const todayKey = (() => {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  if (!allCompletedDates.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    if (allCompletedDates.has(key)) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak across all completions
  const sorted = Array.from(allCompletedDates).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev) {
      const diffDays = Math.round((date.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        run++;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = date;
  }

  return { currentStreak: current, longestStreak: longest };
}

export const listHabits = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: habits, error: habitsErr } = await supabase
      .from("habits")
      .select("id, name, category, color, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (habitsErr) throw new Error(habitsErr.message);

    if (!habits || habits.length === 0) {
      return { habits: [] as HabitWithStats[] };
    }

    const { data: completions, error: compErr } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on")
      .eq("user_id", userId);
    if (compErr) throw new Error(compErr.message);

    const days = lastNDays(31);
    const daysSet = new Set(days);

    const byHabit = new Map<string, Set<string>>();
    for (const c of completions ?? []) {
      const set = byHabit.get(c.habit_id) ?? new Set<string>();
      set.add(c.completed_on as string);
      byHabit.set(c.habit_id, set);
    }

    const enriched: HabitWithStats[] = habits.map((h) => {
      const all = byHabit.get(h.id) ?? new Set<string>();
      const completed = days.map((d) => all.has(d));
      const { currentStreak, longestStreak } = computeStreaks(all);
      // (daysSet referenced to silence unused warning intentionally)
      void daysSet;
      return {
        id: h.id,
        name: h.name,
        category: h.category,
        color: h.color,
        created_at: h.created_at,
        days,
        completed,
        currentStreak,
        longestStreak,
      };
    });

    return { habits: enriched };
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
    const { error } = await supabase.from("habits").insert({
      name: data.name,
      category: data.category ?? null,
      user_id: userId,
    });
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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
    // Verify habit ownership (RLS would also enforce this)
    const { data: habit, error: habitErr } = await supabase
      .from("habits")
      .select("id")
      .eq("id", data.habitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (habitErr) throw new Error(habitErr.message);
    if (!habit) throw new Error("Habit not found");

    // Don't allow future dates
    if (data.date > todayISO()) {
      throw new Error("Cannot mark future dates");
    }

    const { data: existing, error: exErr } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("habit_id", data.habitId)
      .eq("completed_on", data.date)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (existing) {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, completed: false };
    } else {
      const { error } = await supabase.from("habit_completions").insert({
        habit_id: data.habitId,
        user_id: userId,
        completed_on: data.date,
      });
      if (error) throw new Error(error.message);
      return { ok: true, completed: true };
    }
  });
