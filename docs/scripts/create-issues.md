# Creating GitHub issues from the backlog

**Maintainer-run only.** Do not run issue creation in bulk, and never publish entries from “Maintainer-only tracking.”

1. Choose a public issue from `ISSUES_BACKLOG.md`. Confirm its file paths and behavior are still accurate, and check GitHub for an existing issue before creating a duplicate.
2. Copy the full issue write-up into GitHub's new-issue form. Keep the body, acceptance checklist, and out-of-scope notes intact.
3. Apply exactly the issue's difficulty, area, and type labels. Add a status label such as `needs triage` only when it is useful.
4. Confirm the title, priority, dependencies, and test instructions with another maintainer. Do not include private audit details or credentials.

## Worked example: GFI-08

After confirming that the issue does not already exist, copy the complete **GFI-08** write-up into a temporary local file named `issue-body.md` in the repository root. Do not commit that temporary file. From the repository root, a maintainer can create the issue with GitHub CLI:

```powershell
gh issue create --title "Add a friendly custom not-found page" --body-file .\issue-body.md --label "good first issue" --label "area:frontend" --label "enhancement"
```

Alternatively, open the repository's **Issues** tab, choose **New issue**, paste the same full write-up, and select `good first issue`, `area:frontend`, and `enhancement` before submitting.
