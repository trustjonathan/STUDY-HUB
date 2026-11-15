# Study Hub Technical Audit & Security Review 🛡📊

**Date of Audit:** November 2026  
**Auditor Role:** Senior Open-Source Maintainer, Security-Minded Reviewer & Technical Writer  
**Repository Target:** `trustjonathan/STUDY-HUB`  
**Live Site Verified:** [https://trustjonathan.github.io/STUDY-HUB/](https://trustjonathan.github.io/STUDY-HUB/)  

---

## Executive Summary

Study Hub is an impressive, high-impact educational initiative providing Ugandan students and teachers with free revision resources, curriculum-aligned notes, a PDF flipbook reader, and AI study tools.

This comprehensive audit evaluates platform security, privacy compliance under Uganda's legal framework, database architecture, payment workflows, and contributor readiness.

---

## Summary of Findings by Severity

| Severity | Count | Primary Areas |
| :---: | :---: | :--- |
| **CRITICAL** | 2 | Committed secret credentials (handled/rotated). |
| **HIGH** | 5 | Wildcard CORS fallback, DB migration divergence, payment spoofing risk, unmetered anonymous forms, unrevocable 30-day JWTs. |
| **MEDIUM** | 7 | Supabase HTTP 402 catalog outage, Node engine mismatch, unpruned dependencies (`mongoose`), dead backend routes, privacy policy disclosure alignment. |
| **LOW** | 5 | Public anon key / project ref documentation, AdSense/ads.txt configuration, legacy MongoDB config files. |

---

## Detailed Audit Findings

### 1. Security & Credentials

#### SEC-01: Exposed Supabase `service_role` Key in Environment Template
- **File Path:** `backend/.env.example` (line 15)
- **Finding:** A live Supabase `service_role` JWT token was committed to version control in the example configuration file.
- **Why It Matters:** The Supabase `service_role` key bypasses all Row Level Security (RLS) policies. Anyone possessing this key has unrestricted administrative read, write, and delete permissions over the entire cloud database and storage buckets.
- **Status:** **CRITICAL** | **Effort:** S | **Status: ROTATED**
- **Remediation:** The key was rotated by the project owner. The `.env.example` file has been sanitized with standard placeholders. Git history scrubbing is being finalized on branch `security/remove-exposed-secrets`.

#### SEC-02: Hardcoded Google Gemini API Key in Frontend Astro Pages
- **File Path:**
  - `frontend/src/pages/frontend/src/html/bio-notes-html/bio-updates.html.astro`
  - `frontend/src/pages/frontend/src/html/bio-notes-html/cell-division.html.astro`
  - `frontend/src/pages/frontend/src/html/bio-notes-html/story-of-genetics.html.astro`
  - `frontend/src/pages/frontend/src/html/chem-notes-html/Electrochemistry.html.astro`
  - `frontend/src/pages/frontend/src/html/math-notes-html/math-updates.html.astro`
- **Finding:** A live Google API key (`AIza...`) was hardcoded directly in client-side script blocks across 5 legacy notes pages.
- **Why It Matters:** Publicly exposed API keys can be scraped by automated bots, leading to quota exhaustion, denial of service for genuine students, or unexpected billing.
- **Status:** **CRITICAL** | **Effort:** S | **Status: ROTATED**
- **Remediation:** The key was invalidated and rotated. All AI requests must route through the backend proxy (`POST /api/ai-study-companion`), completely removing client-side AI keys.

#### SEC-03: Permissive CORS Fallback in Express Server
- **File Path:** `backend/server.js` (lines 18–23)
- **Finding:** If `STUDY_HUB_ALLOWED_ORIGINS` is unset or empty, Express defaults to `app.use(cors({}))`, which emits `Access-Control-Allow-Origin: *`.
- **Why It Matters:** Any malicious website can initiate authenticated cross-origin requests to backend endpoints if the learner has an active session.
- **Status:** **HIGH** | **Effort:** S
- **Remediation:** Enforce a strict fallback allowing only `https://trustjonathan.github.io` and `http://localhost:4321`. Throw an error or refuse startup if origins are misconfigured in production.

#### SEC-04: Non-Revocable 30-Day JWT Tokens
- **File Path:** `backend/config/index.js` (line 16), `backend/middleware/authMiddleware.js`
- **Finding:** Backend authentication issues JWT tokens with a 30-day lifetime (`auth.tokenExpiry: '30d'`). Tokens are verified statelessly without checking if a user was deleted, banned, or had their role revoked.
- **Why It Matters:** If an administrator role is revoked in the database, the user remains an admin until the 30-day token expires.
- **Status:** **HIGH** | **Effort:** M
- **Remediation:** Shorten token expiry to 1–7 days, implement token refresh, or query user status in `authMiddleware.verifyToken` for privileged admin routes.

#### SEC-05: Anonymous Uploads & Suggestions Without CAPTCHA
- **File Path:** `supabase/functions/submit-resource-contribution/`, `supabase/migrations/20261009130000_study_hub_anonymous_suggestions.sql`
- **Finding:** Suggestions and upload staging endpoints accept submissions without proof-of-work or CAPTCHA verification (relying only on IP rate limiting).
- **Why It Matters:** Spambots or bad actors can flood storage or the suggestion moderation queue with unwanted content.
- **Status:** **HIGH** | **Effort:** M
- **Remediation:** Integrate Cloudflare Turnstile or a lightweight mathematical challenge on upload and suggestion forms.

#### SEC-06: Supabase Anon Keys and Project References in Client Code
- **File Path:** `.github/workflows/deploy-pages.yml`, `frontend/src/`
- **Finding:** Supabase project URL and anon public API key are present in frontend deployment definitions.
- **Why It Matters:** Supabase anon keys are designed to be public and are safe when Row Level Security (RLS) is strictly enforced. However, they should still be managed cleanly through repository variables.
- **Status:** **LOW** | **Effort:** S

---

### 2. Privacy & Regulatory Compliance (Uganda DPPA 2019)

#### PRIV-01: Storage & Verification of Learner Phone Numbers
- **File Path:** `backend/api/controllers/documentPaymentController.js`, `backend/database/migrations/20261018_document_payments.sql`
- **Finding:** The platform records sender Mobile Money phone numbers in `public.document_payments` to enable manual verification of UGX 1,000 document downloads.
- **Compliance Context:** Under Uganda's **Data Protection and Privacy Act 2019 (DPPA)**, telephone numbers qualify as personal data. Personal data must be collected with consent, used solely for the stated purpose, and not retained indefinitely.
- **Why It Matters:** Unencrypted phone numbers stored indefinitely without an automated data retention policy expose students to privacy risks.
- **Status:** **HIGH** | **Effort:** M
- **Remediation:**
  1. Add an explicit consent checkbox on the checkout page.
  2. Implement an automated retention rule that masks or deletes phone numbers 30 days after verification.
  3. Ensure the Privacy Policy explicitly discloses Mobile Money verification processing.

#### PRIV-02: Hardcoded Personal Support Phone Numbers in Repository
- **File Path:** `README.md`, `frontend/src/pages/document-payment.astro`
- **Finding:** The personal telephone number `0701810497` was hardcoded as the default payment receiving number.
- **Why It Matters:** Hardcoded personal numbers expose maintainers to harassment, spam, and SIM-swap scrutiny.
- **Status:** **MEDIUM** | **Effort:** S
- **Remediation:** Replaced default with configurable environment variable `PUBLIC_STUDY_HUB_PAYMENT_PHONE` (using `0700000000` in dev templates).

---

### 3. Payment Processing & Verification Risks

#### PAY-01: Manual Verification Vulnerability (SMS Spoofing Risk)
- **File Path:** `backend/api/controllers/documentPaymentController.js`
- **Finding:** Admin verifiers manually inspect sender phone numbers and compare them with incoming carrier SMS alerts on their personal SIM.
- **Why It Matters:** A malicious user can submit a phone number matching a legitimate transaction sent by someone else, or spoof a transaction.
- **Status:** **HIGH** | **Effort:** M
- **Remediation:** Require submitters to include the Carrier Transaction ID (e.g. MTN MoMo or Airtel Money reference code). For long-term scale, transition to an automated aggregator (e.g. Flutterwave, Paypack, or Beyonic/Yo! Payments).

#### PAY-02: One-Time Download Enforcement vs Public CDN URLs
- **File Path:** `backend/api/controllers/documentPaymentController.js` (lines 200–240)
- **Finding:** The backend enforces a one-time download state (`consumed`) for verified payments. However, some document files in GitHub repositories remain publicly accessible by direct URL if a student discovers the raw CDN link.
- **Why It Matters:** Paid entitlement is enforced only at the UI layer; direct URLs bypass payment.
- **Status:** **MEDIUM** | **Effort:** L
- **Remediation:** Keep premium documents in private Supabase Storage buckets accessible solely through time-limited signed URLs generated upon payment verification.

---

### 4. Database Schema & Migration Architecture

#### DB-01: Split-Brain Migration Directories & Missing `public.users` in Supabase
- **File Path:** `supabase/migrations/` vs `backend/database/migrations/`
- **Finding:** Migrations are split across two directories. `public.users` is defined in `backend/database/migrations/20261014_auth_learning_profile.sql`, but missing from `supabase/migrations/`.
- **Why It Matters:** Running `supabase db push` from a fresh clone fails on `supabase/migrations/20261017223000_learner_education_profile.sql` because the `public.users` table does not exist.
- **Status:** **HIGH** | **Effort:** M
- **Remediation:** Consolidate all migrations into `supabase/migrations/` as the single source of truth in an upcoming dedicated PR, adding timestamp prefixes to backend migrations.

#### DB-02: Duplicate Migration Files
- **File Path:**
  - `supabase/migrations/20261017223000_learner_education_profile.sql` vs `backend/database/migrations/20261020_learner_education_profile.sql`
  - `supabase/migrations/20261021000000_study_plans_and_streaks.sql` vs `backend/database/migrations/20261021_study_plans_and_streaks.sql`
  - `supabase/migrations/20261022000000_seed_initial_study_streak.sql` vs `backend/database/migrations/20261022_seed_initial_study_streak.sql`
- **Finding:** Three migrations exist in identical form under different filenames in both directories.
- **Why It Matters:** Causes confusion for contributors and risks double execution.
- **Status:** **MEDIUM** | **Effort:** S
- **Remediation:** Remove duplicate files from `backend/database/migrations/` once consolidated.

---

### 5. Operational & Reliability Findings

#### OPS-01: Supabase HTTP 402 Outage on Live Biology Catalog
- **File Path:** Live production site (`/STUDY-HUB/biology.html`), `frontend/src/script/resources.js`
- **Finding:** The live Biology subject page requests resources from Supabase and receives an HTTP 402 (Payment Required / Project Quota Exceeded). The UI displays "Resources could not be loaded right now" and the retry button simply hits the failing endpoint again.
- **Why It Matters:** Degrades student user experience on one of the platform's flagship subjects.
- **Status:** **MEDIUM (Operations Risk)** | **Effort:** S
- **Owner Note:** *Identified and actively getting worked on.*
- **Technical Recommendation:** Update `resources.js` to automatically fall back to the static checked-in JSON catalog (`public/study-hub-resources-1-catalog.json`) when Supabase returns 402 or 5xx.

#### OPS-02: Node Version Engine Incompatibility
- **File Path:** `frontend/package.json` (lines 5–7)
- **Finding:** `frontend/package.json` specifies `"engines": { "node": ">=22.12.0" }`. Astro 7 throws a fatal error if executed on Node 20.x, which is still common on many developer laptops.
- **Why It Matters:** New contributors running older LTS releases cannot build or run the project locally.
- **Status:** **MEDIUM** | **Effort:** S
- **Remediation:** Clearly document Node 22.12+ in `README.md` and `docs/LOCAL_DEVELOPMENT.md`.

#### OPS-03: Dead Backend Routes and Unused Dependencies
- **File Path:** `backend/package.json`, `backend/api/routes/`
- **Finding:**
  - `mongoose` is installed and initialized in `database/config/mongo.js`, but MongoDB is not used anywhere in production.
  - `expree` (typo package) and `cloudinary` are present in `dependencies`.
  - Both `bcrypt` and `bcryptjs` are installed simultaneously.
  - `marketplaceRoutes.js`, `socialRoutes.js`, and `knowledgeRoutes.js` exist in `backend/api/routes/` but are unmounted in `server.js`.
- **Why It Matters:** Bloats `node_modules` install times and bandwidth usage for East African contributors on metered connections.
- **Status:** **MEDIUM** | **Effort:** S
- **Remediation:** Remove unused dependencies and unmounted route files during Phase 2 cleanup.
