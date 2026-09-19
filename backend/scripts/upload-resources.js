#!/usr/bin/env node
// backend/scripts/upload-resources.js
//
// One-off (and repeatable) migration: push everything in ../resources to the
// Supabase Storage bucket `study-hub-resources` and index it in the
// public.resources table, so the binary study material no longer needs to live
// in the GitHub repository.
//
// Usage (from the backend folder):
//   node scripts/upload-resources.js --dry-run          # plan only, no network, no SDK needed
//   node scripts/upload-resources.js                    # upload + index
//   node scripts/upload-resources.js --dedupe           # skip byte-identical copies
//   node scripts/upload-resources.js --only=chem/papers --limit=5
//
// Flags:
//   --dry-run, -n        show the plan and write the manifest, upload nothing
//   --dedupe             skip files whose SHA-256 already appeared (extra copies)
//   --force              overwrite objects that already exist in the bucket
//   --skip-db            upload files but do not touch public.resources
//   --create-bucket      create the bucket automatically if it is missing
//   --include-exe        also upload the 6 empty .exe placeholders (default: skipped)
//   --include-empty      also upload zero-byte files
//   --only=<prefix>      only files whose relative path starts with the prefix
//   --limit=<n>          only the first n files (useful for a smoke test)
//   --concurrency=<n>    parallel uploads (default 3)
//   --retries=<n>        attempts per file (default 3)
//   --bucket=<name>      override SUPABASE_RESOURCES_BUCKET
//   --resources-dir=<p>  override the source folder (default: <repo>/resources)
//   --report=<p>         manifest output path (default backend/data/resources-manifest.json)
//   --quiet              suppress progress output
//   --help, -h           this text

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { walkFiles, resolveResourcesDir, sha256File } = require('./lib/resourceWalker');
const { classifyResource, formatBytes, sanitizeStorageKey } = require('./lib/resourceMeta');
const {
  getSupabaseClient,
  SUPABASE_URL,
  RESOURCES_BUCKET,
  RESOURCES_TABLE
} = require('../config/supabase');

const DEFAULT_REPORT_PATH = path.resolve(__dirname, '..', 'data', 'resources-manifest.json');
const DEFAULT_SKIP_EXTENSIONS = ['.exe'];
const DB_TABLE = RESOURCES_TABLE;
const MAX_FILE_SIZE_BYTES = 52428800; // 50 MB - Supabase Free plan ceiling

function printHelp() {
  const header = fs.readFileSync(__filename, 'utf8').split('\n');
  const end = header.findIndex((line) => line.startsWith('const fs = require'));
  console.log(header.slice(1, end > 0 ? end : 40).join('\n').replace(/^\/\/ ?/gm, ''));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    dedupe: false,
    force: false,
    skipDb: false,
    createBucket: false,
    includeEmpty: false,
    quiet: false,
    help: false,
    only: null,
    limit: null,
    concurrency: 3,
    retries: 3,
    bucket: RESOURCES_BUCKET,
    resourcesDir: null,
    report: DEFAULT_REPORT_PATH,
    skipExtensions: [...DEFAULT_SKIP_EXTENSIONS]
  };

  for (const raw of argv) {
    const arg = String(raw).trim();
    if (!arg) continue;

    if (arg === '--dry-run' || arg === '-n') options.dryRun = true;
    else if (arg === '--dedupe') options.dedupe = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--skip-db') options.skipDb = true;
    else if (arg === '--create-bucket') options.createBucket = true;
    else if (arg === '--include-empty') options.includeEmpty = true;
    else if (arg === '--include-exe') options.skipExtensions = [];
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--only=')) options.only = arg.slice('--only='.length);
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length)) || null;
    else if (arg.startsWith('--concurrency=')) options.concurrency = Math.max(1, Number(arg.slice('--concurrency='.length)) || 3);
    else if (arg.startsWith('--retries=')) options.retries = Math.max(1, Number(arg.slice('--retries='.length)) || 3);
    else if (arg.startsWith('--bucket=')) options.bucket = arg.slice('--bucket='.length);
    else if (arg.startsWith('--resources-dir=')) options.resourcesDir = arg.slice('--resources-dir='.length);
    else if (arg.startsWith('--report=')) options.report = path.resolve(process.cwd(), arg.slice('--report='.length));
    else throw new Error(`Unknown argument: ${arg} (try --help)`);
  }

  return options;
}

// ----------------------
// Planning
// ----------------------

