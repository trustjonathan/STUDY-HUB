CREATE TABLE IF NOT EXISTS public.study_hub_resource_ratings (
  resource_id TEXT NOT NULL CHECK (char_length(resource_id) BETWEEN 1 AND 2048),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS study_hub_resource_ratings_resource_idx
  ON public.study_hub_resource_ratings (resource_id);

CREATE TABLE IF NOT EXISTS public.study_hub_resource_bookmarks (
  resource_id TEXT NOT NULL CHECK (char_length(resource_id) BETWEEN 1 AND 2048),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS study_hub_resource_bookmarks_user_idx
  ON public.study_hub_resource_bookmarks (user_id);
