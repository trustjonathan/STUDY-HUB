// Build-time aggregator for the public Fresh-Teacher GitHub Pages library.
// Aggregates ~534 root-level JSON files into one static catalog that the Library
// island loads at runtime. Resilient: on failure it keeps the existing catalog and
// exits 0 so it never breaks `npm run build`.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '..', 'public', 'fresh-teacher-catalog.json');

const OWNER = process.env.FRESH_TEACHER_OWNER || 'Fresh-Teacher';
const REPO = process.env.FRESH_TEACHER_REPO || 'fresh-teacher.github.io';
const BRANCH = process.env.FRESH_TEACHER_BRANCH || 'main';
const FRESH_TEACHER_ORIGINS = new Set([
  'https://fresh-teacher.github.io',
  'https://s6-fresh-teacher.vercel.app',
  'https://freshteachers.vercel.app',
]);

// Longest tokens first so "BabyClass" wins over "Baby", "TopClass" over "Top", etc.
const CLASS_TOKENS = [
  ['BabyClass', 'baby'], ['Baby', 'baby'],
  ['TopClass', 'top'], ['Top', 'top'],
  ['MiddleClass', 'middle'], ['Middle', 'middle'],
  ['PrimaryOne', 'p1'], ['PrimaryTwo', 'p2'], ['PrimaryThree', 'p3'],
  ['PrimaryFour', 'p4'], ['PrimaryFive', 'p5'], ['PrimarySix', 'p6'], ['PrimarySeven', 'p7'],
  ['SeniorOne', 's1'], ['SeniorTwo', 's2'], ['SeniorThree', 's3'],
  ['SeniorFour', 's4'], ['SeniorFive', 's5'], ['SeniorSix', 's6'],
];

const CLASS_LABELS = {
  baby: 'Baby Class', top: 'Top Class', middle: 'Middle Class',
  p1: 'P.1', p2: 'P.2', p3: 'P.3', p4: 'P.4', p5: 'P.5', p6: 'P.6', p7: 'P.7',
  s1: 'S.1', s2: 'S.2', s3: 'S.3', s4: 'S.4', s5: 'S.5', s6: 'S.6',
};

const TYPE_PATTERNS = [
  [/PastPapers/i, 'Past Papers'],
  [/LessonNotes/i, 'Lesson Notes'],
  [/SchemesofWork|SchemesOfWork/i, 'Schemes of Work'],
  [/HolidayPackages|Holiday/i, 'Holiday Package'],
];

function parseType(name) {
  for (const [re, label] of TYPE_PATTERNS) {
    if (re.test(name)) return label;
  }
  return 'Resources';
}

function parseFreshName(fileName) {
  let work = fileName;
  let classKey = null;
  for (const [token, key] of CLASS_TOKENS) {
    const idx = work.indexOf(token);
    if (idx !== -1) {
      classKey = key;
      work = work.slice(0, idx) + work.slice(idx + token.length);
      break;
    }
  }
  const type = parseType(work);
  work = work
    .replace(/PastPapers|LessonNotes|SchemesofWork|SchemesOfWork|HolidayPackages/gi, '')
    .replace(/\bClass\b/g, '')
    .replace(/\bAll\b/g, '')
    .replace(/\bPackages?\b/gi, '')
    .trim();
  const subject = work.length ? work : 'All Subjects';
  return {
    classKey,
    className: classKey ? CLASS_LABELS[classKey] : 'General',
    type,
    subject: subject.replace(/\s+/g, ' ').trim(),
  };
}

function titleFromUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
    return last.replace(/\.(?:pdf|docx?|rtf)$/i, '') || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

function normalizeResourceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    // Fresh Teacher filenames sometimes contain a literal #, which must not
    // become a URL fragment and truncate the file path.
    const url = new URL(value.trim().replace(/#/g, '%23'));
    if (url.protocol !== 'https:' || !FRESH_TEACHER_ORIGINS.has(url.origin)) return '';
    url.pathname = url.pathname.replace(/,+$/, '');
    if (!/\.(?:pdf|docx?|rtf)$/i.test(url.pathname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'study-hub-catalog-builder' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTree() {
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const data = await fetchJson(api);
  if (!data || !Array.isArray(data.tree)) throw new Error('Invalid tree response');
  return data.tree
    .filter((entry) => entry.type === 'blob' && /\.json$/i.test(entry.path) && !entry.path.includes('/'))
    .map((entry) => path.basename(entry.path, '.json'))
    .filter((name) => name && name.toLowerCase() !== 'manifest'); // manifest.json is a PWA manifest, not data
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        results[index] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  let fileNames;
  try {
    fileNames = await fetchTree();
  } catch (err) {
    console.warn(`[fresh-teacher] Could not list repo tree (${err.message}). Keeping existing catalog.`);
    return;
  }
  if (!fileNames.length) {
    console.warn('[fresh-teacher] No data files found. Keeping existing catalog.');
    return;
  }

  console.log(`[fresh-teacher] Aggregating ${fileNames.length} data files...`);

  const fetched = await mapWithConcurrency(fileNames, 15, async (name) => {
    const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodeURIComponent(name)}.json`;
    const data = await fetchJson(url);
    return { name, data };
  });

  const items = [];
  let filesOk = 0;
  let filesFailed = 0;

  for (const result of fetched) {
    if (!result || result.error || !Array.isArray(result.data)) {
      filesFailed += 1;
      continue;
    }
    filesOk += 1;
    const meta = parseFreshName(result.name);
    for (const entry of result.data) {
      const sourceUrl = typeof entry?.pdfUrl === 'string' ? entry.pdfUrl : '';
      const url = normalizeResourceUrl(sourceUrl);
      if (!url) continue;
      items.push({
        classKey: meta.classKey,
        className: meta.className,
        subject: meta.subject,
        type: meta.type,
        title: (sourceUrl.includes('#') ? '' : typeof entry?.title === 'string' ? entry.title.trim() : '') || titleFromUrl(url),
        url,
      });
    }
  }

  if (!items.length) {
    console.warn('[fresh-teacher] Aggregated 0 items. Keeping existing catalog.');
    return;
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: `https://github.com/${OWNER}/${REPO}`,
    count: items.length,
    items,
  };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(catalog), 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(catalog)) / 1024).toFixed(0);
  console.log(`[fresh-teacher] Wrote ${items.length} items from ${filesOk} files (${filesFailed} failed) -> ${path.relative(process.cwd(), OUTPUT)} (${kb} KB)`);
}

main().catch((err) => {
  console.warn(`[fresh-teacher] Aggregator error: ${err instanceof Error ? err.message : err}. Keeping existing catalog.`);
});
