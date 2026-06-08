import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-auth-middleware";

const HANDLE = z
  .string()
  .trim()
  .regex(/^.{2,20}#\d{4}$/, "Use the full handle like Alex#0042");

export type FoundUser = {
  user_id: string;
  display_name: string;
  tag: string;
};

export type FriendRequestView = {
  id: string;
  user_id: string; // the other party
  display_name: string | null;
  tag: string | null;
  created_at: string;
};

export type FriendView = {
  id: string;
  user_id: string;
  display_name: string | null;
  tag: string | null;
};

function fail(message: string, error: unknown): never {
  console.error(`[friends] ${message}:`, error);
  throw new Error(message);
}

function parseHandle(handle: string): { name: string; tag: string } {
  const hash = handle.lastIndexOf("#");
  return {
    name: handle.slice(0, hash).trim(),
    tag: handle.slice(hash + 1),
  };
}

// Look up a user by full handle "Name#1234" (case-insensitive on name).
export const findUserByHandle = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ handle: HANDLE }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ user: FoundUser | null }> => {
    const { supabase, userId } = context;
    const { name, tag } = parseHandle(data.handle);
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, tag")
      .ilike("display_name", name)
      .eq("tag", tag)
      .limit(1);
    if (error) fail("Search failed", error);
    const row = rows?.[0];
    if (!row || !row.display_name || !row.tag) return { user: null };
    if (row.user_id === userId) return { user: null };
    return {
      user: {
        user_id: row.user_id,
        display_name: row.display_name,
        tag: row.tag,
      },
    };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ addressee_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.addressee_id === userId) {
      throw new Error("You can't friend yourself");
    }

    // If the other person already sent a request to us, accept it instead.
    const { data: incoming } = await supabase
      .from("friendships")
      .select("id, status")
      .eq("requester_id", data.addressee_id)
      .eq("addressee_id", userId)
      .maybeSingle();
    if (incoming) {
      if (incoming.status === "accepted") return { ok: true, status: "accepted" };
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", incoming.id);
      if (error) fail("Failed to accept request", error);
      return { ok: true, status: "accepted" };
    }

    // Otherwise create a new pending request.
    const { error } = await supabase.from("friendships").insert({
      requester_id: userId,
      addressee_id: data.addressee_id,
      status: "pending",
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("Request already sent");
      }
      fail("Failed to send request", error);
    }
    return { ok: true, status: "pending" };
  });

export const listIncomingRequests = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ requests: FriendRequestView[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("id, requester_id, created_at")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) fail("Failed to load requests", error);

    const ids = (rows ?? []).map((r) => r.requester_id);
    const profMap = await loadProfiles(supabase, ids);

    return {
      requests: (rows ?? []).map((r) => ({
        id: r.id,
        user_id: r.requester_id,
        display_name: profMap.get(r.requester_id)?.display_name ?? null,
        tag: profMap.get(r.requester_id)?.tag ?? null,
        created_at: r.created_at as string,
      })),
    };
  });

export const respondToRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.action === "accept") {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", data.request_id)
        .eq("addressee_id", userId);
      if (error) fail("Failed to accept", error);
    } else {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", data.request_id)
        .eq("addressee_id", userId);
      if (error) fail("Failed to decline", error);
    }
    return { ok: true };
  });

export const listFriends = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ friends: FriendView[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id")
      .eq("status", "accepted");
    if (error) fail("Failed to load friends", error);

    const friends = (rows ?? []).map((r) => ({
      id: r.id,
      other:
        r.requester_id === userId ? r.addressee_id : r.requester_id,
    }));
    const profMap = await loadProfiles(
      supabase,
      friends.map((f) => f.other),
    );
    return {
      friends: friends.map((f) => ({
        id: f.id,
        user_id: f.other,
        display_name: profMap.get(f.other)?.display_name ?? null,
        tag: profMap.get(f.other)?.tag ?? null,
      })),
    };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ friendship_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", data.friendship_id);
    if (error) fail("Failed to remove friend", error);
    return { ok: true };
  });

type ProfileLite = { display_name: string | null; tag: string | null };

async function loadProfiles(
  supabase: { from: (table: "profiles") => any },
  userIds: string[],
): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  if (userIds.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, tag")
    .in("user_id", userIds);
  for (const p of (data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    tag: string | null;
  }>) {
    map.set(p.user_id, { display_name: p.display_name, tag: p.tag });
  }
  return map;
}
