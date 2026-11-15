# Local Development Guide 💻

This guide walks you through setting up and running Study Hub on your local machine.

---

## 🛠 System Prerequisites

- **Node.js:** `>=22.12.0` (LTS recommended).
  > ⚠️ **Important:** Astro 7 strictly requires Node 22.12 or newer. Running an older version (such as Node 20.x) will cause `astro check` and `astro build` to exit with an engine incompatibility error.
  > Check your installed version:
  > ```bash
  > node --version
  > npm --version
  > ```
- **Git**
- **Operating System:** Windows, macOS, or Linux.

---

## 🚀 Setup Mode A: Frontend-Only (Fastest, Recommended)

You do **not** need a backend, database, or external API keys to contribute to the frontend UI, flipbook reader, or documentation.

1. **Clone your fork:**
   ```bash
   git clone https://github.com/<your-username>/STUDY-HUB.git
   cd STUDY-HUB/frontend
   ```
2. **Install dependencies:**
   ```bash
   npm ci
   ```
3. **Configure local environment:**
   ```bash
   cp .env.example .env
   ```
   The default template connects to mock endpoints and local catalogs. You do not need to change any values for standard UI development.
4. **Start the Astro development server:**
   ```bash
   npm run dev
   ```
5. **Open in browser:**
   Navigate to [http://localhost:4321/STUDY-HUB/](http://localhost:4321/STUDY-HUB/).

---

## ⚙️ Setup Mode B: Full Stack (Frontend + Backend + Database)

Use this setup when working on authentication, study plans, AI tutoring proxies, or payment verification.

### 1. Configure the Express Backend

1. Navigate to the backend directory:
   ```bash
   cd ../backend
   npm ci
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Generate a secure local JWT secret (minimum 32 characters):
   ```bash
   # On macOS/Linux/Git Bash:
   openssl rand -hex 32
   # On Windows PowerShell:
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
   Paste this value into `JWT_SECRET` in `backend/.env`.

### 2. Set Up a Local Database or Free Supabase Project

You have two choices for your development database:

#### Choice 1: Local PostgreSQL (Docker or Native)
1. Install PostgreSQL 15+ locally or launch via Docker:
   ```bash
   docker run --name studyhub-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=studyhub -p 5432:5432 -d postgres:15
   ```
2. In `backend/.env`, set:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studyhub
   ```
3. Apply backend migrations in numerical order:
   ```bash
   # Execute each SQL migration in backend/database/migrations/ against your local database
   psql -U postgres -d studyhub -f backend/database/migrations/20261014_auth_learning_profile.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261015_google_sign_in.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261016_resource_engagement.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261017_resource_dislikes_and_shares.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261018_document_payments.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261019_ai_study_memory.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261020_learner_education_profile.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261021_study_plans_and_streaks.sql
   psql -U postgres -d studyhub -f backend/database/migrations/20261022_seed_initial_study_streak.sql
   ```

#### Choice 2: Free Supabase Cloud Project
1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project (e.g. `study-hub-dev`).
3. In **Project Settings > Database > Connection String**, copy the URI and set it as `DATABASE_URL` in `backend/.env`.

### 3. Optional: Configure AI Keys

To test Gemini AI tutoring or OpenAI memory:
- Obtain a free API key from [Google AI Studio](https://aistudio.google.com/) and set `GEMINI_API_KEY` in `backend/.env`.
- The models default to `GEMINI_MODEL=gemini-3.5-flash` with fallback to `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite`.
- Never commit these keys!

### 4. Start the Backend Server

```bash
cd backend
npm start
```
The server will start on [http://localhost:4000](http://localhost:4000). Verify by opening [http://localhost:4000/health](http://localhost:4000/health).

### 5. Run the Backend Test Suite

The test suite runs against in-memory mocks without needing live external API keys:
```bash
cd backend
npm test
```
All 65 tests should pass.

---

## 🧪 Seeding Test Data

To create a local administrator account for testing payment verification:
```sql
-- Connect to your local database and run:
INSERT INTO public.users (username, email, password, role, "createdAt", "updatedAt")
VALUES ('TestAdmin', 'admin@example.com', '$2a$10$wT/Yl1N5Q4v0Xp0yV5EwMeH/E1R6e2BvH8O7F5B1K7A1B2C3D4E5F', 'admin', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
```
*(The password hash corresponds to the test password `Password123!`)*.
