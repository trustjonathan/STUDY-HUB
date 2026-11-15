# Secrets & Environment Variables Inventory 🔐

This document catalogs every environment variable, secret, and repository variable used across Study Hub, along with its sensitivity classification and storage location.

---

## 1. Classification & Security Rules

- **🟢 Public Variables (`PUBLIC_*`):** Embedded into the static frontend build. Visible to anyone inspecting network requests in browser DevTools. Never store private tokens or passwords here.
- **🔴 Secret Keys:** Server-only credentials (database passwords, API keys, JWT secrets). Stored securely in Render environment settings or GitHub Actions repository secrets. Never bundled into frontend code.

---

## 2. Complete Variable Inventory

### A. Frontend Build (`frontend/.env` / GitHub Repository Variables)

| Variable Name | Sensitivity | Purpose & Scope | Default / Example Value |
| :--- | :---: | :--- | :--- |
| `PUBLIC_SUPABASE_URL` | 🟢 Public | Supabase project HTTPS endpoint | `https://your-project.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | 🟢 Public | Supabase public anon key for browser client | `eyJhbGciOi...` |
| `PUBLIC_STUDY_HUB_API_URL` | 🟢 Public | Origin of deployed Express backend | `https://api.studyhub.org` or `http://localhost:4000` |
| `PUBLIC_GOOGLE_CLIENT_ID` | 🟢 Public | Google OAuth 2.0 Web Client ID | `<id>.apps.googleusercontent.com` |
| `PUBLIC_STUDY_HUB_PAYMENT_PHONE` | 🟢 Public | Receiver phone number shown for Mobile Money | Configurable public line (dummy in dev) |

---

### B. Backend API (`backend/.env` / Render Hosting Dashboard)

| Variable Name | Sensitivity | Purpose & Scope |
| :--- | :---: | :--- |
| `NODE_ENV` | 🟢 Config | Execution mode (`development`, `production`, `test`). |
| `PORT` | 🟢 Config | Express listening port (default `4000`). |
| `STUDY_HUB_ALLOWED_ORIGINS` | 🟢 Config | Comma-separated allowed CORS origins. |
| `DATABASE_URL` | 🔴 Secret | PostgreSQL connection string (`postgresql://...`). |
| `DATABASE_SSL` | 🟢 Config | Enable TLS for database connection (`true`/`false`). |
| `DATABASE_SSL_CA` | 🔴 Secret | Supabase database CA certificate PEM contents. |
| `JWT_SECRET` | 🔴 Secret | 32+ byte random string for signing user session tokens. |
| `GEMINI_API_KEY` | 🔴 Secret | Google Gemini API key for AI tutoring and study planning. |
| `GEMINI_MODEL` | 🟢 Config | Primary model identifier (`gemini-3.5-flash`). |
| `GEMINI_FALLBACK_MODEL` | 🟢 Config | Fallback model identifier (`gemini-3.5-flash-lite`). |
| `OPENAI_API_KEY` | 🔴 Secret | OpenAI key for `text-embedding-3-small` topic vector search. |
| `OPEN_AI_API_KEY_1`, `_2` | 🔴 Secret | Failover OpenAI keys. |
| `GITHUB_RESOURCES_PAT` | 🔴 Secret | Fine-grained PAT for uploading curated materials to GitHub archive. |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 Secret | Supabase admin key for server-side resource management. |

---

### C. GitHub Actions Secrets (Repository Settings > Secrets & Variables)

| Secret Name | Purpose | Where Used |
| :--- | :--- | :--- |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token (`sbp_...`) for Supabase CLI | `deploy-supabase.yml` |
| `SUPABASE_DB_PASSWORD` | Postgres database password | `deploy-supabase.yml` |
| `SUPABASE_PROJECT_REF` | 20-character project identifier | `deploy-supabase.yml` |
| `SUBMISSION_RATE_LIMIT_SALT`| Salt for anonymous rate limit hashing | `deploy-supabase.yml` |
| `CONTRIBUTION_CLEANUP_SECRET`| Bearer token authorizing hourly staging cleanup | `cleanup-contribution-staging.yml` |

---

## 3. Key Rotation Runbook

If any credential or key is accidentally exposed or compromised, follow these exact steps immediately:

### A. Rotating Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Delete the compromised API key.
3. Click **Create API key** and generate a replacement.
4. Update `GEMINI_API_KEY` in Render environment settings.
5. Trigger a deployment on Render to apply the new environment.

### B. Rotating Supabase Service Role Key
1. Open Supabase Dashboard > **Project Settings > API**.
2. Under **Project API keys**, click **Reset service_role secret** (or regenerate JWT secret).
   > ⚠️ *Note: Resetting the JWT secret immediately invalidates all active user sessions and requires updating backend settings.*
3. Copy the new key and update `SUPABASE_SERVICE_ROLE_KEY` in Render.

### C. Rotating Supabase Database Password
1. In Supabase Dashboard > **Database Settings > Database Password**, click **Reset database password**.
2. Enter a strong random password.
3. Update `SUPABASE_DB_PASSWORD` in GitHub Actions repository secrets.
4. Update `DATABASE_URL` in Render environment settings.
