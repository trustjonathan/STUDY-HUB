#!/usr/bin/env node
// backend/scripts/upload.mjs
//
// Quick CLI uploader: pushes local study material into a Supabase Storage bucket.
//
// Usage (from the backend folder):
//   node scripts/upload.mjs                                  # bucket=study-hub-resources, folder=../resources
//   node scripts/upload.mjs study-hub-resources ../resources # explicit bucket + folder
//   node scripts/upload.mjs --dry-run                        # show what would be uploaded, upload nothing
//
// ENV (backend/.env, or exported in the shell):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_RESOURCES_BUCKET   (optional; positional arg wins)
//
// The bucket/table were created by:
//   supabase/migrations/20260919090000_study_hub_resources.sql

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env when dotenv is available; real env vars still work without it.
try {
  const { config } = await import('dotenv');
  config({ path: path.resolve(__dirname, '..', '.env') });
} catch {
  // dotenv not installed - rely on process.env
}

// ----------------------
// CLI arguments
// ----------------------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
const positional = argv.filter((arg) => !arg.startsWith('--'));

const DRY_RUN = flags.has('--dry-run') || flags.has('-n');
const BUCKET_NAME = positional[0] || process.env.SUPABASE_RESOURCES_BUCKET || 'study-hub-resources';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// `./resources` should work whether you run this from the repo root or backend/.
function resolveFolder(candidate) {
  const asGiven = path.resolve(candidate);

  if (fs.existsSync(asGiven)) return asGiven;

  const fromRepoRoot = path.resolve(REPO_ROOT, String(candidate).replace(/^[.\\/]+/, ''));

  if (fs.existsSync(fromRepoRoot)) return fromRepoRoot;

  return asGiven;
}

const FOLDER_PATH = resolveFolder(positional[1] || 'resources');

// Object keys are stored under this prefix, mirroring the local folder layout.
const STORAGE_PREFIX = 'documents';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_FILE_SIZE_BYTES = 52428800; // 50 MB - Supabase Free plan ceiling

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

// Supabase Storage rejects these characters in object keys (they must be rewritten).
const DISALLOWED_CHARS = /[^A-Za-z0-9_\-.'!,*&$@=;:?() ]/g;

// Explicit ASCII rewrites so the whitelist derivation below is deterministic.
const ASCII_REWRITES = [
  ['[', '('],
  [']', ')'],
  ['{', '('],
  ['}', ')'],
  ['%', ' percent '],
  ['\\', '-'],
  ['/', '-'],
  ['|', '-'],
  ['<', '-'],
  ['>', '-'],
  ['"', "'"]
];

// Never upload these: 0-byte Windows stubs that ended up in the archive.
const SKIP_EXTENSIONS = new Set(['.exe']);

function sanitizeFileName(fileName) {
  const ext = path.extname(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;

  let safeBase = base
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4\u0060]/g, "'") // ’ -> '
    .replace(/[\u201C\u201D\u201E]/g, "'") // ” -> '
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\[\{]/g, '(')
    .replace(/[\]\}]/g, ')')
    .replace(DISALLOWED_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[.\s-]+/, '')
    .replace(/[.\s-]+$/, '');

  // Final pass: make sure nothing the whitelist rejects survives.
  for (const [from, to] of ASCII_REWRITES) {
    if (safeBase.includes(from)) safeBase = safeBase.split(from).join(to);
  }

  safeBase = safeBase.replace(/\s+/g, ' ').replace(/-{2,}/g, '-').trim();

  return `${safeBase || 'file'}${ext.toLowerCase()}`;
}

// Recursively collect every uploadable file (resources/ has bio/ and chem/ subfolders).
function collectFiles(folder, root = folder, found = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const absolute = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      collectFiles(absolute, root, found);
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    const stats = fs.statSync(absolute);

    found.push({
      absolute,
      relative: path.relative(root, absolute).split(path.sep).join('/'),
      extension,
      sizeBytes: stats.size,
      isEmpty: stats.size === 0,
      skipped: SKIP_EXTENSIONS.has(extension) ? `ignored extension ${extension}` : null
    });
  }

  return found;
}

// documents/bio/papers/A-level-Science Self help Materials-1 - NCDC.pdf
function buildObjectKey(relativePath) {
  const segments = relativePath.split('/').map((segment) => sanitizeFileName(segment));
  return [STORAGE_PREFIX, ...segments].join('/');
}

async function batchUpload() {
  if (!fs.existsSync(FOLDER_PATH)) {
    console.error(`Folder not found: ${FOLDER_PATH}`);
    process.exitCode = 1;
    return;
  }

  const files = collectFiles(FOLDER_PATH);

  const uploadable = files.filter(
    (file) => !file.skipped && !file.isEmpty && file.sizeBytes <= MAX_FILE_SIZE_BYTES
  );

  const skipped = files.filter(
    (file) => file.skipped || file.isEmpty || file.sizeBytes > MAX_FILE_SIZE_BYTES
  );

  console.log(`Bucket  : ${BUCKET_NAME}`);
  console.log(`Folder  : ${FOLDER_PATH}`);
  console.log(`Files   : ${uploadable.length} to upload, ${skipped.length} skipped`);

  if (DRY_RUN) {
    for (const file of uploadable.slice(0, 10)) {
      console.log(`  ${file.relative}  ->  ${buildObjectKey(file.relative)}`);
    }
    if (uploadable.length > 10) {
      console.log(`  ... and ${uploadable.length - 10} more`);
    }
    console.log('\nDry run: nothing was uploaded.');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Copy backend/.env.example to backend/.env and fill them in, then re-run.');
    process.exitCode = 1;
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let uploaded = 0;
  const failures = [];

  for (const file of uploadable) {
    const objectKey = buildObjectKey(file.relative);
    const fileBuffer = fs.readFileSync(file.absolute);

    console.log(`Uploading ${file.relative}...`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectKey, fileBuffer, {
        contentType: MIME_TYPES[file.extension] || 'application/octet-stream',
        upsert: true
      });

    if (error) {
      console.error(`  Error uploading ${file.relative}: ${error.message}`);
      failures.push({ relative: file.relative, objectKey, error: error.message });
    } else {
      console.log(`  Uploaded successfully: ${data.path}`);
      uploaded += 1;
    }
  }

  console.log(`\nDone. ${uploaded} uploaded, ${failures.length} failed, ${skipped.length} skipped.`);

  if (failures.length) {
    console.log('Failures:');
    for (const failure of failures.slice(0, 10)) {
      console.log(`  ! ${failure.relative} - ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

// Only run when executed directly, so the helpers stay importable/testable.
const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedDirectly) {
  batchUpload().catch((err) => {
    console.error('Unexpected error:', err);
    process.exitCode = 1;
  });
}

export { sanitizeFileName, buildObjectKey, collectFiles, BUCKET_NAME, FOLDER_PATH };