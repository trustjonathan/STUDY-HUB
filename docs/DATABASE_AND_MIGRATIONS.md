# Database Schema & Migrations Guide 🗄

This document explains the database structure, migration history, safe authoring practices, and the consolidation roadmap for Study Hub.

---

## 1. Architecture & Single Source of Truth

The Study Hub database runs on PostgreSQL (hosted via Supabase) and utilizes the `pgvector` extension for semantic AI topic search.

### Current State: Two Migration Directories
Historically, migrations developed in two locations:
1. `supabase/migrations/`: Migrations managed via the Supabase CLI and automatically applied to production by `.github/workflows/deploy-supabase.yml`.
2. `backend/database/migrations/`: Migrations authored alongside the Express Sequelize backend.

### Consolidation Roadmap
To prevent split-brain schema discrepancies:
- **`supabase/migrations/` is designated as the single source of truth.**
- A dedicated upcoming PR (`database/consolidate-migrations`) will migrate all backend SQL files into `supabase/migrations/`, remove duplicate versions, and ensure fresh clones can execute `supabase db push` cleanly from zero.
- *Per project owner direction, migration files are not altered in this collaboration setup task.*

---

## 2. Chronological Migration Inventory

Below is the complete execution order of the system's database migrations:

| Timestamp / Prefix | Migration Name | Source Folder | Description |
| :--- | :--- | :--- | :--- |
| `20260919090000` | `study_hub_resources.sql` | `supabase/` | Base catalog indexing table and full-text search indexes. |
| `20261001090000` | `study_hub_math_submissions.sql` | `supabase/` | Math upload staging schema. |
| `20261001110000` | `study_hub_biology_submissions.sql` | `supabase/` | Biology upload staging schema. |
| `20261001120000` | `study_hub_chemistry_submissions.sql` | `supabase/` | Chemistry upload staging schema. |
| `20261009120000` | `study_hub_community_chat.sql` | `supabase/` | Legacy authenticated chat room table. |
| `20261009130000` | `study_hub_anonymous_suggestions.sql`| `supabase/` | Moderated suggestion board schema. |
| `20261009140000` | `study_hub_subject_catalog.sql` | `supabase/` | Subject taxonomy table. |
| `20261009150000` | `study_hub_contributions_inbox.sql` | `supabase/` | Private contribution inbox and staging storage policies. |
| `20261009200000` | `study_hub_resumable_contributions.sql`| `supabase/`| Chunked Tus resumable upload metadata. |
| `20261010201300` | `unlimit_contribution_file_count.sql` | `supabase/` | Relaxes upload batch file count limits. |
| `20261011023000` | `fix_tus_contribution_size_policy.sql`| `supabase/` | Fixes RLS file size evaluation on Tus staging bucket. |
| `20261011090000` | `study_hub_private_moderation.sql` | `supabase/` | Private admin moderation policies. |
| `20261014` | `auth_learning_profile.sql` | `backend/` | **Core Users Table:** Creates `public.users` (id, email, password, role). |
| `20261015` | `google_sign_in.sql` | `backend/` | Adds `google_id` column to `public.users`. |
| `20261016` | `resource_engagement.sql` | `backend/` | Creates `user_ratings` and `user_bookmarks` tables. |
| `20261017` | `resource_dislikes_and_shares.sql` | `backend/` | Adds dislike ratings and public share counter. |
| `20261017223000` | `learner_education_profile.sql` | `supabase/` & `backend/` | Adds `learner_type`, `education_level`, `university_course`. |
| `20261018` | `document_payments.sql` | `backend/` | Creates `document_payments` queue for UGX 1,000 Mobile Money verification. |
| `20261019` | `ai_study_memory.sql` | `backend/` | Enables `pgvector` extension and creates `ai_study_memory` embedding table. |
| `20261021000000` | `study_plans_and_streaks.sql` | `supabase/` & `backend/` | Personalized 7-day study plans, completed sessions, and streaks. |
| `20261022000000` | `seed_initial_study_streak.sql` | `supabase/` & `backend/` | Grants initial 5-day streak to active learners. |

---

## 3. The `public.users` Dependency Gap (Critical Context)

Currently, `20261014_auth_learning_profile.sql` (which creates `public.users`) exists only in `backend/database/migrations/`. Because `supabase/migrations/20261017223000_learner_education_profile.sql` runs `ALTER TABLE public.users ...`, a fresh clone running `supabase db push` will fail unless `public.users` is created first.

### Planned Resolution
In the upcoming migration consolidation PR:
1. `backend/database/migrations/20261014_auth_learning_profile.sql` through `20261019_ai_study_memory.sql` will be formally prefixed with ISO timestamps and moved into `supabase/migrations/`.
2. Duplicate files will be removed.
3. The remote production schema migration table (`supabase_migrations.schema_migrations`) will be aligned using `supabase migration repair`.

---

## 4. How to Author a Safe Migration

When writing new database changes:

1. **Idempotence is Mandatory:**
   Always use guarded DDL statements:
   ```sql
   CREATE TABLE IF NOT EXISTS public.example_table ( ... );
   ALTER TABLE public.example_table ADD COLUMN IF NOT EXISTS example_col TEXT;
   ```
2. **Always Enable Row Level Security (RLS):**
   Every new table exposed to Supabase must enforce RLS:
   ```sql
   ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;
   ```
3. **Non-Blocking Alterations:**
   Avoid table-locking constraints on large tables. Set default values carefully.
4. **Owner Review Gate:**
   Because pushes to `supabase/` on `main` immediately execute `supabase db push` in production, every PR modifying SQL migrations must receive approval from `@trustjonathan`.
