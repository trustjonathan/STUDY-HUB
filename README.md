# STUDY HUB
STUDY HUB that will bring accademic resources at the comfort of the student's phones

## Requirements

- Node.js 22.12.0 or newer (an LTS release is recommended).
- On Windows, install it using the official [Node.js Windows Installer (.msi)](https://nodejs.org/en/download).

Verify the installation with `node --version` and `npm --version`.

## Resource contributions

The document reader supports bulk batches of up to 20 files and 250 MB total (50 MB per file). It sends files directly to private, resumable staging storage in three parallel transfers; after the user submits the complete batch, the server verifies and moves each file to `contribution/` for manual sorting. Completed staged files survive leaving the reader; an interrupted file can resume when the user returns and reselects it in the same browser. Incomplete batches expire after 24 hours. The Biology, Chemistry, and Mathematics archive forms continue to store new uploads in the same private contribution inbox. Existing curated files and previously submitted files are not moved, and contributions are never published automatically.

Apply both `supabase/migrations/20261009150000_study_hub_contributions_inbox.sql` and `supabase/migrations/20261009200000_study_hub_resumable_contributions.sql`. Enable anonymous sign-ins in Supabase Auth, then deploy `start-resource-contribution`, `finalize-resource-contribution`, `cancel-resource-contribution`, and `cleanup-contribution-staging`. Configure `TURNSTILE_SECRET_KEY`, `SUBMISSION_RATE_LIMIT_SALT`, `STUDY_HUB_ALLOWED_ORIGINS`, and `CONTRIBUTION_CLEANUP_SECRET`; schedule `cleanup-contribution-staging` to run hourly using that secret so expired staging files are removed. Redeploy `submit-resource-contribution` and the three subject submission functions so archive-form uploads continue to use the shared inbox and rate limit. Static sites need only the public Supabase anon key and Cloudflare Turnstile site key; never put a service-role key in frontend code or URLs.

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
