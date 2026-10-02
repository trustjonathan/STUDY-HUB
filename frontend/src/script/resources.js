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
    url: document.querySelector('meta[name="study-hub-supabase-url"]')?.content || '',
    anonKey: document.querySelector('meta[name="study-hub-supabase-anon-key"]')?.content || ''
  };
  const READER_PAGE = document.querySelector('meta[name="study-hub-reader-url"]')?.content || '/STUDY-HUB/full_page_flipbook_viewer/index.html';
  const SUPABASE_TABLE = 'study_hub_resources';
  const PAGE_SIZE = 1000;

  function publicStorageUrl(bucket, storagePath) {
    const encodedPath = String(storagePath)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  async function loadMathematicsResources(category) {
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
      endpoint.searchParams.set('subject', 'eq.mathematics');
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

  function metaLine(item) {
    return [item.level, item.year, typeLabel(item.resourceType), formatBytes(item.sizeBytes)]
      .filter(Boolean)
      .join(' \u00b7 ');
  }

  function matches(item, query, level) {
    if (level && item.level !== level) return false;
    if (!query) return true;
    const haystack = `${item.title} ${item.originalFilename} ${item.year || ''}`.toLowerCase();
    return haystack.includes(query);
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
    link.href = readerUrl.href;
    link.textContent = item.title || item.originalFilename;

    const meta = document.createElement('span');
    meta.className = 'resource-meta';
    meta.textContent = metaLine(item);

    row.appendChild(link);
    row.appendChild(meta);
    return row;
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
      message.textContent = 'Mathematics resources could not be loaded.';

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn resource-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', loadFromApi);
      listEl.append(message, retry);

      if (statusEl) statusEl.textContent = 'Check the connection and public Supabase configuration, then retry.';
    }

    async function loadFromApi() {
      loading = true;
      listEl.innerHTML = '<div class="resource-empty" role="status">Loading Mathematics resources...</div>';
      if (statusEl) statusEl.textContent = 'Loading Mathematics resources...';

      try {
        all = await loadMathematicsResources(category);
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
        console.error('Unable to load Mathematics resources:', error);
        renderError();
      }
    }

    if (searchEl) searchEl.addEventListener('input', () => { visible = pageSize; draw(); });
    if (filterEl) filterEl.addEventListener('change', () => { visible = pageSize; draw(); });

    if (subject === 'mathematics') {
      void loadFromApi();
      return;
    }

    if (!MANIFEST || !Array.isArray(MANIFEST.items)) {
      loading = false;
      listEl.innerHTML = '<div class="resource-empty">Resource index unavailable.</div>';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    all = MANIFEST.items.filter(
      (item) => item.subject === subject && item.category === category
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