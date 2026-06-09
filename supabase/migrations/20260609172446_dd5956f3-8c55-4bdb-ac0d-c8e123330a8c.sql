
-- Function: are two users accepted friends?
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a)
      )
  );
$$;

-- Drop stale group-based policies
DROP POLICY IF EXISTS "Group members view habits" ON public.habits;
DROP POLICY IF EXISTS "Group members view completions" ON public.habit_completions;

-- Friends can view each other's habits / completions
CREATE POLICY "Friends can view habits"
  ON public.habits FOR SELECT
  TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

CREATE POLICY "Friends can view completions"
  ON public.habit_completions FOR SELECT
  TO authenticated
  USING (public.are_friends(auth.uid(), user_id));