async function buildPlan(options) {
  const root = resolveResourcesDir(options.resourcesDir);
  const files = walkFiles(root, { skipExtensions: options.skipExtensions });

  const checksums = new Map(); // checksum -> first relPath
  const items = [];
  const warnings = [];
  let skippedEmpty = 0;
  let skippedByFilter = 0;

  for (const file of files) {
    if (options.only && !file.relPath.toLowerCase().startsWith(options.only.toLowerCase())) {
      skippedByFilter += 1;
      continue;
    }

    if (file.isEmpty && !options.includeEmpty) {
      skippedEmpty += 1;
      continue;
    }

    const checksumSha256 = await sha256File(file.absPath);
    const meta = classifyResource({ relPath: file.relPath, originalFilename: file.originalFilename });
    const storageKey = sanitizeStorageKey(file.relPath);

    const item = {
      relPath: file.relPath,
      absPath: file.absPath,
      originalFilename: file.originalFilename,
      storageKey,
      keyChanged: storageKey !== file.relPath,
      sizeBytes: file.sizeBytes,
      checksumSha256,
      subject: meta.subject,
      category: meta.category,
      level: meta.level,
      year: meta.year,
      resourceType: meta.resourceType,
      title: meta.title,
      extension: meta.extension,
      mimeType: meta.mimeType,
      duplicateOf: null,
      status: 'pending',
      error: null
    };

    if (!item.subject) warnings.push(`Unknown subject folder (kept anyway): ${file.relPath}`);
    if (item.sizeBytes > MAX_FILE_SIZE_BYTES) warnings.push(`Larger than the 50 MB Supabase limit: ${file.relPath}`);

    if (checksums.has(checksumSha256)) item.duplicateOf = checksums.get(checksumSha256);
    else checksums.set(checksumSha256, file.relPath);

    items.push(item);
  }

  // Two different source files can sanitise to the same object key, so make keys unique.
  const usedKeys = new Set();
  for (const item of items) {
    if (!usedKeys.has(item.storageKey)) {
      usedKeys.add(item.storageKey);
      continue;
    }

    const suffix = `-${item.checksumSha256.slice(0, 8)}`;
    const base = item.extension ? item.storageKey.slice(0, -item.extension.length) : item.storageKey;
    item.storageKey = `${base}${suffix}${item.extension}`;
    item.keyChanged = true;
    usedKeys.add(item.storageKey);
  }

  const selected = options.limit ? items.slice(0, options.limit) : items;

  return {
    root,
    items: selected,
    skippedEmpty,
    skippedByFilter,
    warnings,
    scannedFiles: files.length
  };
}

// ----------------------
// Summary
// ----------------------

function summarize(items) {
  const totals = {
    files: items.length,
    bytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
    duplicates: items.filter((item) => item.duplicateOf).length,
    duplicateBytes: items
      .filter((item) => item.duplicateOf)
      .reduce((sum, item) => sum + item.sizeBytes, 0),
    keyRewrites: items.filter((item) => item.keyChanged).length,
    bySubject: {},
    byCategory: {},
    byType: {}
  };

  const bump = (bucket, key, bytes) => {
    bucket[key] = bucket[key] || { files: 0, bytes: 0 };
    bucket[key].files += 1;
    bucket[key].bytes += bytes;
  };

  for (const item of items) {
    bump(totals.bySubject, item.subject || 'unknown', item.sizeBytes);
    bump(totals.byCategory, item.category || 'unknown', item.sizeBytes);
    totals.byType[item.resourceType || 'other'] = (totals.byType[item.resourceType || 'other'] || 0) + 1;
  }

  return totals;
}

