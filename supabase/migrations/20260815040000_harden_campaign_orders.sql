ALTER TABLE public.campaign_tokens
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_tokens_unique_fiverr_order_idx
  ON public.campaign_tokens (lower(fiverr_order_reference))
  WHERE fiverr_order_reference IS NOT NULL AND status <> 'revoked';
