# STUDY HUB
STUDY HUB that will bring accademic resources at the comfort of the student's phones

## Requirements

- Node.js 22.12.0 or newer (an LTS release is recommended).
- On Windows, install it using the official [Node.js Windows Installer (.msi)](https://nodejs.org/en/download).

Verify the installation with `node --version` and `npm --version`.

## Resource contributions

The document reader supports bulk batches of up to 20 files and 250 MB total (50 MB per file). It sends files directly to private, resumable staging storage in three parallel transfers; after the user submits the complete batch, the server verifies and moves each file to `contribution/` for manual sorting. Completed staged files survive leaving the reader; an interrupted file can resume when the user returns and reselects it in the same browser. Incomplete batches expire after 24 hours. The Biology, Chemistry, and Mathematics archive forms continue to store new uploads in the same private contribution inbox. Existing curated files and previously submitted files are not moved, and contributions are never published automatically.

The GitHub Actions workflows deploy the public site and Supabase upload backend separately. Before the first backend deployment, enable **Anonymous Sign-Ins** in Supabase Auth and add these GitHub repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `TURNSTILE_SECRET_KEY`, `SUBMISSION_RATE_LIMIT_SALT`, and `CONTRIBUTION_CLEANUP_SECRET`. `SUPABASE_ACCESS_TOKEN` must be a scoped Supabase personal access token that can access the target project and has **Read** permission for **Project Settings**, **API Keys**, and **API Key Secrets**; the CLI's `supabase link` step requires all three. Add the repository variables `STUDY_HUB_ALLOWED_ORIGINS` (comma-separated exact origins, for example `https://trustjonathan.github.io,http://localhost:4321,http://127.0.0.1:4321`), `PUBLIC_TURNSTILE_SITE_KEY`, and optionally `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` if the project differs from the defaults. For local frontend development, set `PUBLIC_TURNSTILE_SITE_KEY` in `frontend/.env`; `TURNSTILE_SITE_KEY` in `backend/.env` is not read by the Astro frontend. Add the GitHub Pages hostname to the Cloudflare Turnstile widget's allowed hostnames. The Pages workflow uses the configured public site key, with the existing widget key as a fallback.

On pushes affecting `supabase/`, `.github/workflows/deploy-supabase.yml` links to the configured project, applies pending migrations, sets upload-only secrets, and deploys the generic reader endpoint, the three archive endpoints, and the staging lifecycle functions. `.github/workflows/cleanup-contribution-staging.yml` calls the protected cleanup function hourly. You can also run either workflow manually from GitHub Actions. Never put the Supabase service-role key in frontend code, URLs, or GitHub repository variables.

The reader's contents panel uses embedded PDF outlines or rendered document headings when available, saves bookmarks and color preferences in the current browser, and offers warm, grayscale, and night color modes. Resuming a partially transferred file requires reselecting that original file because browsers do not let a page reopen a user's local file automatically.

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
