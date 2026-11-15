# Study Hub Issue Backlog

## 1. How to use this file

Pick an open issue that matches your time and experience, then comment that you would like to work on it.
Ask a maintainer before changing payment, database, deployment, or security-sensitive behavior.
Keep pull requests focused, follow [CONTRIBUTING.md](CONTRIBUTING.md), and use the test steps in the issue.
Maintainer-only tracking below is private planning material; do not copy it into a public issue.

**Status legend:** `needs triage` = confirm scope and owner; `blocked` = waiting on a decision or dependency; `in progress` = work has started; `needs review` = a pull request is ready for review.

## 2. Label taxonomy

Use one difficulty label, one area label, and one type label on each public issue. Status labels are added as work changes state.

| Name | Color | Description | When to use |
| :--- | :--- | :--- | :--- |
| `good first issue` | `#7057ff` | A small, guided task for a new contributor. | Self-contained work that does not change sensitive systems. |
| `help wanted` | `#008672` | A task where additional contributors are welcome. | Medium-sized work that benefits from community help. |
| `advanced` | `#b60205` | Work needing substantial experience or maintainer oversight. | Multi-step or high-impact changes; not for first-time contributors. |
| `area:frontend` | `#1d76db` | Browser pages, components, styles, or client-side behavior. | Work mainly under `frontend/`. |
| `area:backend` | `#5319e7` | Express routes, controllers, or services. | Work mainly under `backend/`. |
| `area:database` | `#d93f0b` | SQL schema, migrations, or database access. | Work that changes or tests database structures or queries. |
| `area:ai` | `#b60205` | AI study tools and their integrations. | Work on AI-specific user experiences or services. |
| `area:payments` | `#0e8a16` | Payment and document-delivery flows. | Maintainer-approved work related to payments. |
| `area:content` | `#fbca04` | Study materials, catalogs, and curriculum content. | Work on learner-facing educational content or metadata. |
| `area:docs` | `#0075ca` | Project documentation and contributor guidance. | Work mainly on Markdown or written instructions. |
| `area:security` | `#e11d48` | Security and privacy controls. | Maintainer-only work unless a maintainer approves a safe public scope. |
| `area:accessibility` | `#5319e7` | Keyboard, screen-reader, and inclusive-use improvements. | Work that improves access for learners with different needs. |
| `area:performance` | `#0e8a16` | Loading speed, bandwidth, and runtime efficiency. | Work that measures or improves performance. |
| `area:testing` | `#c2e0c6` | Automated or manual test coverage. | Work whose main goal is to make behavior easier to verify. |
| `area:devops` | `#6f42c1` | Build, release, hosting, or operational setup. | Work on deployment and development infrastructure. |
| `bug` | `#d73a4a` | A confirmed behavior that needs correction. | Reproducible issues with current behavior. |
| `enhancement` | `#a2eeef` | A useful improvement or new capability. | Work that adds learner or maintainer value without fixing a defect. |
| `cleanup` | `#fef2c0` | A focused reduction in duplication or unused material. | Work that simplifies code or documentation without changing intended behavior. |
| `question` | `#d876e3` | A decision or investigation is needed first. | Work that should not start until a maintainer confirms the intended direction. |
| `needs triage` | `#ededed` | Scope or priority still needs confirmation. | Newly filed issues awaiting maintainer review. |
| `blocked` | `#b60205` | Progress depends on a decision or another issue. | Work that cannot safely continue yet. |
| `in progress` | `#fbca04` | Someone is actively working on the issue. | An issue with an agreed contributor or maintainer owner. |
| `needs review` | `#0e8a16` | A pull request is ready for review. | Work submitted as a pull request. |

## 3. Issue summary

**Effort:** `S` is under 2 hours; `M` is about half a day; `L` is multi-day work. **Priority:** `P0` needs urgent maintainer attention; `P1` should be handled early; `P2` is normal planned work; `P3` is a later improvement. “Maintainer-only” means the issue must not be published publicly.

| ID | Title | Area | Difficulty | Effort | Priority | Depends on | Visibility |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| GFI-01 | Improve alt text on legacy study images | accessibility | good first issue | S | P2 | none | public |
| GFI-02 | Lazy-load below-the-fold legacy images | performance | good first issue | S | P2 | none | public |
| GFI-03 | Give duplicate biology pages unique metadata | frontend | good first issue | S | P2 | none | public |
| GFI-04 | Avoid duplicate Open Graph metadata on legacy pages | frontend | good first issue | S | P2 | none | public |
| GFI-05 | Pin the Node version for local development | devops | good first issue | S | P2 | none | public |
| GFI-06 | Add tests for resource metadata helpers | testing | good first issue | S | P2 | none | public |
| GFI-07 | Document frontend build and preview commands | docs | good first issue | S | P2 | none | public |
| GFI-08 | Add a friendly custom not-found page | frontend | good first issue | M | P2 | none | public |
| GFI-09 | Add help for document reader controls | accessibility | good first issue | S | P3 | none | public |
| GFI-10 | Show file sizes in library listings | frontend | good first issue | S | P2 | none | public |
| GFI-11 | Describe informative Library Guide images | accessibility | good first issue | S | P2 | none | public |
| GFI-12 | Compress Library Guide images for low-bandwidth access | performance | good first issue | S | P2 | none | public |
| GFI-13 | Return JSON from the backend health endpoint | backend | good first issue | M | P2 | none | public |
| GFI-14 | Check sitemap entries against published routes | testing | good first issue | M | P2 | none | public |
| GFI-15 | Clarify the pull-request review target | docs | good first issue | S | P3 | none | public |
| HW-01 | Test catalog behavior when a source fails | testing | help wanted | M | P1 | none | public |
| HW-02 | Consolidate repeated legacy subject-page markup | frontend | help wanted | M | P2 | none | public |
| HW-03 | Add browser smoke tests for student flows | testing | help wanted | M | P2 | none | public |
| HW-04 | Extend offline support to library catalogs | frontend | help wanted | M | P2 | none | public |
| HW-05 | Profile catalog loading on slow connections | performance | help wanted | M | P2 | HW-01 | public |
| HW-06 | Standardize backend error responses | backend | help wanted | M | P2 | none | public |
| HW-07 | Improve abuse protection on public forms | frontend | help wanted | M | P1 | none | public |
| HW-08 | Audit backend dependencies before removing packages | backend | help wanted | M | P2 | none | public |
| HW-09 | Add backend route integration tests | testing | help wanted | M | P2 | none | public |
| HW-10 | Add timeouts and retry guidance to catalog loading | frontend | help wanted | M | P2 | HW-01 | public |
| ADV-01 | Consolidate database migrations into one source of truth | database | advanced | L | P1 | none | public |
| ADV-02 | Review backend access and session controls | security | advanced | M | P1 | none | maintainer-only |
| ADV-03 | Review payment verification and delivery controls | payments | advanced | L | P1 | none | maintainer-only |
| ADV-04 | Review learner-data handling and retention | security | advanced | M | P1 | none | maintainer-only |
| ADV-05 | Remove confirmed unmounted backend route modules | backend | advanced | M | P2 | none | public |
| ADV-06 | Review client-service integration | ai | advanced | M | P1 | none | maintainer-only |
| ADV-07 | Establish an application staging environment | devops | advanced | L | P2 | none | public |
| ADV-08 | Review abuse controls and rate limits on public endpoints | security | advanced | L | P1 | none | maintainer-only |

