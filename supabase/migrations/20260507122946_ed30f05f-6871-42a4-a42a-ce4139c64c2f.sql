ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Backfill positions per user based on created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.habits
)
UPDATE public.habits h SET position = o.rn FROM ordered o WHERE h.id = o.id;

CREATE INDEX IF NOT EXISTS idx_habits_user_position ON public.habits(user_id, position);