function printPlanSummary(plan, options, log) {
  const totals = summarize(plan.items);

  log('');
  log(`Source folder  : ${plan.root}`);
  log(`Bucket         : ${options.bucket}${SUPABASE_URL ? `  (${SUPABASE_URL})` : ''}`);
  log(`Catalog table  : ${DB_TABLE}`);
  log(`Files scanned  : ${plan.scannedFiles}`);
  log(`Files planned  : ${totals.files}  (${formatBytes(totals.bytes)})`);
  log(`Duplicate bytes: ${formatBytes(totals.duplicateBytes)} across ${totals.duplicates} extra copies`);
  log(`Key rewrites   : ${totals.keyRewrites}  (names containing [ ] ’ etc.)`);

  if (plan.skippedEmpty) log(`Skipped (0 B)  : ${plan.skippedEmpty}`);
  if (plan.skippedByFilter) log(`Skipped (filter): ${plan.skippedByFilter}`);

  log('');
  log('By subject:');
  for (const [subject, value] of Object.entries(totals.bySubject)) {
    log(`  ${subject.padEnd(12)} ${String(value.files).padStart(4)} files   ${formatBytes(value.bytes)}`);
  }

  log('By category:');
  for (const [category, value] of Object.entries(totals.byCategory)) {
    log(`  ${category.padEnd(12)} ${String(value.files).padStart(4)} files   ${formatBytes(value.bytes)}`);
  }

  log('By detected type:');
  for (const [type, count] of Object.entries(totals.byType)) {
    log(`  ${type.padEnd(12)} ${String(count).padStart(4)} files`);
  }

  if (plan.warnings.length) {
    log('');
    log(`Warnings (${plan.warnings.length}):`);
    for (const warning of plan.warnings.slice(0, 15)) log(`  ! ${warning}`);
    if (plan.warnings.length > 15) log(`  ... and ${plan.warnings.length - 15} more`);
  }

  log('');
  return totals;
}

// ----------------------
// Reporting
// ----------------------

function publicUrl(storageKey, bucket) {
  if (!SUPABASE_URL) return null;
  const encoded = String(storageKey)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}

function toReportItem(item, bucket) {
  return {
    relPath: item.relPath,
    storageKey: item.storageKey,
    originalFilename: item.originalFilename,
    subject: item.subject,
    category: item.category,
    level: item.level,
    year: item.year,
    resourceType: item.resourceType,
    title: item.title,
    extension: item.extension.replace(/^\./, ''),
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    checksumSha256: item.checksumSha256,
    duplicateOf: item.duplicateOf,
    publicUrl: publicUrl(item.storageKey, bucket),
    status: item.status,
    error: item.error
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

// ----------------------
// Uploading
// ----------------------

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/plain'
];

async function ensureBucket(supabase, bucket, log) {
  const existing = await supabase.storage.getBucket(bucket);
  if (existing && existing.data) return existing.data;

  const { data, error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES
  });

  if (error) throw new Error(`Could not create bucket "${bucket}": ${error.message}`);
  log(`Created bucket "${bucket}"`);
  return data;
}

// Storage list() is not recursive, so walk every folder.
async function collectStorageKeys(supabase, bucket, prefix, keys) {
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;

    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) await collectStorageKeys(supabase, bucket, full, keys);
      else keys.add(full);
    }

    if (data.length < pageSize) break;
    offset += data.length;
  }
}

function runWithConcurrency(items, limit, worker) {
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });

  return Promise.all(runners);
}

async function uploadOne(supabase, item, options) {
  const body = fs.readFileSync(item.absPath);

  const { error } = await supabase.storage.from(options.bucket).upload(item.storageKey, body, {
    contentType: item.mimeType,
    upsert: options.force,
    cacheControl: '31536000'
  });

  if (error) throw new Error(error.message);
}

async function withRetry(fn, attempts) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await delay(500 * attempt);
    }
  }

  throw lastError;
}

function toRow(item) {
  return {
    subject: item.subject || 'unknown',
    category: item.category,
    storage_bucket: item.bucket,
    storage_path: item.storageKey,
    original_filename: item.originalFilename,
    title: item.title,
    extension: item.extension.replace(/^\./, ''),
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    checksum_sha256: item.checksumSha256,
    level: item.level,
    year: item.year,
    resource_type: item.resourceType,
    duplicate_of: item.duplicateOf
  };
}

async function indexRows(supabase, rows, log) {
  const chunkSize = 200;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase
      .from(DB_TABLE)
      .upsert(chunk, { onConflict: 'storage_bucket,storage_path' });

    if (error) throw new Error(`Indexing failed: ${error.message}`);
    log(`  indexed ${Math.min(index + chunkSize, rows.length)}/${rows.length} rows`);
  }
}

// ----------------------
// Orchestration
// ----------------------

