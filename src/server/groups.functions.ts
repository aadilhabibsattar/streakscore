import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const NAME = z.string().trim().min(1).max(60);
const CODE = z.string().trim().regex(/^\d{6}$/, "Must be 6 digits");

export type GroupSummary = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
};

export type GroupMemberView = {
  user_id: string;
  username: string | null;
  habits: { id: string; name: string; completedDates: string[] }[];
};


export const listGroups = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ groups: GroupSummary[] }> => {
    const { supabase, userId } = context;
    // Get my memberships
    const { data: mine, error: meErr } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    if (meErr) throw new Error(meErr.message);
    const ids = (mine ?? []).map((m) => m.group_id);
    if (ids.length === 0) return { groups: [] };

    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, name, owner_id")
      .in("id", ids);
    if (gErr) throw new Error(gErr.message);

    const { data: counts, error: cErr } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", ids);
    if (cErr) throw new Error(cErr.message);
    const countMap = new Map<string, number>();
    for (const r of counts ?? []) {
      countMap.set(r.group_id, (countMap.get(r.group_id) ?? 0) + 1);
    }

    return {
      groups: (groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        invite_code: "",
        owner_id: g.owner_id,
        member_count: countMap.get(g.id) ?? 0,
      })),
    };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: NAME }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Generate a unique 6-digit invite code with a few retries
    let invite_code = "";
    let lastErr: string | null = null;
    let groupId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      invite_code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const { data: row, error } = await supabase
        .from("groups")
        .insert({ name: data.name, owner_id: userId, invite_code })
        .select("id")
        .single();
      if (!error && row) {
        groupId = row.id;
        break;
      }
      lastErr = error?.message ?? null;
      // 23505 = unique_violation; retry on conflict, fail otherwise
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(error.message);
      }
    }
    if (!groupId) throw new Error(lastErr ?? "Failed to create group");
    return { id: groupId, invite_code };
  });

export const getMyGroupInvite = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: code, error } = await supabase.rpc("get_my_group_invite", {
      _group: data.groupId,
    });
    if (error) throw new Error(error.message);
    return { invite_code: (code as string | null) ?? null };
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: CODE }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: gid, error } = await supabase.rpc("join_group_by_code", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return { id: gid as unknown as string };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      group: GroupSummary;
      members: GroupMemberView[];
    }> => {
      const { supabase, userId } = context;
      const { data: g, error: gErr } = await supabase
        .from("groups")
        .select("id, name, owner_id")
        .eq("id", data.groupId)
        .single();
      if (gErr) throw new Error(gErr.message);

      let invite_code = "";
      if (g.owner_id === userId) {
        const { data: code } = await supabase.rpc("get_my_group_invite", {
          _group: data.groupId,
        });
        invite_code = (code as string | null) ?? "";
      }

      const { data: members, error: mErr } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", data.groupId);
      if (mErr) throw new Error(mErr.message);
      const userIds = (members ?? []).map((m) => m.user_id);

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const profMap = new Map<string, string | null>();
      for (const p of profs ?? []) profMap.set(p.user_id, p.username);

      const { data: habits } = await supabase
        .from("habits")
        .select("id, name, user_id")
        .in("user_id", userIds);

      // Pull all completions in last ~400 days so client can render any view
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 400);
      const minDay = minDate.toISOString().slice(0, 10);
      const habitIds = (habits ?? []).map((h) => h.id);
      const { data: comps } = habitIds.length
        ? await supabase
            .from("habit_completions")
            .select("habit_id, completed_on")
            .in("habit_id", habitIds)
            .gte("completed_on", minDay)
        : { data: [] as { habit_id: string; completed_on: string }[] };

      const compsByHabit = new Map<string, string[]>();
      for (const c of comps ?? []) {
        const arr = compsByHabit.get(c.habit_id) ?? [];
        arr.push(c.completed_on as string);
        compsByHabit.set(c.habit_id, arr);
      }

      const memberViews: GroupMemberView[] = userIds.map((uid) => ({
        user_id: uid,
        username: profMap.get(uid) ?? null,
        habits: (habits ?? [])
          .filter((h) => h.user_id === uid)
          .map((h) => ({
            id: h.id,
            name: h.name,
            completedDates: compsByHabit.get(h.id) ?? [],
          })),
      }));

      return {
        group: {
          id: g.id,
          name: g.name,
          invite_code: g.invite_code,
          owner_id: g.owner_id,
          member_count: userIds.length,
        },
        members: memberViews,
      };
    },
  );
