-- Move RLS helper functions to an internal schema so they are usable by policies
-- without being exposed as public API functions.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_group_member(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group
      AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION private.shares_group(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gma
    JOIN public.group_members gmb ON gma.group_id = gmb.group_id
    WHERE gma.user_id = _a
      AND gmb.user_id = _b
  );
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.shares_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_group(uuid, uuid) TO authenticated;

-- Update policies to use the internal helper functions.
DROP POLICY IF EXISTS "Members view memberships" ON public.group_members;
CREATE POLICY "Members view memberships"
ON public.group_members
FOR SELECT
TO authenticated
USING (private.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members view groups" ON public.groups;
CREATE POLICY "Members view groups"
ON public.groups
FOR SELECT
TO authenticated
USING (private.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "Group members view habits" ON public.habits;
CREATE POLICY "Group members view habits"
ON public.habits
FOR SELECT
TO authenticated
USING (private.shares_group(auth.uid(), user_id));

DROP POLICY IF EXISTS "Group members view completions" ON public.habit_completions;
CREATE POLICY "Group members view completions"
ON public.habit_completions
FOR SELECT
TO authenticated
USING (private.shares_group(auth.uid(), user_id));

DROP POLICY IF EXISTS "Group members view profiles" ON public.profiles;
CREATE POLICY "Group members view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.shares_group(auth.uid(), user_id));

-- Public copies are kept for compatibility but are not directly callable.
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_group(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- User-facing functions that intentionally perform invite-code flows remain callable.
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_group_invite(uuid) TO authenticated;