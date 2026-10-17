CREATE TABLE IF NOT EXISTS public.study_hub_study_plans (
  user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan JSONB NOT NULL,
  starter_points INTEGER NOT NULL DEFAULT 0 CHECK (starter_points >= 0),
  streak_count INTEGER NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_study_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.study_hub_study_activity (
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  completed_topics INTEGER NOT NULL DEFAULT 0 CHECK (completed_topics >= 0),
  reading_minutes INTEGER NOT NULL DEFAULT 0 CHECK (reading_minutes >= 0),
  PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS study_hub_study_activity_user_date_idx
  ON public.study_hub_study_activity (user_id, activity_date DESC);

REVOKE ALL ON TABLE public.study_hub_study_plans FROM PUBLIC;
REVOKE ALL ON TABLE public.study_hub_study_activity FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.study_hub_study_plans FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.study_hub_study_activity FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.study_hub_study_plans FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public.study_hub_study_activity FROM authenticated';
  END IF;
END
$$;
