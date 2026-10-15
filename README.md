# STUDY HUB
STUDY HUB that will bring accademic resources at the comfort of the student's phones

## Requirements

- Node.js 22.12.0 or newer (an LTS release is recommended).
- On Windows, install it using the official [Node.js Windows Installer (.msi)](https://nodejs.org/en/download).

Verify the installation with `node --version` and `npm --version`.

## Resource contributions

The document reader accepts any number of files per batch, subject to a 250 MB total batch limit and a 50 MB per-file limit. It sends files directly to private, resumable staging storage in three parallel transfers; after the user submits the complete batch, the server verifies and moves each file to `contribution/` for manual sorting. Completed staged files survive leaving the reader; an interrupted file can resume when the user returns and reselects it in the same browser. Incomplete batches expire after 24 hours. The Biology, Chemistry, and Mathematics archive forms continue to store new uploads in the same private contribution inbox. Existing curated files and previously submitted files are not moved, and contributions are never published automatically.

The GitHub Actions workflows deploy the public site and Supabase upload backend separately. Before the first backend deployment, enable **Anonymous Sign-Ins** in Supabase Auth and add these GitHub repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUBMISSION_RATE_LIMIT_SALT`, and `CONTRIBUTION_CLEANUP_SECRET`. Upload forms currently do not use a CAPTCHA provider; origin checks, anonymous upload sessions, file validation, batch-size limits, and server-side rate limits remain active. `SUPABASE_ACCESS_TOKEN` must be a Supabase Personal Access Token beginning with `sbp_` (not an anon/service-role API key, JWT, or database password). Create it in Supabase account settings, grant access to the target project, and give it **Read** permission for **Project Settings**, **API Keys**, and **API Key Secrets**; the CLI's `supabase link` step requires all three. `SUPABASE_DB_PASSWORD` is different: it must be the current Postgres database password for that project's `postgres` role, not the personal access token, API key, or project reference. If Actions reports `password authentication failed for user "postgres"`, verify that GitHub's `SUPABASE_DB_PASSWORD` secret matches the current database password for the project selected by `SUPABASE_PROJECT_REF`; reset it only if the current value cannot be confirmed. If `db push` reports an object such as a policy already exists, first compare the remote schema with the pending migration. When the complete migration is already present but its version is absent from remote history, use `supabase migration repair --linked --status applied <version>` for only the verified version(s); this records history without rerunning SQL. Never mark a migration applied merely to bypass an error. If Actions reports `Invalid access token format`, replace the `SUPABASE_ACCESS_TOKEN` GitHub repository secret with a newly generated `sbp_` personal access token, then rerun the workflow. Add the repository variable `STUDY_HUB_ALLOWED_ORIGINS` (comma-separated exact origins, for example `https://trustjonathan.github.io,http://localhost:4321,http://127.0.0.1:4321`), and optionally `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` if the project differs from the defaults.

On pushes affecting `supabase/`, `.github/workflows/deploy-supabase.yml` links to the configured project, applies pending migrations, sets upload-only secrets, and deploys the generic reader endpoint, the three archive endpoints, and the staging lifecycle functions. `.github/workflows/cleanup-contribution-staging.yml` calls the protected cleanup function hourly. You can also run either workflow manually from GitHub Actions. Never put the Supabase service-role key in frontend code, URLs, or GitHub repository variables.

The reader's contents panel uses embedded PDF outlines or rendered document headings when available, saves bookmarks and color preferences in the current browser, and offers warm, grayscale, and night color modes. Resuming a partially transferred file requires reselecting that original file because browsers do not let a page reopen a user's local file automatically.

The Study Assistant answers academic questions and builds study guides; the PDF reader's optional AI Study Companion can explain the currently displayed page. Both use the Gemini key only on the backend. AI Study keeps the 20 most recent guide questions and generated answers in the current browser, so they can be searched and reopened without another AI request; backend-published guides are also listed. For local use, run the backend with `GEMINI_API_KEY` set in `backend/.env`, then set `PUBLIC_STUDY_HUB_API_URL=http://localhost:4000` in `frontend/.env` before building or running Astro. The backend defaults to `GEMINI_MODEL=gemini-3.8-flash` and automatically falls back to `GEMINI_FALLBACK_MODEL=gemini-3.5-flash` when the primary model is busy or unavailable. Set either backend variable only to a Gemini model available to your key. For GitHub Pages, deploy the Express backend over HTTPS, set the repository variable `PUBLIC_STUDY_HUB_API_URL` to its public origin, and configure `GEMINI_API_KEY` in that backend's environment. Never add the Gemini key to frontend variables or source. Without a configured API URL, the AI features remain unavailable while the rest of the site continues to work.

## Optional accounts

Visitors can browse subjects and use the public library without an account. To enable account creation, sign-in, and saved learning preferences, apply `backend/database/migrations/20261014_auth_learning_profile.sql` to the backend PostgreSQL database. Configure a random `JWT_SECRET` of at least 32 bytes and the database connection on the backend host. For managed PostgreSQL, set `DATABASE_URL` to the provider's PostgreSQL connection string; production connections use TLS by default. Deploy the Express backend and set `PUBLIC_STUDY_HUB_API_URL` to its HTTPS origin in the GitHub Actions variables or secrets used by Pages builds. The deployment workflow validates this configuration before building so it cannot silently publish a disabled sign-in form. Configure `STUDY_HUB_ALLOWED_ORIGINS` on the backend with the exact frontend origins, comma-separated (including the GitHub Pages origin and local development origins if needed). First-time sign-ins are guided through AI Study and the Library, where learners can choose a class and subjects; they can change these preferences later from the sign-in/profile page. Account sessions are stored in the current browser tab. The AI Study guide request may include the saved class and subject preferences, but does not send the account email or password to Gemini.

Google sign-in additionally requires applying `backend/database/migrations/20261015_google_sign_in.sql`, setting `GOOGLE_CLIENT_ID` on the backend and adding the same public value as `PUBLIC_GOOGLE_CLIENT_ID` in the GitHub Actions variables or secrets used for Pages builds (or to the frontend environment for local builds), and adding each site origin (for example `https://trustjonathan.github.io` and `http://localhost:4321`) to the Google OAuth client's authorized JavaScript origins. Public frontend values are included in the published site even if stored as Actions secrets; keep the Google client secret, if present, on the backend only.

## Anonymous Suggestions

The suggestions board is available at `/STUDY-HUB/community-chat.html`. Visitors do not need an account and the board does not create or restore a Supabase Auth session. The database stores suggestion text, moderation status, and submission time only; it does not store a name, email, user ID, or IP address.

Apply `supabase/migrations/20261009130000_study_hub_anonymous_suggestions.sql` to the Study Hub Supabase project. The frontend build needs `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`; the public anon key is intended for browser use. Never expose a service-role key in the frontend.

New suggestions are `pending` and remain invisible to visitors. A moderator can review them in the Supabase SQL Editor:

```sql
select id, created_at, content
from public.study_hub_suggestions
where status = 'pending'
order by created_at;

update public.study_hub_suggestions
set status = 'approved'
where id = '<suggestion-id>' and status = 'pending';
```

Set `status` to `rejected` instead to dismiss a submission. Approval makes the suggestion publicly readable and refreshes the live board. Public visitors cannot approve, edit, or delete suggestions. The previous authenticated chat table is left untouched by this migration and is no longer used by the public page.
