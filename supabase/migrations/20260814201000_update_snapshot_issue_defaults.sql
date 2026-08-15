ALTER TABLE public.channel_snapshots
  ALTER COLUMN issue_count SET DEFAULT 16,
  ALTER COLUMN health_score SET DEFAULT 0;

UPDATE public.channel_snapshots
SET issue_count = 16,
    health_score = 0
WHERE issue_count = 12 AND health_score = 4;
