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
    link.href = item.publicUrl;
    link.textContent = item.title || item.originalFilename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

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

    if (!MANIFEST || !Array.isArray(MANIFEST.items)) {
      listEl.innerHTML = '<div class="resource-empty">Resource index unavailable.</div>';
      return;
    }

    const all = MANIFEST.items.filter(
      (item) => item.subject === subject && item.category === category
    );

    if (!all.length) {
      listEl.innerHTML =
        '<div class="resource-empty">No files uploaded for this subject yet.</div>';
      if (statusEl) statusEl.textContent = '';
      return;
    }

    // Level filter options, built from the data itself.
    if (filterEl && !filterEl.dataset.ready) {
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

    let visible = pageSize;
    let moreButton = null;

    function draw() {
      const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
      const level = filterEl ? filterEl.value : '';
      const filtered = all.filter((item) => matches(item, query, level));

      listEl.innerHTML = '';
      moreButton = null;

      if (!filtered.length) {
        listEl.innerHTML = '<div class="resource-empty">No matching resources.</div>';
        if (statusEl) statusEl.textContent = '';
        return;
      }

      for (const item of filtered.slice(0, visible)) {
        listEl.appendChild(buildItem(item));
      }

      if (filtered.length > visible) {
        moreButton = document.createElement('button');
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

    if (searchEl) searchEl.addEventListener('input', () => { visible = pageSize; draw(); });
    if (filterEl) filterEl.addEventListener('change', () => { visible = pageSize; draw(); });

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