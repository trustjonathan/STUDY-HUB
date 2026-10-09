# STUDY HUB
STUDY HUB that will bring accademic resources at the comfort of the student's phones

## Requirements

- Node.js 22.12.0 or newer (an LTS release is recommended).
- On Windows, install it using the official [Node.js Windows Installer (.msi)](https://nodejs.org/en/download).

Verify the installation with `node --version` and `npm --version`.

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
