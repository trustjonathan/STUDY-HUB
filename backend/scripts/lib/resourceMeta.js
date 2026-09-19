// backend/scripts/lib/resourceMeta.js
//
// Shared helpers for the "resources -> Supabase Storage" tooling.
// Keeps Supabase object-key rules, the Study Hub subject taxonomy and the
// filename -> metadata heuristics in one testable place.
//
// Used by:
//   backend/scripts/upload-resources.js   (write side / one-off migration)
//   backend/services/resourceService.js   (read side / API)

const path = require('path');

// Supabase Storage only allows these characters in object keys:
//   A-Z a-z 0-9 _ - . ' , ! * & $ @ = ; : + ? ( ) and whitespace
// Anything else ( [ ] ’ # % \ | etc. ) must be rewritten before upload.
const DISALLOWED_CHARS = /[^A-Za-z0-9_\-.'!,*&$@=;:+?() ]/g;

// Human friendly normalisations applied before the whitelist strip.
const NORMALISATIONS = [
  [/[\u2018\u2019\u201A\u201B\u2032\u00B4\u0060]/g, "'"], // smart single quotes / backtick
  [/[\u201C\u201D\u201E\u00AB\u00BB]/g, "'"], // smart double quotes
  [/[\u2013\u2014\u2212]/g, '-'], // en dash / em dash / minus
  [/[\u2026]/g, '...'], // ellipsis
  [/[\[\{]/g, '('], // square brackets are rejected by Supabase
  [/[\]\}]/g, ')'],
  [/#/g, 'No.'],
  [/[%]/g, ' percent '],
  [/[\\/|<>"]/g, '-']
];

const SUBJECTS = {
  bio: 'biology',
  biology: 'biology',
  chem: 'chemistry',
  chemistry: 'chemistry',
  math: 'mathematics',
  maths: 'mathematics',
  mathematics: 'mathematics'
};

const SUBJECT_LABELS = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics'
};

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.exe': 'application/octet-stream',
  '.zip': 'application/zip'
};

const MAX_FILE_NAME_LENGTH = 180;

// ----------------------
// Key sanitising
// ----------------------

function sanitizeSegment(segment) {
  const value = String(segment);
  const lastDot = value.lastIndexOf('.');
  let base = lastDot > 0 ? value.slice(0, lastDot) : value;
  const ext = lastDot > 0 ? value.slice(lastDot).toLowerCase() : '';

  for (const [pattern, replacement] of NORMALISATIONS) {
    base = base.replace(pattern, replacement);
  }

  base = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (é -> e)
    .replace(/\u00A0/g, ' ')
    .replace(DISALLOWED_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/-\s*-/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s-]+/, '')
    .replace(/[.\s-]+$/, '');

  if (!base) base = 'file';

  const maxBaseLength = Math.max(1, MAX_FILE_NAME_LENGTH - ext.length);
  if (base.length > maxBaseLength) {
    base = base.slice(0, maxBaseLength).replace(/[.\s-]+$/, '');
  }

  return `${base}${ext}`;
}

// Turn a relative path such as `chem/papers/CHEM 3[1].pdf`
// into a Storage-safe key such as `chem/papers/CHEM 3(1).pdf`.
function sanitizeStorageKey(relPath) {
  return String(relPath)
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(sanitizeSegment)
    .join('/');
}

// ----------------------
// Metadata heuristics
// ----------------------

function detectLevel(fileName) {
  const upper = String(fileName).toUpperCase();

  // S.3 / S3 / S. 6 / S6  (also matches names like "S5CHEM1")
  const secondary = upper.match(/\bS\.?\s?([3-6])\b/);
  if (secondary) return `S.${secondary[1]}`;

  if (/UACE|\bA[\s-]?LEVEL\b|\bA2\b/.test(upper)) return 'A-Level';
  if (/\bUCE\b|O[\s-]?LEVEL/.test(upper)) return 'O-Level';

  return null;
}

function detectYear(fileName) {
  const matches = String(fileName).match(/\b(19[89]\d|20[0-3]\d)\b/g);
  if (!matches || !matches.length) return null;

  const years = matches
    .map((value) => Number(value))
    .filter((value) => value >= 1990 && value <= 2035);

  if (!years.length) return null;
  return Math.max(...years);
}

function detectResourceType(lowerName, category) {
  if (/(marking guide|marking scheme|answers?|solutions?|\bguide\b|\bmg\b)/.test(lowerName)) return 'guide';
  if (/(coursebook|textbook|encyclopedia|\bbook\b|\bnotes\b)/.test(lowerName)) return 'notes';
  if (/(paper|\bpp?\s?[1-4]\b|\bp\s?\.?\s?[1-4]\b|mock|exam|test|\beot\b|premock|postmock|seminar|assignment|revision|practical)/.test(lowerName)) return 'paper';
  if (category === 'notes') return 'notes';
  if (category === 'papers') return 'paper';
  return 'other';
}

function titleFromFilename(fileName) {
  const ext = path.extname(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || fileName;
}

function mimeTypeFor(extension) {
  return MIME_TYPES[String(extension).toLowerCase()] || 'application/octet-stream';
}

// Build the full metadata record for one local file.
function classifyResource({ relPath, originalFilename }) {
  const parts = String(relPath).split(/[\\/]+/).filter(Boolean);
  const folders = parts.slice(0, -1);
  const fileName = originalFilename || parts[parts.length - 1] || '';
  const lowerName = fileName.toLowerCase();
  const extension = path.extname(fileName).toLowerCase();

  const subject = SUBJECTS[String(folders[0] || '').toLowerCase()] || null;
  const rawCategory = String(folders[1] || '').toLowerCase();
  const category = rawCategory === 'notes' || rawCategory === 'papers' ? rawCategory : null;

  return {
    subject,
    subjectLabel: subject ? SUBJECT_LABELS[subject] : null,
    category,
    level: detectLevel(fileName),
    year: detectYear(fileName),
    resourceType: detectResourceType(lowerName, category),
    extension,
    mimeType: mimeTypeFor(extension),
    title: titleFromFilename(fileName)
  };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

module.exports = {
  DISALLOWED_CHARS,
  SUBJECTS,
  SUBJECT_LABELS,
  MIME_TYPES,
  MAX_FILE_NAME_LENGTH,
  sanitizeSegment,
  sanitizeStorageKey,
  detectLevel,
  detectYear,
  detectResourceType,
  titleFromFilename,
  mimeTypeFor,
  classifyResource,
  formatBytes
};