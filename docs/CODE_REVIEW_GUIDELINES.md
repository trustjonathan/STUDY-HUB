# Study Hub Code Review Guidelines 🔍

Code review is a collaborative teaching and learning opportunity. Our contributors include students, teachers, and junior developers across East Africa. Reviews should build confidence, protect security, and ensure software quality.

---

## 🌟 The Reviewer Mindset

1. **Be Welcoming and Kind:** Acknowledge effort and thank contributors for their time.
2. **Explain the "Why":** Rather than stating *"Change this"*, explain *"Using `const` here prevents accidental reassignment, which improves readability"*.
3. **Separate Blockers from Nits:**
   - **[Blocker]:** A security risk, broken build, missing migration step, or regression. Must be resolved before merge.
   - **[Nit / Suggestion]:** A minor stylistic preference, optional refactor, or comment typo. Prefix with `Nit:` so the author knows it does not block merging.

---

## 📋 Comprehensive Reviewer Checklist

### 1. Security & Credentials (Mandatory Zero-Tolerance)
- [ ] **No Committed Secrets:** Verify no API keys, database passwords, `.env` files, Supabase `service_role` keys, or personal phone numbers are included in diffs.
- [ ] **Input Validation:** Are backend inputs sanitized and validated (e.g. using `express-validator`)?
- [ ] **Authentication & Authorization:** Are protected routes guarded by `authMiddleware.verifyToken`? Is role checking properly scoped?
- [ ] **Database & RLS:** Do new Supabase tables have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) with explicit select/insert/update policies?
- [ ] **CORS Origin Check:** Are API responses restricted to configured frontend origins?

### 2. Database Migrations
- [ ] **Reversibility:** Does the migration provide safe addition or alterations?
- [ ] **Idempotence:** Does the SQL script use `IF NOT EXISTS` / `IF EXISTS` to avoid crashing if partially applied?
- [ ] **Review Gate:** Does `@trustjonathan` review the migration prior to merging? (Pushes to `supabase/` deploy directly to production).

### 3. Mobile Usability & Low-Bandwidth Performance
- [ ] **320px–412px Viewport Testing:** Does the layout render cleanly on narrow screens without horizontal overflow or overlapping text?
- [ ] **Asset Weight:** Are images compressed? Are large PDF files kept out of the git repository?
- [ ] **Touch Targets:** Are interactive buttons and navigation links at least 44x44px for reliable touch interactions?
- [ ] **Lazy Loading:** Are document previews, heavy third-party renderers (PDF.js, docx-preview), and catalogs loaded lazily?

### 4. AI Cost & Abuse Safeguards
- [ ] **Model Selection:** Are AI queries routed through server-side proxies? (Never call Gemini or OpenAI directly from the browser with exposed keys).
- [ ] **Token Efficiency:** Are prompts scoped with reasonable character limits?
- [ ] **Local Caching:** Does the frontend cache recent guides locally to avoid repeat API calls?
- [ ] **Fallback Logic:** Is the fallback model (`gemini-3.5-flash-lite`) invoked if the primary model encounters rate limits?

### 5. Privacy & Legal Compliance
- [ ] **Phone Number Handling:** Are Mobile Money numbers treated as sensitive personal data under Uganda's Data Protection and Privacy Act 2019?
- [ ] **Educational Content Provenance:** Are newly added notes, past papers, or diagrams properly attributed without copyright infringement?

### 6. Documentation & Environment Sync
- [ ] If a new configuration variable is introduced, is it documented in `.env.example` and `docs/SECRETS_AND_ENV.md`?
- [ ] Are new user-facing features reflected in `README.md` or relevant guides?

---

## ✍️ Author Self-Review Checklist

Before requesting review on your Pull Request:

1. [ ] I ran `git diff` to ensure no temporary debug statements (`console.log`, `.tmp` files) remain.
2. [ ] I tested the changes on both desktop and mobile screen viewports.
3. [ ] `npm test` passes in `backend/` and `npm run build` succeeds in `frontend/`.
4. [ ] I completed the pull request template with a clear explanation of changes.
