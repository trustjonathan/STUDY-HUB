import resourceManifestUrl from '../data/resources.json?url';

export const CATALOG_SOURCES = [
  {
    id: 'github-resources-1',
    label: 'GitHub Resources 1',
    url: 'study-hub-resources-1-catalog.json',
    fileBaseUrl: 'https://cdn.jsdelivr.net/gh/trustjonathan/STUDY-HUB-RESOURCES-1@main',
  },
  {
    id: 'github-2026',
    label: 'GitHub 2026 archive',
    url: 'https://cdn.jsdelivr.net/gh/trustjonathan/STUDT-HUB-RESOURCES-2026@main/resource-catalog.json',
    fileBaseUrl: 'https://cdn.jsdelivr.net/gh/trustjonathan/STUDT-HUB-RESOURCES-2026@main',
  },
  {
    id: 'fresh-teacher',
    label: 'Fresh Teacher',
    url: 'fresh-teacher-catalog.json',
  },
  {
    id: 'static-manifest',
    label: 'Checked-in resource manifest',
    url: resourceManifestUrl,
  },
] as const;

export const ENABLE_SUPABASE_CATALOG =
  import.meta.env.PUBLIC_ENABLE_SUPABASE_CATALOG?.trim().toLowerCase() === 'true';
