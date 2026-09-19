# Study Hub — Modernization & Supabase Migration Plan

> **Status:** proposal — awaiting approval per phase
> **Implemented:** §0 (completed and verified — see §0 for evidence)
> **Proposed:** §1–§6 (nothing in these sections has been built yet)
> **Last updated:** 2026-09-19
> **Owner:** Jonathan (trustjonathan)

**Contents**

| # | Section |
|---|---|
| 0 | [What has already been completed](#0-what-has-already-been-completed) |
| 1 | [Ground truth & constraints](#1-ground-truth--constraints) |
| 2 | [Reconciliation with the roadmap](#2-reconciliation-with-the-roadmap) |
| 3 | [Phases 0-5](#3-phases) |
| 4 | [Open decisions (blocking)](#4-open-decisions-blocking) |
| 5 | [Sequencing & risks](#5-sequencing--risks) |
| 6 | [Appendix: verified facts & commands](#6-appendix-verified-facts--commands) |

---

## 0. What has already been completed

This plan builds on work that is already **done and verified**. It is recorded here so the plan is not read as if the resource problem is unsolved.

### 0.1 Study material moved out of GitHub → Supabase Storage

| Item | Value |
|---|---|
| Supabase project | `ttuxelhyoctyshgvjykj` (org "STUDY HUB RESOURCES", region `eu-west-1`) |
| Storage bucket | `study-hub-resources` (public) |
| Object prefix | `documents/` → `documents/bio/notes`, `documents/bio/papers`, `documents/chem/papers` |
| Files migrated | **408 uploaded, 0 failed** (6 zero-byte `.exe` stubs deliberately skipped) |
| Payload | **487.5 MB** |
| Catalog table | `public.study_hub_resources` — **408 rows indexed** |
| Migration | `supabase/migrations/20260919090000_study_hub_resources.sql` (bucket + table + indexes + RLS) |

Public URL pattern (unauthenticated, verified `200`):

```
https://ttuxelhyoctyshgvjykj.supabase.co/storage/v1/object/public/study-hub-resources/documents/<subject>/<category>/<file>
```

> **Do not** use `/object/public/resources/...` — no `resources` bucket exists in this project.
> A bucket named `resources` exists only in the unrelated StudiFy project (`jepsiuddbtboogcjiajh`).

### 0.2 Repository slimmed

| Metric | Before | After |
|---|---|---|
| Local git pack | 528.00 MiB | **13.13 MiB** (‑97.5%) |
| `resources/` objects in history | 511 | **0** |
| Remote `main` | `98e21dd` | force-pushed to `f3ce98b` (superseded by later commits) |

Method: `git rm -r --cached resources` + `/resources/` in `.gitignore`, then **BFG Repo-Cleaner** (`--delete-folders resources --no-blob-protection`), reflog expiry, `gc --prune=now`, `git push origin main --force` (only `main` — pushing a backup branch would have restored the payload).

### 0.3 Files added for the migration

| File | Purpose |
|---|---|
| `backend/scripts/upload.mjs` | Recursive CLI uploader (bucket + folder args, Supabase-legal key sanitisation) |
| `backend/scripts/build-resources-manifest.mjs` | Lists the live bucket → writes `frontend/src/data/resources.js`/`.json`, optionally indexes the DB |
| `backend/scripts/upload-resources.js` + `scripts/lib/*` | Fuller migration tool (plan/dry-run, dedupe by SHA-256, resume, retries, manifest) |
| `backend/config/supabase.js` | Shared Supabase client (anon vs service_role) |
| `backend/services/resourceService.js` | Read-path API (catalog query, search, stats, signed URLs) |
| `frontend/src/data/resources.{js,json}` | **Generated** resource index (408 items) used by the static site |
| `frontend/src/script/resources.js` | Renders/filters the library into `[data-resources]` containers |
| `frontend/src/styles/resources.css` | Styles for the above |
| `supabase/config.toml`, `supabase/migrations/*` | Standard Supabase CLI project |

### 0.4 Page rewiring (Supabase-backed library)

The 6 stale external links (`trustjonathan.github.io/BIOLOGY|CHEMISTRY|CHEMISTRTY|MATHEMATICS/#view-notes|#view-papers`) in `biology.html`, `chemistry.html`, `mathematics.html` were replaced with `data-resources` containers fed by the generated manifest. Chemistry's working internal `chem-notes-html/Electrochemistry.html` link was preserved. Mathematics retains its legacy links **as a labelled fallback** because no mathematics files were migrated.

### 0.5 Supabase migration pipeline

Verified healthy: local and remote history both at `20260919090000`; `supabase db push --linked --dry-run` reports **"Remote database is up to date."**

Removed as part of cleanup: a 0-byte `20260919_remote_schema.sql` (malformed timestamp prefix — would break `db push`), a duplicate non-recursive `backend/upload.mjs`, and an empty `backend/database/schema/` directory.

---

## 1. Ground truth & constraints

Every figure below was verified directly against the repository and the live Supabase project — none are estimates.

| Fact | Value | Consequence for this plan |
|---|---|---|
| **GitHub Pages deploy** | source branch `main`, source path `/`, build type **`legacy`**, status `built`, no CNAME | Pages publishes the repo root verbatim — this is why `index.html` links to `frontend/src/html/biology.html`. Any build system must either emit into the repo root, **or** Pages must be switched to GitHub Actions. |
| Build tooling | **none** — no `frontend/package.json`, `astro.config.*`, `next.config.*`, `tailwind.config.*`, `vite.config.*`, `tsconfig.json`, and no `.github/` directory | The framework migration is **greenfield, not incremental**. There is no existing bundler, dev server, or CI to extend. |
| Authored pages | **11 HTML files** under `frontend/src/html/` (**178 KB**) + root `index.html` (**31 KB**) | Small enough to migrate by hand; large enough to need a real content model. |
| Other frontend assets | **8 CSS** files, **5 JS** files, **18 images (13.33 MB)** | All 8 CSS files are replaced outright by a utility framework (Tailwind). |
| Hardcoded absolute URLs | **71 occurrences across 13 files** (`trustjonathan.github.io/...`) in canonical, `og:image`, `og:url`, twitter-card and JSON-LD tags, plus `sitemap.xml` and `robots.txt` | **The single biggest migration hazard.** Every one breaks under a new base path unless made config-driven first. |
| Uploaded documents | **408 files / 487.5 MB** in Supabase Storage | Already migrated. This is **not** markdown-able content. |
| Repository size | **13.13 MiB** (was 528 MiB) | Done — see §0.2. |
| Supabase project | `ttuxelhyoctyshgvjykj`, org "STUDY HUB RESOURCES" | Dedicated to Study Hub. Do not confuse with `jepsiuddbtboogcjiajh` (StudiFy). |
| Tooling available | Node **v26.7.0**, npm, Java 21, Supabase CLI **v2.115.0** (linked) | Astro/Next need no new runtime prerequisites. |
| Test tooling | None (backend `npm test` is a placeholder) | Phase 2 introduces the first real build/test step — budget time for it. |

---

## 2. Reconciliation with the roadmap

The submitted roadmap implies the content-storage problem is untouched. **Most of it is already solved**, and the roadmap conflates two fundamentally different kinds of content.

### 2.1 Two content types, two different solutions

| Content type | Volume | Correct home | Status |
|---|---|---|---|
| **Authored notes** — hand-written explanations, the HTML note pages | 11 pages | MDX + frontmatter → framework content collections | **Not started** (Phase 1) |
| **Uploaded documents** — scanned UNEB/UACE papers, textbook PDFs, DOCX | 408 files / 487.5 MB | Supabase Storage + `study_hub_resources` catalog | **Done** (§0) |

Authoring the 408 scanned PDFs as MDX would be a category error: they are binary scans, not text. Conversely, the 11 HTML note pages are exactly the content that *should* become MDX.

### 2.2 What survives a framework change, and what gets replaced

**Survives (no rework needed):**

* The Supabase project, the `study-hub-resources` bucket and its 408 objects
* The `study_hub_resources` table (408 rows) and its RLS policies
* `backend/scripts/build-resources-manifest.mjs` — the manifest generator
* `backend/scripts/upload.mjs` and `upload-resources.js` — upload tooling
* `backend/config/supabase.js`, `backend/services/resourceService.js`
* `frontend/src/data/resources.json` — pure data, consumable by any framework

**Gets replaced:**

* All 8 CSS files → Tailwind utilities / design tokens
* `frontend/src/script/resources.js` (direct DOM manipulation) → a framework component
* All 12 page bodies → layouts + components

### 2.3 Two roadmap items that need correcting on technical grounds

1. **Mermaid.js for "biological diagrams".** Mermaid is a flow/graph/timeline engine — it cannot render anatomy, cell structures, or specimen illustrations. Correct use: **Mermaid for chemical pathways and process flows**, **authored SVG for biological structures**. Do not promise Mermaid for biology.
2. **Video.js for "unified media".** For unifying YouTube embeds it adds roughly 150 KB of JS and worsens mobile performance on the exact low-bandwidth networks this project targets. A **click-to-load facade** (static `youtube-nocookie` thumbnail plus a play button, swapping in the iframe on tap) is faster, lighter, and defers the third-party connection entirely. Recommend facades over Video.js.

### 2.4 Where the roadmap is right

Section 1 (editorial/tone) is the highest-credibility-value, lowest-risk change and should happen first. Section 5 (offline, lazy loading, image formats) is genuinely needed for Ugandan mobile networks. Section 3's breadcrumbs and level-labelling directly improve exam-preparation usability.