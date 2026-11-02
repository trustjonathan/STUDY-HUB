function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function associationsFor(item) {
  if (Array.isArray(item.classSubjects)) return item.classSubjects;
  const classKey = typeof item.classKey === 'string' ? item.classKey : 'unsorted';
  return typeof item.subject === 'string' && item.subject.trim()
    ? [{ classKey, subject: item.subject }]
    : [];
}

export function canonicalCatalogUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.searchParams.sort();
  return url.href;
}

export function dedupeCatalogItemsByUrl(items) {
  const mergedItems = new Map();

  for (const item of items) {
    const url = canonicalCatalogUrl(item.url);
    const normalized = { ...item, url };
    const existing = mergedItems.get(url);

    if (!existing) {
      mergedItems.set(url, normalized);
      continue;
    }

    const mergedClassKeys = uniqueStrings([
      ...(existing.classKeys || []),
      existing.classKey,
      ...(item.classKeys || []),
      item.classKey,
    ]);
    const mergedSubjects = uniqueStrings([
      ...(existing.subjects || []),
      existing.subject,
      ...(item.subjects || []),
      item.subject,
    ]);
    const classSubjects = new Map();
    for (const association of [...associationsFor(existing), ...associationsFor(item)]) {
      if (typeof association?.classKey !== 'string' || typeof association.subject !== 'string') continue;
      classSubjects.set(`${association.classKey}\0${association.subject}`, association);
    }
    if (mergedClassKeys.length) existing.classKeys = mergedClassKeys;
    if (mergedSubjects.length) existing.subjects = mergedSubjects;
    if (classSubjects.size) existing.classSubjects = [...classSubjects.values()];
  }

  return [...mergedItems.values()];
}
