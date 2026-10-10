import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';

(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const requestedFile = params.get('file');
  const title = params.get('title') || 'Study Hub resource';
  const storagePrefix = 'https://ttuxelhyoctyshgvjykj.supabase.co/storage/v1/object/public/study-hub-resources/';
  const toolbar = document.querySelector('#reader-toolbar');
  const pdfReader = document.querySelector('#pdf-reader');
  const pdfPages = document.querySelector('#pdf-pages');
  const documentReader = document.querySelector('#document-reader');
  const documentContent = document.querySelector('#document-content');
  const documentFrame = document.querySelector('#document-frame');
  const readerError = document.querySelector('#reader-error');
  const pageInput = document.querySelector('.ela-pageinput input');
  const totalPages = document.querySelector('.ela-total');
  const previousButton = document.querySelector('[data-a="prev"]');
  const nextButton = document.querySelector('[data-a="next"]');
  const zoomSelect = document.querySelector('#reader-zoom');
  const zoomControl = document.querySelector('.ela-zoom');
  const colorSelect = document.querySelector('#reader-color');
  const readingPanel = document.querySelector('#reading-panel');
  const contentsButton = document.querySelector('[data-a="contents"]');
  const relatedList = document.querySelector('#related-list');
  const relatedSubjectLabel = document.querySelector('#related-subject');
  const relatedRetry = document.querySelector('#related-retry');
  const relatedToggle = document.querySelector('[data-a="related"]');
  const relatedRail = document.querySelector('#related-documents');
  const toc = document.querySelector('#document-toc');
  const bookmarksContainer = document.querySelector('#document-bookmarks');
  const bookmarkButton = document.querySelector('#bookmark-current');
  const contributionForm = document.querySelector('#contribution-form');
  const drawerBackdrop = document.querySelector('.reader-drawer-backdrop');
  const fileInput = contributionForm.querySelector('input[type="file"]');
  const contributionToggle = document.querySelector('[data-a="contribute"]');
  const submitButton = document.querySelector('#submit-contribution');
  const uploadStatus = document.querySelector('#upload-status');
  const uploadQueue = document.querySelector('#upload-queue');
  const notice = document.createElement('span');
  notice.className = 'sr-only';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  document.body.append(notice);

  let pdfDocument = null;
  let activePage = 1;
  let zoom = 1;
  let renderGeneration = 0;
  let captchaResponse = '';
  let captchaWidgetId;
  let searchGeneration = 0;
  let uploadAuthClient = null;
  let selectedFiles = [];
  let activeBatch = null;
  let processingQueue = false;
  let startingBatch = false;
  const resourceKey = requestedFile || window.location.pathname;
  const readerStateKey = `study-hub-reader:${encodeURIComponent(resourceKey)}`;
  const uploadBatchKey = 'study-hub-contribution-upload-batch-v1';
  const renderedPages = new Set();
  const renderEntries = new Map();
  const pageElements = new Map();

  document.title = `${title} | Study Hub`;
  document.querySelector('.ela-t-title').textContent = title;

  function setUploadMessage(message, stateName = '') {
    uploadStatus.textContent = message;
    uploadStatus.dataset.state = stateName;
  }

  const subjectNames = {
    biology: 'Biology',
    chemistry: 'Chemistry',
    mathematics: 'Mathematics',
    physics: 'Physics'
  };

  function currentSubject() {
    const requestedSubject = params.get('subject')?.toLowerCase();
    if (Object.hasOwn(subjectNames, requestedSubject)) return requestedSubject;

    try {
      const path = new URL(requestedFile).pathname.toLowerCase();
      const match = path.match(/\/documents\/(bio|biology|chem|chemistry|math|mathematics|physics)\//);
      if (!match) return '';
      return ({
        bio: 'biology',
        chem: 'chemistry',
        math: 'mathematics'
      })[match[1]] || match[1];
    } catch {
      return '';
    }
  }

  function resourceTitle(item) {
    return item.title || item.original_filename || item.storage_path?.split('/').pop() || 'Study resource';
  }

  function resourceType(item) {
    const type = item.resource_type;
    if (type === 'notes' || type === 'guide' || type === 'paper') {
      return type === 'paper' ? 'Practice paper' : type === 'guide' ? 'Marking guide' : 'Study notes';
    }
    const category = item.category;
    if (category === 'notes') return 'Study notes';
    if (category === 'papers') return 'Practice paper';
    return String(item.extension || 'document').toUpperCase() + ' resource';
  }

  function resourcePublicUrl(item) {
    const sourceUrl = new URL(requestedFile);
    const storagePath = String(item.storage_path || '').split('/').map(encodeURIComponent).join('/');
    const bucket = encodeURIComponent(item.storage_bucket || 'study-hub-resources');
    return `${sourceUrl.origin}/storage/v1/object/public/${bucket}/${storagePath}`;
  }

  function relatedResourceUrl(item, subject) {
    const link = new URL(window.location.href);
    link.search = '';
    link.searchParams.set('file', resourcePublicUrl(item));
    link.searchParams.set('title', resourceTitle(item));
    link.searchParams.set('subject', subject);
    const returnUrl = params.get('return');
    if (returnUrl) link.searchParams.set('return', returnUrl);
    for (const key of ['anon_key', 'turnstile_key']) {
      const value = params.get(key);
      if (value) link.searchParams.set(key, value);
    }
    return link.href;
  }

  async function renderRelatedPdfPreview(preview) {
    if (!window.pdfjsLib) throw new Error('The PDF preview renderer is unavailable.');
    const pdf = await window.pdfjsLib.getDocument(preview.dataset.previewUrl).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(58 / baseViewport.width, 74 / baseViewport.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The PDF preview canvas is unavailable.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    preview.replaceChildren(canvas);
  }

  const relatedPreviewObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        void renderRelatedPdfPreview(entry.target).catch((error) => {
          console.warn('Unable to render a related document preview:', error);
        });
      }
    }, { rootMargin: '120px 0px' })
    : null;

  function renderRelatedDocuments(items, subject) {
    const currentPath = (() => {
      try {
        return decodeURIComponent(new URL(requestedFile).pathname.split('/').pop() || '').toLowerCase();
      } catch {
        return '';
      }
    })();
    const related = items.filter((item) => {
      const path = String(item.storage_path || '').split('/').pop() || '';
      let normalizedPath = path;
      try {
        normalizedPath = decodeURIComponent(path);
      } catch {
        normalizedPath = path;
      }
      return item.storage_path && normalizedPath.toLowerCase() !== currentPath;
    });

    if (!related.length) {
      relatedList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'related-status',
        textContent: `No other ${subjectNames[subject]} documents are available yet.`
      }));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of related) {
      const link = document.createElement('a');
      link.className = 'related-card';
      link.href = relatedResourceUrl(item, subject);
      link.setAttribute('aria-label', `Open ${resourceTitle(item)}`);

      const preview = document.createElement('span');
      preview.className = 'related-preview';
      preview.setAttribute('aria-hidden', 'true');
      const extension = String(item.extension || '').toUpperCase();
      preview.append(Object.assign(document.createElement('span'), {
        className: 'related-preview-placeholder',
        textContent: extension || 'FILE'
      }));
      if (extension === 'PDF') {
        preview.dataset.previewUrl = resourcePublicUrl(item);
        if (relatedPreviewObserver) relatedPreviewObserver.observe(preview);
        else void renderRelatedPdfPreview(preview).catch((error) => {
          console.warn('Unable to render a related document preview:', error);
        });
      }

      const copy = document.createElement('span');
      copy.className = 'related-copy';
      copy.append(Object.assign(document.createElement('span'), {
        className: 'related-type',
        textContent: resourceType(item)
      }));
      copy.append(Object.assign(document.createElement('span'), {
        className: 'related-name',
        textContent: resourceTitle(item)
      }));
      const meta = [item.level, item.year].filter(Boolean).join(' · ');
      if (meta) {
        copy.append(Object.assign(document.createElement('span'), {
          className: 'related-meta',
          textContent: meta
        }));
      }
      link.append(preview, copy);
      fragment.append(link);
    }
    relatedList.replaceChildren(fragment);
  }

  async function loadRelatedDocuments() {
    const subject = currentSubject();
    const subjectName = subjectNames[subject];
    relatedRetry.hidden = true;
    relatedSubjectLabel.textContent = subjectName || '';
    if (!subject || !requestedFile) {
      relatedList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'related-status',
        textContent: 'Related documents appear here when you open a resource from a subject library.'
      }));
      return;
    }

    const anonKey = params.get('anon_key') || '';
    if (!anonKey) {
      relatedList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'related-status',
        textContent: 'Related documents could not be loaded because the library connection is unavailable.'
      }));
      relatedRetry.hidden = false;
      return;
    }

    relatedList.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'related-status',
      textContent: `Loading ${subjectName} documents…`
    }));

    try {
      const sourceUrl = new URL(requestedFile);
      const endpoint = new URL('/rest/v1/study_hub_resources', sourceUrl.origin);
      endpoint.searchParams.set('select', 'subject,category,storage_bucket,storage_path,original_filename,title,extension,level,year,resource_type,size_bytes');
      endpoint.searchParams.set('subject', `eq.${subject}`);
      endpoint.searchParams.set('size_bytes', 'gt.0');
      endpoint.searchParams.set('order', 'updated_at.desc.nullslast,title.asc,storage_path.asc');
      endpoint.searchParams.set('limit', '30');
      const response = await fetch(endpoint, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        }
      });
      if (!response.ok) throw new Error(`Related resource request failed (HTTP ${response.status}).`);
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('Related resources returned an invalid response.');
      renderRelatedDocuments(items, subject);
    } catch (error) {
      console.error('Unable to load related subject documents:', error);
      relatedList.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'related-status',
        textContent: 'Related documents could not be loaded right now.'
      }));
      relatedRetry.hidden = false;
    }
  }

  function loadReaderState() {
    try {
      const value = JSON.parse(localStorage.getItem(readerStateKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      notice.textContent = 'Saved reading preferences could not be loaded.';
      return {};
    }
  }

  function saveReaderState(state) {
    try {
      localStorage.setItem(readerStateKey, JSON.stringify(state));
    } catch {
      notice.textContent = 'This browser could not save your reading preferences.';
    }
  }

  const readerState = loadReaderState();

  function currentPosition() {
    if (pdfDocument) return { kind: 'page', value: activePage, label: `Page ${activePage}` };
    const scrollHeight = Math.max(1, documentReader.scrollHeight - documentReader.clientHeight);
    const value = Math.min(1, Math.max(0, documentReader.scrollTop / scrollHeight));
    return { kind: 'scroll', value, label: `Reading position ${Math.round(value * 100)}%` };
  }

  function savedBookmarks() {
    return Array.isArray(readerState.bookmarks) ? readerState.bookmarks : [];
  }

  function renderBookmarks() {
    const bookmarks = savedBookmarks();
    if (!bookmarks.length) {
      bookmarksContainer.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'No bookmarks saved yet.' }));
      return;
    }
    const fragment = document.createDocumentFragment();
    bookmarks.forEach((bookmark, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = bookmark.label || `Bookmark ${index + 1}`;
      button.addEventListener('click', () => {
        if (bookmark.kind === 'page') scrollToPage(bookmark.value);
        else documentReader.scrollTo({ top: bookmark.value * (documentReader.scrollHeight - documentReader.clientHeight), behavior: 'smooth' });
      });
      fragment.append(button);
    });
    bookmarksContainer.replaceChildren(fragment);
  }

  function toggleBookmark() {
    const position = currentPosition();
    const bookmarks = savedBookmarks();
    const existingIndex = bookmarks.findIndex((bookmark) => bookmark.kind === position.kind && bookmark.value === position.value);
    if (existingIndex >= 0) bookmarks.splice(existingIndex, 1);
    else bookmarks.push({ ...position, savedAt: Date.now() });
    readerState.bookmarks = bookmarks.slice(-50);
    saveReaderState(readerState);
    renderBookmarks();
    notice.textContent = existingIndex >= 0 ? 'Bookmark removed.' : `${position.label} bookmarked.`;
  }

  function applyReadingColor(value) {
    const filters = {
      original: '',
      warm: 'sepia(.24) saturate(.86)',
      gray: 'grayscale(1)',
      night: 'invert(.88) hue-rotate(180deg) brightness(.86) contrast(.9)',
    };
    const filter = filters[value] ?? '';
    pdfPages.style.filter = filter;
    documentContent.style.filter = filter;
    documentFrame.style.filter = filter;
    colorSelect.value = filters[value] === undefined ? 'original' : value;
    readerState.color = colorSelect.value;
    saveReaderState(readerState);
  }

  async function buildContents() {
    const fragment = document.createDocumentFragment();
    let count = 0;
    if (pdfDocument) {
      const outline = await pdfDocument.getOutline();
      async function appendOutline(items, depth = 0) {
        for (const item of items || []) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = item.title || 'Untitled section';
          button.style.paddingLeft = `${9 + depth * 14}px`;
          button.addEventListener('click', async () => {
            if (!item.dest) {
              notice.textContent = 'This contents entry does not include a page destination.';
              return;
            }
            try {
              const destination = typeof item.dest === 'string'
                ? await pdfDocument.getDestination(item.dest)
                : item.dest;
              const pageIndex = destination?.[0] ? await pdfDocument.getPageIndex(destination[0]) : 0;
              scrollToPage(pageIndex + 1);
              readingPanel.hidden = true;
              contentsButton.setAttribute('aria-expanded', 'false');
            } catch (error) {
              notice.textContent = error instanceof Error ? error.message : 'This contents link could not be opened.';
            }
          });
          fragment.append(button);
          count += 1;
          await appendOutline(item.items, depth + 1);
        }
      }
      await appendOutline(outline);
    } else {
      const headings = [...documentContent.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      headings.forEach((heading, index) => {
        if (!heading.id) heading.id = `reader-section-${index + 1}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = heading.textContent.trim() || `Section ${index + 1}`;
        button.style.paddingLeft = `${9 + (Number(heading.tagName.slice(1)) - 1) * 10}px`;
        button.addEventListener('click', () => {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          readingPanel.hidden = true;
          contentsButton.setAttribute('aria-expanded', 'false');
        });
        fragment.append(button);
        count += 1;
      });
    }
    if (count) toc.replaceChildren(fragment);
    else toc.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'This document has no embedded contents.' }));
  }

  function showError(message) {
    toolbar.hidden = true;
    readerError.textContent = message;
    readerError.hidden = false;
  }

  function goBack() {
    const returnUrl = params.get('return');
    if (returnUrl) {
      try {
        const destination = new URL(returnUrl);
        if (destination.origin === window.location.origin) {
          window.location.assign(destination.href);
          return;
        }
      } catch {
        notice.textContent = 'The return link was invalid; using browser history instead.';
      }
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      const destination = new URL('../', window.location.href);
      destination.pathname = destination.pathname.replace(/\/$/, '') || '/';
      window.location.assign(destination.href);
    }
  }

  function updatePageControls() {
    pageInput.value = String(activePage);
    pageInput.max = String(pdfDocument?.numPages || 1);
    totalPages.textContent = String(pdfDocument?.numPages || 1);
    previousButton.disabled = !pdfDocument || activePage <= 1;
    nextButton.disabled = !pdfDocument || activePage >= pdfDocument.numPages;
  }

  function scrollToPage(pageNumber) {
    if (!pdfDocument) return;
    const page = Math.min(Math.max(Number(pageNumber) || 1, 1), pdfDocument.numPages);
    activePage = page;
    updatePageControls();
    pageElements.get(page)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void renderPage(page);
  }

  function pageScale(page) {
    const naturalWidth = page.getViewport({ scale: 1 }).width;
    const availableWidth = Math.max(240, pdfReader.clientWidth - 48);
    const fit = Math.min(availableWidth / naturalWidth, 1.5);
    return fit * zoom;
  }

  async function renderPage(pageNumber) {
    if (!pdfDocument || renderedPages.has(pageNumber)) return;
    const generation = renderGeneration;
    const existing = renderEntries.get(pageNumber);
    if (existing?.generation === generation) return existing.promise;
    const element = pageElements.get(pageNumber);
    if (!element) return;

    const entry = { generation, task: null, promise: null };
    entry.promise = (async () => {
      const page = await pdfDocument.getPage(pageNumber);
      if (generation !== renderGeneration) return;
      const scale = pageScale(page);
      const viewport = page.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', `Page ${pageNumber}`);
      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      element.replaceChildren(canvas);
      element.style.width = `${viewport.width}px`;
      element.style.aspectRatio = '';

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('This browser could not create a document page.');
      entry.task = page.render({
        canvasContext: context,
        viewport: page.getViewport({ scale: scale * pixelRatio }),
      });
      await entry.task.promise;
      if (generation === renderGeneration) renderedPages.add(pageNumber);
    })();
    renderEntries.set(pageNumber, entry);

    try {
      await entry.promise;
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException' && generation === renderGeneration) {
        element.textContent = 'This page could not be rendered.';
        notice.textContent = error instanceof Error ? error.message : 'A document page could not be rendered.';
      }
    } finally {
      if (renderEntries.get(pageNumber) === entry) renderEntries.delete(pageNumber);
    }
  }

  function renderNearbyPages() {
    if (!pdfDocument) return;
    const readerBounds = pdfReader.getBoundingClientRect();
    for (const [pageNumber, element] of pageElements) {
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom >= readerBounds.top - 800 && bounds.top <= readerBounds.bottom + 800) {
        void renderPage(pageNumber);
      }
    }
  }

  function resetRenderedPages() {
    renderGeneration += 1;
    for (const entry of renderEntries.values()) entry.task?.cancel();
    renderEntries.clear();
    renderedPages.clear();
    const maxWidth = Math.min(850, Math.max(240, pdfReader.clientWidth - 48));
    for (const element of pageElements.values()) {
      element.replaceChildren();
      element.style.width = `${maxWidth}px`;
      element.style.aspectRatio = '0.7727';
    }
    requestAnimationFrame(renderNearbyPages);
  }

  function createPdfPages() {
    const fragment = document.createDocumentFragment();
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = document.createElement('section');
      page.className = 'pdf-page';
      page.dataset.page = String(pageNumber);
      page.setAttribute('aria-label', `Page ${pageNumber}`);
      page.style.width = `${Math.min(850, Math.max(240, pdfReader.clientWidth - 48))}px`;
      page.style.aspectRatio = '0.7727';
      pageElements.set(pageNumber, page);
      fragment.append(page);
    }
    pdfPages.replaceChildren(fragment);

    if ('IntersectionObserver' in window) {
      const pageObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void renderPage(Number(entry.target.dataset.page));
        }
      }, { root: pdfReader, rootMargin: '800px 0px' });
      pageElements.forEach((page) => pageObserver.observe(page));
    } else {
      if (!('IntersectionObserver' in window)) renderNearbyPages();
    }

    let scrollFrame = 0;
    pdfReader.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        renderNearbyPages();
        const readerTop = pdfReader.getBoundingClientRect().top;
        for (const [pageNumber, element] of pageElements) {
          if (element.getBoundingClientRect().bottom > readerTop + 24) {
            if (pageNumber !== activePage) {
              activePage = pageNumber;
              updatePageControls();
            }
            break;
          }
        }
      });
    }, { passive: true });

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(resetRenderedPages);
      resizeObserver.observe(pdfReader);
    } else {
      window.addEventListener('resize', resetRenderedPages);
    }
  }

  async function loadPdf(fileUrl) {
    if (!window.pdfjsLib) throw new Error('The PDF reader could not be loaded. Please refresh and try again.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
    const loadingTask = window.pdfjsLib.getDocument(fileUrl.href);
    pdfDocument = await loadingTask.promise;
    pdfReader.hidden = false;
    document.querySelectorAll('[data-pdf-only]').forEach((element) => { element.hidden = false; });
    document.querySelector('[data-a="search"]').hidden = false;
    zoomControl.hidden = false;
    createPdfPages();
    updatePageControls();
    await buildContents();
    applyReadingColor(readerState.color || 'original');
    renderBookmarks();
    void renderPage(1);
  }

  async function findInPdf() {
    if (!pdfDocument) return;
    const query = window.prompt('Find text in this document');
    if (!query?.trim()) return;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const generation = ++searchGeneration;
    notice.textContent = 'Searching document text…';
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        if (generation !== searchGeneration) return;
        const page = await pdfDocument.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').toLocaleLowerCase();
        if (text.includes(normalizedQuery)) {
          notice.textContent = `Found text on page ${pageNumber}.`;
          scrollToPage(pageNumber);
          return;
        }
      }
      notice.textContent = 'No matching text was found in this document.';
    } catch (error) {
      notice.textContent = error instanceof Error ? error.message : 'Could not search this document.';
    }
  }

  function persistUploadBatch() {
    try {
      if (!activeBatch) {
        localStorage.removeItem(uploadBatchKey);
        return;
      }
      localStorage.setItem(uploadBatchKey, JSON.stringify(activeBatch));
    } catch {
      setUploadMessage('This browser could not save upload progress. Keep this page open until the batch is staged.', 'error');
    }
  }

  function isBatchReady() {
    return Boolean(activeBatch?.files?.length && activeBatch.files.every((file) => file.status === 'staged'));
  }

  function updateSubmitButton() {
    submitButton.disabled = !captchaResponse || !isBatchReady();
  }

  function renderUploadQueue() {
    uploadQueue.replaceChildren();
    if (!activeBatch?.files?.length) {
      updateSubmitButton();
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const file of activeBatch.files) {
      const item = document.createElement('div');
      item.className = 'upload-item';
      item.dataset.state = file.status;
      const heading = document.createElement('div');
      heading.className = 'upload-item-heading';
      const name = document.createElement('span');
      name.className = 'upload-item-name';
      name.textContent = file.name;
      name.title = file.name;
      const state = document.createElement('span');
      state.className = 'upload-item-state';
      state.textContent = file.status === 'staged' ? 'Ready' : file.status === 'uploading' ? `${Math.round(file.progress || 0)}%` : file.status === 'failed' ? 'Retry' : file.status === 'needs-file' ? 'Reselect to resume' : 'Waiting';
      heading.append(name, state);
      const progress = document.createElement('progress');
      progress.max = 100;
      progress.value = file.status === 'staged' ? 100 : Number(file.progress) || 0;
      item.append(heading, progress);
      fragment.append(item);
    }
    uploadQueue.append(fragment);

    const actions = document.createElement('div');
    actions.className = 'upload-queue-actions';
    const discard = document.createElement('button');
    discard.type = 'button';
    discard.textContent = 'Discard batch';
    discard.disabled = processingQueue || startingBatch || activeBatch.finalizing === true;
    discard.addEventListener('click', () => { void discardUploadBatch(); });
    actions.append(discard);
    uploadQueue.append(actions);
    updateSubmitButton();
  }

  function restoreUploadBatch() {
    try {
      const value = JSON.parse(localStorage.getItem(uploadBatchKey) || 'null');
      if (value && typeof value.sessionId === 'string' && Array.isArray(value.files)) {
        if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now() && value.finalizing !== true) {
          localStorage.removeItem(uploadBatchKey);
          setUploadMessage('The saved batch expired after 24 hours. Start a new batch to upload these files again.', 'error');
        } else {
          activeBatch = value;
        }
      }
    } catch {
      setUploadMessage('A saved upload batch could not be read. You can start a new batch.', 'error');
    }
    renderUploadQueue();
  }

  async function getUploadAuth(captchaToken = '') {
    const anonKey = params.get('anon_key') || '';
    const apiUrl = new URL(requestedFile).origin;
    if (!uploadAuthClient) {
      uploadAuthClient = createClient(apiUrl, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'study-hub-contribution-auth-v1',
        },
      });
    }
    let { data: { session }, error } = await uploadAuthClient.auth.getSession();
    if (error) throw error;
    if (!session) {
      const result = await uploadAuthClient.auth.signInAnonymously({
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (result.error) throw result.error;
      session = result.data.session;
    }
    if (!session) throw new Error('Could not create a private upload session.');
    return session;
  }

  async function callContributionFunction(functionName, body) {
    const session = await getUploadAuth(
      typeof body.turnstileToken === 'string' ? body.turnstileToken : captchaResponse,
    );
    const apiUrl = new URL(requestedFile).origin;
    const response = await fetch(new URL(`/functions/v1/${functionName}`, apiUrl), {
      method: 'POST',
      headers: {
        apikey: params.get('anon_key') || '',
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Upload request failed (HTTP ${response.status}).`);
    return result;
  }

  async function refreshStagedFiles() {
    if (!activeBatch) return;
    const session = await getUploadAuth();
    const userId = session.user.id;
    const { data, error } = await uploadAuthClient.storage
      .from('study-hub-contributions')
      .list(`staging/${userId}/${activeBatch.sessionId}`, { limit: 25 });
    if (error) throw error;
    const stagedNames = new Set((data || []).map((entry) => entry.name));
    for (const file of activeBatch.files) {
      if (stagedNames.has(file.path.split('/').pop())) {
        file.status = 'staged';
        file.progress = 100;
      } else {
        file.status = 'needs-file';
      }
    }
    persistUploadBatch();
    renderUploadQueue();
  }

  function validateSelectedFiles(files) {
    const allowed = new Map([
      ['application/pdf', '.pdf'],
      ['application/msword', '.doc'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
      ['application/rtf', '.rtf'],
      ['text/plain', '.txt'],
    ]);
    if (files.length < 1 || files.length > 20) throw new Error('Select between 1 and 20 files.');
    let total = 0;
    for (const file of files) {
      const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
      if (allowed.get(file.type) !== extension) throw new Error(`${file.name} has an unsupported type or mismatched extension.`);
      if (file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error(`${file.name} must be no larger than 50 MB.`);
      total += file.size;
    }
    if (total > 250 * 1024 * 1024) throw new Error('The batch must be no larger than 250 MB.');
  }

  async function uploadFile(file, record) {
    const session = await getUploadAuth();
    const apiUrl = new URL(requestedFile);
    const projectId = apiUrl.hostname.split('.')[0];
    const endpoint = apiUrl.hostname.endsWith('.supabase.co')
      ? `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`
      : new URL('/storage/v1/upload/resumable', apiUrl.origin).href;

    await new Promise((resolve, reject) => {
      let lastPersisted = 0;
      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          apikey: params.get('anon_key') || '',
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: 'study-hub-contributions',
          objectName: record.path,
          contentType: file.type,
          cacheControl: '3600',
        },
        onError(error) {
          reject(error);
        },
        onProgress(bytesUploaded, bytesTotal) {
          record.progress = bytesTotal ? (bytesUploaded / bytesTotal) * 100 : 0;
          if (Date.now() - lastPersisted > 300) {
            lastPersisted = Date.now();
            persistUploadBatch();
            renderUploadQueue();
          }
        },
        onSuccess() {
          record.status = 'staged';
          record.progress = 100;
          persistUploadBatch();
          renderUploadQueue();
          resolve();
        },
      });
      upload.findPreviousUploads()
        .then((previousUploads) => {
          if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
          upload.start();
        })
        .catch(reject);
    });
  }

  async function transferBatch(files) {
    if (processingQueue) return;
    processingQueue = true;
    const pending = activeBatch.files.filter((item) => item.status !== 'staged');
    let nextIndex = 0;
    let failed = false;
    const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (nextIndex < pending.length) {
        const item = pending[nextIndex++];
        const file = files.find((candidate) => candidate.name === item.name && candidate.size === item.size && candidate.type === item.type);
        if (!file) {
          item.status = 'needs-file';
          failed = true;
          renderUploadQueue();
          continue;
        }
        item.status = 'uploading';
        item.progress = 0;
        renderUploadQueue();
        try {
          await uploadFile(file, item);
        } catch (error) {
          item.status = 'failed';
          failed = true;
          setUploadMessage(error instanceof Error ? error.message : `Could not upload ${item.name}.`, 'error');
          renderUploadQueue();
        }
        persistUploadBatch();
      }
    });
    await Promise.all(workers);
    processingQueue = false;
    updateSubmitButton();
    if (!failed && isBatchReady()) setUploadMessage('All files are safely staged. Submit the batch when you are ready.', 'success');
    else if (!uploadStatus.dataset.state || uploadStatus.dataset.state !== 'error') setUploadMessage('Reselect any unfinished files to resume the private upload.');
  }

  async function startSelectedBatch() {
    if (!selectedFiles.length || !captchaResponse || processingQueue || startingBatch) return;
    startingBatch = true;
    const rightsConfirmed = contributionForm.querySelector('[name="rights_confirmed"]').checked;
    if (!rightsConfirmed) {
      setUploadMessage('Confirm that you have permission to share each selected file.');
      startingBatch = false;
      return;
    }
    try {
      validateSelectedFiles(selectedFiles);
      if (activeBatch) {
        const sameBatch = activeBatch.files.length === selectedFiles.length && activeBatch.files.every((item) =>
          selectedFiles.some((file) => file.name === item.name && file.size === item.size && file.type === item.type));
        if (!sameBatch) {
          setUploadMessage('A saved batch already exists. Resume it with the same files or discard it first.', 'error');
          return;
        }
        activeBatch.files.forEach((item) => {
          if (item.status === 'needs-file' || item.status === 'failed') item.status = 'queued';
        });
      } else {
        setUploadMessage('Preparing a private upload session…');
        const response = await callContributionFunction('start-resource-contribution', {
          files: selectedFiles.map((file) => ({ name: file.name, size: file.size, type: file.type })),
          rightsConfirmed: true,
          turnstileToken: captchaResponse,
        });
        activeBatch = {
          sessionId: response.sessionId,
          expiresAt: response.expiresAt,
          files: response.files.map((file) => ({ ...file, status: 'queued', progress: 0 })),
        };
        persistUploadBatch();
        if (window.turnstile && captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
        captchaResponse = '';
      }
      renderUploadQueue();
      await transferBatch(selectedFiles);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Could not prepare this batch.', 'error');
      captchaResponse = '';
      if (window.turnstile && captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
    } finally {
      startingBatch = false;
      renderUploadQueue();
    }
  }

  async function discardUploadBatch() {
    if (!activeBatch) return;
    try {
      await callContributionFunction('cancel-resource-contribution', { sessionId: activeBatch.sessionId });
      activeBatch = null;
      selectedFiles = [];
      fileInput.value = '';
      persistUploadBatch();
      renderUploadQueue();
      setUploadMessage('The staged batch was discarded.');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Could not discard this batch.', 'error');
    }
  }

  async function initializeTurnstile() {
    const anonKey = params.get('anon_key') || '';
    const siteKey = params.get('turnstile_key') || '';
    if (!requestedFile || !anonKey || !siteKey) {
      setUploadMessage('Uploads are not configured for this link yet.');
      return;
    }

    contributionForm.hidden = false;
    restoreUploadBatch();
    if (activeBatch) {
      try {
        await refreshStagedFiles();
        setUploadMessage('A saved batch was found. Reselect the original files to resume any unfinished transfers.');
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : 'Could not restore the saved upload batch.', 'error');
      }
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.turnstile) {
        setUploadMessage('Verification could not load. Please try again later.', 'error');
        return;
      }
      captchaWidgetId = window.turnstile.render('#turnstile-widget', {
        sitekey: siteKey,
        callback(token) {
          captchaResponse = token;
          updateSubmitButton();
          if (selectedFiles.length) void startSelectedBatch();
        },
        'expired-callback'() {
          captchaResponse = '';
          updateSubmitButton();
        },
        'error-callback'() {
          captchaResponse = '';
          updateSubmitButton();
          setUploadMessage('Verification failed to load. Please try again later.', 'error');
        },
      });
    };
    script.onerror = () => setUploadMessage('Verification could not load. Please try again later.', 'error');
    document.head.append(script);

    fileInput.addEventListener('change', () => {
      selectedFiles = Array.from(fileInput.files || []);
      if (!selectedFiles.length) return;
      try {
        validateSelectedFiles(selectedFiles);
        if (activeBatch && activeBatch.files.some((item) => item.status === 'staged')) {
          setUploadMessage('Resume the saved batch by reselecting all its original files.');
        }
        if (!captchaResponse) {
          setUploadMessage('Complete verification to begin staging the selected files.');
          return;
        }
        void startSelectedBatch();
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : 'These files cannot be uploaded.', 'error');
      }
    });
    contributionForm.querySelector('[name="rights_confirmed"]').addEventListener('change', () => {
      if (selectedFiles.length && captchaResponse) void startSelectedBatch();
    });

    contributionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!captchaResponse || !isBatchReady()) {
        setUploadMessage('Finish staging every file and complete verification before submitting.', 'error');
        return;
      }
      submitButton.disabled = true;
      setUploadMessage('Submitting the staged files to the private contribution inbox…');
      try {
        activeBatch.finalizing = true;
        persistUploadBatch();
        renderUploadQueue();
        await callContributionFunction('finalize-resource-contribution', {
          sessionId: activeBatch.sessionId,
          turnstileToken: captchaResponse,
        });
        activeBatch = null;
        selectedFiles = [];
        fileInput.value = '';
        contributionForm.querySelector('[name="rights_confirmed"]').checked = false;
        persistUploadBatch();
        renderUploadQueue();
        captchaResponse = '';
        if (window.turnstile && captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
        setUploadMessage('Thank you. The files are private and will be reviewed before they are added to the library.', 'success');
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired')) {
          activeBatch = null;
          persistUploadBatch();
          renderUploadQueue();
        }
        captchaResponse = '';
        if (window.turnstile && captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
        if (error instanceof Error && error.message.includes('not fully uploaded yet')) {
          try {
            await refreshStagedFiles();
          } catch (refreshError) {
            setUploadMessage(refreshError instanceof Error ? refreshError.message : 'Could not check upload progress.', 'error');
          }
        }
        setUploadMessage(error instanceof Error ? error.message : 'The batch could not be submitted.', 'error');
        updateSubmitButton();
      }
    });
  }

  function toggleContributionPanel(open) {
    const shouldOpen = open ?? !document.body.classList.contains('contribution-panel-open');
    if (shouldOpen) toggleRelatedPanel(false);
    document.body.classList.toggle('contribution-panel-open', shouldOpen);
    document.querySelector('#contribution-rail').setAttribute('aria-hidden', String(!shouldOpen));
    contributionToggle.setAttribute('aria-expanded', String(shouldOpen));
    contributionToggle.setAttribute('aria-label', shouldOpen ? 'Close resource sharing panel' : 'Open resource sharing panel');
    contributionToggle.title = shouldOpen ? 'Close resource sharing panel' : 'Share a resource';
    syncDrawerBackdrop();
  }

  function toggleRelatedPanel(open) {
    const shouldOpen = open ?? !document.body.classList.contains('related-panel-open');
    if (shouldOpen) toggleContributionPanel(false);
    document.body.classList.toggle('related-panel-open', shouldOpen);
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    relatedRail.setAttribute('aria-hidden', String(isMobile && !shouldOpen));
    relatedToggle.setAttribute('aria-expanded', String(shouldOpen));
    relatedToggle.setAttribute('aria-label', shouldOpen ? 'Close related documents' : 'Open related documents');
    relatedToggle.title = shouldOpen ? 'Close related documents' : 'Related documents';
    syncDrawerBackdrop();
  }

  function syncDrawerBackdrop() {
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const relatedOpen = isMobile && document.body.classList.contains('related-panel-open');
    const contributionOpen = document.body.classList.contains('contribution-panel-open');
    drawerBackdrop.hidden = !relatedOpen && !contributionOpen;
  }

  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-a]');
    if (!button) return;
    switch (button.dataset.a) {
      case 'back':
        goBack();
        break;
      case 'prev':
        scrollToPage(activePage - 1);
        break;
      case 'next':
        scrollToPage(activePage + 1);
        break;
      case 'search':
        if (pdfDocument) void findInPdf();
        else {
          const query = window.prompt('Find text in this document');
          if (query) window.find(query);
        }
        break;
      case 'full':
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else if (document.querySelector('.reader-layout').requestFullscreen) {
          void document.querySelector('.reader-layout').requestFullscreen().catch(() => {
            notice.textContent = 'Full screen mode is unavailable in this browser.';
          });
        }
        break;
      case 'contribute':
        toggleContributionPanel();
        break;
      case 'related':
        toggleRelatedPanel();
        break;
      case 'close-contribution':
        toggleContributionPanel(false);
        break;
      case 'close-related':
        toggleRelatedPanel(false);
        break;
      case 'close-drawers':
        toggleRelatedPanel(false);
        toggleContributionPanel(false);
        break;
      case 'contents':
        readingPanel.hidden = !readingPanel.hidden;
        contentsButton.setAttribute('aria-expanded', String(!readingPanel.hidden));
        break;
      case 'close-reading-panel':
        readingPanel.hidden = true;
        contentsButton.setAttribute('aria-expanded', 'false');
        break;
    }
  });
  readingPanel.querySelector('[data-a="close-reading-panel"]').addEventListener('click', () => {
    readingPanel.hidden = true;
    contentsButton.setAttribute('aria-expanded', 'false');
  });
  document.querySelector('[data-a="close-contribution"]').addEventListener('click', () => toggleContributionPanel(false));
  document.querySelector('.related-share').addEventListener('click', () => toggleContributionPanel(true));
  relatedRetry.addEventListener('click', () => void loadRelatedDocuments());
  drawerBackdrop.addEventListener('click', () => {
    toggleRelatedPanel(false);
    toggleContributionPanel(false);
  });
  bookmarkButton.addEventListener('click', toggleBookmark);
  colorSelect.addEventListener('change', () => applyReadingColor(colorSelect.value));

  pageInput.addEventListener('change', () => scrollToPage(pageInput.value));
  pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pageInput.dispatchEvent(new Event('change'));
      pageInput.blur();
    }
  });

  zoomSelect.addEventListener('change', () => {
    const selectedZoom = zoomSelect.value === 'fit' ? 1 : Number(zoomSelect.value);
    if (pdfDocument) {
      zoom = selectedZoom;
      resetRenderedPages();
    } else if (!documentContent.hidden) {
      documentContent.style.zoom = String(selectedZoom);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleRelatedPanel(false);
      toggleContributionPanel(false);
      readingPanel.hidden = true;
      contentsButton.setAttribute('aria-expanded', 'false');
    }
  });

  async function start() {
    let fileUrl = new URL('sample.pdf', window.location.href);
    if (requestedFile) {
      try {
        fileUrl = new URL(requestedFile);
      } catch {
        showError('This resource link is invalid. Return to the library and try again.');
        return;
      }

      if (!fileUrl.href.startsWith(storagePrefix)) {
        showError('This resource is not hosted in the public Study Hub library. Return to the library and try again.');
        return;
      }
    }

    toolbar.hidden = false;
    toggleContributionPanel(false);
    toggleRelatedPanel(false);
    void loadRelatedDocuments();
    void initializeTurnstile();
    const extension = fileUrl.pathname.split('.').pop().toLowerCase();
    bookmarkButton.hidden = !['pdf', 'docx', 'rtf'].includes(extension);
    try {
      if (extension === 'pdf') {
        await loadPdf(fileUrl);
        return;
      }

      documentReader.hidden = false;
      document.querySelector('[data-a="search"]').hidden = !['docx', 'rtf'].includes(extension);
      zoomControl.hidden = !['docx', 'rtf'].includes(extension);
      if (['docx', 'rtf'].includes(extension)) {
        const response = await fetch(fileUrl.href);
        if (!response.ok) throw new Error(`Resource request failed (HTTP ${response.status}).`);
        const data = await response.arrayBuffer();
        documentContent.hidden = false;
        if (extension === 'docx') {
          await window.docx.renderAsync(data, documentContent, documentContent);
        } else {
          const documentData = new window.RTFJS.Document(data);
          documentContent.replaceChildren(...await documentData.render());
        }
        await buildContents();
        applyReadingColor(readerState.color || 'original');
        renderBookmarks();
      } else if (extension === 'doc') {
        documentFrame.title = `${title} reader`;
        documentFrame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl.href)}`;
        documentFrame.hidden = false;
        applyReadingColor(readerState.color || 'original');
        renderBookmarks();
      } else {
        documentFrame.title = `${title} reader`;
        documentFrame.src = fileUrl.href;
        documentFrame.hidden = false;
        applyReadingColor(readerState.color || 'original');
        renderBookmarks();
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'This document could not be opened.');
    }
  }

  void start();
})();
