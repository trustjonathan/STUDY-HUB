# Security Policy

The Study Hub team takes the security of our platform and the privacy of our students and contributors seriously.

## Supported Versions

Security patches and vulnerability fixes are applied to the active development branch (`main`) and rolled out to production deployments.

| Component | Status |
| :--- | :--- |
| Main Branch (`main`) | Supported |
| GitHub Pages Frontend | Supported |
| Express Backend API | Supported |
| Supabase Edge Functions & Database | Supported |

## Reporting a Vulnerability

If you discover a security vulnerability, security flaw, or credential leak, please report it privately. **Do NOT open a public GitHub issue.**

### Reporting Channels

1. **GitHub Private Vulnerability Reporting (Preferred):**
   Navigate to the repository's [Security tab](https://github.com/trustjonathan/STUDY-HUB/security/advisories) and select **Report a vulnerability**.
2. **Direct Email:**
   Send an encrypted or private email to:
   * **Maintainer:** Jonathan Mwesigwa
   * **Email:** [trusteth777@gmail.com](mailto:trusteth777@gmail.com)
   * **Subject Line:** `[SECURITY] Study Hub Vulnerability Report - <Short Summary>`

### What to Include

To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability.
- Steps to reproduce or a proof of concept (do not weaponize or execute attacks against live users).
- Affected endpoints, scripts, or components.
- Your assessment of the potential impact.

## Response Expectations & SLAs

- **Initial Acknowledgment:** Within 48 hours of receipt.
- **Triage & Assessment:** Within 5 business days.
- **Fix & Disclosure:** We aim to release a patch within 14 days, coordinating public disclosure with you after the fix is verified in production.

## Safe Harbor & Research Principles

We consider security research conducted in good faith to be authorized and protected under safe harbor:
- Do not access, modify, or delete student accounts, exam records, or donor data that does not belong to you.
- Do not perform denial of service (DoS/DDoS) attacks against production infrastructure.
- Give us reasonable time to remediate the vulnerability before disclosing it publicly.
- If you accidentally encounter personal information or credentials during research, cease access immediately and notify us.