## 4. Three-phase roadmap

### Phase 1: Contributor-readiness and safety

**Goal:** Make setup expectations clear and keep sensitive operational work private until a maintainer has reviewed it.

**Issue IDs:** GFI-05, GFI-07, GFI-15, HW-07, ADV-02, ADV-06, ADV-07, ADV-08.

**Done when:** Contributors can identify the supported Node version and local build steps, public-form work has a safe scope, and maintainers have reviewed the private security and staging items.

### Phase 2: Cleanup and testing

**Goal:** Improve documentation and accessibility, remove confirmed duplication, and make current behavior easier to test.

**Issue IDs:** GFI-01, GFI-02, GFI-03, GFI-04, GFI-06, GFI-11, GFI-12, GFI-13, GFI-14, HW-01, HW-02, HW-06, HW-08, HW-09, HW-10, ADV-01, ADV-05.

**Done when:** The listed tests pass, legacy pages have consistent metadata and accessible images, duplicate routes or migrations have a maintainer-approved disposition, and the sitemap check matches the intended public routes.

### Phase 3: New features

**Goal:** Improve everyday study access, especially for learners using small screens or unreliable connections.

**Issue IDs:** GFI-08, GFI-09, GFI-10, HW-03, HW-04, HW-05, ADV-03, ADV-04.

**Done when:** The new student-facing features work on narrow screens, offline behavior is tested, performance changes are measured, and maintainers have agreed on payment and retention decisions.

## 5. Full issue write-ups

## Good First Issues

### [GFI-01] Improve alt text on legacy study images
- **Labels:** `good first issue`, `area:accessibility`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic HTML, screen-reader awareness
- **Background:** Several older study pages use vague image descriptions such as “image in a hexagon” or “grind.” Better text helps learners who use screen readers understand images that add information; decorative images should stay silent.
- **Where to look:** `frontend/src/pages/frontend/src/html/bio-notes-html/bio-updates.html.astro`, `frontend/src/pages/frontend/src/html/bio-notes-html/cell-division.html.astro`, `frontend/src/pages/frontend/src/html/bio-notes-html/story-of-genetics.html.astro`, `frontend/src/pages/frontend/src/html/chem-notes-html/chem-updates.html.astro`, `frontend/src/pages/frontend/src/html/math-notes-html/math-updates.html.astro`.
- **What to do:**
  1. Review each image in context and decide whether it is informative or decorative.
  2. Give informative images a short, accurate description; use `alt=""` only for decorative images.
  3. Do not repeat nearby headings or add descriptions that guess at image content.
- **Acceptance criteria:**
  - [ ] Informative images have useful, accurate alt text.
  - [ ] Decorative images use empty alt text.
  - [ ] Existing image sources and page behavior are unchanged.
