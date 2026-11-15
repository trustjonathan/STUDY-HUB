#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it and try again." >&2
  exit 1
fi

gh auth status >/dev/null
gh repo view >/dev/null

while IFS='|' read -r name color description; do
  [ -n "$name" ] || continue
  gh label create "$name" \
    --color "$color" \
    --description "$description" \
    --force
done <<'LABELS'
good first issue|7057ff|A small, guided task for a new contributor.
help wanted|008672|A task where additional contributors are welcome.
advanced|b60205|Work needing substantial experience or maintainer oversight.
area:frontend|1d76db|Browser pages, components, styles, or client-side behavior.
area:backend|5319e7|Express routes, controllers, or services.
area:database|d93f0b|SQL schema, migrations, or database access.
area:ai|b60205|AI study tools and their integrations.
area:payments|0e8a16|Payment and document-delivery flows.
area:content|fbca04|Study materials, catalogs, and curriculum content.
area:docs|0075ca|Project documentation and contributor guidance.
area:security|e11d48|Security and privacy controls.
area:accessibility|5319e7|Keyboard, screen-reader, and inclusive-use improvements.
area:performance|0e8a16|Loading speed, bandwidth, and runtime efficiency.
area:testing|c2e0c6|Automated or manual test coverage.
area:devops|6f42c1|Build, release, hosting, or operational setup.
bug|d73a4a|A confirmed behavior that needs correction.
enhancement|a2eeef|A useful improvement or new capability.
cleanup|fef2c0|A focused reduction in duplication or unused material.
question|d876e3|A decision or investigation is needed first.
needs triage|ededed|Scope or priority still needs confirmation.
blocked|b60205|Progress depends on a decision or another issue.
in progress|fbca04|Someone is actively working on the issue.
needs review|0e8a16|A pull request is ready for review.
LABELS

echo "Labels synced for the current repository."
