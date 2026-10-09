Study Hub Document Reader

This folder contains the standalone Study Hub reader. PDFs render as vertically stacked pages in a scrollable reading area; the toolbar and optional contribution panel stay separate from the document scroll area.

Included files:
- index.html
- js/
- css/
- images/
- mp3/
- webfonts/
- sample.pdf

How to use:
1. In the repository, install frontend dependencies and run `npm run build` from the `frontend` folder. This bundles the reader's Supabase and resumable-upload clients.
2. Serve `frontend/public/full_page_flipbook_viewer` with a local web server.
3. Open its `index.html`; the reader will render sample.pdf as a vertical page list.

Note:
- Some browsers require serving the folder via a local web server when loading PDFs.
- A simple option is:
  python -m http.server 8000
  Then open http://localhost:8000 in the browser.
- In Study Hub, resource links open this reader in-app: PDFs use PDF.js, DOCX and RTF use local browser renderers, and legacy DOC files use the embedded Office viewer.
- The Study Hub build copies the viewer and its renderer bundles from this folder and the frontend dependencies.
- Optional reader uploads support up to 20 files and 250 MB per batch (50 MB per file). Files are transferred in parallel to private resumable staging; completed files survive leaving the reader, and interrupted files can resume after reselecting them in the same browser.
- Staged batches expire after 24 hours unless submitted. Applying the migrations, enabling Supabase anonymous sign-ins, deploying the contribution Edge Functions, and scheduling staging cleanup are required before uploads work.
- The reader offers embedded contents navigation, browser-local bookmarks, and warm, grayscale, and night reading colors.
