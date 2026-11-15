# Security Policy

The Study Hub team takes the security of our platform and the privacy of our students and contributors seriously.

## Supported Components and Releases

We address security reports for the current production deployment and the active `main` branch. We do not publish a separate long-term support schedule for tagged releases, forks, or archived snapshots. Include the affected release, commit, or deployment where known.

| Component | Status |
| :--- | :--- |
| Active development branch (`main`) | Supported |
| Production frontend | Supported |
| Production Express Backend API | Supported |
| Production Supabase Edge Functions & Database | Supported |

## Reporting a Vulnerability

If you discover a security vulnerability, security flaw, or credential leak, please report it privately. **Do NOT open a public GitHub issue.**

### Reporting Channels

1. **GitHub Private Vulnerability Reporting:**
   If private vulnerability reporting is enabled, use the repository's [Security tab](https://github.com/trustjonathan/STUDY-HUB/security/advisories) and select **Report a vulnerability**.
2. **Direct Email (fallback):**
   Email the maintainer at:
   * **Maintainer:** Jonathan Mwesigwa
   * **Email:** [trusteth777@gmail.com](mailto:trusteth777@gmail.com)
   * **Subject Line:** `[SECURITY] Study Hub Vulnerability Report - <Short Summary>`

Email is not an end-to-end encrypted channel. Do not include passwords, full API keys, access tokens, or unnecessary personal data in a report. For a suspected exposed credential, identify the affected service and location without repeating the secret value.

### What to Include

To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability.
- Steps to reproduce or a proof of concept (do not weaponize or execute attacks against live users).
- Affected endpoints, scripts, or components.
- Your assessment of the potential impact.

## Response Targets

These are targets, not guarantees. We aim to acknowledge a report within **5 working days** and provide an initial assessment within **10 working days**. We will share material status updates when practical. Remediation and disclosure timing depend on severity, complexity, and release risk; we will coordinate disclosure with the reporter where possible and will not promise a fixed patch date.

## Safe Harbor & Research Principles

We welcome good-faith research that is limited to systems owned or operated by Study Hub and follows this policy. This policy does not authorize testing third-party systems, override applicable law or platform terms, or guarantee legal immunity. To the extent permitted by law, Study Hub maintainers will not pursue legal action against researchers for security research that follows this policy.

- Do not access, modify, or delete student accounts, exam records, or donor data that does not belong to you.
- Do not perform denial-of-service testing or otherwise disrupt production services.
- Do not use a vulnerability to access, change, or retain data beyond what is necessary to demonstrate the issue; use test accounts and data you control.
- Give us a reasonable opportunity to investigate and remediate before publicly disclosing the issue.
- If you unexpectedly encounter personal information or credentials, stop testing, do not copy or share the data, and notify us privately.
