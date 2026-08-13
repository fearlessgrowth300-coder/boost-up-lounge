CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'twitch',
  username TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  followers INTEGER NOT NULL DEFAULT 0,
  is_live BOOLEAN NOT NULL DEFAULT false,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, username)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT SELECT ON public.channels TO anon;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view channels" ON public.channels FOR SELECT USING (true);
CREATE POLICY "own channels insert" ON public.channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own channels update" ON public.channels FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own channels delete" ON public.channels FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels ON DELETE CASCADE,
  country TEXT,
  country_code TEXT,
  referrer TEXT,
  source_domain TEXT,
  converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clicks_channel_created_idx ON public.clicks (channel_id, created_at DESC);
GRANT SELECT ON public.clicks TO anon, authenticated;
GRANT ALL ON public.clicks TO service_role;
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view clicks" ON public.clicks FOR SELECT USING (true);

CREATE TABLE public.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  platform TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_user_created_idx ON public.activity (user_id, created_at DESC);
GRANT SELECT ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity select" ON public.activity FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER channels_updated_at BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();