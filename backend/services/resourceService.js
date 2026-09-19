// backend/services/resourceService.js
//
// Read side of the resource library. The binary files live in Supabase Storage;
// their metadata lives in the `resources` table (or in the locally generated
// manifest when Supabase credentials are not configured).

const fs = require('fs');
const path = require('path');

const {
  getSupabaseClient,
  hasSupabaseCredentials,
  publicUrlFor,
  RESOURCES_BUCKET,
  RESOURCES_TABLE
} = require('../config/supabase');

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '..', 'data', 'resources-manifest.json');
const MAX_PAGE_SIZE = 200;

function normalise(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function readManifest(manifestPath = process.env.RESOURCES_MANIFEST || DEFAULT_MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return Array.isArray(parsed.items) ? parsed : null;
  } catch (err) {
    return null;
  }
}

// Apply the same filters to manifest rows and to database rows.
function applyFilters(items, filters = {}) {
  const subject = normalise(filters.subject);
  const category = normalise(filters.category);
  const level = normalise(filters.level);
  const type = normalise(filters.type || filters.resourceType);
  const year = filters.year ? Number(filters.year) : null;
  const search = normalise(filters.search);

  return items.filter((item) => {
    if (subject && normalise(item.subject) !== subject) return false;
    if (category && normalise(item.category) !== category) return false;
    if (level && normalise(item.level) !== level) return false;
    if (type && normalise(item.resourceType) !== type) return false;
    if (year && Number(item.year) !== year) return false;
    if (search) {
      const haystack = `${item.title || ''} ${item.originalFilename || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function paginate(items, filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), MAX_PAGE_SIZE);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
}

class ResourceService {
  constructor() {
    this.manifestCache = null;
  }

  get manifest() {
    if (!this.manifestCache) this.manifestCache = readManifest();
    return this.manifestCache;
  }

  withPublicUrl(item) {
    if (!item) return item;
    return {
      ...item,
      publicUrl: item.publicUrl || publicUrlFor(item.storagePath, { bucket: RESOURCES_BUCKET })
    };
  }

  // Offline / no-credentials fallback, and also the source for `stats`.
  listFromManifest(filters = {}) {
    if (!this.manifest) return null;
    const filtered = applyFilters(this.manifest, filters);
    const page = paginate(filtered, filters);
    return { ...page, source: 'manifest', items: page.items.map((item) => this.withPublicUrl(item)) };
  }

  // Live catalog query (public.resources).
  async listFromCatalog(filters = {}) {
    const supabase = getSupabaseClient({ role: 'anon' });
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), MAX_PAGE_SIZE);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    let query = supabase.from(RESOURCES_TABLE).select('*', { count: 'exact' });

    if (filters.subject) query = query.eq('subject', normalise(filters.subject));
    if (filters.category) query = query.eq('category', normalise(filters.category));
    if (filters.level) query = query.eq('level', filters.level);
    if (filters.type || filters.resourceType) query = query.eq('resource_type', normalise(filters.type || filters.resourceType));
    if (filters.year) query = query.eq('year', Number(filters.year));

    if (filters.search) {
      const term = String(filters.search).replace(/[%,()]/g, ' ').trim();
      if (term) query = query.or(`title.ilike.%${term}%,original_filename.ilike.%${term}%`);
    }

    const { data, error, count } = await query
      .order('subject', { ascending: true })
      .order('category', { ascending: true })
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return {
      total: typeof count === 'number' ? count : (data || []).length,
      limit,
      offset,
      source: 'supabase',
      items: (data || []).map((row) => this.withPublicUrl(mapRow(row)))
    };
  }

  async list(filters = {}) {
    if (!filters.forceManifest && hasSupabaseCredentials('anon')) {
      try {
        return await this.listFromCatalog(filters);
      } catch (err) {
        console.warn('Resource catalog unavailable, using local manifest instead:', err.message);
      }
    }

    const fromManifest = this.listFromManifest(filters);
    if (fromManifest) return fromManifest;

    return {
      total: 0,
      limit: Number(filters.limit) || 50,
      offset: Number(filters.offset) || 0,
      source: 'none',
      items: [],
      warning: 'No Supabase credentials and no manifest found. Run `npm run resources:plan` in the backend folder.'
    };
  }

  async getById(id) {
    if (!hasSupabaseCredentials('anon')) return null;

    const supabase = getSupabaseClient({ role: 'anon' });
    const { data, error } = await supabase.from(RESOURCES_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return this.withPublicUrl(mapRow(data));
  }

  async getByStoragePath(storagePath) {
    if (!hasSupabaseCredentials('anon')) return null;

    const supabase = getSupabaseClient({ role: 'anon' });
    const { data, error } = await supabase
      .from(RESOURCES_TABLE)
      .select('*')
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return this.withPublicUrl(mapRow(data));
  }

  // Only needed if the bucket is switched to private later.
  async createSignedUrl(storagePath, expiresIn = 3600) {
    const supabase = getSupabaseClient({ role: 'service' });
    const { data, error } = await supabase.storage
      .from(RESOURCES_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  // Aggregated counts for dashboards / browse filters.
  async stats() {
    const rows = [];

    if (hasSupabaseCredentials('anon')) {
      try {
        const supabase = getSupabaseClient({ role: 'anon' });
        const { data, error } = await supabase
          .from(RESOURCES_TABLE)
          .select('subject, category, level, resource_type, size_bytes');

        if (error) throw new Error(error.message);
        rows.push(...(data || []).map(mapRow));
      } catch (err) {
        console.warn('Resource stats unavailable from Supabase:', err.message);
      }
    }

    if (!rows.length && this.manifest) rows.push(...this.manifest);

    const empty = () => ({ files: 0, bytes: 0 });
    const stats = {
      files: rows.length,
      bytes: rows.reduce((sum, row) => sum + (Number(row.sizeBytes) || 0), 0),
      subjects: {},
      categories: {},
      levels: {},
      types: {}
    };

    const bump = (bucket, key, bytes) => {
      const safeKey = key || 'unknown';
      bucket[safeKey] = bucket[safeKey] || empty();
      bucket[safeKey].files += 1;
      bucket[safeKey].bytes += bytes;
    };

    for (const row of rows) {
      const bytes = Number(row.sizeBytes) || 0;
      bump(stats.subjects, row.subject, bytes);
      bump(stats.categories, row.category, bytes);
      bump(stats.levels, row.level, bytes);
      bump(stats.types, row.resourceType, bytes);
    }

    return stats;
  }
}

// Database row (snake_case) -> API shape (camelCase).
function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    title: row.title,
    extension: row.extension,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    checksumSha256: row.checksum_sha256,
    level: row.level,
    year: row.year,
    resourceType: row.resource_type,
    duplicateOf: row.duplicate_of,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at
  };
}

module.exports = new ResourceService();
module.exports.readManifest = readManifest;
module.exports.applyFilters = applyFilters;
module.exports.ResourceService = ResourceService;