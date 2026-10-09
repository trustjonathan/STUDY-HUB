# Study Hub — Modernization & Supabase Migration Plan

> **Status:** Astro is the sole authored page source; GitHub Pages cutover is pending
> **Implemented:** §0 (resource migration), Astro foundation, shared layout, all page routes, and removal of duplicate legacy HTML sources
> **In progress:** typed Astro/React component extraction and production deployment settings
> **Last updated:** 2026-10-01
> **Owner:** Jonathan (trustjonathan)
...
### Current frontend migration checkpoint

- Astro, TypeScript, and the React integration are configured in `frontend/`.
- The Astro landing route is `frontend/src/pages/index.astro`, with shared page metadata and navigation in `frontend/src/layouts/SiteLayout.astro`.
- All 11 former HTML pages have Astro route sources under `frontend/src/pages/frontend/src/html/` and render through `frontend/src/layouts/LegacyPageLayout.astro`. The root `index.html` and all duplicate `frontend/src/html/**/*.html` sources have been removed. Current `.html` public URLs are generated from Astro routes by flattening Astro's `.html.html` build output.
- The static build uses the GitHub Pages base path `/STUDY-HUB/` and writes to `frontend/dist/`.
- `npm run dev` and `npm run build` stage shared styles, scripts, data, images, `robots.txt`, and `sitemap.xml` under Astro's public output. No legacy HTML pages are copied or served.
- Existing page body markup, styles, and inline scripts are preserved as Astro route content for this migration pass. Typed React/Astro feature components and MDX conversion of authored notes remain future work.
- Production preview verified all 12 Astro routes return HTTP 200 with no runtime JavaScript errors. The build now purges stale copied HTML from its public directory. The Electro tutorial still references two diagram images that are absent from the repository.
- `.github/workflows/deploy-pages.yml` builds and deploys `frontend/dist/`. In GitHub repository Settings → Pages, the source must be set to **GitHub Actions**; the old branch-root deployment cannot work after removing its `index.html`.
- Configure repository Actions variables `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` so deployed Mathematics resources can load. Only the public anon key belongs in the browser build; never use the service-role key there.
- Next: confirm Pages is set to GitHub Actions and these variables exist, deploy, then componentize the page behavior and repair the two missing Electro diagrams.

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

The 6 stale external links (`trustjonathan.github.io/BIOLOGY|CHEMISTRY|CHEMISTRTY|MATHEMATICS/#view-notes|#view-papers`) in `biology.html`, `chemistry.html`, `mathematics.html` were replaced with `data-resources` containers fed by the generated manifest. Chemistry's working internal `chem-notes-html/Electrochemistry.html` link was preserved. Mathematics is now indexed in the shared catalog and its Study Hub page reads Mathematics notes and papers directly from Supabase; the separate Mathematics app remains independently styled.

### 0.5 Supabase migration pipeline

Verified healthy: local and remote history both at `20260919090000`; `supabase db push --linked --dry-run` reports **"Remote database is up to date."**

Removed as part of cleanup: a 0-byte `20260919_remote_schema.sql` (malformed timestamp prefix — would break `db push`), a duplicate non-recursive `backend/upload.mjs`, and an empty `backend/database/schema/` directory.

### 0.6 Mathematics resource sharing

The standalone `MATHEMATICS` app uploads files to `study-hub-resources` under `documents/math/notes` and `documents/math/papers`. `study_hub_resources` is the shared catalog; its existing public SELECT RLS policy permits public Mathematics listings, and the bucket is public, so only approved public materials belong there.

