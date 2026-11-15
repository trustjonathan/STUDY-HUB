# Repository Settings Checklist (for Project Owner) 🛡

This checklist provides the exact GitHub web configuration options for the repository owner (`@trustjonathan`) to ensure enterprise-grade security and smooth collaboration.

---

## 1. Branch Protection for `main`

Go to **Repository Settings → Branches → Add branch protection rule**:
- **Branch name pattern:** `main`

Check the following boxes:
- [x] **Require a pull request before merging**
  - [x] **Require approvals:** Set to **1**
  - [x] **Dismiss stale pull request approvals when new commits are pushed**
  - [x] **Require review from Code Owners** (enforces `.github/CODEOWNERS`)
- [x] **Require status checks to pass before merging**
  - [x] **Require branches to be up to date before merging**
  - [x] **Status checks that are required:**
    - `Backend Test Suite`
    - `Frontend Typecheck & Build`
- [x] **Require conversation resolution before merging**
- [x] **Require linear history** (pairs with Squash and Merge)
- [x] **Do not allow bypassing the above settings**
- [x] **Block force pushes** (prevent accidental history overwrites)
- [x] **Do not allow deletions**

---

## 2. Pull Request & Merge Settings

Go to **Repository Settings → General → Pull Requests**:
- [ ] Allow merge commits: **Disabled** (uncheck)
- [x] **Allow squash merging:** **Enabled** (Default to PR title and commit details)
- [ ] Allow rebase merging: **Disabled** (uncheck)
- [x] **Automatically delete head branches:** **Enabled** (keeps branches list tidy)

---

## 3. GitHub Actions & Fork PR Safeguards

Go to **Repository Settings → Actions → General**:

### Fork Pull Request Execution
- Select: **Require approval for first-time contributors** (or *Require approval for all outside collaborators*).
  *This prevents untrusted forks from executing arbitrary cryptocurrency miners or malicious scripts on GitHub Actions runners.*

### Workflow Permissions
- Select: **Read repository contents and packages permissions** (read-only by default).
- [ ] Allow GitHub Actions to create and approve pull requests: **Disabled** (uncheck).

---

## 4. Code Security & Analysis

Go to **Repository Settings → Code security and analysis**:

- [x] **Dependency graph:** **Enabled**
- [x] **Dependabot alerts:** **Enabled**
- [x] **Dependabot security updates:** **Enabled**
- [x] **Secret scanning:** **Enabled**
- [x] **Push protection for secret scanning:** **Enabled**
  *Push protection blocks commits containing API keys, private keys, or tokens before they can be pushed.*
- [x] **Private vulnerability reporting:** **Enabled**
  *Enables researchers to report vulnerabilities privately under the Security tab.*

---

## 5. GitHub Pages Settings

Go to **Repository Settings → Pages**:
- **Source:** Select **GitHub Actions**.
- **Custom domain:** (Leave as `trustjonathan.github.io/STUDY-HUB/` or configure custom domain).
- [x] **Enforce HTTPS:** **Enabled**

---

## 6. Community Features

Go to **Repository Settings → General → Features**:
- [x] **Issues:** Enabled (powered by `.github/ISSUE_TEMPLATE/`)
- [x] **Discussions:** Enabled (for Q&A, syllabus chat, and student study groups)
- [ ] **Wikis:** Optional / Disabled (documentation lives in `docs/` within version control)
