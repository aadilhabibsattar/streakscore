-- Stop exposing SECURITY DEFINER invite-code functions as callable RPCs.
-- The app server will perform these authenticated operations instead.
REVOKE EXECUTE ON FUNCTION public.get_my_group_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon, authenticated;

-- Also ensure the private RLS helper schema remains inaccessible to anonymous users.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.shares_group(uuid, uuid) FROM PUBLIC, anon;