- **How to test:** Follow the frontend setup in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open the listed pages and review the images with a screen reader or browser accessibility tree.
- **Out of scope:** Rewriting the study notes, changing image files, or editing application behavior.
- **Hints / resources:** [W3C: Images Tutorial](https://www.w3.org/WAI/tutorials/images/); [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 40 lines changed.
- **Mentor:** @trustjonathan

### [GFI-02] Lazy-load below-the-fold legacy images
- **Labels:** `good first issue`, `area:performance`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic HTML, browser developer tools
- **Background:** The legacy subject pages include several content images without a loading hint. Deferring images below the first screen can reduce the amount of data learners download before they reach the material they need.
- **Where to look:** The five legacy pages listed in GFI-01 contain multiple `<img>` elements; the reader and shared layouts are in `frontend/src/layouts/LegacyPageLayout.astro`.
- **What to do:**
  1. Identify images that begin below the first visible screen.
  2. Add native lazy loading to those images, keeping any first-screen hero image eager.
  3. Keep meaningful `alt` text and image dimensions intact.
- **Acceptance criteria:**
  - [ ] Below-the-fold images load as the learner scrolls.
  - [ ] The first visible image is not delayed unnecessarily.
  - [ ] All five pages still render without broken images at 320px, 375px, and 412px.
- **How to test:** Follow the frontend setup in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; use browser developer tools to inspect image loading while scrolling each page.
- **Out of scope:** Replacing the image formats, changing page layout, or modifying the service worker.
- **Hints / resources:** [MDN: `<img>` loading](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#loading); [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 40 lines changed.
- **Mentor:** @trustjonathan

### [GFI-03] Give duplicate biology pages unique metadata
- **Labels:** `good first issue`, `area:frontend`, `bug`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic HTML and Astro
- **Background:** The biology pages `bio-updates.html` and `cell-division.html` currently use the same page title and description even though they are separate routes. Distinct titles help learners recognize the page they opened and help search results describe it accurately.
- **Where to look:** `frontend/src/pages/frontend/src/html/bio-notes-html/bio-updates.html.astro`, `frontend/src/pages/frontend/src/html/bio-notes-html/cell-division.html.astro`, and `frontend/src/layouts/LegacyPageLayout.astro`.
- **What to do:**
  1. Check the visible heading and material on each page.
  2. Write a concise, accurate title and description for each route.
  3. Keep the existing shared layout and route behavior.
- **Acceptance criteria:**
  - [ ] Each route has a different title that matches its visible content.
  - [ ] Each route has a useful, non-duplicated description.
  - [ ] The descriptions do not promise material that is not on the page.
- **How to test:** Follow the frontend setup in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open both routes and check the browser tab title and page source.
- **Out of scope:** Rewriting page content, changing canonical URL behavior, or editing other subjects' metadata.
- **Hints / resources:** [Astro: HTML pages](https://docs.astro.build/en/basics/astro-pages/); [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 30 lines changed.
- **Mentor:** @trustjonathan

### [GFI-04] Avoid duplicate Open Graph metadata on legacy pages
- **Labels:** `good first issue`, `area:frontend`, `cleanup`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic HTML and Astro
- **Background:** `LegacyPageLayout.astro` creates Open Graph title, description, and URL tags, while legacy pages can add another set through the `head` slot. Duplicate tags can make link previews inconsistent for learners sharing a study page.
- **Where to look:** `frontend/src/layouts/LegacyPageLayout.astro` and `frontend/src/pages/frontend/src/html/bio-notes-html/bio-updates.html.astro`.
- **What to do:**
  1. Compare the shared metadata with the tags added in the page head slot.
  2. Keep one correct source for each Open Graph field.
  3. Preserve page-specific metadata where it is genuinely needed.
- **Acceptance criteria:**
  - [ ] The rendered page has one Open Graph title, description, and URL.
  - [ ] The rendered values match the page and its canonical URL.
  - [ ] The normal browser title and description remain present.
- **How to test:** Follow the frontend setup in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; inspect the rendered `<head>` on a legacy notes page.
- **Out of scope:** Changing the site-wide metadata design or adding a new social image.
- **Hints / resources:** [Open Graph protocol](https://ogp.me/); `frontend/src/layouts/LegacyPageLayout.astro`.
- **Estimated PR size:** Under 40 lines changed.
- **Mentor:** @trustjonathan

### [GFI-05] Pin the Node version for local development
- **Labels:** `good first issue`, `area:devops`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 1
- **Depends on:** none
- **Skills needed:** Basic command line and JSON
- **Background:** Both package manifests require Node.js 22.12 or newer, and the local setup guide explains that requirement. A version pin at the repository root would also help version managers select a compatible runtime automatically.
- **Where to look:** `frontend/package.json`, `backend/package.json`, and `docs/LOCAL_DEVELOPMENT.md`.
- **What to do:**
  1. Confirm the Node version required by both package manifests.
  2. Add a repository-root Node version pin that matches that minimum.
  3. Mention the version pin in the local setup guide without removing the existing explanation.
- **Acceptance criteria:**
  - [ ] The pinned version satisfies both package engine requirements.
  - [ ] The setup guide explains how to use the pin or select the same version manually.
  - [ ] No package engine requirement is lowered.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): check `node --version` and `npm --version`, then run `npm ci` in `frontend` and `backend`.
- **Out of scope:** Changing Node engine requirements, lockfiles, or CI workflows.
- **Hints / resources:** [Node.js releases](https://nodejs.org/en/about/previous-releases); [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 20 lines changed.
- **Mentor:** @trustjonathan

### [GFI-06] Add tests for resource metadata helpers
- **Labels:** `good first issue`, `area:testing`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** JavaScript basics and Node's test runner
- **Background:** `resourceMeta.js` exports small helpers for file names, levels, years, and display sizes. Focused tests will help contributors change catalog behavior without needing a live database or external service.
- **Where to look:** `backend/scripts/lib/resourceMeta.js`, `backend/test/`, and `backend/package.json`.
- **What to do:**
  1. Add a test file under the existing `backend/test/` directory.
  2. Cover representative inputs and edge cases for the exported pure helpers.
  3. Use Node's built-in test runner and avoid live network or database access.
- **Acceptance criteria:**
  - [ ] Tests cover at least filename sanitizing, year detection, and byte formatting.
  - [ ] Edge cases include empty or unsupported values where the helper defines behavior.
  - [ ] The existing backend test command passes.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`.
- **Out of scope:** Changing catalog classification behavior or running resource uploads.
- **Hints / resources:** [Node.js test runner](https://nodejs.org/api/test.html); `backend/scripts/lib/resourceMeta.js`.
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-07] Document frontend build and preview commands
- **Labels:** `good first issue`, `area:docs`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 1
- **Depends on:** none
- **Skills needed:** Markdown and basic command line
- **Background:** The frontend package has build and preview scripts, but the local development guide focuses on starting the development server and backend tests. Adding the missing commands gives contributors one reliable place to learn how to check a production build.
- **Where to look:** `docs/LOCAL_DEVELOPMENT.md`, `frontend/package.json`, and `CONTRIBUTING.md`.
- **What to do:**
  1. Add the frontend production-build command to the guide.
  2. Explain how to preview the built site locally.
  3. Keep the command names consistent with `frontend/package.json`.
- **Acceptance criteria:**
  - [ ] The guide shows install, build, and preview commands in the correct directory.
  - [ ] The instructions make clear that the preview follows a successful build.
  - [ ] No secret or production-only environment values are required.
- **How to test:** From `frontend/`, run `npm ci`, `npm run build`, and `npm run preview`; open the preview URL printed in the terminal and confirm the build output is served.
- **Out of scope:** Changing package scripts, CI, or deployment behavior.
- **Hints / resources:** `frontend/package.json`; [Astro: CLI commands](https://docs.astro.build/en/reference/cli-reference/); [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 40 lines changed.
- **Mentor:** @trustjonathan

### [GFI-08] Add a friendly custom not-found page
- **Labels:** `good first issue`, `area:frontend`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 3
- **Depends on:** none
- **Skills needed:** Astro, HTML, and CSS basics
- **Background:** The frontend has many student-facing routes but no custom Astro not-found page. A helpful page can guide a learner back to subjects or the library instead of leaving them confused after opening an outdated link.
- **Where to look:** `frontend/src/pages/`, `frontend/src/pages/index.astro`, `frontend/src/pages/subjects.astro`, and `frontend/src/layouts/SiteLayout.astro`.
- **What to do:**
  1. Add a not-found page under the existing Astro pages directory.
  2. Include a short explanation and working links to the home page and subject directory.
  3. Use the shared site layout and existing design styles.
- **Acceptance criteria:**
  - [ ] An unknown route displays the custom page in the built site.
  - [ ] The page has a clear heading and working recovery links.
  - [ ] The layout works at 320px, 375px, and 412px.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open a clearly nonexistent route and check the listed screen widths.
- **Out of scope:** Changing route redirects, sitemap policy, or deployment configuration.
- **Hints / resources:** [Astro: Custom 404 pages](https://docs.astro.build/en/basics/astro-pages/#custom-404-error-page); `frontend/src/layouts/SiteLayout.astro`.
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-09] Add help for document reader controls
- **Labels:** `good first issue`, `area:accessibility`, `enhancement`
- **Priority / Effort / Phase:** P3 / S / Phase 3
- **Depends on:** none
- **Skills needed:** HTML and accessibility basics
- **Background:** The standalone reader toolbar has several buttons and selectors, but no single, simple help entry that explains them. A short guide can make the reader easier to use for students opening a document for the first time.
- **Where to look:** `frontend/public/full_page_flipbook_viewer/index.html` and `frontend/public/full_page_flipbook_viewer/css/reader-controls.css`.
- **What to do:**
  1. Add a clearly named help control to the reader toolbar.
  2. Explain the visible controls without documenting shortcuts unless they are confirmed in the current reader code.
  3. Make the help content usable with a keyboard and screen reader.
- **Acceptance criteria:**
  - [ ] The help control has an accessible name and opens/closes help.
  - [ ] Help text matches the controls that actually appear.
  - [ ] The dialog or panel is usable at 320px, 375px, and 412px.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open the reader page and test the help control with a mouse, keyboard, and screen reader.
- **Out of scope:** Adding or changing reader keyboard shortcuts, document navigation, or AI behavior.
- **Hints / resources:** [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/); `frontend/public/full_page_flipbook_viewer/index.html`.
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-10] Show file sizes in library listings
- **Labels:** `good first issue`, `area:frontend`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 3
- **Depends on:** none
- **Skills needed:** TypeScript and React basics
- **Background:** Catalog items can include `sizeBytes`, but the library's `Resource` view model does not currently carry that value to the listing. Showing a file size helps learners decide whether a download is practical on a limited data bundle.
- **Where to look:** `frontend/src/components/LibraryWorkspace.tsx`, especially `StaticManifestItem`, `loadStaticManifest`, and the resource row rendering.
- **What to do:**
  1. Preserve a valid file size when mapping catalog records into library resources.
  2. Format bytes as a short human-readable value.
  3. Show the value only when a reliable size is available.
- **Acceptance criteria:**
  - [ ] A resource with a known size shows a readable size label.
  - [ ] Missing or invalid sizes do not display a misleading value.
  - [ ] The label remains readable at 320px, 375px, and 412px.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; inspect resources with and without size metadata.
- **Out of scope:** Changing catalog APIs, resource downloads, or payment behavior.
- **Hints / resources:** `frontend/src/components/LibraryWorkspace.tsx`; [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat).
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-11] Describe informative Library Guide images
- **Labels:** `good first issue`, `area:accessibility`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic HTML and screen-reader awareness
- **Background:** The Library Guide includes screenshots and subject images with empty alt text. Some may be decorative, while others explain a screen or learning resource; checking each in context will help screen-reader users get the same useful information.
- **Where to look:** `frontend/src/pages/library-guide.html.astro`.
- **What to do:**
  1. Review each image alongside its nearby caption and heading.
  2. Add concise alt text when the image communicates information not already present in text.
  3. Keep empty alt text for images that are purely decorative or fully redundant.
- **Acceptance criteria:**
  - [ ] Informative screenshots have concise descriptions.
  - [ ] Decorative or redundant images remain silent to screen readers.
  - [ ] No image is described based on a guess about its contents.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open the Library Guide and inspect image names in the browser accessibility tree.
- **Out of scope:** Replacing images or changing the guide's text and layout.
- **Hints / resources:** [W3C: Images Tutorial](https://www.w3.org/WAI/tutorials/images/); `frontend/src/pages/library-guide.html.astro`.
- **Estimated PR size:** Under 40 lines changed.
- **Mentor:** @trustjonathan

### [GFI-12] Compress Library Guide images for low-bandwidth access
- **Labels:** `good first issue`, `area:performance`, `enhancement`
- **Priority / Effort / Phase:** P2 / S / Phase 2
- **Depends on:** none
- **Skills needed:** Basic image editing and file-size checks
- **Background:** The Library Guide uses several PNG screenshots around a few hundred kilobytes each. Smaller assets can help students on metered mobile data, provided labels and small text in the screenshots remain readable.
- **Where to look:** `frontend/public/assets/library-guide/` and `frontend/src/pages/library-guide.html.astro`.
- **What to do:**
  1. Record the current byte size of the guide screenshots.
  2. Optimize or convert the large screenshots while preserving legible text and visual quality.
  3. Update the guide references if an image format or filename changes.
- **Acceptance criteria:**
  - [ ] The changed image files are smaller than their originals.
  - [ ] Text and interface details remain legible at normal and mobile sizes.
  - [ ] Every updated image still loads on the Library Guide.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; compare original and optimized images and check the guide at 320px, 375px, and 412px.
- **Out of scope:** Replacing study material PDFs or changing images outside the Library Guide.
- **Hints / resources:** [web.dev: Optimize images](https://web.dev/learn/performance/image-performance); `frontend/src/pages/library-guide.html.astro`.
- **Estimated PR size:** Under 100 lines changed, plus optimized image assets.
- **Mentor:** @trustjonathan

### [GFI-13] Return JSON from the backend health endpoint
- **Labels:** `good first issue`, `area:backend`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** JavaScript and HTTP basics
- **Background:** `GET /health` currently responds with plain text, while the root route already returns JSON. A small structured response is easier for a health check to read and gives maintainers a consistent way to confirm that the service is running.
- **Where to look:** `backend/server.js` and `backend/test/`.
- **What to do:**
  1. Change the health route to return a stable JSON object with a status and timestamp.
  2. Add a focused test for the response status and JSON shape.
  3. Keep the endpoint independent of credentials and external services.
- **Acceptance criteria:**
  - [ ] A healthy server returns HTTP 200 and valid JSON.
  - [ ] The JSON includes a stable status field and a parseable timestamp.
  - [ ] The test does not require production credentials or a live database.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`; use `npm start` and open `http://localhost:4000/health` for the manual check.
- **Out of scope:** Adding detailed infrastructure diagnostics or exposing environment settings.
- **Hints / resources:** [Node.js test runner](https://nodejs.org/api/test.html); `backend/server.js`; [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-14] Check sitemap entries against published routes
- **Labels:** `good first issue`, `area:testing`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** XML and JavaScript basics
- **Background:** The repository keeps a hand-written sitemap, while Astro pages define the routes that are built. A lightweight check can catch missing or stale links without assuming that every route should be indexed.
- **Where to look:** `frontend/public/sitemap.xml`, `frontend/public/robots.txt`, and `frontend/src/pages/`.
- **What to do:**
  1. Compare sitemap locations with the routes that are intended to be public and searchable.
  2. Ask a maintainer before adding account, admin, or utility pages to the sitemap.
  3. Add a small check or documented review step for future route changes.
- **Acceptance criteria:**
  - [ ] Every sitemap URL corresponds to an intended published page.
  - [ ] Private, account, admin, and utility routes are not added by default.
  - [ ] The sitemap remains valid XML and uses the deployed site base path.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; open the sitemap route and compare its entries with the public routes.
- **Out of scope:** Changing indexing policy for private routes or editing deployment configuration.
- **Hints / resources:** [Sitemaps protocol](https://www.sitemaps.org/protocol.html); `frontend/public/robots.txt`.
- **Estimated PR size:** Under 100 lines changed.
- **Mentor:** @trustjonathan

### [GFI-15] Clarify the pull-request review target
- **Labels:** `good first issue`, `area:docs`, `cleanup`
- **Priority / Effort / Phase:** P3 / S / Phase 1
- **Depends on:** none
- **Skills needed:** Markdown and careful editing
- **Background:** The contribution guide gives a 48–72 hour review expectation. A clear best-effort target can help contributors plan while avoiding a promise the maintainers may not be able to meet during busy periods.
- **Where to look:** `CONTRIBUTING.md`, especially the pull-request submission section.
- **What to do:**
  1. Ask the maintainer to choose a review target they can sustain.
  2. Present it as a best-effort estimate and explain that urgent deadlines cannot be guaranteed.
  3. Keep the tone welcoming and avoid changing the technical contribution steps.
- **Acceptance criteria:**
  - [ ] The review window is approved by the maintainer before it is changed.
  - [ ] The wording distinguishes a target from a guarantee.
  - [ ] No other response or security policy is changed.
- **How to test:** Review the edited Markdown in [CONTRIBUTING.md](CONTRIBUTING.md) and confirm all existing relative links still point to repository files.
- **Out of scope:** Changing security acknowledgments, content takedown targets, or code review requirements.
- **Hints / resources:** [CONTRIBUTING.md](CONTRIBUTING.md); [docs/COLLABORATION_POLICY.md](docs/COLLABORATION_POLICY.md).
- **Estimated PR size:** Under 20 lines changed.
- **Mentor:** @trustjonathan

## Help Wanted

### [HW-01] Test catalog behavior when a source fails
- **Labels:** `help wanted`, `area:testing`, `enhancement`
- **Priority / Effort / Phase:** P1 / M / Phase 2
- **Depends on:** none
- **Skills needed:** TypeScript, async testing, browser network basics
- **Background:** The library loads several catalog sources and uses `Promise.allSettled` so one source can fail while others still provide resources. Tests can protect this useful behavior and make future catalog changes safer for students on unstable connections.
- **Where to look:** `frontend/src/components/LibraryWorkspace.tsx`, especially `fetchCachedCatalog`, `loadStaticManifest`, and the catalog-loading effect; `frontend/src/config/catalogSources.ts`.
- **What to do:**
  1. Add a focused frontend test setup and expose it as `npm test` in `frontend/package.json`.
  2. Simulate one failed catalog while the checked-in manifest succeeds.
  3. Cover the case where a cached response is used after a network failure.
  4. Document the frontend test command in `docs/LOCAL_DEVELOPMENT.md`.
- **Acceptance criteria:**
  - [ ] A failed optional source does not hide resources returned by another source.
  - [ ] A saved catalog response remains usable when its refresh fails.
  - [ ] Tests use local fixtures and do not call production services.
  - [ ] The local setup guide includes the frontend test command.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm test`; run `npm run dev` for the manual check with one catalog source unavailable.
- **Out of scope:** Changing which catalog sources are enabled or altering production credentials.
- **Hints / resources:** `frontend/src/config/catalogSources.ts`; [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 200 lines changed.
- **Mentor:** @trustjonathan

### [HW-02] Consolidate repeated legacy subject-page markup
- **Labels:** `help wanted`, `area:frontend`, `cleanup`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** Astro, HTML, and CSS
- **Background:** Several older subject-note pages repeat page structure and metadata around the shared `LegacyPageLayout`. Reducing only the truly repeated markup can make future content fixes easier without taking away each page's unique notes.
- **Where to look:** `frontend/src/layouts/LegacyPageLayout.astro` and the existing pages under `frontend/src/pages/frontend/src/html/`.
- **What to do:**
  1. Compare the legacy pages and list the markup that is genuinely shared.
  2. Ask a maintainer to agree on the extraction boundary before changing routes.
  3. Reuse shared pieces while keeping page-specific text, figures, and route URLs intact.
- **Acceptance criteria:**
  - [ ] Shared markup has one clear source.
  - [ ] Existing subject-note URLs still build and display the same content.
  - [ ] No lesson material or attribution is lost.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; compare the affected pages at 320px, 375px, and 412px.
- **Out of scope:** Rewriting the curriculum, removing legacy routes, or changing the design system.
- **Hints / resources:** `frontend/src/layouts/LegacyPageLayout.astro`; [Astro components](https://docs.astro.build/en/basics/astro-components/).
- **Estimated PR size:** Under 250 lines changed.
- **Mentor:** @trustjonathan

### [HW-03] Add browser smoke tests for student flows
- **Labels:** `help wanted`, `area:testing`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 3
- **Depends on:** none
- **Skills needed:** JavaScript, browser automation, basic GitHub Actions
- **Background:** CI currently builds the frontend and runs backend tests, but there is no browser smoke suite for the student-facing pages. A few stable checks can catch broken navigation before a change reaches learners.
- **Where to look:** `.github/workflows/ci.yml`, `frontend/package.json`, `frontend/src/pages/index.astro`, `frontend/src/pages/library.astro`, and `frontend/public/full_page_flipbook_viewer/index.html`.
- **What to do:**
  1. Propose a small browser test tool and keep its download size and setup simple.
  2. Cover the home page, library navigation, and opening the reader shell.
  3. Add an `npm run test:e2e` command and document it in `docs/LOCAL_DEVELOPMENT.md`.
  4. Add the tests to CI only after they run reliably from a clean install.
- **Acceptance criteria:**
  - [ ] Tests run without production credentials or real user accounts.
  - [ ] The chosen flows pass in CI and locally.
  - [ ] Tests include a narrow viewport check between 320px and 412px.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend` and `npm ci`; start `npm run dev` in one terminal and run `npm run test:e2e` in another; confirm the home, library, and reader checks pass.
- **Out of scope:** Testing payment flows, real authentication, or production services.
- **Hints / resources:** `.github/workflows/ci.yml`; [Playwright getting started](https://playwright.dev/docs/intro).
- **Estimated PR size:** Under 250 lines changed.
- **Mentor:** @trustjonathan

### [HW-04] Extend offline support to library catalogs
- **Labels:** `help wanted`, `area:frontend`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 3
- **Depends on:** none
- **Skills needed:** JavaScript, service workers, browser storage basics
- **Background:** The service worker currently caches the Study and Assistant app shells and selected static assets. Extending carefully to small catalog metadata could help learners reopen a previously viewed library when their connection drops.
- **Where to look:** `frontend/public/study-sw.js`, `frontend/src/pages/study.astro`, `frontend/src/pages/assistant.astro`, and `frontend/src/components/LibraryWorkspace.tsx`.
- **What to do:**
  1. Agree with a maintainer which small catalog responses are safe and useful to cache.
  2. Add a bounded cache policy and a clear way to refresh stale data.
  3. Do not cache large documents or account-specific responses as part of this issue.
- **Acceptance criteria:**
  - [ ] A previously loaded catalog can be viewed offline with a clear freshness cue.
  - [ ] Cache size and expiry behavior are documented and bounded.
  - [ ] Account, API, and payment responses are not added to the cache.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; use browser developer tools to load a catalog, switch offline, and reopen it.
- **Out of scope:** Offline PDF storage, authentication caching, and changes to payment or account behavior.
- **Hints / resources:** `frontend/public/study-sw.js`; [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
- **Estimated PR size:** Under 250 lines changed.
- **Mentor:** @trustjonathan

### [HW-05] Profile catalog loading on slow connections
- **Labels:** `help wanted`, `area:performance`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 3
- **Depends on:** HW-01
- **Skills needed:** Browser developer tools, TypeScript, performance measurement
- **Background:** `LibraryWorkspace` starts multiple catalog loads in parallel, and the live source can request additional pages. Measuring this on a slow connection will show whether students wait on unnecessary downloads or requests.
- **Where to look:** `frontend/src/components/LibraryWorkspace.tsx` and `frontend/src/config/catalogSources.ts`.
- **What to do:**
  1. Record request count, transferred bytes, and time until first useful results with browser network throttling.
  2. Identify one measured bottleneck before proposing a change.
  3. Make a small optimization and compare the same measurements afterward.
- **Acceptance criteria:**
  - [ ] Before-and-after measurements use the same test data and network profile.
  - [ ] Search and filtering results remain correct.
  - [ ] A failed source does not prevent other catalogs from appearing.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; use browser developer tools with a throttled mobile connection.
- **Out of scope:** Changing database indexes, replacing catalog providers, or increasing the amount of data sent to browsers.
- **Hints / resources:** `frontend/src/components/LibraryWorkspace.tsx`; [web.dev: Measure performance](https://web.dev/learn/performance/).
- **Estimated PR size:** Under 200 lines changed.
- **Mentor:** @trustjonathan

### [HW-06] Standardize backend error responses
- **Labels:** `help wanted`, `area:backend`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** Express, JavaScript, API design
- **Background:** The Express error middleware and controllers do not all return errors in the same shape. A consistent, safe response makes it easier for the frontend to show helpful messages without exposing internal implementation details.
- **Where to look:** `backend/server.js`, `backend/api/controllers/resourceUploadController.js`, `backend/api/controllers/socialController.js`, and `backend/test/`.
- **What to do:**
  1. Agree on a small response shape for client-visible errors.
  2. Keep detailed diagnostic information in server logs, not in public responses.
  3. Update affected controller tests and document the expected shape.
- **Acceptance criteria:**
  - [ ] Expected client errors keep their appropriate HTTP status.
  - [ ] Unexpected errors use a consistent, non-sensitive response.
  - [ ] Tests cover both a validation error and an unexpected server error.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`.
- **Out of scope:** Changing authorization rules, route availability, or database behavior.
- **Hints / resources:** `backend/server.js`; [Express error handling](https://expressjs.com/en/guide/error-handling.html).
- **Estimated PR size:** Under 250 lines changed.
- **Mentor:** @trustjonathan

### [HW-07] Improve abuse protection on public forms
- **Labels:** `help wanted`, `area:frontend`, `enhancement`
- **Priority / Effort / Phase:** P1 / M / Phase 1
- **Depends on:** none
- **Skills needed:** React, accessible forms, product design
- **Background:** Study Hub has public suggestion and resource-contribution forms that should remain welcoming to real learners while discouraging automated misuse. The public scope is to design gentle safeguards and clear feedback without publishing operational security details.
- **Where to look:** `frontend/src/components/SuggestionBoard.tsx`, `frontend/src/components/ResourceUploadPanel.tsx`, and `docs/CONTENT_GUIDELINES.md`.
- **What to do:**
  1. Discuss the user experience and privacy impact with a maintainer before choosing a safeguard.
  2. Keep the form usable on low-cost phones and slower connections.
  3. Provide a clear, accessible message when a submission cannot continue.
- **Acceptance criteria:**
  - [ ] Maintainer approves the safeguard before implementation.
  - [ ] The normal form flow remains usable at 320px, 375px, and 412px.
  - [ ] Error and retry messages are understandable and do not expose internal controls.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; manually test valid, incomplete, and temporarily unavailable form states at 320px, 375px, and 412px.
- **Out of scope:** Publishing bypass details, changing database access policies, or modifying payment and account forms.
- **Hints / resources:** `docs/CONTENT_GUIDELINES.md`; [WAI form notifications](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19).
- **Estimated PR size:** Under 200 lines changed.
- **Mentor:** @trustjonathan

### [HW-08] Audit backend dependencies before removing packages
- **Labels:** `help wanted`, `area:backend`, `cleanup`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** Node.js, npm, code search
- **Background:** `backend/package.json` includes packages used by both current and older-looking code. For example, the repository contains Mongo and PostgreSQL model files, so package names alone are not enough to decide what is safe to remove.
- **Where to look:** `backend/package.json`, `backend/package-lock.json`, `backend/database/`, and `backend/`.
- **What to do:**
  1. Search for direct and dynamic uses of each proposed dependency.
  2. Record whether each package is used by a mounted feature, a script, or only legacy code.
  3. Ask a maintainer before removing any package with an unclear runtime role.
- **Acceptance criteria:**
  - [ ] The pull request lists evidence for each dependency changed.
  - [ ] No package still imported by active code is removed.
  - [ ] A clean `npm ci` and the backend test suite pass after any approved removal.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`.
- **Out of scope:** Removing database models, changing database architecture, or upgrading unrelated packages.
- **Hints / resources:** `backend/package.json`; [npm: package.json](https://docs.npmjs.com/cli/v10/configuring-npm/package-json).
- **Estimated PR size:** Under 100 lines changed, including the lockfile.
- **Mentor:** @trustjonathan

### [HW-09] Add backend route integration tests
- **Labels:** `help wanted`, `area:testing`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** Express, Node.js test runner, HTTP basics
- **Background:** The backend has controller tests, but the server setup and mounted-route wiring are not covered by a focused integration test. A small route-level check can catch problems that isolated controller tests miss.
- **Where to look:** `backend/server.js`, `backend/api/routes/`, and `backend/test/`.
- **What to do:**
  1. Choose a safe way to start the Express app in a test without binding a fixed production port.
  2. Exercise a health request and one non-sensitive route response.
  3. Keep tests independent of real credentials and external services.
- **Acceptance criteria:**
  - [ ] Tests verify the app responds through its HTTP route layer.
  - [ ] Tests do not start a long-lived server after the test runner exits.
  - [ ] Existing controller tests continue to pass.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`.
- **Out of scope:** Testing production deployments, payments, or real user accounts.
- **Hints / resources:** `backend/server.js`; [Node.js test runner](https://nodejs.org/api/test.html).
- **Estimated PR size:** Under 200 lines changed.
- **Mentor:** @trustjonathan

### [HW-10] Add timeouts and retry guidance to catalog loading
- **Labels:** `help wanted`, `area:frontend`, `enhancement`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** HW-01
- **Skills needed:** TypeScript, fetch API, asynchronous error handling
- **Background:** Catalog requests use `fetchCachedCatalog`, but the request has no explicit time limit. A slow external source can leave a learner waiting; bounded requests and clear retry guidance can keep other available sources useful.
- **Where to look:** `frontend/src/components/LibraryWorkspace.tsx`, especially `fetchCachedCatalog` and the catalog-loading effect.
- **What to do:**
  1. Agree on a reasonable request timeout and retry count with a maintainer.
  2. Preserve cached results and results from other sources when one request times out.
  3. Show a short, actionable message rather than retrying indefinitely.
- **Acceptance criteria:**
  - [ ] A stalled catalog request eventually settles.
  - [ ] Retry behavior is bounded and does not create repeated background requests.
  - [ ] Available resources remain visible while an optional source is unavailable.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`; simulate a slow or unavailable catalog in browser developer tools.
- **Out of scope:** Changing catalog providers, API credentials, or database pagination.
- **Hints / resources:** `frontend/src/components/LibraryWorkspace.tsx`; [MDN: AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).
- **Estimated PR size:** Under 200 lines changed.
- **Mentor:** @trustjonathan

## Advanced / Maintainer-Only

### [ADV-01] Consolidate database migrations into one source of truth
- **Labels:** `advanced`, `area:database`, `cleanup`
- **Priority / Effort / Phase:** P1 / L / Phase 2
- **Depends on:** none
- **Skills needed:** SQL, PostgreSQL, migration history, Supabase CLI
- **Background:** The repository has migration files in both `supabase/migrations/` and `backend/database/migrations/`, including three pairs with identical contents under different filenames. One agreed source can reduce confusion for contributors and help fresh installations match the intended schema.
- **Where to look:** `supabase/migrations/`, `backend/database/migrations/`, and the local database instructions in `docs/LOCAL_DEVELOPMENT.md`.
- **What to do:**
  1. Ask the database maintainer to confirm `supabase/migrations/` as the authoritative migration directory.
  2. Compare all migration files and applied history before moving or removing anything; preserve the correct order and do not replay already-applied changes.
  3. Reconcile duplicate migration contents and update the local setup instructions to use the chosen source.
  4. Validate the plan on a fresh local database and a non-production Supabase project before proposing production changes.
- **Acceptance criteria:**
  - [ ] There is one documented authoritative migration directory.
  - [ ] Each schema change has one unambiguous migration entry.
  - [ ] A fresh local database can be built in order using the updated guide.
  - [ ] No production database is changed by the pull request.
- **How to test:** Follow the local PostgreSQL setup in [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md), including `cd backend`, `npm ci`, and `npm test`; apply migration checks only to a disposable local database.
- **Out of scope:** Rewriting unrelated table definitions, changing access policies, or applying migrations to production.
- **Hints / resources:** [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md); `supabase/migrations/`; `backend/database/migrations/`.
- **Estimated PR size:** Multi-file change; split into smaller reviewed pull requests if needed.
- **Mentor:** @trustjonathan

### [ADV-05] Remove confirmed unmounted backend route modules
- **Labels:** `advanced`, `area:backend`, `cleanup`
- **Priority / Effort / Phase:** P2 / M / Phase 2
- **Depends on:** none
- **Skills needed:** Express, JavaScript, code search
- **Background:** Three older route modules are present under `backend/api/routes/`, but `backend/server.js` mounts a different set of routes. Confirming that these modules have no intended callers before removing them can make the backend easier for new contributors to understand.
- **Where to look:** `backend/api/routes/marketplaceRoutes.js`, `backend/api/routes/socialRoutes.js`, `backend/api/routes/knowledgeRoutes.js`, and `backend/server.js`.
- **What to do:**
  1. Search the repository for imports and documented use of each route module.
  2. Ask the backend maintainer to confirm the routes are no longer planned.
  3. Remove only confirmed-unused modules and any imports that become unnecessary.
- **Acceptance criteria:**
  - [ ] Each removed module has no remaining imports or documented active use.
  - [ ] Existing backend tests pass.
  - [ ] No mounted route or learner-facing behavior changes.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd backend`, `npm ci`, and `npm test`.
- **Out of scope:** Removing database tables, changing public APIs, or deleting other route modules.
- **Hints / resources:** `backend/server.js`; `backend/api/routes/`; [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
- **Estimated PR size:** Under 150 lines changed.
- **Mentor:** @trustjonathan

### [ADV-07] Establish an application staging environment
- **Labels:** `advanced`, `area:devops`, `enhancement`
- **Priority / Effort / Phase:** P2 / L / Phase 1
- **Depends on:** none
- **Skills needed:** GitHub Actions, hosting, environment separation
- **Background:** CI builds and tests the project, and the repository has a separate contribution-staging cleanup workflow. The repository does not establish whether an application preview environment already exists outside the codebase, so that must be checked before adding infrastructure.
- **Where to look:** `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/cleanup-contribution-staging.yml`, and `docs/COLLABORATION_POLICY.md`.
- **What to do:**
  1. TODO(owner): verify whether an application staging or preview deployment already exists outside this repository.
  2. Agree on a non-production host and separate test data before changing workflows.
  3. Document who can deploy, how to verify the preview, and how to avoid production credentials.
- **Acceptance criteria:**
  - [ ] A staging environment is separate from the production deployment and data.
  - [ ] No production credential or personal data is copied into staging.
  - [ ] Contributors can follow documented steps to verify a preview.
- **How to test:** Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md): run `cd frontend`, `npm ci`, and `npm run dev`, then run `cd ..\backend`, `npm ci`, and `npm test`; have a maintainer verify a preview using synthetic data.
- **Out of scope:** Changing production deployment settings or publishing environment values.
- **Hints / resources:** `.github/workflows/ci.yml`; [docs/COLLABORATION_POLICY.md](docs/COLLABORATION_POLICY.md).
- **Estimated PR size:** Multi-file; split setup, workflow, and documentation changes into reviewed steps.
- **Mentor:** @trustjonathan

## Maintainer-only tracking (do NOT publish as public issues)

| Internal title | Area | Priority | Note |
| :--- | :--- | :---: | :--- |
| Review backend access and session controls | security | P1 | Details are in `AUDIT_REPORT.md`. |
| Review payment verification and delivery controls | payments | P1 | Details are in `AUDIT_REPORT.md`. |
| Review learner-data handling and retention | security | P1 | Details are in `AUDIT_REPORT.md`. |
| Review client-service integration | ai | P1 | Details are in `AUDIT_REPORT.md`. |
| Review abuse controls and rate limits on public endpoints | security | P1 | Details are in `AUDIT_REPORT.md`. |

## 6. Parking lot

These are useful ideas, but they are not ready to schedule until a maintainer confirms demand and capacity:

- Explore teacher-submitted lesson plans and personalized revision features after the core library and testing work is stable.
- Consider offline document downloads only after the smaller catalog-cache work has clear storage and expiry limits.
- Review repository branch-protection settings with the owner; this is a repository setting, not a contributor code issue.
- **Previous backlog reconciliation:** The old catalog-fallback request is covered by HW-01 and HW-10. The current library already loads a checked-in manifest and cached responses, so the former behavior change was not verified as needed.
- **Previous backlog reconciliation:** The old mobile-overflow request is not repeated because source inspection alone cannot prove a viewport bug. `TODO(owner): verify` in a browser at 320px, 375px, and 412px before reopening it.
- **Previous backlog reconciliation:** The old footer-directory request is not repeated because the current footer already uses a short featured-subject list and collapsible sections.
- **Previous backlog reconciliation:** The old dependency-removal request is refined as HW-08; database-related packages need an import/use audit before removal.
- **Previous backlog reconciliation:** The old payment consent, instruction-copy, and transaction-reference ideas are not public tasks. Their wording and data handling need owner review under maintainer-only ADV-03 and ADV-04.
- **Previous backlog reconciliation:** The old reading-time request is replaced by GFI-10 because the current frontend resource view does not carry a page-count field; the catalog manifest can include file size.
- **Previous backlog reconciliation:** The old dark-mode request is not repeated because the reader already offers Original, Warm, Grayscale, and Night color choices. `TODO(owner): verify` whether the selected choice persists before reopening that request.
- **Previous backlog reconciliation:** The old health-check request is refined as GFI-13 to return a stable JSON response and test its shape.
- **Previous backlog reconciliation:** The broad SEO request is narrowed to the confirmed duplicate metadata in GFI-03 and GFI-04 rather than claiming all subject pages need new metadata.
- **Previous backlog reconciliation:** The old reader-shortcuts request is refined as GFI-09, which focuses on helping learners discover the controls already available.
- **Previous backlog reconciliation:** The former Node-version concern is narrowed to GFI-05, which adds a version pin; the package manifests and local setup guide already require Node 22.12 or newer.
- **Previous roadmap ideas:** AI quizzes and a teacher portal remain unscheduled until an owner confirms demand, support needs, and a safe scope.

## Where we need help

New to open source? Start with [open good first issues](https://github.com/trustjonathan/STUDY-HUB/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22).
Ready for a medium task? Browse [open help wanted issues](https://github.com/trustjonathan/STUDY-HUB/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22).
Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
Ask a maintainer if you are unsure whether an issue is a good fit.
Maintainer-only tracking is not available for public claiming.
