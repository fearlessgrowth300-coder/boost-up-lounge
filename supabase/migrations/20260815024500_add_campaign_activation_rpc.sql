CREATE OR REPLACE FUNCTION public.activate_campaign_token(
  p_channel_id UUID,
  p_token_hash TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
BEGIN
  SELECT status INTO current_status
  FROM public.campaign_tokens
  WHERE channel_id = p_channel_id AND token_hash = p_token_hash;

  IF current_status IS NULL THEN RETURN 'invalid'; END IF;
  IF current_status = 'revoked' THEN RETURN 'revoked'; END IF;
  IF current_status = 'active' THEN RETURN 'already_active'; END IF;

  UPDATE public.campaign_tokens
  SET status = 'active', activated_at = now()
  WHERE channel_id = p_channel_id
    AND token_hash = p_token_hash
    AND status = 'issued';

  RETURN 'activated';
END;
$$;

REVOKE ALL ON FUNCTION public.activate_campaign_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_campaign_token(UUID, TEXT) TO anon, authenticated;
