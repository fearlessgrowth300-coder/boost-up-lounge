ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS broadcaster_type TEXT,
  ADD COLUMN IF NOT EXISTS current_category TEXT,
  ADD COLUMN IF NOT EXISTS current_title TEXT,
  ADD COLUMN IF NOT EXISTS recent_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_insights JSONB NOT NULL DEFAULT '[]'::jsonb;
