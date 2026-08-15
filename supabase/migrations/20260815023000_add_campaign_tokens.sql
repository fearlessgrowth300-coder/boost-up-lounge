CREATE TABLE IF NOT EXISTS public.campaign_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_preview TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'active', 'revoked')),
  fiverr_order_reference TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS campaign_tokens_owner_idx
  ON public.campaign_tokens (user_id, issued_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_tokens_one_issued_per_channel_idx
  ON public.campaign_tokens (channel_id) WHERE status = 'issued';
CREATE UNIQUE INDEX IF NOT EXISTS campaign_tokens_one_active_per_channel_idx
  ON public.campaign_tokens (channel_id) WHERE status = 'active';

ALTER TABLE public.campaign_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages campaign tokens"
  ON public.campaign_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_tokens TO authenticated;
GRANT ALL ON public.campaign_tokens TO service_role;
