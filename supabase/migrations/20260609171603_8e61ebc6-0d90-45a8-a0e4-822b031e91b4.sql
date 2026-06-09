DROP POLICY IF EXISTS "Group members view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);