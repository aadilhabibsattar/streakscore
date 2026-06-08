
-- Drop groups feature
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP FUNCTION IF EXISTS public.add_creator_to_group() CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.shares_group(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.join_group_by_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.gen_invite_code() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_group_invite(uuid) CASCADE;

-- Profiles: add display_name + tag (handle = display_name#tag)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS tag text;

-- Backfill from username for existing rows
UPDATE public.profiles
SET display_name = COALESCE(display_name, username)
WHERE display_name IS NULL AND username IS NOT NULL;

UPDATE public.profiles
SET tag = lpad((floor(random()*10000))::int::text, 4, '0')
WHERE tag IS NULL AND display_name IS NOT NULL;

-- Validate tag format (4 digits) via trigger (CHECK is fine here but trigger keeps it consistent)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tag_format_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tag_format_chk CHECK (tag IS NULL OR tag ~ '^[0-9]{4}$');

-- Unique handle: (lower(display_name), tag)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx
  ON public.profiles (lower(display_name), tag)
  WHERE display_name IS NOT NULL AND tag IS NOT NULL;

-- Friendships: one row per (requester, addressee). status: 'pending' | 'accepted'
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_status_chk CHECK (status IN ('pending','accepted')),
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY "Addressee can accept requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Either side can delete"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for lookups
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships (requester_id, status);
