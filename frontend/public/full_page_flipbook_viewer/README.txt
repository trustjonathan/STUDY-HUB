Full Page PDF Flipbook Viewer Bundle

This folder contains a standalone viewer that renders a PDF in the browser using the flipbook viewer from the Fresh Teacher site.

Included files:
- index.html
- js/
- css/
- images/
- mp3/
- webfonts/
- sample.pdf

How to use:
1. Extract this folder anywhere.
2. Open index.html in a browser.
3. The viewer will render sample.pdf in full-page mode.

To use another PDF:
- replace sample.pdf with your file
- or edit the pdfUrl field in index.html

Note:
- Some browsers require serving the folder via a local web server when loading PDFs.
- A simple option is:
  python -m http.server 8000
  Then open http://localhost:8000 in the browser.
- In Study Hub, resource links open this reader in-app: PDFs use the flipbook, DOCX and RTF use local browser renderers, and legacy DOC files use the embedded Office viewer.
- The Study Hub build copies the viewer and its renderer bundles from this folder and the frontend dependencies.
- Renderer license texts are copied beside their browser bundles; jQuery 3.7.1 is loaded from code.jquery.com under the MIT license.
