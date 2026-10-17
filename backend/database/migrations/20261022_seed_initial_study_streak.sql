UPDATE public.study_hub_study_plans
   SET streak_count = 5,
       last_study_date = CURRENT_DATE,
       starter_points = 0,
       updated_at = CURRENT_TIMESTAMP
 WHERE starter_points >= 5
   AND streak_count = 0
   AND last_study_date IS NULL;

ALTER TABLE public.study_hub_study_plans
  DROP COLUMN IF EXISTS starter_points;
