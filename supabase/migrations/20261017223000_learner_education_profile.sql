ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS learner_type TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS university_course VARCHAR(160),
  ADD COLUMN IF NOT EXISTS university_year SMALLINT,
  ADD COLUMN IF NOT EXISTS secondary_track TEXT;
