
-- 1) Auto-add creator as a group member
DROP TRIGGER IF EXISTS trg_add_creator_to_group ON public.groups;
CREATE TRIGGER trg_add_creator_to_group
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_creator_to_group();

-- 2) Groups policies (idempotent re-create)
DROP POLICY IF EXISTS "Users create groups" ON public.groups;
CREATE POLICY "Users create groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members view groups" ON public.groups;
CREATE POLICY "Members view groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));

-- Allow owner to also view their group immediately after insert (covers the
-- RETURNING row even before trigger membership row is visible to RLS in same tx)
DROP POLICY IF EXISTS "Owners view own groups" ON public.groups;
CREATE POLICY "Owners view own groups"
  ON public.groups FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- 3) Group members policies
DROP POLICY IF EXISTS "Users join groups" ON public.group_members;
CREATE POLICY "Users join groups"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members view memberships" ON public.group_members;
CREATE POLICY "Members view memberships"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Users leave groups" ON public.group_members;
CREATE POLICY "Users leave groups"
  ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) Profiles policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Group members view profiles" ON public.profiles;
CREATE POLICY "Group members view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.shares_group(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
