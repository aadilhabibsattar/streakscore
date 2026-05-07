
-- 1) Hide invite_code column from non-owners
REVOKE SELECT (invite_code) ON public.groups FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_group_invite(_group uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code FROM public.groups
  WHERE id = _group AND owner_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_group_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_group_invite(uuid) TO authenticated;

-- 2) Block direct self-insert into group_members. Joining must go through join_group_by_code.
DROP POLICY IF EXISTS "Users join groups" ON public.group_members;

-- 3) Lock down internal SECURITY DEFINER helpers — not for direct user calls
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_creator_to_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- join_group_by_code remains callable so users can join via invite code
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;
