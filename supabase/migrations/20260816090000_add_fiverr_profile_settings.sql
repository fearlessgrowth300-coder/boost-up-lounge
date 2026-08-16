-- Each account chooses the Fiverr profile or gig that receives its campaign orders.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fiverr_profile_url TEXT;

-- A public report may reveal only the channel owner's public Fiverr URL, never the
-- rest of their profile.  This keeps the profile table protected by its own RLS.
CREATE OR REPLACE FUNCTION public.get_channel_fiverr_profile(target_channel_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.fiverr_profile_url
  FROM public.channels AS c
  JOIN public.profiles AS p ON p.id = c.user_id
  WHERE c.id = target_channel_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_fiverr_profile(UUID) TO anon, authenticated;
