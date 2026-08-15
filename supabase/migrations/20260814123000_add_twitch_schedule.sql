ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS schedule_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_vacation JSONB;
