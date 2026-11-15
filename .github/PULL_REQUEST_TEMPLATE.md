## Summary of Changes

<!-- Provide a clear, concise explanation of what this pull request does and why. -->

Fixes / Relates to Issue: #

## Type of Change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Documentation update (`docs:`)
- [ ] Curriculum / Content addition (`content:`)
- [ ] Refactoring or code cleanup (`refactor:`)
- [ ] Tests or CI adjustment (`test:` / `chore:`)

## Contributor Checklist

Please check all that apply before requesting review:

### Code Quality & Testing
- [ ] My code follows the project's formatting and style guidelines (`.editorconfig`, `.prettierrc`).
- [ ] I have tested these changes locally on Node.js 22.12+.
- [ ] Backend tests run cleanly: `npm test` inside `backend/` passes (if backend files were changed).
- [ ] Frontend build succeeds: `npm run build` inside `frontend/` succeeds without errors.

### Mobile & Bandwidth Accessibility
- [ ] I verified responsive layout on mobile viewports (tested at 320px, 375px, and 412px in DevTools).
- [ ] No unwanted horizontal scrolling introduced.
- [ ] Document/image sizes are compressed and low-bandwidth friendly.

### Security & Privacy
- [ ] **NO SECRETS:** I verified that no API keys, tokens, `.env` files, passwords, or personal telephone numbers are committed.
- [ ] Does this PR add or change environment variables? (If yes, updated `.env.example` and `docs/SECRETS_AND_ENV.md`).
- [ ] Does this PR modify database schema or migrations? (If yes, requires maintainer `@trustjonathan` review).
- [ ] Does this PR touch payment verification or authentication? (If yes, verified with maintainer beforehand).

## Screenshots / Evidence (for UI changes)

<!-- Attach before/after screenshots or screen recordings showing desktop and mobile views -->
