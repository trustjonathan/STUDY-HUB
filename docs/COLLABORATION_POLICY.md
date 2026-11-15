# Study Hub Collaboration & Governance Policy

This document defines roles, permissions, production access boundaries, and operational standards for the Study Hub open-source project.

---

## 1. Governance & Roles

| Role | GitHub Permission | Description & Responsibilities |
| :--- | :--- | :--- |
| **Project Owner** (`@trustjonathan`) | `Admin` / Repository Owner | Holds ultimate responsibility for project direction, domain names, production cloud infrastructure, and legal compliance. |
| **Maintainer** | `Write` / `Triage` | Reviews pull requests, triages issues, labels backlog items, guides contributors, and enforces code standards. |
| **Collaborator** | `Triage` | Helps manage issue discussions, verifies bug reports, and reviews content additions. |
| **Contributor** | `Read` (via Fork) | Any developer or student submitting bug fixes, UI improvements, documentation, or study notes via Pull Request. |

---

## 2. Production Access Policy (Zero-Trust by Default)

> **Important Rule:** Contributors and regular maintainers **never** receive direct access to production secrets, credentials, or hosting dashboards.

### Production Boundary Definitions

- **Supabase Cloud Dashboard:** Restricted exclusively to Project Owner. Contains student user records and production database settings.
- **Render Hosting Console:** Restricted to Project Owner. Hosts the live Express API.
- **GitHub Repository Secrets:** Restricted to Project Owner. Houses deployment tokens (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, API secrets).
- **Google Cloud Console:** Houses OAuth 2.0 Web Client IDs and consent screen configuration.
- **AI Provider Accounts (Gemini, OpenAI):** Keys are owned and funded by the Project Owner.
- **Mobile Money Admin Verification:** Admin role in `public.users` is granted only to verified platform administrators.

### Local Mocking for Contributors
Contributors develop and test using their own free-tier Supabase projects or local SQLite/PostgreSQL instances. No production connection string is ever shared or required.

---

## 3. Branching & Protection Rules

### Protected `main` Branch Settings

The `main` branch represents tested, deployable code. Direct pushes are blocked.

- **Pull Request Required:** All changes must land via a Pull Request.
- **Required Approvals:** Minimum of 1 approving review from a maintainer.
- **CODEOWNERS Approval Required:** Any PR touching `supabase/`, `.github/workflows/`, payment endpoints, or authentication middleware requires approval from `@trustjonathan`.
- **Status Checks Must Pass:** The `CI (PR Validation & Build)` workflow must pass before merge.
- **Linear Git History:** Merge strategy is strictly **Squash and Merge**. This prevents micro-commits from cluttering git history.
- **No Force Pushes:** Force pushing and branch deletion are permanently disabled on `main`.

---

## 4. Issue Triage & Review SLAs

- **Initial Issue Triage:** Within 48 hours. Maintainers assign appropriate labels (`bug`, `enhancement`, `good first issue`, `content`).
- **PR Initial Review:** Within 3 business days.
- **Stale PR Policy:** If a PR has requested changes with no author activity for 14 days, a polite reminder is posted. After 28 days of inactivity, the PR may be closed with a welcoming note encouraging reopening when ready.

---

## 5. Decision Making & Escalations

1. **Everyday Changes (UI, bug fixes, docs):** Decided via standard pull request review by any maintainer.
2. **Architectural Decisions (New databases, external dependencies, AI models):** Discussed in an architectural issue RFC; requires Project Owner consent.
3. **Security & Payment Modifications:** Requires written sign-off from Project Owner.

---

## 6. Onboarding & Offboarding Checklist

### Maintainer Onboarding
- [ ] Review `docs/ARCHITECTURE.md` and `docs/COLLABORATION_POLICY.md`.
- [ ] Set up 2-Factor Authentication (2FA) on GitHub account (mandatory).
- [ ] Accept GitHub repository invitation with `Triage` or `Write` role.
- [ ] Added to maintainers communication channel.

### Maintainer Offboarding / Inactivity
- [ ] **Inactivity Window:** 6 consecutive months without repository activity leads to a cordial downgrade to `Triage` or `Read`.
- [ ] Revoke repository write access.
- [ ] Update documentation credits to reflect emeritus maintainer status.
