CREATE TABLE IF NOT EXISTS public.channel_issue_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  issue_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  evidence_url TEXT,
  notes TEXT,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, issue_id)
);

CREATE TABLE IF NOT EXISTS public.channel_workspace (
  channel_id UUID PRIMARY KEY REFERENCES public.channels ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  owner_notes TEXT,
  follow_up_at TIMESTAMPTZ,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_issue_progress_channel_idx
  ON public.channel_issue_progress (channel_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS channel_workspace_follow_up_idx
  ON public.channel_workspace (user_id, follow_up_at);

ALTER TABLE public.channel_issue_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_workspace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages issue progress"
  ON public.channel_issue_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public reads report issue progress"
  ON public.channel_issue_progress FOR SELECT TO anon
  USING (true);

CREATE POLICY "owner manages channel workspace"
  ON public.channel_workspace FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.channel_issue_progress TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_issue_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_workspace TO authenticated;
GRANT ALL ON public.channel_issue_progress, public.channel_workspace TO service_role;
