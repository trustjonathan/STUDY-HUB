# Study Hub Deployment Runbook 🚀

> **Access Restriction:** Deployment actions, repository secrets, and hosting configuration are restricted exclusively to project maintainers and the project owner (`@trustjonathan`).

---

## 1. Production Architecture Overview

Study Hub deployments are split across three automated infrastructure providers:

| Component | Target Platform | Deployment Trigger | Workflow File |
| :--- | :--- | :--- | :--- |
| **Frontend Static Site** | GitHub Pages | Push to `main` (branch) | `.github/workflows/deploy-pages.yml` |
| **Upload Pipeline & Edge Functions** | Supabase Cloud | Push modifying `supabase/**` on `main` | `.github/workflows/deploy-supabase.yml` |
| **Storage Lifecycle Cleanup** | Supabase Edge Functions | Scheduled hourly cron (`17 * * * *`) | `.github/workflows/cleanup-contribution-staging.yml` |
| **Backend REST API** | Render Cloud | Automated push hook or Git webhook | Render dashboard |

---

## 2. GitHub Pages Deployment (`deploy-pages.yml`)

The frontend deploys automatically on every push to `main`.

### Workflow Steps
1. Checks out repository and installs Node 22 (`npm ci`).
2. Validates that `PUBLIC_STUDY_HUB_API_URL` uses `https://` (preventing insecure HTTP mixed-content blocks).
3. Validates that `PUBLIC_GOOGLE_CLIENT_ID` is present.
4. Executes Astro build:
   ```bash
   npm run build
   ```
5. Packages `frontend/dist` and deploys via GitHub Pages artifact actions.

---

## 3. Supabase Upload Pipeline Deployment (`deploy-supabase.yml`)

Triggered automatically when changes are pushed to `supabase/` on `main`.

### Prerequisites in GitHub Secrets
- `SUPABASE_ACCESS_TOKEN`: A Personal Access Token beginning with `sbp_`.
- `SUPABASE_DB_PASSWORD`: Database password for the `postgres` user.
- `SUPABASE_PROJECT_REF`: The 20-character project identifier.
- `SUBMISSION_RATE_LIMIT_SALT`: Salt for anonymous upload rate limiting.
- `CONTRIBUTION_CLEANUP_SECRET`: Authorization secret for the cleanup cron.

### Deployment Actions
1. Installs Supabase CLI (`supabase/setup-cli@v1`).
2. Links to production project:
   ```bash
   supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
   ```
3. Pushes pending database migrations:
   ```bash
   supabase db push --linked --yes
   ```
4. Deploys Edge Functions:
   - `submit-resource-contribution`
   - `submit-biology-resource`
   - `submit-chemistry-resource`
   - `submit-math-resource`
   - `start-resource-contribution`
   - `finalize-resource-contribution`
   - `cancel-resource-contribution`
   - `cleanup-contribution-staging`
   - `study-hub-admin`
5. Verifies CORS preflight response headers against `https://trustjonathan.github.io`.

---

## 4. Render Backend API Deployment

The Express backend runs on Render as a Web Service.

1. **Environment:** Node.js, runtime `Node 22`.
2. **Build Command:** `npm ci`
3. **Start Command:** `npm start`
4. **Environment Variables:** Set in Render dashboard (see `docs/SECRETS_AND_ENV.md`).
5. **Cold Starts Note:** On Render free-tier instances, the backend server spins down after 15 minutes of inactivity. First requests can experience a 30–50 second delay. The frontend handles this gracefully by showing fallback static catalogs.

---

## 5. Troubleshooting Common Deployment Errors

### 1. `password authentication failed for user "postgres"`
- **Cause:** `SUPABASE_DB_PASSWORD` secret in GitHub Actions does not match the actual database password on Supabase.
- **Fix:** Verify or reset the database password in Supabase Dashboard (**Database Settings > Database Password**) and update the secret in GitHub repository settings.

### 2. `Invalid access token format`
- **Cause:** `SUPABASE_ACCESS_TOKEN` is not an `sbp_` personal access token (e.g. an anon key or JWT was pasted by mistake).
- **Fix:** Generate a new personal access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) with Read/Write permissions for Project Settings and API Secrets.

### 3. `relation already exists` or migration failure during `db push`
- **Cause:** A migration was previously executed manually in the SQL Editor, so running the migration file encounters existing tables or policies.
- **Fix:** Mark that migration version applied in the remote schema history without rerunning the SQL:
  ```bash
  supabase migration repair --linked --status applied <version>
  ```
  *Never use this command merely to bypass a genuine syntax error.*

---

## 6. Rollback Procedures

- **Frontend Rollback:** In GitHub Actions > **Deploy Astro site to GitHub Pages**, select the last successful run and click **Re-deploy** or revert the merge commit on `main`.
- **Backend Rollback:** In Render Dashboard > **Deploys**, select the prior release and click **Rollback**.
- **Database Rollback:** Apply a dedicated corrective down-migration rather than rolling back git commits, as `supabase db push` operates forwards.
