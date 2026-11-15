# Contributing to Study Hub 📚✨

Welcome! We are thrilled that you are interested in contributing to **Study Hub**.

This platform was built to help Ugandan students access quality education. Many of our contributors are students or early-career developers working on modest laptops and metered mobile data connections. We actively design our workflow to be accessible, low-bandwidth, and welcoming to first-time open-source contributors.

---

## 🧭 Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat fellow contributors with patience, kindness, and respect.

---

## ⚡ Your First Contribution in 30 Minutes

If you are new to Git or open source, here is a fast, low-bandwidth way to make your first contribution:

1. **Find a Beginner Issue:** Look for issues tagged [`good first issue`](https://github.com/trustjonathan/STUDY-HUB/labels/good%20first%20issue) in the repository backlog. These are self-contained and typically touch only 1 or 2 files.
2. **Fork the Repository:** Click the **Fork** button on GitHub to create your own copy.
3. **Clone Your Fork Locally:**
   ```bash
   git clone https://github.com/<your-username>/STUDY-HUB.git
   cd STUDY-HUB
   ```
4. **Create a Feature Branch:**
   ```bash
   git checkout -b fix/correct-subject-typo
   ```
5. **Run the Frontend:**
   ```bash
   cd frontend
   npm ci
   cp .env.example .env
   npm run dev
   ```
   Open [http://localhost:4321/STUDY-HUB/](http://localhost:4321/STUDY-HUB/) in your browser.
6. **Make Your Change:** Edit the file (e.g. fix a broken link or styling flaw), verify it in your browser.
7. **Commit & Push:**
   ```bash
   git add .
   git commit -m "docs: correct syllabus link on biology notes page"
   git push origin fix/correct-subject-typo
   ```
8. **Open a Pull Request:** Navigate to your fork on GitHub and submit a Pull Request against `main`.

---

## 🌿 Contribution Workflow

### 1. Fork & Branch

Always create a new branch for your work. Never commit directly to `main`.

Use clean branch prefixes:
- `feature/<short-name>` – New functionality (e.g. `feature/dark-mode-toggle`)
- `fix/<short-name>` – Bug fixes (e.g. `fix/mobile-nav-overflow`)
- `docs/<short-name>` – Documentation updates (e.g. `docs/setup-guide`)
- `content/<short-name>` – Adding curriculum notes or past papers (e.g. `content/o-level-physics-2024`)

### 2. Commit Message Convention

We follow standard **Conventional Commits**:

- `feat:` Adds a new user-facing feature
- `fix:` Fixes a bug
- `docs:` Documentation changes only
- `style:` Formatting, whitespace, semicolon corrections
- `refactor:` Code restructuring without changing behavior
- `test:` Adding or fixing unit/integration tests
- `chore:` Maintenance, updating dependencies, build scripts

*Example:*
```bash
git commit -m "fix(library): resolve horizontal overflow on 320px mobile screens"
```

### 3. Keeping Your Fork in Sync

Keep your local repository updated with upstream changes to prevent merge conflicts:

```bash
# Add upstream remote once
git remote add upstream https://github.com/trustjonathan/STUDY-HUB.git

# Pull latest main before starting work
git checkout main
git pull upstream main
git checkout your-feature-branch
git merge main
```

---

## 🛡 Protected Boundaries & Permissions

To maintain platform stability, security, and student data protection, certain areas require **maintainer approval** before work begins:

| Repository Area | Can Contributors Edit? | Notes & Requirements |
| :--- | :---: | :--- |
| **Frontend UI & Components** (`frontend/src/`) | ✅ Yes | Follow responsive guidelines (320px+). |
| **Documentation** (`docs/`, `*.md`) | ✅ Yes | Clarifications and guides are warmly welcomed. |
| **Resource Catalogs & Content** | ✅ Yes | Must have rights or proper public attribution. |
| **Backend API Endpoints** (`backend/api/`) | ⚠️ Discuss First | Open an issue before creating new routes. |
| **Database Migrations** (`supabase/`, `backend/database/`) | 🔒 Maintainer Approval | Pushing to `supabase/` triggers production deployments! |
| **Payment Verification** (`*payment*`) | 🔒 Maintainer Approval | Handles real student Mobile Money transactions. |
| **Authentication & Cryptography** (`*auth*`) | 🔒 Maintainer Approval | Security-critical JWT and session logic. |
| **CI/CD Workflows** (`.github/workflows/`) | 🔒 Maintainer Approval | Affects automated deployments and repository secrets. |

---

## 🧪 Testing & Quality Expectations

Before opening your pull request, verify that:

1. **Frontend Builds Cleanly:**
   ```bash
   cd frontend
   npm run build
   ```
2. **Backend Tests Pass:**
   ```bash
   cd backend
   npm test
   ```
3. **Responsive Mobile Check:** Most students in East Africa access Study Hub on budget Android devices. Verify your UI changes in Chrome/Firefox DevTools at **320px, 375px, and 412px** screen widths. Avoid horizontal scrolling.
4. **No Secrets or Credentials:** Never commit `.env` files, API keys, passwords, personal phone numbers, or tokens.
5. **No Network Heavy Assets:** Avoid committing large PDFs or uncompressed images. See [docs/CONTENT_GUIDELINES.md](docs/CONTENT_GUIDELINES.md).

---

## 📬 Submitting a Pull Request

1. Ensure your PR is small and focused (<300 lines of code changes is ideal).
2. Complete all sections of the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
3. Link the relevant issue (e.g. `Closes #42`).
4. Attach screenshots or GIFs for any UI adjustments.
5. A maintainer will review your PR within 48–72 hours. We appreciate your patience!
