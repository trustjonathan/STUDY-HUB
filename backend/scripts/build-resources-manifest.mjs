#!/usr/bin/env node
// backend/scripts/build-resources-manifest.mjs
//
// Reads the LIVE Supabase Storage bucket, builds the resource index the static
// frontend uses, and (optionally) indexes the rows in public.study_hub_resources.
//
// Uses only Node's built-in fetch - no npm install required.
//
// Usage (from the backend folder):
//   node scripts/build-resources-manifest.mjs              # write manifest files
//   node scripts/build-resources-manifest.mjs --index-db   # also upsert catalog rows
//   node scripts/build-resources-manifest.mjs --check      # report only, write nothing

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import meta from './lib/resourceMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

// ----------------------
// env
// ----------------------
try {
  const { config } = await import('dotenv');
  config({ path: path.join(BACKEND_DIR, '.env') });
} catch {
  // dotenv optional
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvFile(path.join(BACKEND_DIR, '.env'));

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BUCKET = process.env.SUPABASE_RESOURCES_BUCKET || 'study-hub-resources';
const PREFIX = (process.env.SUPABASE_RESOURCES_PREFIX || 'documents').replace(/^\/+|\/+$/g, '');
const TABLE = process.env.SUPABASE_RESOURCES_TABLE || 'study_hub_resources';

const FLAGS = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const INDEX_DB = FLAGS.has('--index-db');
const CHECK_ONLY = FLAGS.has('--check');

const KEY = SERVICE_KEY || ANON_KEY;

const OUT_JS = path.join(REPO_ROOT, 'frontend', 'src', 'data', 'resources.js');
const OUT_JSON = path.join(REPO_ROOT, 'frontend', 'src', 'data', 'resources.json');

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL and/or a Supabase key.');
  console.error(`Fill in ${path.join(BACKEND_DIR, '.env')} (see .env.example).`);
  process.exitCode = 1;
  process.exit();
}

// ----------------------
// Storage listing (recursive)
// ----------------------
const AUTH_HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json'
};

async function listPrefix(prefix) {
  const pageSize = 1000;
  let offset = 0;
  let out = [];

  for (;;) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ prefix, limit: pageSize, offset })
    });

    if (!response.ok) {
      throw new Error(`list("${prefix}") failed: ${response.status} ${await response.text()}`);
    }

    const page = await response.json();
    if (!Array.isArray(page) || !page.length) break;

    out = out.concat(page);

    if (page.length < pageSize) break;
    offset += page.length;
  }

  return out;
}

async function walk(prefix, found = []) {
  for (const entry of await listPrefix(prefix)) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.id === null || entry.id === undefined) {
      await walk(key, found);
      continue;
    }

    found.push({
      key,
      sizeBytes: Number(entry.metadata?.size) || 0,
      mimeType: entry.metadata?.mimetype || null,
      updatedAt: entry.updated_at || entry.created_at || null
    });
  }

  return found;
}

function publicUrlFor(key) {
  const encoded = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

// ----------------------
// Classification
// ----------------------
function classifyKey(key) {
  const relative = PREFIX && key.startsWith(`${PREFIX}/`) ? key.slice(PREFIX.length + 1) : key;
  const segments = relative.split('/');
  const originalFilename = segments[segments.length - 1];
  const info = meta.classifyResource({ relPath: relative, originalFilename });

  return { relative, originalFilename, ...info };
}

// ----------------------
// Database indexing (optional)
// ----------------------
async function indexDatabase(items) {
  const rows = items.map((item) => ({
    subject: item.subject || 'unknown',
    category: item.category,
    storage_bucket: BUCKET,
    storage_path: item.storagePath,
    original_filename: item.originalFilename,
    title: item.title,
    extension: item.extension,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    level: item.level,
    year: item.year,
    resource_type: item.resourceType
  }));

  const chunkSize = 200;
  let written = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=storage_bucket,storage_path`,
      {
        method: 'POST',
        headers: {
          ...AUTH_HEADERS,
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(chunk)
      }
    );

    if (!response.ok) {
      throw new Error(`Indexing failed: ${response.status} ${await response.text()}`);
    }

    written += chunk.length;
    console.log(`  indexed ${written}/${rows.length} rows`);
  }
}

// ----------------------
// Main
// ----------------------
function countBy(items, field) {
  const counts = {};
  for (const item of items) {
    const key = item[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function main() {
  console.log(`Project : ${SUPABASE_URL}`);
  console.log(`Bucket  : ${BUCKET}`);
  console.log(`Prefix  : ${PREFIX}/`);

  const files = await walk(PREFIX);
  files.sort((a, b) => a.key.localeCompare(b.key));
  console.log(`Objects : ${files.length}`);

  const items = files.map((file) => {
    const info = classifyKey(file.key);

    return {
      key: file.key,
      storageBucket: BUCKET,
      storagePath: file.key,
      title: info.title,
      originalFilename: info.originalFilename,
      subject: info.subject,
      category: info.category,
      level: info.level,
      year: info.year,
      resourceType: info.resourceType,
      extension: info.extension.replace(/^\./, ''),
      mimeType: file.mimeType || info.mimeType,
      sizeBytes: file.sizeBytes,
      updatedAt: file.updatedAt,
      publicUrl: publicUrlFor(file.key)
    };
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    projectUrl: SUPABASE_URL,
    bucket: BUCKET,
    prefix: PREFIX,
    count: items.length,
    totals: {
      bytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
      bySubject: countBy(items, 'subject'),
      byCategory: countBy(items, 'category'),
      byLevel: countBy(items, 'level'),
      byType: countBy(items, 'resourceType')
    },
    items
  };

  console.log('By subject :', JSON.stringify(manifest.totals.bySubject));
  console.log('By category:', JSON.stringify(manifest.totals.byCategory));
  console.log('By type    :', JSON.stringify(manifest.totals.byType));

  if (CHECK_ONLY) {
    console.log('\n--check: nothing written.');
    return;
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    OUT_JS,
    [
      '// GENERATED FILE - do not edit by hand.',
      '// Source: Supabase Storage bucket "study-hub-resources" (prefix: documents/).',
      '// Regenerate with: cd backend && node scripts/build-resources-manifest.mjs',
      `window.STUDY_HUB_RESOURCES = ${JSON.stringify(manifest)};`,
      ''
    ].join('\n'),
    'utf8'
  );

  console.log(`\nWrote ${path.relative(REPO_ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_JS)}`);

  if (INDEX_DB) {
    console.log(`\nIndexing into ${TABLE}...`);
    await indexDatabase(items);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exitCode = 1;
});
