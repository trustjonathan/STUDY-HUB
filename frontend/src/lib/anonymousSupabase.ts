import { createClient } from '@supabase/supabase-js';

interface CachedClient {
  url: string;
  anonKey: string;
  client: ReturnType<typeof createClient>;
}

const clientGlobal = globalThis as typeof globalThis & {
  studyHubAnonymousSupabase?: CachedClient;
};

export function getAnonymousSupabase(url: string, anonKey: string) {
  const cached = clientGlobal.studyHubAnonymousSupabase;
  if (cached?.url === url && cached.anonKey === anonKey) return cached.client;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  clientGlobal.studyHubAnonymousSupabase = { url, anonKey, client };
  return client;
}