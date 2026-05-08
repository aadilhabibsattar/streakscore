-- Triggers need EXECUTE on their function for the calling role.
GRANT EXECUTE ON FUNCTION public.add_creator_to_group() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_invite_code() TO authenticated;