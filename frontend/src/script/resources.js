// frontend/src/script/resources.js
//
// Renders Study Hub libraries from the public resource catalog, loading pages
// on demand and using the generated manifest only as a fallback.
//
// Any element with [data-resources] becomes a list:
//   <ul data-resources data-subject="chemistry" data-category="papers" data-limit="20"></ul>
//
// Optional companions, keyed with "subject|category":
//   <input data-resource-search="chemistry|papers">
//   <select data-resource-filter="chemistry|papers"></select>
//   <p data-resource-status="chemistry|papers"></p>

(function () {
  'use strict';

  let MANIFEST = window.STUDY_HUB_RESOURCES || null;
  let manifestLoadPromise = null;
  const SUPABASE_CONFIG = {
    url: document.querySelector('meta[name="study-hub-supabase-url"]')?.content || MANIFEST?.projectUrl || '',
    anonKey: document.querySelector('meta[name="study-hub-supabase-anon-key"]')?.content || ''
  };
  const READER_PAGE = document.querySelector('meta[name="study-hub-reader-url"]')?.content || '/STUDY-HUB/full_page_flipbook_viewer/index.html';
  const SUPABASE_TABLE = 'study_hub_resources';
  const PAGE_SIZE = 100;

  function publicStorageUrl(bucket, storagePath, projectUrl = SUPABASE_CONFIG.url) {
    const encodedPath = String(storagePath)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${String(projectUrl).replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  function loadManifestFallback() {
    if (MANIFEST) return Promise.resolve(MANIFEST);
    if (manifestLoadPromise) return manifestLoadPromise;
    manifestLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../data/resources.js', window.location.href).href;
      script.onload = () => {
        MANIFEST = window.STUDY_HUB_RESOURCES || null;
        if (!MANIFEST || !Array.isArray(MANIFEST.items)) {
          reject(new Error('The fallback resource index is invalid.'));
          return;
        }
        resolve(MANIFEST);
      };
      script.onerror = () => reject(new Error('The fallback resource index could not be loaded.'));
      document.head.appendChild(script);
    });
    return manifestLoadPromise;
  }


  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function typeLabel(type) {
    const labels = {
      paper: 'Past paper',
      guide: 'Marking guide',
      notes: 'Notes',
      other: 'Document'
    };
    return labels[type] || 'Document';
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function searchKeywords(item) {
    return normalizeSearchText([
      item.title,
      item.originalFilename,
      item.storagePath || item.storage_path,
      item.subject,
      item.category,
      item.level,
      item.year,
      item.resourceType || item.resource_type,
      item.extension
    ].filter(Boolean).join(' '));
  }

  function matchesSearch(item, query) {
    const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const keywords = searchKeywords(item).split(/\s+/).filter(Boolean);
    return terms.every((term) => keywords.some((keyword) => keyword.startsWith(term)));
  }

  function searchRelevance(item, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return 0;
    const title = normalizeSearchText(item.title || '');
    const filename = normalizeSearchText(item.originalFilename || '');
    if (title === normalizedQuery) return 3;
    if (title.startsWith(normalizedQuery)) return 2;
    if (filename.startsWith(normalizedQuery)) return 1;
    return 0;
  }

  function resourceGroup(item) {
    if (item.resourceType === 'notes' || item.resourceType === 'guide') return 'notes';
    if (item.resourceType === 'paper') return 'papers';
    if (item.category === 'notes') return 'notes';
    if (item.category === 'papers') return 'papers';
    return 'other';
  }

  function classifyResourceType(item) {
    const filename = String(item.originalFilename || item.original_filename || item.title || '').toLowerCase();
    const category = item.category;
    const existingType = item.resourceType || item.resource_type;
    if (/(marking guide|marking scheme|answers?|solutions?|\bguides?\b|\bmg\b)/.test(filename)) return 'guide';
    if (/(coursebook|textbook|encyclopedia|\bbook\b|\bnotes\b|syllabus|curriculum|course outline|handout|summary)/.test(filename)) return 'notes';
    if (/(paper|\bpp?\s?[1-4]\b|\bp\s?\.?\s?[1-4]\b|mock|exam|test|\beot\b|premock|postmock|seminar|assignment|revision|assessment|scenario|trial|workshop|question bank|sample set|\bitems?\b|end of term|end of year|mid[- ]?term)/.test(filename)) return 'paper';
    if (existingType && existingType !== 'other') return existingType;
    if (category === 'notes') return 'notes';
    if (category === 'papers') return 'paper';
    return existingType || 'other';
  }

  function isUsableResource(item) {
    const storagePath = item.storagePath || item.storage_path || '';
    return !storagePath.split('/').includes('.emptyFolderPlaceholder') &&
      Number(item.sizeBytes ?? item.size_bytes) > 0;
  }

  function timestamp(value) {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function metaLine(item) {
    return [item.level, item.year, typeLabel(item.resourceType), formatBytes(item.sizeBytes)]
      .filter(Boolean)
      .join(' \u00b7 ');
  }

  function matches(item, query, level) {
    if (level && item.level !== level) return false;
    return matchesSearch(item, query);
  }

  function buildItem(item) {
    const row = document.createElement('div');
    row.className = 'resource-item';

    const link = document.createElement('a');
    link.className = 'resource-link';
    const readerUrl = new URL(READER_PAGE, window.location.href);
    readerUrl.searchParams.set('file', item.publicUrl);
    readerUrl.searchParams.set('title', item.title || item.originalFilename || 'Study Hub resource');
    if (item.subject) readerUrl.searchParams.set('subject', item.subject);
    readerUrl.searchParams.set('return', window.location.href);
    if (SUPABASE_CONFIG.anonKey) readerUrl.searchParams.set('anon_key', SUPABASE_CONFIG.anonKey);
    link.href = readerUrl.href;
    link.textContent = item.title || item.originalFilename;

    const meta = document.createElement('span');
    meta.className = 'resource-meta';
    meta.textContent = metaLine(item);

    row.appendChild(link);
    row.appendChild(meta);
    return row;
  }


  async function fetchCatalogPage(subjects, { category, offset = 0, order } = {}) {
    const catalogUrl = String(SUPABASE_CONFIG.url || '').replace(/\/+$/, '');
    const anonKey = SUPABASE_CONFIG.anonKey || '';
    if (!catalogUrl || !anonKey) {
      await loadManifestFallback();
      const filtered = MANIFEST.items.filter((item) => {
        if (!isUsableResource(item)) return false;
        if (!subjects.has(item.subject)) return false;
        return true;
      }).map((item) => ({
        ...item,
        resourceType: classifyResourceType(item),
        storagePath: item.storagePath || item.storage_path,
        publicUrl: item.publicUrl || publicStorageUrl(item.storageBucket || item.storage_bucket, item.storagePath || item.storage_path)
      })).filter((item) => {
        if (!category) return true;
        if (category === 'notes') return resourceGroup(item) === 'notes';
        if (category === 'papers') return resourceGroup(item) === 'papers';
        return item.category === category;
      });
      const page = filtered.slice(offset, offset + PAGE_SIZE);
      return { items: page, total: filtered.length, scanned: page.length, hasMore: offset + page.length < filtered.length };
    }

    const endpoint = new URL(`${catalogUrl}/rest/v1/${SUPABASE_TABLE}`);
    endpoint.searchParams.set(
      'select',
      'subject,category,storage_bucket,storage_path,original_filename,title,extension,size_bytes,level,year,resource_type,uploaded_at,updated_at'
    );
    endpoint.searchParams.set('subject', `in.(${Array.from(subjects).join(',')})`);
    endpoint.searchParams.set('size_bytes', 'gt.0');
    if (category === 'notes') endpoint.searchParams.set('or', '(resource_type.in.(notes,guide),and(category.eq.notes,resource_type.eq.other),and(category.eq.notes,resource_type.is.null),resource_type.eq.other,and(category.is.null,resource_type.is.null))');
    else if (category === 'papers') endpoint.searchParams.set('or', '(resource_type.eq.paper,and(category.eq.papers,resource_type.eq.other),and(category.eq.papers,resource_type.is.null),resource_type.eq.other,and(category.is.null,resource_type.is.null))');
    else if (category) endpoint.searchParams.set('category', `eq.${category}`);
    endpoint.searchParams.set('order', order || 'uploaded_at.desc.nullslast,title.asc,storage_path.asc');
    endpoint.searchParams.set('limit', String(PAGE_SIZE));
    endpoint.searchParams.set('offset', String(offset));

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'count=exact'
      }
    });
    if (!response.ok) throw new Error(`Resource catalog request failed (HTTP ${response.status}).`);

    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('The resource catalog returned an invalid response.');
    const contentRange = response.headers.get('content-range') || '';
    const totalFromHeader = Number(contentRange.split('/')[1]);
    const total = Number.isFinite(totalFromHeader) ? totalFromHeader : null;
    const mappedItems = page.map((item) => ({
      title: item.title,
      originalFilename: item.original_filename,
      storagePath: item.storage_path,
      subject: item.subject,
      category: item.category,
      extension: item.extension,
      sizeBytes: item.size_bytes,
      level: item.level,
      year: item.year,
      resourceType: classifyResourceType(item),
      uploadedAt: item.uploaded_at,
      updatedAt: item.updated_at,
      publicUrl: publicStorageUrl(item.storage_bucket, item.storage_path, catalogUrl)
    }));
    const items = mappedItems.filter((item) => {
      if (!category) return true;
      if (category === 'notes') return resourceGroup(item) === 'notes';
      if (category === 'papers') return resourceGroup(item) === 'papers';
      return item.category === category;
    });

    return {
      items,
      total: category ? null : total,
      scanned: page.length,
      hasMore: page.length === PAGE_SIZE && (total === null || offset + page.length < total)
    };
  }

  function createDashboardCatalog(subjects) {
    const catalog = { items: [], total: null, hasMore: true, offset: 0, pending: null };

    async function loadNext() {
      if (catalog.pending) return catalog.pending;
      if (!catalog.hasMore) return catalog;

      catalog.pending = fetchCatalogPage(subjects, { offset: catalog.offset }).then((page) => {
        const existing = new Set(catalog.items.map((item) => item.storagePath));
        page.items.forEach((item) => {
          if (!existing.has(item.storagePath)) catalog.items.push(item);
        });
        catalog.offset += page.scanned ?? page.items.length;
        catalog.total = page.total ?? catalog.total;
        catalog.hasMore = page.hasMore;
        return catalog;
      }).finally(() => {
        catalog.pending = null;
      });

      return catalog.pending;
    }

    async function loadAll(onPage) {
      while (catalog.hasMore) {
        await loadNext();
        onPage?.();
      }
      return catalog;
    }

    return { ...catalog, get items() { return catalog.items; }, get total() { return catalog.total; }, get hasMore() { return catalog.hasMore; }, loadNext, loadAll };
  }

  function renderDashboardLibraries() {
    document.querySelectorAll('[data-dashboard-library]').forEach((library) => {
      const aliases = (library.dataset.dashboardAliases || '').split(',').filter(Boolean);
      const subjects = new Set([library.dataset.dashboardSubject, ...aliases]);
      let all = [];
      const queryInput = library.querySelector('[data-dashboard-query]');
      const levelSelect = library.querySelector('[data-dashboard-level]');
      const yearSelect = library.querySelector('[data-dashboard-year]');
      const globalStatus = library.querySelector('[data-dashboard-status]');
      const totalLabel = library.querySelector('[data-dashboard-total]');
      const readerPage = library.dataset.dashboardReader || READER_PAGE;
      const returnUrl = library.dataset.dashboardReturn || window.location.href;
      const anonKey = SUPABASE_CONFIG.anonKey || '';
      const collections = new Map();
      const catalog = createDashboardCatalog(subjects);
      let searchTimer = 0;
      let searchingAll = false;

      function populateFilters() {
        for (const [select, values] of [
          [levelSelect, Array.from(new Set(all.map((item) => item.level).filter(Boolean))).sort()],
          [yearSelect, Array.from(new Set(all.map((item) => item.year).filter(Boolean))).sort((left, right) => Number(right) - Number(left))]
        ]) {
          if (!select) continue;
          const selected = select.value;
          const existing = new Set(Array.from(select.options, (option) => option.value));
          for (const value of values) {
            if (existing.has(String(value))) continue;
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            select.appendChild(option);
          }
          select.value = selected;
        }
      }

      function updateDashboardStats() {
        const resourceCount = document.querySelector('[data-dashboard-stat="resources"]');
        const countSuffix = catalog.hasMore ? '+' : '';
        if (resourceCount) resourceCount.textContent = catalog.total === null
          ? `${all.length}${countSuffix}`
          : String(catalog.total);
        const counts = {
          notes: all.filter((item) => resourceGroup(item) === 'notes').length,
          papers: all.filter((item) => resourceGroup(item) === 'papers').length,
          levels: new Set(all.map((item) => item.level).filter(Boolean)).size
        };
        Object.entries(counts).forEach(([key, value]) => {
          const stat = document.querySelector(`[data-dashboard-stat="${key}"]`);
          if (stat) stat.textContent = `${value}${countSuffix}`;
        });
        if (totalLabel) totalLabel.textContent = catalog.total !== null
          ? `${catalog.total} resources`
          : catalog.hasMore ? `${all.length}+ loaded` : `${all.length} resources`;
      }

      function resourceHref(item) {
        const query = new URLSearchParams({
          file: item.publicUrl || publicStorageUrl(item.storageBucket || item.storage_bucket, item.storagePath || item.storage_path),
          title: item.title || item.originalFilename || 'Study Hub resource',
          return: returnUrl
        });
        if (item.subject) query.set('subject', item.subject);
        if (anonKey) query.set('anon_key', anonKey);
        return `${readerPage}?${query}`;
      }

      function createCard(item) {
        const card = document.createElement('a');
        card.className = 'dashboard-resource-card';
        card.href = resourceHref(item);
        card.setAttribute('aria-label', `Open ${item.title || item.originalFilename || 'study resource'}`);

        const preview = document.createElement('span');
        preview.className = 'dashboard-preview';
        const extension = String(item.extension || '').toLowerCase();
        preview.dataset.previewFormat = extension;
        preview.dataset.previewWorker = new URL('js/pdf.worker.min.js', new URL(readerPage, window.location.href)).href;
        const previewable = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'].includes(extension);
        if (previewable) preview.dataset.previewUrl = item.publicUrl;
        const placeholder = document.createElement('span');
        placeholder.className = 'dashboard-preview-placeholder';
        placeholder.textContent = item.resourceType === 'paper' ? 'âœ' : item.resourceType === 'notes' || item.resourceType === 'guide' ? 'â–¤' : 'â–§';
        preview.appendChild(placeholder);
        if (previewable) {
          const caption = document.createElement('span');
          caption.className = 'dashboard-preview-caption';
          caption.textContent = 'Loading page previewâ€¦';
          preview.appendChild(caption);
        } else {
          const caption = document.createElement('span');
          caption.className = 'dashboard-preview-caption';
          caption.textContent = `${extension ? extension.toUpperCase() : 'FILE'} Â· Open to view`;
          preview.appendChild(caption);
        }

        const type = document.createElement('span');
        type.className = 'dashboard-resource-type';
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.resourceType === 'paper' ? 'âœ' : item.resourceType === 'notes' ? 'â–¤' : item.resourceType === 'guide' ? 'âœ“' : 'â–§';
        const format = document.createElement('span');
        format.textContent = item.extension ? `${item.extension.toUpperCase()} resource` : 'Study resource';
        type.append(icon, format);

        const copy = document.createElement('span');
        copy.className = 'dashboard-resource-copy';
        const title = document.createElement('span');
        title.className = 'dashboard-card-title';
        title.textContent = item.title || item.originalFilename || 'Untitled resource';
        const meta = document.createElement('span');
        meta.className = 'dashboard-card-meta';
        meta.textContent = [item.level, item.year, item.resourceType === 'guide' ? 'Study guide' : item.resourceType === 'notes' ? 'Notes' : item.resourceType === 'paper' ? 'Past paper' : 'Study resource']
          .filter(Boolean)
          .join(' Â· ');
        copy.append(title, meta);
        card.append(preview, type, copy);
        return card;
      }

      function matchesDashboardSearch(item, query, level, year) {
        if (level && item.level !== level) return false;
        if (year && String(item.year || '') !== year) return false;
        return matchesSearch(item, query);
      }

      function setEmpty(row, message) {
        row.replaceChildren();
        const empty = document.createElement('p');
        empty.className = 'dashboard-resource-empty';
        empty.textContent = message;
        row.appendChild(empty);
      }

      function updateCollectionStatus(name) {
        const state = collections.get(name);
        const status = document.querySelector(`[data-dashboard-collection-status="${name}"]`);
        if (!state || !status) return;
        const shown = state.rows.reduce((total, row) => total + row.rendered, 0);
        const queryActive = Boolean(queryInput?.value.trim() || levelSelect?.value || yearSelect?.value);
        if (shown >= state.items.length && catalog.hasMore) {
          status.textContent = `Showing ${shown} loaded resources. Scroll to load more.`;
        } else if (shown >= state.items.length && !catalog.hasMore) {
          status.textContent = `All ${state.items.length} matching resources are shown.`;
        } else {
          const searchingNote = queryActive && catalog.hasMore ? ' Search continues in the full collection.' : '';
          status.textContent = `Showing ${shown} of ${state.items.length} loaded resources.${searchingNote}`;
        }
      }

      function appendBatch(name, rowState) {
        if (rowState.loading || rowState.next >= rowState.items.length) return;
        rowState.loading = true;
        const batch = rowState.items.slice(rowState.next, rowState.next + 8);
        const fragment = document.createDocumentFragment();
        batch.forEach((item) => fragment.appendChild(createCard(item)));
        rowState.element.appendChild(fragment);
        rowState.next += batch.length;
        rowState.rendered = rowState.next;
        rowState.loading = false;
        updateCollectionStatus(name);
        updateRowControls(rowState.element);
      }

      function updateRowControls(row) {
        const rowIndex = row.dataset.row;
        const collection = row.dataset.dashboardRow;
        const controls = document.querySelectorAll(`[data-dashboard-scroll="${collection}"][data-row="${rowIndex}"]`);
        const maxScroll = row.scrollWidth - row.clientWidth;
        controls.forEach((control) => {
          const direction = Number(control.dataset.direction);
          control.disabled = direction < 0 ? row.scrollLeft <= 1 : row.scrollLeft >= maxScroll - 1;
        });
      }

      function refresh(preserveProgress = false) {
        const query = queryInput?.value.trim().toLocaleLowerCase() || '';
        const level = levelSelect?.value || '';
        const year = yearSelect?.value || '';
        const filtered = all.filter((item) => matchesDashboardSearch(item, query, level, year));
        const recent = [...filtered].sort((left, right) =>
          timestamp(right.uploadedAt || right.createdAt || right.updatedAt) -
            timestamp(left.uploadedAt || left.createdAt || left.updatedAt) ||
          (left.title || left.originalFilename || '').localeCompare(right.title || right.originalFilename || '')
        );
        const notes = filtered
          .filter((item) => resourceGroup(item) === 'notes')
          .sort((left, right) => {
            if (catalog.hasMore) {
              return timestamp(right.uploadedAt || right.updatedAt) - timestamp(left.uploadedAt || left.updatedAt);
            }
            return searchRelevance(right, query) - searchRelevance(left, query) ||
              (left.title || left.originalFilename || '').localeCompare(right.title || right.originalFilename || '');
          });
        if (globalStatus) {
          const searchDescription = query || level || year;
          globalStatus.textContent = catalog.hasMore
            ? `${filtered.length} matching resource${filtered.length === 1 ? '' : 's'} in ${all.length} loaded. ${searchDescription ? 'Searching the full collectionâ€¦' : 'Scroll a row to load more.'}`
            : `${filtered.length} matching resource${filtered.length === 1 ? '' : 's'} found. Recently added and study notes are shown below.`;
        }

        for (const [name, items] of [['recent', recent], ['notes', notes]]) {
          const section = document.querySelector(`[data-dashboard-collection="${name}"][data-dashboard-parent="${library.dataset.dashboardSubject}"]`);
          const rows = Array.from(section?.querySelectorAll('[data-dashboard-row]') || []);
          const previousStates = collections.get(name)?.rows || [];
          const prior = rows.map((row, index) => ({
            scrollLeft: preserveProgress ? row.scrollLeft : 0,
            rendered: preserveProgress ? previousStates[index]?.rendered || 0 : 0
          }));
          rows.forEach((row) => {
            row.onscroll = null;
            row.replaceChildren();
          });
          const partitions = [[], []];
          items.forEach((item, index) => partitions[index % 2].push(item));
          const rowStates = rows.map((row, index) => ({
            element: row,
            items: partitions[index] || [],
            next: 0,
            rendered: 0,
            loading: false
          }));
          collections.set(name, { items, rows: rowStates });

          rowStates.forEach((rowState) => {
            const rowIndex = Number(rowState.element.dataset.row);
            if (rowState.items.length) {
              const targetRendered = prior[rowIndex]?.rendered || 0;
              while (rowState.rendered < targetRendered) appendBatch(name, rowState);
              if (rowState.rendered === 0) appendBatch(name, rowState);
            } else if (!catalog.hasMore) {
              setEmpty(rowState.element, name === 'notes' ? 'No study notes or guides match these filters.' : 'No recently added resources match these filters.');
            } else {
              setEmpty(rowState.element, 'More resources will load as you browse this collection.');
            }
            rowState.element.scrollLeft = prior[rowIndex]?.scrollLeft || 0;
            rowState.element.onscroll = () => {
              if (rowState.element.scrollWidth - rowState.element.scrollLeft - rowState.element.clientWidth < 320) {
                void loadMoreForRow(name, rowIndex);
              }
              updateRowControls(rowState.element);
            };
            updateRowControls(rowState.element);
          });
          updateCollectionStatus(name);
        }
      }

      async function loadMoreForRow(name, rowIndex) {
        const state = collections.get(name);
        const rowState = state?.rows[rowIndex];
        if (!rowState || rowState.loading) return;
        if (rowState.next < rowState.items.length) {
          appendBatch(name, rowState);
          return;
        }
        if (!catalog.hasMore) return;

        rowState.loading = true;
        try {
          await catalog.loadNext();
          all = catalog.items;
          populateFilters();
          updateDashboardStats();
          refresh(true);
          const updatedState = collections.get(name)?.rows[rowIndex];
          if (updatedState && updatedState.next < updatedState.items.length) appendBatch(name, updatedState);
          else if (catalog.hasMore) void loadMoreForRow(name, rowIndex);
        } catch (error) {
          console.error('Unable to load more subject resources:', error);
          if (globalStatus) globalStatus.textContent = 'More resources could not be loaded. Scroll again to retry.';
        } finally {
          rowState.loading = false;
        }
      }

      async function searchCompleteCatalog() {
        if (searchingAll || !catalog.hasMore) return;
        searchingAll = true;
        try {
          await catalog.loadAll(() => {
            all = catalog.items;
            populateFilters();
            updateDashboardStats();
            refresh(true);
          });
        } catch (error) {
          console.error('Unable to complete resource search:', error);
          if (globalStatus) globalStatus.textContent = 'The full collection could not be searched. Try again.';
        } finally {
          searchingAll = false;
        }
      }

      function applySearch() {
        refresh();
        window.clearTimeout(searchTimer);
        if (queryInput?.value.trim() || levelSelect?.value || yearSelect?.value) {
          searchTimer = window.setTimeout(() => void searchCompleteCatalog(), 250);
        }
      }

      queryInput?.addEventListener('input', applySearch);
      levelSelect?.addEventListener('change', applySearch);
      yearSelect?.addEventListener('change', applySearch);

      document.addEventListener('click', (event) => {
        const control = event.target.closest('[data-dashboard-scroll]');
        if (!control) return;
        const collection = control.dataset.dashboardScroll;
        const rowIndex = control.dataset.row;
        const row = document.querySelector(`[data-dashboard-row="${collection}"][data-row="${rowIndex}"]`);
        if (!row) return;
        const direction = Number(control.dataset.direction);
        const card = row.querySelector('.dashboard-resource-card');
        row.scrollBy({
          left: direction * ((card?.getBoundingClientRect().width || 220) + 12) * 2,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      });

      async function initialize() {
        if (globalStatus) globalStatus.textContent = 'Loading the resource catalogâ€¦';
        try {
          await catalog.loadNext();
          all = catalog.items;
          populateFilters();
          updateDashboardStats();
          refresh();
        } catch (error) {
          console.error('Unable to load the subject resource catalog:', error);
          const message = document.createElement('span');
          message.textContent = 'Resources could not be loaded right now.';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'dashboard-retry';
          retry.textContent = 'Try again';
          retry.addEventListener('click', initialize);
          if (globalStatus) globalStatus.replaceChildren(message, document.createTextNode(' '), retry);
        }
      }

      void initialize();
    });
  }

  function renderList(listEl) {
    const subject = listEl.dataset.subject;
    const category = listEl.dataset.category;
    const pageSize = Number(listEl.dataset.limit) || 20;
    const key = `${subject}|${category}`;

    const searchEl = document.querySelector(`[data-resource-search="${key}"]`);
    const filterEl = document.querySelector(`[data-resource-filter="${key}"]`);
    const statusEl = document.querySelector(`[data-resource-status="${key}"]`);
    let all = [];
    let visible = pageSize;
    let loading = false;
    let offset = 0;
    let total = null;
    let hasMore = false;
    let searchPromise = null;
    let pageRequest = null;
    let loadFailed = false;
    let started = false;
    const resourceSubjects = Array.from(document.querySelectorAll(`[data-resources][data-subject="${subject}"]`))
      .flatMap((element) => (element.dataset.subjectAliases || '').split(','))
      .filter(Boolean);
    const matchingSubjects = new Set([subject, ...resourceSubjects]);

    function draw() {
      if (loading) return;
      const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
      const level = filterEl ? filterEl.value : '';
      const filtered = all.filter((item) => matches(item, query, level));

      listEl.innerHTML = '';

      if (!filtered.length) {
        const message = all.length
          ? hasMore && query ? 'No match in the loaded resources yet. Searching the full collectionâ€¦' : 'No matching resources.'
          : hasMore ? 'Loading more resourcesâ€¦' : 'No files uploaded for this subject yet.';
        listEl.innerHTML = `<div class="resource-empty">${message}</div>`;
        if (statusEl) statusEl.textContent = hasMore && query ? `Searching ${all.length} of ${total ?? 'the'} resourcesâ€¦` : '';
        return;
      }

      for (const item of filtered.slice(0, visible)) {
        listEl.appendChild(buildItem(item));
      }

      if (filtered.length > visible) {
        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'btn resource-more';
        moreButton.textContent = `Show ${Math.min(pageSize, filtered.length - visible)} more loaded`;
        moreButton.addEventListener('click', () => {
          visible += pageSize;
          draw();
        });
        listEl.appendChild(moreButton);
      } else if (hasMore) {
        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'btn resource-more';
        moreButton.textContent = `Load next ${PAGE_SIZE} resources`;
        moreButton.addEventListener('click', () => void loadNextPage());
        listEl.appendChild(moreButton);
      }

      if (statusEl) {
        statusEl.textContent = hasMore
          ? `Showing ${Math.min(visible, filtered.length)} of ${total ?? 'more'} resources. Load more or search the full collection.`
          : `Showing ${Math.min(visible, filtered.length)} of ${filtered.length} file(s).`;
      }
    }

    function renderError() {
      loading = false;
      listEl.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'resource-empty';
      message.setAttribute('role', 'alert');
      const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
      message.textContent = `${subjectName} resources could not be loaded.`;

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn resource-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => void loadNextPage(true));
      listEl.append(message, retry);

      if (statusEl) statusEl.textContent = 'Check your connection, then try again.';
    }

    async function loadNextPage(reset = false) {
      if (loading) return pageRequest;
      if (!hasMore && !reset && started) return;
      loading = true;
      started = true;
      loadFailed = false;
      const nextOffset = reset ? 0 : offset;
      if (reset) {
        all = [];
        visible = pageSize;
        offset = 0;
        total = null;
        listEl.innerHTML = '<div class="resource-empty" role="status">Loading resources...</div>';
      }
      if (statusEl) statusEl.textContent = 'Loading the next resource batchâ€¦';
      pageRequest = (async () => {
      try {
        const page = await fetchCatalogPage(matchingSubjects, {
          category,
          offset: nextOffset,
          order: 'title.asc,original_filename.asc,storage_path.asc'
        });
        const existing = new Set(all.map((item) => item.storagePath));
        page.items.forEach((item) => {
          if (!existing.has(item.storagePath)) all.push(item);
        });
        offset += page.scanned ?? page.items.length;
        total = page.total ?? total;
        hasMore = page.hasMore;
        loading = false;

        if (filterEl) filterEl.dataset.ready = '';
        if (filterEl) {
          const existingLevels = new Set(Array.from(filterEl.options, (option) => option.value));
          const levels = Array.from(new Set(all.map((item) => item.level).filter(Boolean))).sort();
          for (const level of levels) {
            if (existingLevels.has(level)) continue;
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            filterEl.appendChild(option);
          }
          filterEl.dataset.ready = 'true';
        }
        draw();
      } catch (error) {
        const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
        console.error(`Unable to load ${subjectName} resources:`, error);
        loading = false;
        loadFailed = true;
        hasMore = false;
        renderError();
      }
      })().finally(() => {
        loading = false;
        pageRequest = null;
        if (hasMore && !all.length && !searchEl?.value.trim() && !filterEl?.value) {
          window.setTimeout(() => void loadNextPage(), 0);
        }
      });
      return pageRequest;
    }

    async function loadAllForSearch() {
      if (searchPromise) return searchPromise;
      searchPromise = (async () => {
        if (loading && pageRequest) await pageRequest;
        else if (!started) await loadNextPage(true);
        while (hasMore && !loadFailed) {
          await loadNextPage();
          if (!loadFailed && searchEl?.value.trim()) draw();
        }
      })().finally(() => {
        searchPromise = null;
      });
      return searchPromise;
    }

    if (searchEl) searchEl.addEventListener('input', () => {
      visible = pageSize;
      draw();
      if (searchEl.value.trim()) void loadAllForSearch();
    });
    if (filterEl) filterEl.addEventListener('change', () => {
      visible = pageSize;
      draw();
      if (filterEl.value) void loadAllForSearch();
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void loadNextPage(true);
      }, { rootMargin: '240px 0px' });
      observer.observe(listEl);
    } else {
      void loadNextPage(true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderDashboardLibraries();
    document.querySelectorAll('[data-resources]').forEach(renderList);
  });

  // Exposed for pages/tests that want to query the index directly.
  window.StudyHubResources = {
    manifest: MANIFEST,
    formatBytes,
    filter(subject, category, options) {
      const opts = options || {};
      if (!MANIFEST || !Array.isArray(MANIFEST.items)) return [];
      return MANIFEST.items.filter(
        (item) =>
          isUsableResource(item) &&
          (!subject || item.subject === subject) &&
          (!category || item.category === category) &&
          matches(item, (opts.search || '').toLowerCase(), opts.level || '')
      );
    }
  };
})();