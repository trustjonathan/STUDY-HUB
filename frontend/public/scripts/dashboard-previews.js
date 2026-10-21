(function () {
  'use strict';

  const documents = new Map();
  const scripts = new Map();
  const observedPreviews = new WeakSet();
  const previewResizeObservers = new WeakMap();
  const queuedPreviews = new WeakSet();
  const previewQueue = [];
  const MAX_ACTIVE_PREVIEWS = 2;
  let activePreviews = 0;

  function enqueuePreview(preview) {
    if (queuedPreviews.has(preview)) return;
    queuedPreviews.add(preview);
    previewQueue.push(preview);
    processPreviewQueue();
  }

  function processPreviewQueue() {
    while (activePreviews < MAX_ACTIVE_PREVIEWS && previewQueue.length) {
      const preview = previewQueue.shift();
      if (!preview.isConnected) continue;
      activePreviews += 1;
      renderPreview(preview)
        .catch((error) => handlePreviewError(preview, error))
        .finally(() => {
          activePreviews -= 1;
          processPreviewQueue();
        });
    }
  }

  function loadScript(url) {
    if (!scripts.has(url)) {
      scripts.set(url, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Unable to load preview library: ${url}`));
        document.head.append(script);
      }));
    }
    return scripts.get(url);
  }

  async function getPdfJs(preview) {
    const workerUrl = preview.dataset.previewWorker;
    if (!workerUrl) throw new Error('PDF preview worker URL is missing.');
    if (!window.pdfjsLib) await loadScript(workerUrl.replace(/pdf\.worker\.min\.js$/, 'pdf.min.js'));
    if (!window.pdfjsLib) throw new Error('PDF preview renderer is unavailable.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    return window.pdfjsLib;
  }

  async function getDocxRenderer(preview) {
    const workerUrl = preview.dataset.previewWorker;
    if (!workerUrl) throw new Error('Document preview asset path is missing.');
    const assetRoot = workerUrl.replace(/pdf\.worker\.min\.js$/, '');
    await loadScript(`${assetRoot}jszip.min.js`);
    await loadScript(`${assetRoot}docx-preview.min.js`);
    if (!window.docx?.renderAsync) throw new Error('Word preview renderer is unavailable.');
    return window.docx;
  }

  function loadDocument(url, pdfjs) {
    if (!documents.has(url)) {
      documents.set(url, pdfjs.getDocument({ url }).promise);
    }
    return documents.get(url);
  }

  async function renderPdfPreview(preview) {
    const pdfjs = await getPdfJs(preview);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable.');

    const pdf = await loadDocument(preview.dataset.previewUrl, pdfjs);
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    let currentRenderTask = null;
    let renderGeneration = 0;
    let renderedSize = '';
    const renderToFit = async () => {
      const width = Math.max(1, preview.clientWidth || 220);
      const height = Math.max(1, preview.clientHeight || 96);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(width / baseViewport.width, height / baseViewport.height) * pixelRatio;
      const viewport = page.getViewport({ scale });
      const sizeKey = `${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)}`;
      if (sizeKey === renderedSize) return;
      renderedSize = sizeKey;
      const generation = ++renderGeneration;
      if (currentRenderTask) currentRenderTask.cancel();
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      currentRenderTask = page.render({ canvasContext: context, viewport });
      try {
        await currentRenderTask.promise;
      } catch (error) {
        if (generation !== renderGeneration || error?.name === 'RenderingCancelledException') return;
        throw error;
      }
      if (generation !== renderGeneration) return;
      if (!canvas.isConnected) preview.insertBefore(canvas, preview.firstChild);
      preview.classList.add('has-preview');
    };

    await renderToFit();
    if ('ResizeObserver' in window && !previewResizeObservers.has(preview)) {
      const observer = new ResizeObserver(() => {
        if (!preview.isConnected) {
          observer.disconnect();
          previewResizeObservers.delete(preview);
          return;
        }
        renderToFit().catch((error) => handlePreviewError(preview, error));
      });
      previewResizeObservers.set(preview, observer);
      observer.observe(preview);
    }

    const caption = preview.querySelector('.dashboard-preview-caption');
    if (caption) caption.textContent = 'Page 1 preview';
  }

  async function renderDocxPreview(preview) {
    const docx = await getDocxRenderer(preview);
    const response = await fetch(preview.dataset.previewUrl);
    if (!response.ok) throw new Error(`Document request failed (HTTP ${response.status}).`);

    const content = document.createElement('div');
    content.className = 'dashboard-preview-document';
    await docx.renderAsync(await response.arrayBuffer(), content, content);
    preview.insertBefore(content, preview.firstChild);
    preview.classList.add('has-preview');
    const resizeDocument = () => {
      const scale = Math.min(preview.clientWidth / 816, preview.clientHeight / 1056);
      content.style.transform = `translateX(-50%) scale(${scale})`;
    };
    resizeDocument();
    if ('ResizeObserver' in window) {
      new ResizeObserver(resizeDocument).observe(preview);
    }

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

  function createObserver(root) {
    return 'IntersectionObserver' in window
      ? new IntersectionObserver((entries, currentObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            currentObserver.unobserve(entry.target);
            enqueuePreview(entry.target);
          });
      }, { root, rootMargin: '180px 0px' })
      : null;
  }

  const viewportObserver = createObserver(null);
  const containerObservers = new WeakMap();

  function observerFor(preview) {
    const root = preview.closest('.lib-main-body');
    if (!root) return viewportObserver;
    if (!containerObservers.has(root)) containerObservers.set(root, createObserver(root));
    return containerObservers.get(root);
  }

  function observePreviews(root) {
    const previews = [];
    if (root instanceof Element && root.matches('.dashboard-preview[data-preview-url]')) {
      previews.push(root);
    }
    if ('querySelectorAll' in root) {
      previews.push(...root.querySelectorAll('.dashboard-preview[data-preview-url]'));
    }

    previews.forEach((preview) => {
      if (observedPreviews.has(preview)) return;
      observedPreviews.add(preview);
      const previewObserver = observerFor(preview);
      if (previewObserver) previewObserver.observe(preview);
      else enqueuePreview(preview);
    });
  }

  observePreviews(document);
  new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(observePreviews));
  }).observe(document.body, { childList: true, subtree: true });
})();
