CREATE TABLE IF NOT EXISTS public.channel_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  followers INTEGER NOT NULL DEFAULT 0,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  is_live BOOLEAN NOT NULL DEFAULT false,
  recent_broadcasts INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 12,
  health_score INTEGER NOT NULL DEFAULT 4,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_snapshots_channel_recorded_idx
  ON public.channel_snapshots (channel_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.channel_snapshots TO authenticated;
GRANT ALL ON public.channel_snapshots TO service_role;
ALTER TABLE public.channel_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own channel snapshots select"
  ON public.channel_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own channel snapshots insert"
  ON public.channel_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.channels
      WHERE channels.id = channel_id AND channels.user_id = auth.uid()
    )
  );
