import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const OUTPUT = path.join(frontendRoot, 'public', 'study-hub-resources-1-catalog.json');
const OWNER = 'trustjonathan';
const REPO = 'STUDY-HUB-RESOURCES-1';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const RESOURCE_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.rtf', '.ppt', '.pptx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.epub', '.zip', '.rar',
]);
const CLASS_LABELS = {
  baby: 'Baby Class',
  top: 'Top Class',
  middle: 'Middle Class',
  p1: 'P.1', p2: 'P.2', p3: 'P.3', p4: 'P.4', p5: 'P.5', p6: 'P.6', p7: 'P.7',
  s1: 'S.1', s2: 'S.2', s3: 'S.3', s4: 'S.4', s5: 'S.5', s6: 'S.6',
};
const SUBJECT_CATALOG = JSON.parse(await fs.readFile(
  path.join(frontendRoot, 'src', 'data', 'subjects.json'),
  'utf8',
));
const SUBJECT_ALIASES = SUBJECT_CATALOG.flatMap((subject) => [
  { name: subject.name, alias: subject.name },
  { name: subject.name, alias: subject.storageFolder },
  ...subject.folderAliases.map((alias) => ({ name: subject.name, alias })),
  ...({
    'English Language': ['English', 'Language Development'],
    Mathematics: ['Maths', 'Math', 'MTC', 'Numeracy'],
    'Social Studies': ['SST', 'Social Studies'],
    'General Paper (GP)': ['GP'],
    'Christian Religious Education (CRE / Divinity)': ['CRE', 'Divinity'],
    'Islamic Religious Education (IRE)': ['IRE'],
    'Physical Education (PE)': ['PE'],
  }[subject.name] || []).map((alias) => ({ name: subject.name, alias })),
])
  .sort((left, right) => right.alias.length - left.alias.length);
const SUBJECT_WORDS = SUBJECT_ALIASES.map(({ alias, name }) => ({
  name,
  pattern: new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase()}([^a-z0-9]|$)`, 'i'),
}));

function classForPath(parts) {
  const folders = parts.map((part) => part.toLowerCase());
  const nursery = folders.indexOf('nursery');
  if (nursery >= 0) {
    const key = ({ 'baby class': 'baby', 'top class': 'top', 'middle class': 'middle' })[folders[nursery + 1]];
    if (key) return key;
  }

  const primary = folders.indexOf('primary');
  if (primary >= 0) {
    const match = /^p([1-7])$/.exec(folders[primary + 1] || '');
    if (match) return `p${match[1]}`;
  }

  for (const folder of folders) {
    const match = /^s([1-6])$/.exec(folder);
    if (match) return `s${match[1]}`;
  }
  return 'unsorted';
}

function subjectForPath(parts, title) {
  const levelFolder = parts.findIndex((part) => /^(?:primary|o-level|a-level)$/i.test(part));
  if (levelFolder >= 0 && parts[levelFolder + 2]) {
    const subjectFolder = parts[levelFolder + 2];
    if (!/^(?:general|all subjects)$/i.test(subjectFolder)) return subjectFolder;
    return 'General';
  }

  const nurseryIndex = parts.findIndex((part) => /^nursery$/i.test(part));
  if (nurseryIndex >= 0) {
    const area = parts[nurseryIndex + 2] || '';
    if (/^language development/i.test(area)) return 'English Language';
  }

  const fileName = `${parts.slice(0, -1).join(' ')} ${title}`.toLowerCase();
  return SUBJECT_WORDS.find(({ pattern }) => pattern.test(fileName))?.name || 'General';
}

function typeForResource(title, filePath) {
  const lower = `${filePath} ${title}`.toLowerCase();
  if (/(marking guide|marking scheme|answers?|\bguides?\b|\bmg\b)/.test(lower)) return 'Guides';
  if (/(scheme of work|schemes of work)/.test(lower)) return 'Schemes of Work';
  if (/holiday package|holiday work/.test(lower)) return 'Holiday Package';
  if (/(coursebook|textbook|encyclopedia|\bbook\b|\bnotes?\b|syllabus|curriculum|handout|summary)/.test(lower)) return 'Lesson Notes';
  if (/(paper|\bpp?\s?[1-4]\b|\bp\s?\.?\s?[1-4]\b|mock|exam|test|\beot\b|premock|postmock|seminar|assignment|revision|assessment|scenario|trial|workshop|question bank|sample set|end of term|end of year|mid[- ]?term)/.test(lower)) return 'Past Papers';
  return 'Study Resources';
}

function yearForResource(title) {
  const matches = title.match(/\b(?:19[89]\d|20[0-3]\d)\b/g) || [];
  return matches.length ? String(Math.max(...matches.map(Number))) : 'Undated';
}

function titleFromPath(filePath) {
  return path.posix.basename(filePath, path.posix.extname(filePath))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled resource';
}

async function fetchTree() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'study-hub-resource-catalog-builder' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Resource repository tree request failed (HTTP ${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.tree) || data.truncated) {
    throw new Error('Resource repository tree is missing or truncated.');
  }
  return data.tree;
}

async function main() {
  const tree = await fetchTree();
  const items = tree
    .filter((entry) => {
      if (entry.type !== 'blob' || !entry.path.startsWith('Resources/')) return false;
      return RESOURCE_EXTENSIONS.has(path.posix.extname(entry.path).toLowerCase());
    })
    .map((entry) => {
      const parts = entry.path.split('/');
      const title = titleFromPath(entry.path);
      const classKey = classForPath(parts);
      const encodedPath = entry.path.split('/').map(encodeURIComponent).join('/');
      return {
        path: entry.path,
        title,
        year: yearForResource(title),
        classKey,
        classKeys: [classKey],
        className: CLASS_LABELS[classKey] || 'Unsorted',
        subject: subjectForPath(parts, title),
        type: typeForResource(title, entry.path),
        url: `${RAW_BASE}/${encodedPath}`,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  if (!items.length) throw new Error('The resource repository contains no supported files under Resources/.');

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: `https://github.com/${OWNER}/${REPO}`,
    count: items.length,
    items,
  };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(catalog), 'utf8');
  console.log(`[resource-repository] Wrote ${items.length} files -> ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch((error) => {
  console.error(`[resource-repository] Catalog build failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
