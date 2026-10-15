ALTER TABLE public.study_hub_resource_ratings
  DROP CONSTRAINT IF EXISTS study_hub_resource_ratings_vote_check;

ALTER TABLE public.study_hub_resource_ratings
  ADD CONSTRAINT study_hub_resource_ratings_vote_check CHECK (vote IN (-1, 1));

CREATE TABLE IF NOT EXISTS public.study_hub_resource_shares (
  resource_id TEXT PRIMARY KEY CHECK (char_length(resource_id) BETWEEN 1 AND 2048),
  share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
