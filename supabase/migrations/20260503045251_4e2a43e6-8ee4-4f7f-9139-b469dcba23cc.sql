
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.shares_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gma
    JOIN public.group_members gmb ON gma.group_id = gmb.group_id
    WHERE gma.user_id = _a AND gmb.user_id = _b
  );
$$;

CREATE POLICY "Members view groups" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "Users create groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete groups" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Members view memberships" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Users join groups" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave groups" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Group members view habits" ON public.habits FOR SELECT TO authenticated
  USING (public.shares_group(auth.uid(), user_id));

CREATE POLICY "Group members view completions" ON public.habit_completions FOR SELECT TO authenticated
  USING (public.shares_group(auth.uid(), user_id));

CREATE POLICY "Group members view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.shares_group(auth.uid(), user_id));

CREATE OR REPLACE FUNCTION public.gen_invite_code() RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c text;
BEGIN
  LOOP
    c := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = c);
  END LOOP;
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM public.groups WHERE invite_code = _code;
  IF gid IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (gid, auth.uid())
    ON CONFLICT DO NOTHING;
  RETURN gid;
END; $$;

CREATE OR REPLACE FUNCTION public.add_creator_to_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id) VALUES (NEW.id, NEW.owner_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS groups_add_creator ON public.groups;
CREATE TRIGGER groups_add_creator AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_to_group();
