-- Create settings table for evTrack app
CREATE TABLE IF NOT EXISTS public.ev_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) and allow public read-write
ALTER TABLE public.ev_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for settings" ON public.ev_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default electric rate
INSERT INTO public.ev_settings (key, value)
VALUES ('electric_rate', '4.2218')
ON CONFLICT (key) DO NOTHING;
