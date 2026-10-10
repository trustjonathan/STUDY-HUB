// frontend/src/script/resources.js
//
// Renders the Study Hub resource library from the generated manifest
// (frontend/src/data/resources.js) which indexes the Supabase Storage bucket
// `study-hub-resources` (prefix: documents/).
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

  const MANIFEST = window.STUDY_HUB_RESOURCES || null;
  const SUPABASE_CONFIG = {
    url: document.querySelector('meta[name="study-hub-supabase-url"]')?.content || MANIFEST?.projectUrl || '',
    anonKey: document.querySelector('meta[name="study-hub-supabase-anon-key"]')?.content || ''
  };
  const READER_PAGE = document.querySelector('meta[name="study-hub-reader-url"]')?.content || '/STUDY-HUB/full_page_flipbook_viewer/index.html';
  const TURNSTILE_SITE_KEY = document.querySelector('meta[name="study-hub-turnstile-site-key"]')?.content || '';
  const SUPABASE_TABLE = 'study_hub_resources';
  const PAGE_SIZE = 1000;

  function publicStorageUrl(bucket, storagePath, projectUrl = SUPABASE_CONFIG.url) {
    const encodedPath = String(storagePath)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${String(projectUrl).replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  async function loadCatalogResources(subject, category) {
    const supabaseUrl = String(SUPABASE_CONFIG.url || '').replace(/\/+$/, '');
    const anonKey = SUPABASE_CONFIG.anonKey || '';

    if (!supabaseUrl || !anonKey) {
      throw new Error('The public Supabase URL or anon key is not configured.');
    }

    const resources = [];
    let offset = 0;

    for (;;) {
      const endpoint = new URL(`${supabaseUrl}/rest/v1/${SUPABASE_TABLE}`);
      endpoint.searchParams.set(
        'select',
        'subject,category,storage_bucket,storage_path,original_filename,title,size_bytes,level,year,resource_type'
      );
      endpoint.searchParams.set('subject', `eq.${subject}`);
      endpoint.searchParams.set('category', `eq.${category}`);
      endpoint.searchParams.set('order', 'title.asc,original_filename.asc');
      endpoint.searchParams.set('limit', String(PAGE_SIZE));
      endpoint.searchParams.set('offset', String(offset));

      const headers = { apikey: anonKey };
      if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`;

      const response = await fetch(endpoint, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Supabase returned HTTP ${response.status}.`);
      }

      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Supabase returned an invalid resource list.');

      resources.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return resources.map((item) => ({
      title: item.title,
      originalFilename: item.original_filename,
      storagePath: item.storage_path,
      subject: item.subject,
      category: item.category,
      sizeBytes: item.size_bytes,
      level: item.level,
      year: item.year,
      resourceType: item.resource_type,
      publicUrl: publicStorageUrl(item.storage_bucket, item.storage_path)
    }));
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
    if (item.category === 'notes') return 'notes';
    if (item.category === 'papers') return 'papers';
    if (item.resourceType === 'notes' || item.resourceType === 'guide') return 'notes';
    if (item.resourceType === 'paper') return 'papers';
    return 'other';
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
    readerUrl.searchParams.set('return', window.location.href);
    if (SUPABASE_CONFIG.anonKey) readerUrl.searchParams.set('anon_key', SUPABASE_CONFIG.anonKey);
    if (TURNSTILE_SITE_KEY) readerUrl.searchParams.set('turnstile_key', TURNSTILE_SITE_KEY);
    link.href = readerUrl.href;
    link.textContent = item.title || item.originalFilename;

    const meta = document.createElement('span');
    meta.className = 'resource-meta';
    meta.textContent = metaLine(item);

    row.appendChild(link);
    row.appendChild(meta);
    return row;
  }

  async function loadDashboardResources(subjects) {
    const catalogUrl = String(SUPABASE_CONFIG.url || MANIFEST?.projectUrl || '').replace(/\/+$/, '');
    const anonKey = SUPABASE_CONFIG.anonKey || '';

    if (!catalogUrl || !anonKey) {
      if (!MANIFEST || !Array.isArray(MANIFEST.items)) {
        throw new Error('The resource index and its connection settings are unavailable.');
      }
      return MANIFEST.items.filter((item) => subjects.has(item.subject));
    }

    const resources = [];
    const pageSize = 500;
    let offset = 0;

    for (;;) {
      const endpoint = new URL(`${catalogUrl}/rest/v1/${SUPABASE_TABLE}`);
      endpoint.searchParams.set(
        'select',
        'subject,category,storage_bucket,storage_path,original_filename,title,extension,size_bytes,level,year,resource_type,uploaded_at,updated_at'
      );
      endpoint.searchParams.set('subject', `in.(${Array.from(subjects).join(',')})`);
      endpoint.searchParams.set('order', 'uploaded_at.desc,title.asc');
      endpoint.searchParams.set('limit', String(pageSize));
      endpoint.searchParams.set('offset', String(offset));

      const headers = { apikey: anonKey };
      if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`;
      const response = await fetch(endpoint, { headers });
      if (!response.ok) throw new Error(`Resource catalog request failed (HTTP ${response.status}).`);

      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('The resource catalog returned an invalid response.');
      resources.push(...page.map((item) => ({
        title: item.title,
        originalFilename: item.original_filename,
        storagePath: item.storage_path,
        extension: item.extension,
        sizeBytes: item.size_bytes,
        level: item.level,
        year: item.year,
        category: item.category,
        resourceType: item.resource_type,
        uploadedAt: item.uploaded_at,
        updatedAt: item.updated_at,
        publicUrl: publicStorageUrl(item.storage_bucket, item.storage_path, catalogUrl)
      })));
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return resources;
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
      const turnstileKey = TURNSTILE_SITE_KEY;
      const collections = new Map();

      if (!MANIFEST && globalStatus) globalStatus.textContent = 'Loading the resource catalog…';

      function populateFilters() {
        for (const [select, values] of [
          [levelSelect, Array.from(new Set(all.map((item) => item.level).filter(Boolean))).sort()],
          [yearSelect, Array.from(new Set(all.map((item) => item.year).filter(Boolean))).sort((left, right) => Number(right) - Number(left))]
        ]) {
          if (!select) continue;
          select.replaceChildren(new Option(select === levelSelect ? 'All levels' : 'All years', ''));
          for (const value of values) {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            select.appendChild(option);
          }
        }
      }

      function updateDashboardStats() {
        const counts = {
          resources: all.length,
          notes: all.filter((item) => resourceGroup(item) === 'notes').length,
          papers: all.filter((item) => resourceGroup(item) === 'papers').length,
          levels: new Set(all.map((item) => item.level).filter(Boolean)).size
        };
        Object.entries(counts).forEach(([key, value]) => {
          const stat = document.querySelector(`[data-dashboard-stat="${key}"]`);
          if (stat) stat.textContent = String(value);
        });
        if (totalLabel) totalLabel.textContent = `${all.length} resources`;
      }

      function resourceHref(item) {
        const query = new URLSearchParams({
          file: item.publicUrl || publicStorageUrl(item.storageBucket || item.storage_bucket, item.storagePath || item.storage_path),
          title: item.title || item.originalFilename || 'Study Hub resource',
          return: returnUrl
        });
        if (anonKey) query.set('anon_key', anonKey);
        if (turnstileKey) query.set('turnstile_key', turnstileKey);
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
        placeholder.textContent = item.resourceType === 'paper' ? '✍' : item.resourceType === 'notes' || item.resourceType === 'guide' ? '▤' : '▧';
        preview.appendChild(placeholder);
        if (previewable) {
          const caption = document.createElement('span');
          caption.className = 'dashboard-preview-caption';
          caption.textContent = 'Loading page preview…';
          preview.appendChild(caption);
        } else {
          const caption = document.createElement('span');
          caption.className = 'dashboard-preview-caption';
          caption.textContent = `${extension ? extension.toUpperCase() : 'FILE'} · Open to view`;
          preview.appendChild(caption);
        }

        const type = document.createElement('span');
        type.className = 'dashboard-resource-type';
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.resourceType === 'paper' ? '✍' : item.resourceType === 'notes' ? '▤' : item.resourceType === 'guide' ? '✓' : '▧';
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
          .join(' · ');
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
        status.textContent = shown >= state.items.length
          ? `All ${state.items.length} matching resources are shown.`
          : `Showing ${shown} of ${state.items.length} matching resources. Scroll either row to load more.`;
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

      function refresh() {
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
          .sort((left, right) =>
            searchRelevance(right, query) - searchRelevance(left, query) ||
            (left.title || left.originalFilename || '').localeCompare(right.title || right.originalFilename || '')
          );
        if (globalStatus) {
          globalStatus.textContent = `${filtered.length} matching resource${filtered.length === 1 ? '' : 's'} found. Recently added and study notes are shown below.`;
        }

        for (const [name, items] of [['recent', recent], ['notes', notes]]) {
          const section = document.querySelector(`[data-dashboard-collection="${name}"][data-dashboard-parent="${library.dataset.dashboardSubject}"]`);
          const rows = Array.from(section?.querySelectorAll('[data-dashboard-row]') || []);
          rows.forEach((row) => {
            row.onscroll = null;
            row.replaceChildren();
            row.scrollLeft = 0;
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
            rowState.element.scrollLeft = 0;
            if (rowState.items.length) appendBatch(name, rowState);
            else setEmpty(rowState.element, name === 'notes' ? 'No study notes or guides match these filters.' : 'No recently added resources match these filters.');
            rowState.element.onscroll = () => {
              if (rowState.element.scrollWidth - rowState.element.scrollLeft - rowState.element.clientWidth < 320) {
                appendBatch(name, rowState);
              }
              updateRowControls(rowState.element);
            };
            updateRowControls(rowState.element);
          });
          updateCollectionStatus(name);
        }
      }

      queryInput?.addEventListener('input', refresh);
      levelSelect?.addEventListener('change', refresh);
      yearSelect?.addEventListener('change', refresh);

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
        if (globalStatus) globalStatus.textContent = 'Loading the resource catalog…';
        try {
          all = await loadDashboardResources(subjects);
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
    let loading = subject === 'mathematics';

    function draw() {
      if (loading) return;
      const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
      const level = filterEl ? filterEl.value : '';
      const filtered = all.filter((item) => matches(item, query, level));

      listEl.innerHTML = '';

      if (!filtered.length) {
        const message = all.length
          ? 'No matching resources.'
          : 'No files uploaded for this subject yet.';
        listEl.innerHTML = `<div class="resource-empty">${message}</div>`;
        if (statusEl) statusEl.textContent = '';
        return;
      }

      for (const item of filtered.slice(0, visible)) {
        listEl.appendChild(buildItem(item));
      }

      if (filtered.length > visible) {
        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'btn resource-more';
        moreButton.textContent = `Load ${Math.min(pageSize, filtered.length - visible)} more`;
        moreButton.addEventListener('click', () => {
          visible += pageSize;
          draw();
        });
        listEl.appendChild(moreButton);
      }

      if (statusEl) {
        statusEl.textContent = `Showing ${Math.min(visible, filtered.length)} of ${filtered.length} file(s).`;
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
      retry.addEventListener('click', loadFromApi);
      listEl.append(message, retry);

      if (statusEl) statusEl.textContent = 'Check your connection, then try again.';
    }

    async function loadFromApi() {
      loading = true;
      const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
      listEl.innerHTML = `<div class="resource-empty" role="status">Loading ${subjectName} resources...</div>`;
      if (statusEl) statusEl.textContent = `Loading ${subjectName} resources...`;

      try {
        all = await loadCatalogResources(subject, category);
        loading = false;

        if (filterEl) filterEl.dataset.ready = '';
        visible = pageSize;
        if (filterEl) {
          const levels = Array.from(new Set(all.map((item) => item.level).filter(Boolean))).sort();
          filterEl.innerHTML = '<option value="">All levels</option>';
          for (const level of levels) {
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
        renderError();
      }
    }

    if (searchEl) searchEl.addEventListener('input', () => { visible = pageSize; draw(); });
    if (filterEl) filterEl.addEventListener('change', () => { visible = pageSize; draw(); });

    if (subject === 'mathematics' || listEl.dataset.resourceSource === 'supabase') {
      void loadFromApi();
      return;
    }

    if (!MANIFEST || !Array.isArray(MANIFEST.items)) {
      loading = false;
      listEl.innerHTML = '<div class="resource-empty">Resource index unavailable.</div>';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    const resourceSubjects = Array.from(document.querySelectorAll(`[data-resources][data-subject="${subject}"]`))
      .flatMap((element) => (element.dataset.subjectAliases || '').split(','))
      .filter(Boolean);
    const matchingSubjects = new Set([subject, ...resourceSubjects]);
    all = MANIFEST.items.filter(
      (item) => matchingSubjects.has(item.subject) && item.category === category
    );

    if (filterEl && all.length) {
      const levels = Array.from(new Set(all.map((item) => item.level).filter(Boolean))).sort();
      filterEl.innerHTML = '<option value="">All levels</option>';
      for (const level of levels) {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        filterEl.appendChild(option);
      }
    }

    draw();
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
          (!subject || item.subject === subject) &&
          (!category || item.category === category) &&
          matches(item, (opts.search || '').toLowerCase(), opts.level || '')
      );
    }
  };
})();