The Math uploader upserts catalog metadata after each successful file upload using `(storage_bucket, storage_path)` as the idempotent key. The trusted uploader/indexer uses `SUPABASE_SERVICE_ROLE_KEY`; browser clients must use only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`. The Study Hub Mathematics route reads `subject=mathematics` and `category=notes|papers` from the Supabase REST API, then builds object URLs from the public bucket and storage path. Biology and Chemistry continue using the generated manifest.

The 2026-10-01 Storage scan found 115 Mathematics objects (20 notes, 94 papers, 1 uncategorized); the categorized resources were indexed into the shared table. The local Supabase anon key returned `Invalid API key` during validation, so replace it and set the GitHub Actions repository variables `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` before relying on deployed browser reads. Never configure a service-role key as a frontend or Actions build variable.

---

## 1. Ground truth & constraints

Every figure below was verified directly against the repository and the live Supabase project — none are estimates.

| Fact | Value | Consequence for this plan |
|---|---|---|
| **GitHub Pages deploy** | Astro workflow exists at `.github/workflows/deploy-pages.yml`; external Pages source setting must be GitHub Actions | The repo no longer has a root `index.html`; deployment must use `frontend/dist/` from the workflow. |
| Build tooling | Astro + TypeScript configured in `frontend/`; `.github/workflows/deploy-pages.yml` builds and deploys the static output | The frontend has a working static build and local preview. GitHub Pages repository settings must select the Actions deployment source. |
| Authored pages | 12 Astro routes (landing + 11 former HTML pages); no duplicate root/static HTML page sources | Routes retain current public URLs; MDX/content collections are still a future content-model refactor. |
| Other frontend assets | **8 CSS** files, **5 JS** files, **18 images (13.33 MB)** | Preserved for route parity in the initial Astro pass; component/style modernization remains pending. |
| Hardcoded absolute URLs | **71 occurrences across 13 files** (`trustjonathan.github.io/...`) in canonical, `og:image`, `og:url`, twitter-card and JSON-LD tags, plus `sitemap.xml` and `robots.txt` | **The single biggest migration hazard.** Every one breaks under a new base path unless made config-driven first. |
| Uploaded documents | **408 files / 487.5 MB** in Supabase Storage | Already migrated. This is **not** markdown-able content. |
| Repository size | **13.13 MiB** (was 528 MiB) | Done — see §0.2. |
| Supabase project | `ttuxelhyoctyshgvjykj`, org "STUDY HUB RESOURCES" | Dedicated to Study Hub. Do not confuse with `jepsiuddbtboogcjiajh` (StudiFy). |
| Tooling available | Node **v26.7.0**, npm, Java 21, Supabase CLI **v2.115.0** (linked) | Astro/Next need no new runtime prerequisites. |
| Test tooling | Astro checker/build (`npm run build`); backend `npm test` remains a placeholder | Frontend build passes; production-preview route smoke test covers the 12 generated routes. |

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

---

## 3. Product development stages (ordered execution)

The following stages should be implemented in order. Each stage builds on the previous one and should be treated as the required delivery sequence for scaling this e-library into a modern study platform.

### Stage 1 — Landing page redesign and positioning

Goal: transform the site from a static resource archive into a polished education brand.

Deliverables:
- Modern hero section with strong educational value proposition
- Subject categories with visual hierarchy
- Clear calls to action: Explore library, Start learning, Get AI tutor
- Benefits section explaining why students should use the platform
- Trust indicators, student outcomes, and learning value messaging
- Mobile-first responsive layout and improved readability
- Modern typography, spacing, cards, and CTA design

Exit criteria:
- The landing page clearly communicates the platform as a study ecosystem, not only a document archive
- The page works smoothly on mobile and desktop
- The primary conversion funnel is easy to understand in under 10 seconds

### Stage 2 — Home dashboard and student workflow

Goal: create a personalized study dashboard that makes the platform useful on return visits.

Deliverables:
- Today’s learning overview
- Study streak and weekly progress indicators
- Continue-learning panel for recent topics/resources
- Quick actions for notes, flashcards, quizzes, and AI tutor
- Recommended resources based on subject or learning gaps
- Saved resources and recently viewed content
- Short revision reminders or daily study goals

Exit criteria:
- Users can reach their learning tasks in 2–3 clicks
- The homepage feels active, useful, and habit-forming
- Students can continue learning without needing to browse the entire site

### Stage 3 — Subject pages and resource experience upgrade

Goal: replace static subject pages with usable learning hubs.

Deliverables:
- Subject landing hero banners and chapter structure
- Topic-based resource cards and chapter filters
- Revision summaries and quick learning paths
- Past papers, notes, and supporting content grouped by topic
- Better navigation, breadcrumbs, and exam-oriented labels
- Subject-specific recommendations and curated views
- Cleaner search and category filters across resources

Exit criteria:
- Each subject page becomes a study destination rather than a file list
- Users can easily discover relevant learning materials by topic and level
- Resource browsing feels structured, explanatory, and exam-focused

### Stage 4 — Interactive learning features

Goal: convert the library into an active study environment.

Deliverables:
- Flashcards with spaced repetition
- Practice quizzes with instant feedback
- Bookmarking and saved notes
- Topic-based learning modules
- Short summaries and step-by-step explanations
- Progress tracking for topics and chapters
- Downloadable or shareable revision packs

Exit criteria:
- Students can actively practise content, not only read resources
- Topic mastery can be tracked over time
- Learning becomes measurable and repeatable

### Stage 5 — AI study assistant and personalization

Goal: add the platform’s strongest differentiator.

Deliverables:
- AI tutor chat for explaining difficult concepts
- Smart summarization of notes and chapters
- Practice question generation by topic
- Revision planning based on exam dates and weak areas
- Personalized recommendations using learner activity
- AI-powered explanations in simple, student-friendly language

Exit criteria:
- Students can ask for help with concepts and receive immediate guidance
- Learning recommendations adapt to performance and interest
- AI improves retention and reduces friction in self-study

### Stage 6 — Growth, community and scale features

Goal: turn the platform into a sustainable learning product that keeps users engaged.

Deliverables:
- User accounts and profiles
- Achievement badges and learning streaks
- Study groups and discussion features
- Community Q&A, peer support, and shared notes
- Analytics dashboard for engagement and performance
- Mobile app / PWA support for offline study access
- Premium or institutional content expansion

Exit criteria:
- Users return repeatedly because the product supports habit and accountability
- The platform supports both individual and group learning
- The foundation is ready for scale, expansion, and institutional adoption

### Stage sequencing rule

The sequence must be followed in strict order:

1. Stage 1 — Landing page redesign
2. Stage 2 — Home dashboard and student workflow
3. Stage 3 — Subject pages and resource experience
4. Stage 4 — Interactive learning features
5. Stage 5 — AI study assistant and personalization
6. Stage 6 — Growth, community and scale

This order is intentional. The product must first become usable and modern, then more interactive, then intelligent, and finally community-driven and scalable.

---

This positions the platform as a modern learner-first product while preserving the existing Supabase-backed resource infrastructure already migrated and verified in Sections 0–2.