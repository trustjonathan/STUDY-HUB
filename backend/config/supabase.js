// backend/config/supabase.js
//
// Single place where the app talks to Supabase.
//
// ENV (see backend/.env.example):
//   SUPABASE_URL                 https://<project-ref>.supabase.co
//   SUPABASE_ANON_KEY            public key  -> safe for read-only app usage
//   SUPABASE_SERVICE_ROLE_KEY    secret key  -> ONLY used by scripts / server,
//                                never shipped to the browser
//   SUPABASE_RESOURCES_BUCKET    defaults to `study-hub-resources`
//
// The SDK and dotenv are required lazily so plain tooling (e.g. `--dry-run`)
// keeps working before `npm install` has been run.

try {
  require('dotenv').config();
} catch (err) {
  // dotenv not installed yet - fine for offline planning / dry runs.
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESOURCES_BUCKET = process.env.SUPABASE_RESOURCES_BUCKET || 'study-hub-resources';
// Namespaced on purpose: a Supabase project may already host another app's
// own `resources` table (e.g. StudiFy), so Study Hub never touches it.
const RESOURCES_TABLE = process.env.SUPABASE_RESOURCES_TABLE || 'study_hub_resources';

function hasSupabaseCredentials(role = 'anon') {
  if (!SUPABASE_URL) return false;
  if (role === 'service') return Boolean(SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY);
}

let anonClient = null;
let serviceClient = null;

function loadSdk() {
  try {
    return require('@supabase/supabase-js');
  } catch (err) {
    throw new Error(
      "Missing dependency '@supabase/supabase-js'. Run `npm install` inside the backend folder first."
    );
  }
}

function getSupabaseClient({ role = 'anon' } = {}) {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  }

  if (role === 'service') {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (required for uploads / admin access).');
    }

    if (!serviceClient) {
      const { createClient } = loadSdk();
      serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }

    return serviceClient;
  }

  if (!hasSupabaseCredentials('anon')) {
    throw new Error('SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set.');
  }

  if (!anonClient) {
    const { createClient } = loadSdk();
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return anonClient;
}

// Public URL for an object in a public bucket.
function publicUrlFor(storagePath, { bucket = RESOURCES_BUCKET, supabaseUrl = SUPABASE_URL } = {}) {
  if (!supabaseUrl) return null;
  const encoded = String(storagePath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}

module.exports = {
  SUPABASE_URL,
  RESOURCES_BUCKET,
  RESOURCES_TABLE,
  hasSupabaseCredentials,
  getSupabaseClient,
  publicUrlFor
};