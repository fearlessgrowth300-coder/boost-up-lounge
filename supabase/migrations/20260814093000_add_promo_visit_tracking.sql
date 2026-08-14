ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS operating_system TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT;

CREATE OR REPLACE FUNCTION public.record_promo_click(
  p_channel_id UUID,
  p_country TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_source_domain TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_operating_system TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_click_id UUID;
  target_user_id UUID;
  target_platform TEXT;
BEGIN
  SELECT user_id, platform
    INTO target_user_id, target_platform
  FROM public.channels
  WHERE id = p_channel_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  INSERT INTO public.clicks (
    channel_id,
    country,
    country_code,
    referrer,
    source_domain,
    user_agent,
    device_type,
    operating_system,
    browser,
    language
  )
  VALUES (
    p_channel_id,
    p_country,
    p_country_code,
    p_referrer,
    p_source_domain,
    p_user_agent,
    p_device_type,
    p_operating_system,
    p_browser,
    p_language
  )
  RETURNING id INTO new_click_id;

  INSERT INTO public.activity (channel_id, user_id, event_type, platform, country)
  VALUES (p_channel_id, target_user_id, 'promo_click', target_platform, p_country);

  RETURN new_click_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_promo_click(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_promo_click(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
