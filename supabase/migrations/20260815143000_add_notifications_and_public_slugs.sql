CREATE TABLE IF NOT EXISTS public.channel_public_slugs (
  channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_public_slugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads channel slugs"
  ON public.channel_public_slugs FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.channel_public_slugs TO anon, authenticated;
GRANT ALL ON public.channel_public_slugs TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_channel_public_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  base_slug := trim(both '-' from regexp_replace(lower(NEW.username), '[^a-z0-9]+', '-', 'g'));
  IF base_slug = '' THEN base_slug := 'channel'; END IF;
  final_slug := base_slug;
  IF EXISTS (SELECT 1 FROM public.channel_public_slugs WHERE slug = final_slug) THEN
    final_slug := base_slug || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  INSERT INTO public.channel_public_slugs(channel_id, slug)
  VALUES (NEW.id, final_slug)
  ON CONFLICT (channel_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_channel_public_slug ON public.channels;
CREATE TRIGGER create_channel_public_slug
AFTER INSERT ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.ensure_channel_public_slug();

DO $$
DECLARE channel_row RECORD;
BEGIN
  FOR channel_row IN SELECT id, username FROM public.channels ORDER BY created_at, id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.channel_public_slugs WHERE channel_id = channel_row.id) THEN
      INSERT INTO public.channel_public_slugs(channel_id, slug)
      VALUES (
        channel_row.id,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.channel_public_slugs
            WHERE slug = trim(both '-' from regexp_replace(lower(channel_row.username), '[^a-z0-9]+', '-', 'g'))
          ) THEN trim(both '-' from regexp_replace(lower(channel_row.username), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(channel_row.id::text, '-', ''), 1, 8)
          ELSE trim(both '-' from regexp_replace(lower(channel_row.username), '[^a-z0-9]+', '-', 'g'))
        END
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.campaign_tokens
  DROP CONSTRAINT IF EXISTS campaign_tokens_status_check;
ALTER TABLE public.campaign_tokens
  ADD CONSTRAINT campaign_tokens_status_check
  CHECK (status IN ('awaiting_verification', 'issued', 'active', 'completed', 'revoked'));
ALTER TABLE public.campaign_tokens
  ADD COLUMN IF NOT EXISTS notification_email TEXT,
  ADD COLUMN IF NOT EXISTS campaign_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_milestone INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_tokens_one_pending_per_channel_idx
  ON public.campaign_tokens(channel_id) WHERE status = 'awaiting_verification';

CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels ON DELETE CASCADE,
  campaign_token_id UUID REFERENCES public.campaign_tokens ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  recipient_email TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads notification events"
  ON public.notification_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