function createLogger(quiet) {
  return (...parts) => {
    if (!quiet) console.log(...parts);
  };
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const log = createLogger(options.quiet);

  log('');
  log('Study Hub :: local resources -> Supabase');
  log(`Mode: ${options.dryRun ? 'DRY RUN (nothing is uploaded)' : 'LIVE UPLOAD'}`);

  const plan = await buildPlan(options);
  plan.items.forEach((item) => {
    item.bucket = options.bucket;
  });

  // A dry run must never need credentials or the SDK.
  if (options.dryRun) {
    const totals = printPlanSummary(plan, options, log);
    const reportPath = writeReport(options.report, {
      generatedAt: new Date().toISOString(),
      dryRun: true,
      supabaseUrl: SUPABASE_URL || null,
      bucket: options.bucket,
      table: DB_TABLE,
      sourceRoot: plan.root,
      totals,
      warnings: plan.warnings,
      items: plan.items.map((item) => toReportItem(item, options.bucket))
    });

    log(`Manifest written: ${reportPath}`);
    return;
  }

  let supabase;

  try {
    supabase = getSupabaseClient({ role: 'service' });
  } catch (err) {
    console.error(`\n${err.message}`);
    console.error('Fill in backend/.env (see backend/.env.example), or run with --dry-run.');
    process.exitCode = 1;
    return;
  }

  try {
    const { data } = await supabase.storage.getBucket(options.bucket);
    if (!data) throw new Error('bucket not found');
    log(`\nBucket "${options.bucket}" found.`);
  } catch (err) {
    if (!options.createBucket) {
      console.error(`\nBucket "${options.bucket}" does not exist.`);
      console.error('Apply supabase/migrations/20260919090000_study_hub_resources.sql first (`npm run db:push`),');
      console.error('or re-run with --create-bucket.');
      process.exitCode = 1;
      return;
    }

    await ensureBucket(supabase, options.bucket, log);
  }

  log('Listing objects already in the bucket...');
  const existingKeys = new Set();
  await withRetry(() => collectStorageKeys(supabase, options.bucket, '', existingKeys), options.retries);
  log(`  ${existingKeys.size} object(s) already stored.`);

  let skippedExisting = 0;
  let skippedDuplicates = 0;
  const queue = [];

  for (const item of plan.items) {
    if (existingKeys.has(item.storageKey) && !options.force) {
      item.status = 'exists';
      skippedExisting += 1;
      continue;
    }

    if (options.dedupe && item.duplicateOf) {
      item.status = 'duplicate';
      skippedDuplicates += 1;
      continue;
    }

    queue.push(item);
  }

  log(`To upload: ${queue.length}  |  already present: ${skippedExisting}  |  duplicate copies skipped: ${skippedDuplicates}`);

  let uploaded = 0;
  let failed = 0;
  const failures = [];

  await runWithConcurrency(queue, options.concurrency, async (item) => {
    try {
      await withRetry(() => uploadOne(supabase, item, options), options.retries);
      item.status = 'uploaded';
      item.error = null;
      uploaded += 1;
    } catch (err) {
      item.status = 'failed';
      item.error = err.message;
      failed += 1;
      failures.push({ storageKey: item.storageKey, error: err.message });
    }

    if (!options.quiet) {
      process.stdout.write(`\r  progress ${uploaded + failed}/${queue.length}   `);
    }
  });

  if (!options.quiet && queue.length) process.stdout.write('\n');

  const indexable = plan.items.filter((item) => item.status === 'uploaded' || item.status === 'exists');

  if (options.skipDb) {
    log('\nSkipped database indexing (--skip-db).');
  } else if (indexable.length) {
    log(`\nIndexing ${indexable.length} row(s) into ${DB_TABLE}...`);

    try {
      await indexRows(supabase, indexable.map(toRow), log);
    } catch (err) {
      console.error(`  ! ${err.message}`);
      process.exitCode = 1;
    }
  }

  const totals = summarize(plan.items);
  const reportPath = writeReport(options.report, {
    generatedAt: new Date().toISOString(),
    dryRun: false,
    supabaseUrl: SUPABASE_URL,
    bucket: options.bucket,
    table: DB_TABLE,
    sourceRoot: plan.root,
    totals,
    uploaded,
    skippedExisting,
    skippedDuplicates,
    failed,
    failures,
    warnings: plan.warnings,
    items: plan.items.map((item) => toReportItem(item, options.bucket))
  });

  log('');
  log('Done.');
  log(`  uploaded          : ${uploaded}`);
  log(`  already present   : ${skippedExisting}`);
  log(`  duplicates skipped: ${skippedDuplicates}`);
  log(`  failed            : ${failed}`);

  if (failures.length) {
    log('  first failures:');
    for (const failure of failures.slice(0, 10)) log(`    ! ${failure.storageKey} - ${failure.error}`);
  }

  log(`  manifest          : ${reportPath}`);

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exitCode = 1;
});
