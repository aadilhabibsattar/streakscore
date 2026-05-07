-- Restore EXECUTE privileges for helper functions used by Row-Level Security policies.
-- RLS policy expressions run with the calling user's privileges, so authenticated
-- users must be allowed to execute the SECURITY DEFINER helper functions used there.
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group(uuid, uuid) TO authenticated;

-- These user-facing functions intentionally remain callable by signed-in users.
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_group_invite(uuid) TO authenticated;

-- Keep internal trigger/generator helpers unavailable for direct user calls.
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_creator_to_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;