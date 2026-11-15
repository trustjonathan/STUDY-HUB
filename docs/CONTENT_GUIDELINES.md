# Study Hub Content & Curriculum Guidelines 📝

Study Hub aims to provide clear, curriculum-aligned academic resources for Ugandan learners from Primary level through Advanced Level and University.

---

## 1. Supported Educational Levels & Subjects

| Level | Exam / Certificate | Common Subjects |
| :--- | :--- | :--- |
| **Primary (P1 – P7)** | PLE (Primary Leaving Exam) | English, Mathematics, Integrated Science, Social Studies (SST), Religious Education (C.R.E / I.R.E). |
| **Ordinary Level (S1 – S4)** | UCE (Uganda Certificate of Education) | Biology, Chemistry, Physics, Mathematics, Geography, History, English Language, Literature, Commerce, Agriculture, ICT, Luganda. |
| **Advanced Level (S5 – S6)** | UACE (Uganda Advanced Certificate of Education) | PCB/PCM combinations, Economics, Entrepreneurship, History, Divinity, Sub-Math, General Paper (GP), Subsidiary ICT. |
| **University & Tertiary** | Diploma & Undergraduate | Foundation modules, computer science, education, introductory sciences. |

---

## 2. File Naming & Organization Conventions

When contributing new notes, syllabi, or past examination papers:

- **Format:** Prefer `.pdf` for multi-page documents and books. Prefer `.docx` or `.html` for editable lesson notes.
- **File Naming Pattern:** Use lowercase, hyphen-separated filenames that clearly identify level, subject, and topic:
  ```text
  <level>-<subject>-<topic-or-year>-<doc-type>.<ext>
  ```
  *Examples:*
  - `s4-biology-genetics-and-inheritance-notes.pdf`
  - `uace-2023-physics-paper-1-past-paper.pdf`
  - `p7-ple-2022-mathematics-marking-guide.pdf`

---

## 3. Metadata Standards

Every curated resource in the catalog includes the following structured metadata attributes:

```json
{
  "id": "uace-phy-2023-p1",
  "title": "UACE Physics Paper 1 (2023) Examination & Marking Guide",
  "subject": "Physics",
  "classLevel": "Senior 6",
  "category": "Past Paper",
  "year": 2023,
  "pages": 12,
  "fileType": "pdf",
  "source": "study-hub-resources-1",
  "verified": true
}
```

---

## 4. Copyright, Attribution & Permissions

Study Hub operates as an educational revision platform. We respect intellectual property and expect all contributors to adhere to the following principles:

1. **Original Notes:** Contributors retain ownership of their original work. By submitting it, they grant Study Hub permission to store, index, format as needed for display, and display it through the service. This permission does not transfer ownership or grant other users a general right to redistribute the work.
2. **Third-Party Materials:** Submit or publish third-party work only when you have permission, the applicable license allows it, or you have confirmed another valid legal basis. Do not assume examination papers, syllabi, marking schemes, or other educational materials are free to redistribute because the use is educational or non-commercial.
3. **Commercial Textbooks:** **Never upload full copyrighted commercial textbooks** without explicit permission from the rights holder. Study Hub does not authorize or encourage uploading unauthorized copies.
4. **Attribution:** Cite the originating school, teacher, publisher, or other source where known. Attribution is not a substitute for permission when permission is required.
5. **Item-Specific Terms:** Follow any license, permission, or rights notice attached to an individual resource. The repository's software license does not license educational content or third-party materials; see the [LICENSE](../LICENSE).

---

## 5. Moderation Workflow for Uploaded Contributions

1. **Anonymous Staging:** Uploads land in a private, unindexed Supabase staging bucket.
2. **Automated Verification:** The upload Edge Function verifies file extension (`.pdf`, `.docx`, `.rtf`, `.png`, `.jpg`), file size (<= 50MB), and batch limits.
3. **Manual Editorial Review:** Platform administrators inspect the document in the private contribution queue to ensure:
   - Legible formatting and clear academic value.
   - Freedom from malware, advertising spam, or non-academic content.
   - Appropriate copyright status.
4. **Publishing:** Approved documents are transferred to the public CDN and catalog indexes are regenerated.

---

## 6. Copyright Concern & Takedown Process

If you believe any content on Study Hub infringes your copyright:

1. Send an email to **[trusteth777@gmail.com](mailto:trusteth777@gmail.com)** with the subject `[DMCA/Takedown] Infringing Material Notice`.
2. Include:
   - The exact URL or title of the material.
   - Proof of ownership or authorization to act on behalf of the copyright owner.
   - Your contact details.
   - A short explanation of the rights you believe are affected and the action you are requesting.
3. We aim to acknowledge notices within **5 working days**. We may ask for clarification or supporting information before treating a notice as verified.
4. We aim to review verified notices and, where a claim appears credible and removal or restriction is appropriate, restrict access to the material within **5 working days** of verification. These are response targets, not guarantees; we will communicate material delays where practical.
5. Please do not send passwords, access tokens, or unrelated sensitive personal information. Reports will be handled as discreetly as practical.
