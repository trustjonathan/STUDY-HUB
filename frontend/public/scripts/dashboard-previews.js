(function () {
  'use strict';

  const previews = Array.from(document.querySelectorAll('.dashboard-preview[data-preview-url]'));
  if (!previews.length) return;

  const documents = new Map();
  const pdfjs = window.pdfjsLib;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = previews[0].dataset.previewWorker;

  function loadDocument(url) {
    if (!documents.has(url)) {
      documents.set(url, pdfjs.getDocument({ url }).promise);
    }
    return documents.get(url);
  }

  async function renderPdfPreview(preview) {
    if (!pdfjs) throw new Error('PDF preview renderer is unavailable.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable.');

    const pdf = await loadDocument(preview.dataset.previewUrl);
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(280 / baseViewport.width, 360 / baseViewport.height) * pixelRatio;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    preview.insertBefore(canvas, preview.firstChild);
    preview.classList.add('has-preview');

    const caption = preview.querySelector('.dashboard-preview-caption');
    if (caption) caption.textContent = 'Page 1 preview';
  }

  async function renderDocxPreview(preview) {
    if (!window.docx?.renderAsync) throw new Error('Word preview renderer is unavailable.');
    const response = await fetch(preview.dataset.previewUrl);
    if (!response.ok) throw new Error(`Document request failed (HTTP ${response.status}).`);

    const content = document.createElement('div');
    content.className = 'dashboard-preview-document';
    await window.docx.renderAsync(await response.arrayBuffer(), content, content);
    preview.insertBefore(content, preview.firstChild);
    preview.classList.add('has-preview');

    const caption = preview.querySelector('.dashboard-preview-caption');
    if (caption) caption.textContent = 'First page preview';
  }

  function renderImagePreview(preview) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.className = 'dashboard-preview-image';
      image.alt = '';
      image.onload = () => {
        preview.insertBefore(image, preview.firstChild);
        preview.classList.add('has-preview');
        resolve();
      };
      image.onerror = () => reject(new Error('Image preview could not be loaded.'));
      image.src = preview.dataset.previewUrl;
    });
  }

  async function renderPreview(preview) {
    const format = preview.dataset.previewFormat?.toLowerCase();
    if (format === 'pdf') await renderPdfPreview(preview);
    else if (format === 'docx') await renderDocxPreview(preview);
    else await renderImagePreview(preview);
    const placeholder = preview.querySelector('.dashboard-preview-placeholder');
    if (placeholder) placeholder.remove();
  }

  function handlePreviewError(preview, error) {
    console.warn('Unable to render resource preview:', error);
    preview.classList.add('preview-error');
    const caption = preview.querySelector('.dashboard-preview-caption');
    if (caption) caption.textContent = 'Preview unavailable · Open to view';
  }

  if (!('IntersectionObserver' in window)) {
    previews.forEach((preview) => {
      renderPreview(preview).catch((error) => handlePreviewError(preview, error));
    });
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      currentObserver.unobserve(entry.target);
      renderPreview(entry.target).catch((error) => handlePreviewError(entry.target, error));
    });
  }, { rootMargin: '180px 0px' });

  previews.forEach((preview) => observer.observe(preview));
})();
