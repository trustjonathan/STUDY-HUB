import { useEffect, useMemo, useRef, useState } from 'react';
import { libraryClassGroups, libraryClasses } from '../data/libraryClasses';
import { availableSubjects } from '../data/availableSubjects';
import LearningPreferencesForm, { type LearningPreferences } from './LearningPreferencesForm';
import { clearAuthSession, readAuthSession, updateAuthSessionUser } from '../utils/authSession';

interface Props {
  homeHref: string;
  supabaseUrl: string;
  anonKey: string;
  apiUrl: string;
  embedded?: boolean;
}

type Source = 'study-hub' | 'fresh-teacher' | 'premium-resources';
type LibraryIconName = 'menu' | 'panel-left' | 'panel-left-open' | 'panel-right' | 'panel-right-open' | 'home' | 'bookshelf' | 'classes' | 'assistant' | 'close' | 'document' | 'shield' | 'scale';

interface Resource {
  id: string;
  subject: string;
  type: string;
  source: Source;
  title: string;
  url: string;
  keys: string[];
}

interface ResourceStats {
  resourceId: string;
  upVotes: number;
  downVotes: number;
  totalVotes: number;
  shareCount: number;
}

const TRENDING_2026_CLASS = { label: '2026 trending', keys: ['trending2026'] };
const UNSORTED_CLASS = { label: 'Unsorted files', keys: ['unsorted'] };
const PREMIUM_CATALOG_URL = 'https://raw.githubusercontent.com/trustjonathan/STUDT-HUB-RESOURCES-2026/main/resource-catalog.json';
const PREMIUM_RESOURCE_BASE_URL = 'https://raw.githubusercontent.com/trustjonathan/STUDT-HUB-RESOURCES-2026/main';

function findLibraryClass(label: string | null | undefined) {
  if (label === TRENDING_2026_CLASS.label) return TRENDING_2026_CLASS;
  if (label === UNSORTED_CLASS.label) return UNSORTED_CLASS;
  return libraryClasses.find((item) => item.label === label);
}

function LibraryIcon({ name }: { name: LibraryIconName }) {
  const shared = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'menu':
      return <svg {...shared}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'panel-left':
      return <svg {...shared}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 9l-3 3 3 3" /></svg>;
    case 'panel-left-open':
      return <svg {...shared}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m8-10 3 2-3 2" /></svg>;
    case 'panel-right':
      return <svg {...shared}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16m-6-11 3 3-3 3" /></svg>;
    case 'panel-right-open':
      return <svg {...shared}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16M7 10l-3 2 3 2" /></svg>;
    case 'home':
      return <svg {...shared}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
    case 'bookshelf':
      return <svg {...shared}><path d="M4 4h4v16H4zM10 6h4v14h-4zM16 3h4v17h-4zM3 21h18" /><path d="M5 7h2m5 2h2m5-3h2" /></svg>;
    case 'classes':
      return <svg {...shared}><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" /></svg>;
    case 'assistant':
      return <svg {...shared}><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /><circle cx="12" cy="12" r="5" /></svg>;
    case 'close':
      return <svg {...shared}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'document':
      return <svg {...shared}><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5M9 13h6M9 17h6" /></svg>;
    case 'shield':
      return <svg {...shared}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4" /></svg>;
    case 'scale':
      return <svg {...shared}><path d="M12 3v18M5 6h14M5 6l-3 7h6zM19 6l-3 7h6zM8 21h8" /></svg>;
  }
}

// Supabase stores `level` as S.3–S.6 / A-Level / O-Level; map onto shelf keys.
const SUPA_LEVEL_KEYS: Record<string, string[]> = {
  'S.3': ['s3'], 'S.4': ['s4'], 'S.5': ['s5'], 'S.6': ['s6'],
  'A-Level': ['s5', 's6'], 'O-Level': ['s1', 's2', 's3', 's4'],
};

function titleCase(value: string): string {
  const s = value.trim().replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Normalise Supabase category/resource_type into the shared type vocabulary.
function supaType(category: string, resourceType: string): string {
  if (category === 'papers') return 'Past Papers';
  if (resourceType === 'guide') return 'Guides';
  return 'Lesson Notes';
}

function previewFormat(url: string): string {
  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
    if (extension === 'pdf' || extension === 'docx') return extension;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')) return 'image';
  } catch {
    return '';
  }
  return '';
}

interface CatalogLoad {
  resources: Resource[];
  totalCount: number;
}

interface PremiumCatalogResource {
  path: string;
  title: string;
  year: string;
  classKeys: string[];
  subject?: string;
  type?: string;
}

const LIBRARY_CATALOG_CACHE = 'study-hub-library-catalog-v3';
const LIBRARY_CATALOG_CACHE_TTL = 6 * 60 * 60 * 1000;

function isPremiumCatalogResource(value: unknown): value is PremiumCatalogResource {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const validClassKeys = Array.isArray(item.classKeys)
    && item.classKeys.every((key) => typeof key === 'string' && /^(?:p[1-7]|s[1-6]|unsorted)$/.test(key));
  return typeof item.path === 'string'
    && item.path.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && !part.includes('\\'))
    && typeof item.title === 'string'
    && typeof item.year === 'string'
    && validClassKeys;
}

async function fetchCachedCatalog(catalogUrl: string): Promise<Response> {
  let cache: Cache | undefined;
  let staleResponse: Response | undefined;
  if ('caches' in window) {
    try {
      cache = await window.caches.open(LIBRARY_CATALOG_CACHE);
      const cached = await cache.match(catalogUrl);
      const cachedAt = Number(cached?.headers.get('x-study-hub-cached-at'));
      if (cached && Number.isFinite(cachedAt) && Date.now() - cachedAt < LIBRARY_CATALOG_CACHE_TTL) {
        return cached;
      }
      staleResponse = cached;
    } catch (cacheError) {
      console.warn('Library catalog cache could not be read; loading the catalog from the network.', cacheError);
    }
  }

  let response: Response;
  try {
    response = await fetch(catalogUrl, { cache: 'no-cache' });
  } catch (networkError) {
    if (staleResponse) {
      console.warn('Library catalog refresh failed; showing the saved catalog instead.', networkError);
      return staleResponse;
    }
    throw networkError;
  }
  if (!response.ok || !cache) return response;

  const headers = new Headers(response.headers);
  headers.set('x-study-hub-cached-at', String(Date.now()));
  void response.clone().arrayBuffer()
    .then((body) => cache?.put(catalogUrl, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })))
    .catch((cacheError: unknown) => {
      console.warn('Library catalog cache could not be updated; continuing with the network response.', cacheError);
    });
  return response;
}

async function loadFreshTeacher(catalogUrl: string): Promise<CatalogLoad> {
  const res = await fetchCachedCatalog(catalogUrl);
  if (!res.ok) throw new Error(`Additional subject catalog request failed (HTTP ${res.status}).`);
  const data = await res.json();
  const items: Array<{ classKey?: string; subject?: string; type?: string; title?: string; url?: string }>
    = Array.isArray(data?.items) ? data.items : [];
  const resources = items
    .filter((i) => typeof i.url === 'string' && i.url)
    .map((i) => {
      const subject = titleCase(i.subject || 'General');
      return {
        id: `ft:${i.url}`,
        subject: subject === 'All Subjects' ? 'General' : subject,
        type: i.type || 'Resources',
        source: 'fresh-teacher' as Source,
        title: (i.title || i.url || 'Untitled').trim(),
        url: i.url as string,
        keys: i.classKey ? [i.classKey] : [],
      };
    });
  return { resources, totalCount: resources.length };
}

async function loadPremiumResources(): Promise<CatalogLoad> {
  const response = await fetchCachedCatalog(PREMIUM_CATALOG_URL);
  if (!response.ok) throw new Error(`Premium resource catalog request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('resources' in payload) || !Array.isArray(payload.resources)) {
    throw new Error('Premium resource catalog has an invalid format.');
  }

  const resources = payload.resources
    .filter(isPremiumCatalogResource)
    .map((item) => {
      const resourcePath = item.path;
      const encodedPath = resourcePath.split('/').map(encodeURIComponent).join('/');
      const keys = item.classKeys.length ? [...item.classKeys] : [...UNSORTED_CLASS.keys];
      if (item.year === '2026') keys.push(...TRENDING_2026_CLASS.keys);
      return {
        id: `premium:${resourcePath}`,
        subject: typeof item.subject === 'string' ? item.subject : 'General',
        type: typeof item.type === 'string' ? item.type : 'Study Resources',
        source: 'premium-resources' as Source,
        title: item.title,
        url: `${PREMIUM_RESOURCE_BASE_URL}/${encodedPath}`,
        keys,
      };
    });
  return { resources, totalCount: resources.length };
}

async function loadSupabase(url: string, anonKey: string): Promise<CatalogLoad> {
  const endpoint = new URL('/rest/v1/study_hub_resources', url);
  endpoint.searchParams.set('select', 'subject,category,storage_bucket,storage_path,original_filename,title,size_bytes,level,year,resource_type');
  endpoint.searchParams.set('order', 'uploaded_at.desc,title.asc');
  endpoint.searchParams.set('limit', '1000');
  endpoint.searchParams.set('offset', '0');
  const headers: Record<string, string> = { apikey: anonKey, Prefer: 'count=exact' };
  if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`Study Hub catalog request failed (HTTP ${res.status}).`);
  const totalCount = res.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
  if (totalCount === undefined) throw new Error('Study Hub catalog did not provide an exact resource count.');
  const firstPage: unknown = await res.json();
  if (!Array.isArray(firstPage)) throw new Error('Study Hub catalog returned an invalid list.');
  const count = Number(totalCount);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Study Hub catalog returned an invalid resource count.');
  const offsets = Array.from({ length: Math.ceil(count / 1000) - 1 }, (_, index) => (index + 1) * 1000);
  const nextPages = await Promise.all(offsets.map(async (offset) => {
    const pageUrl = new URL(endpoint);
    pageUrl.searchParams.set('offset', String(offset));
    const pageResponse = await fetch(pageUrl, { headers });
    if (!pageResponse.ok) throw new Error(`Study Hub catalog page request failed (HTTP ${pageResponse.status}).`);
    const page: unknown = await pageResponse.json();
    if (!Array.isArray(page)) throw new Error('Study Hub catalog returned an invalid page.');
    return page;
  }));
  const rows = [...firstPage, ...nextPages.flat()] as Array<Record<string, unknown>>;
  const resources = rows.map((row) => {
    const bucket = String(row.storage_bucket || 'study-hub-resources');
    const storagePath = String(row.storage_path || '');
    const publicUrl = storagePath ? `${url}/storage/v1/object/public/${bucket}/${storagePath}` : '';
    const level = typeof row.level === 'string' ? row.level : '';
    return {
      id: `sh:${storagePath}`,
      subject: titleCase(String(row.subject || 'General')),
      type: supaType(String(row.category || ''), String(row.resource_type || '')),
      source: 'study-hub' as Source,
      title: String(row.title || row.original_filename || 'Untitled'),
      url: publicUrl,
      keys: SUPA_LEVEL_KEYS[level] || [],
    };
  }).filter((r) => r.url);
  return { resources, totalCount: count };
}

export default function LibraryWorkspace({ homeHref, supabaseUrl, anonKey, apiUrl, embedded = false }: Props) {
  const [selected, setSelected] = useState<{ label: string; keys: string[] } | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [totalResourceCount, setTotalResourceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileToken, setProfileToken] = useState('');
  const [profileClass, setProfileClass] = useState('');
  const [preferredSubjects, setPreferredSubjects] = useState<string[]>([]);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [resourceStats, setResourceStats] = useState<Record<string, ResourceStats>>({});
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [engagementError, setEngagementError] = useState('');
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementRefreshing, setEngagementRefreshing] = useState(false);

  const base = homeHref.endsWith('/') ? homeHref : `${homeHref}/`;
  const catalogUrl = `${base}fresh-teacher-catalog.json`;
  const readerBase = `${base}full_page_flipbook_viewer/index.html`;
  const apiBase = apiUrl.replace(/\/+$/, '');

  async function refreshResourceStats() {
    if (!apiBase) throw new Error('Resource ratings are unavailable because the account service is not configured.');
    const response = await fetch(`${apiBase}/api/resources/stats`);
    if (!response.ok) throw new Error(`Resource ratings request failed (HTTP ${response.status}).`);
    const result: { resources?: ResourceStats[] } = await response.json();
    if (!Array.isArray(result.resources)) throw new Error('Resource ratings response is invalid.');
    setResourceStats(Object.fromEntries(result.resources.map((item) => [item.resourceId, item])));
  }

  function signInHref(): string {
    const url = new URL(`${base}sign-in.html`, window.location.origin);
    url.searchParams.set('return', window.location.href);
    return url.href;
  }

  useEffect(() => {
    let active = true;
    async function loadEngagement() {
      if (!apiBase) return;
      setEngagementLoading(true);
      try {
        const response = await fetch(`${apiBase}/api/resources/stats`);
        if (!response.ok) throw new Error(`Resource ratings request failed (HTTP ${response.status}).`);
        const result: { resources?: ResourceStats[] } = await response.json();
        if (!Array.isArray(result.resources)) throw new Error('Resource ratings response is invalid.');
        if (active) setResourceStats(Object.fromEntries(result.resources.map((item) => [item.resourceId, item])));

        const session = readAuthSession();
        if (!session) {
          if (active) {
            setMyVotes({});
            setBookmarks([]);
          }
          return;
        }
        const mineResponse = await fetch(`${apiBase}/api/resources/mine`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (mineResponse.status === 401 || mineResponse.status === 403) {
          clearAuthSession();
          if (active) {
            setMyVotes({});
            setBookmarks([]);
          }
          return;
        }
        if (!mineResponse.ok) throw new Error(`Saved resources request failed (HTTP ${mineResponse.status}).`);
        const mine: { ratings?: Array<{ resourceId: string; vote: number }>; bookmarks?: string[] } = await mineResponse.json();
        if (active) {
          setMyVotes(Object.fromEntries((mine.ratings || [])
            .filter((item): item is { resourceId: string; vote: 1 | -1 } => item.vote === 1 || item.vote === -1)
            .map((item) => [item.resourceId, item.vote])));
          setBookmarks(mine.bookmarks || []);
        }
      } catch (loadError) {
        console.error('Resource engagement could not be loaded.', loadError);
        if (active) setEngagementError('Ratings or saved documents could not be loaded.');
      } finally {
        if (active) setEngagementLoading(false);
      }
    }
    void loadEngagement();
    const reload = () => { void loadEngagement(); };
    window.addEventListener('study-hub-auth-change', reload);
    return () => {
      active = false;
      window.removeEventListener('study-hub-auth-change', reload);
    };
  }, [apiBase]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const tasks: Promise<CatalogLoad>[] = [loadFreshTeacher(catalogUrl), loadPremiumResources()];
      if (supabaseUrl && anonKey) tasks.push(loadSupabase(supabaseUrl, anonKey));
      const results = await Promise.allSettled(tasks);
      if (!active) return;
      const merged: Resource[] = [];
      let totalCount = 0;
      let failed = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          merged.push(...r.value.resources);
          totalCount += r.value.totalCount;
        }
        else failed += 1;
      }
      setResources(merged);
      setTotalResourceCount(totalCount);
      setLoading(false);
      if (!merged.length) setError('No resources could be loaded. Please try again shortly.');
      else if (failed > 0) setError('Some resource catalogs could not be loaded; showing what is available.');
    }
    void load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogUrl, supabaseUrl, anonKey]);

  useEffect(() => {
    const header = document.querySelector('.site-header');
    const updateDashboardHeight = () => {
      const headerHeight = header?.getBoundingClientRect().height ?? 76;
      const root = document.documentElement;
      root.style.setProperty('--lib-header-height', `${headerHeight}px`);
      if (selected) {
        root.style.setProperty('--lib-dashboard-height', `${Math.max(0, window.innerHeight - headerHeight)}px`);
      }
    };

    updateDashboardHeight();
    window.addEventListener('resize', updateDashboardHeight);
    const headerObserver = header ? new ResizeObserver(updateDashboardHeight) : null;
    if (header) headerObserver?.observe(header);

    return () => {
      window.removeEventListener('resize', updateDashboardHeight);
      headerObserver?.disconnect();
      document.documentElement.style.removeProperty('--lib-header-height');
      document.documentElement.style.removeProperty('--lib-dashboard-height');
    };
  }, [selected]);

  useEffect(() => {
    const compactViewport = window.matchMedia('(max-width: 640px)');
    const updatePanels = () => {
      setNavigationCollapsed(compactViewport.matches);
      setFiltersCollapsed(compactViewport.matches);
    };
    updatePanels();
    compactViewport.addEventListener('change', updatePanels);
    return () => compactViewport.removeEventListener('change', updatePanels);
  }, []);

  // Restore class + filters from the URL so refreshes and the reader's Back
  // button (which passes this page as ?return=…) land on the same view.
  useEffect(() => {
    try {
      const session = readAuthSession<{
        classLevel?: unknown;
        subjects?: unknown;
        onboardingComplete?: unknown;
      }>();
      if (session) {
        setProfileToken(session.token);
        const classLevel = typeof session.user.classLevel === 'string' ? session.user.classLevel : '';
        const subjects = Array.isArray(session.user.subjects)
          ? session.user.subjects.filter((subject): subject is string => typeof subject === 'string' && availableSubjects.some((available) => available.name === subject))
          : [];
        setProfileClass(classLevel);
        setPreferredSubjects(subjects);

        const params = new URLSearchParams(window.location.search);
        const requestedClass = params.get('class');
        const selectedClass = findLibraryClass(requestedClass || classLevel);
        if (selectedClass) setSelected(selectedClass);
        if (params.get('welcome') === '1' && session.user.onboardingComplete !== true) setPreferencesOpen(true);
      }
    } catch {
      setPreferencesError('Your saved account profile could not be read. Sign in again to personalise your library.');
    }

    const q = new URLSearchParams(window.location.search);
    const cls = q.get('class');
    if (cls) {
      const found = findLibraryClass(cls);
      if (found) setSelected({ label: found.label, keys: found.keys });
    }
    const subject = q.get('subject');
    if (subject) setSubjectFilter(subject);
    const typ = q.get('type');
    if (typ) setTypeFilter(typ);
    const query = q.get('q');
    if (query) setSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLearningPreferences(preferences: LearningPreferences) {
    if (!profileToken) throw new Error('Sign in again to save your learning profile.');
    const configured = import.meta.env.PUBLIC_STUDY_HUB_API_URL?.trim();
    if (!configured) throw new Error('The account service is not connected. Please try again later.');

    const response = await fetch(`${configured.replace(/\/+$/, '')}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profileToken}`,
    },
      body: JSON.stringify({
        learnerType: preferences.learnerType,
        educationLevel: preferences.educationLevel,
        universityCourse: preferences.universityCourse || null,
        universityYear: preferences.universityYear,
        secondaryTrack: preferences.secondaryTrack,
        classLevel: preferences.classLevel,
        subjects: preferences.subjects,
        onboardingComplete: true,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.user || typeof result.user.email !== 'string') {
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        setProfileToken('');
      }
      throw new Error(result.message || result.error || 'Could not save your learning profile. Please try again.');
    }

    updateAuthSessionUser(result.user);
    setProfileClass(preferences.classLevel || '');
    setPreferredSubjects(preferences.subjects);
    setShowAllSubjects(false);
    setPreferencesError('');
    const selectedClass = libraryClasses.find((item) => item.label === preferences.classLevel);
    if (selectedClass) setSelected(selectedClass);
    setSubjectFilter('all');
    setTypeFilter('all');
    setSearch('');
    setPreferencesOpen(false);
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('welcome');
    if (preferences.classLevel) currentUrl.searchParams.set('class', preferences.classLevel);
    else currentUrl.searchParams.delete('class');
    window.history.replaceState({}, '', currentUrl);
  }

  // The library URL that encodes the current view, handed to the reader as ?return=.
  function libraryStateUrl(): string {
    const url = new URL(`${base}library.html`, window.location.origin);
    if (selected) {
      url.searchParams.set('class', selected.label);
      if (subjectFilter !== 'all') url.searchParams.set('subject', subjectFilter);
      if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
      if (search.trim()) url.searchParams.set('q', search.trim());
    }
    return url.href;
  }

  // Build a flipbook-reader URL for a resource row.
  function readerHref(row: Resource): string {
    const url = new URL(readerBase, window.location.origin);
    url.searchParams.set('file', row.url);
    url.searchParams.set('title', row.title);
    url.searchParams.set('subject', row.subject.toLowerCase());
    url.searchParams.set('resource_id', row.id);
    if (row.source === 'fresh-teacher') {
      url.searchParams.set('source', 'fresh-teacher');
      if (row.keys[0]) url.searchParams.set('class_key', row.keys[0]);
    } else if (row.source === 'premium-resources') {
      url.searchParams.set('source', 'premium-resources');
    }
    url.searchParams.set('return', libraryStateUrl());
    return url.href;
  }

  function checkoutHref(row: Resource): string {
    const url = new URL(`${base}document-payment.html`, window.location.origin);
    url.searchParams.set('resource_id', row.id);
    url.searchParams.set('title', row.title);
    return url.href;
  }

  const path = selected ? ['Home', 'Library', selected.label] : ['Home', 'Library'];


  function onNavigate(index: number) {
    if (index === 0) { window.location.href = homeHref; return; }
    if (index === 1) { setSelected(null); return; }
  }

  return (
    <div className={`library ${selected ? 'is-dashboard' : ''}${embedded ? ' is-embedded' : ''}`}>
      {preferencesOpen && profileToken && (
        <div className="lib-preferences-backdrop" role="presentation">
          <section className="lib-preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="lib-preferences-heading">
            <p className="lib-preferences-kicker">Make your library yours</p>
            <h1 id="lib-preferences-heading">Set your learning profile.</h1>
            <p>Choose your current class and subjects. We’ll use them to focus the Library and tailor AI Study. You can update these choices later from your account.</p>
            {preferencesError && <p className="lib-preferences-error" role="alert">{preferencesError}</p>}
            <LearningPreferencesForm
              initialClassLevel={profileClass}
              initialSubjects={preferredSubjects}
              submitLabel="Save and open my library"
              onSave={saveLearningPreferences}
            />
          </section>
        </div>
      )}
      {!embedded && <nav className="lib-crumbs" aria-label="Library breadcrumb">
        {path.map((item, idx) => {
          const isLast = idx === path.length - 1;
          return (
            <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {idx > 0 && <span className="lib-crumb-sep" aria-hidden="true">/</span>}
              <button
                type="button"
                className={`lib-crumb ${isLast ? 'is-active' : ''}`}
                onClick={() => onNavigate(idx)}
                aria-current={isLast ? 'page' : undefined}
              >
                {item}
              </button>
            </span>
          );
        })}
      </nav>}

      {selected ? (
        <ClassDashboard
          selected={selected}
          embedded={embedded}
          resources={resources}
          loading={loading}
          error={error}
          subjectFilter={subjectFilter}
          typeFilter={typeFilter}
          search={search}
          preferredSubjects={preferredSubjects}
          showAllSubjects={showAllSubjects}
          navigationCollapsed={navigationCollapsed}
          filtersCollapsed={filtersCollapsed}
          apiBase={apiBase}
          resourceStats={resourceStats}
          myVotes={myVotes}
          bookmarks={bookmarks}
          engagementError={engagementError}
          engagementLoading={engagementLoading}
          engagementRefreshing={engagementRefreshing}
          signInHref={signInHref}
          onVoteSaved={(resourceId, vote) => {
            setMyVotes((current) => {
              const next = { ...current };
              if (vote === null) delete next[resourceId];
              else next[resourceId] = vote;
              return next;
            });
            setEngagementRefreshing(true);
            void refreshResourceStats().catch((refreshError: unknown) => {
              console.error('Resource ratings could not be refreshed.', refreshError);
              setEngagementError('Your rating was saved, but the public rating could not be refreshed.');
            }).finally(() => setEngagementRefreshing(false));
          }}
          onShareTracked={(resourceId) => {
            setResourceStats((current) => ({
              ...current,
              [resourceId]: {
                resourceId,
                upVotes: current[resourceId]?.upVotes ?? 0,
                downVotes: current[resourceId]?.downVotes ?? 0,
                totalVotes: current[resourceId]?.totalVotes ?? 0,
                shareCount: (current[resourceId]?.shareCount ?? 0) + 1,
              },
            }));
          }}
          onBookmarkChanged={(resourceId, saved) => {
            setBookmarks((current) => saved
              ? current.includes(resourceId) ? current : [...current, resourceId]
              : current.filter((item) => item !== resourceId));
          }}
          onSubjectFilter={(value) => { setSubjectFilter(value); setShowAllSubjects(true); }}
          onShowAllSubjects={() => { setSubjectFilter('all'); setShowAllSubjects((current) => !current); }}
          onTypeFilter={setTypeFilter}
          onSearch={setSearch}
          onToggleNavigation={() => setNavigationCollapsed((c) => !c)}
          onToggleFilters={() => setFiltersCollapsed((c) => !c)}
          onSelectClass={setSelected}
          readerHref={readerHref}
          checkoutHref={checkoutHref}
          base={base}
          homeHref={homeHref}
          onBackToShelf={() => setSelected(null)}
        />
      ) : (
        <ClassShelf resources={resources} totalResourceCount={totalResourceCount} loading={loading} error={error} onSelect={setSelected} base={base} />
      )}
    </div>
  );
}


function ClassShelf({ resources, totalResourceCount, loading, error, onSelect, base }: { resources: Resource[]; totalResourceCount: number; loading: boolean; error: string; onSelect: (sel: { label: string; keys: string[] }) => void; base: string }) {
  const countFor = (keys: string[]) => resources.filter((r) => keys.some((k) => r.keys.includes(k))).length;
  const classCount = libraryClassGroups.reduce((total, section) => total + section.items.length, 0);

  return (
    <div className="lib-shelf">
      <section className="lib-shelf-hero" aria-labelledby="lib-shelf-heading">
        <div className="lib-shelf-hero-art" aria-hidden="true">
          <img src={`${base}assets/library/class-reading-space.jpg`} alt="" />
        </div>
        <div className="lib-shelf-hero-content">
          <span className="lib-shelf-eyebrow">STUDY-HUB · YOUR DIGITAL LIBRARY</span>
          <h1 id="lib-shelf-heading">A good place to begin.</h1>
          <p>Find clear notes, helpful guides and papers for every step of your learning journey.</p>
          <div className="lib-shelf-stats" aria-label="Library overview">
            <span><strong>{classCount}</strong> learning levels</span>
            <span><strong>{totalResourceCount.toLocaleString()}</strong> site-wide resources</span>
          </div>
          <a className="lib-shelf-cta" href="#library-classes">
            Explore your class <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <div id="library-classes" className="lib-shelf-classes">
        <div className="lib-shelf-section-heading">
          <div>
            <span className="lib-shelf-section-kicker">Choose a learning level</span>
            <h2>Your class shelf</h2>
          </div>
          <span className="lib-shelf-class-count">{classCount} classes</span>
        </div>
        {(loading || error) && <p className="lib-shelf-status" role={error ? 'alert' : 'status'}>{loading ? 'Loading resources…' : error}</p>}
        {libraryClassGroups.map((section) => (
          <section key={section.group} className="lib-shelf-group">
            <h2>{section.group}</h2>
            <div className="lib-shelf-grid">
              {section.items.map((item) => (
                <button key={item.label} type="button" className="lib-class-card" onClick={() => onSelect({ label: item.label, keys: item.keys })}>
                  <span className="lib-class-name">{item.label}</span>
                  <span className="lib-class-sub">{countFor(item.keys)} resources</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <section className="lib-shelf-group">
          <h2>Resource archives</h2>
          <div className="lib-shelf-grid">
            <button
              type="button"
              className="lib-class-card lib-class-card-trending"
              aria-label={`Open 2026 trending resources, ${countFor(TRENDING_2026_CLASS.keys)} resources`}
              onClick={() => onSelect(TRENDING_2026_CLASS)}
            >
              <span className="lib-class-name">2026 trending</span>
              <span className="lib-class-sub">{countFor(TRENDING_2026_CLASS.keys)} resources</span>
            </button>
            <button
              type="button"
              className="lib-class-card"
              aria-label={`Open unsorted files, ${countFor(UNSORTED_CLASS.keys)} resources`}
              onClick={() => onSelect(UNSORTED_CLASS)}
            >
              <span className="lib-class-name">Unsorted files</span>
              <span className="lib-class-sub">{countFor(UNSORTED_CLASS.keys)} resources</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}


interface DashboardProps {
  selected: { label: string; keys: string[] };
  embedded: boolean;
  resources: Resource[];
  loading: boolean;
  error: string;
  subjectFilter: string;
  typeFilter: string;
  search: string;
  preferredSubjects: string[];
  showAllSubjects: boolean;
  navigationCollapsed: boolean;
  filtersCollapsed: boolean;
  apiBase: string;
  resourceStats: Record<string, ResourceStats>;
  myVotes: Record<string, 1 | -1>;
  bookmarks: string[];
  engagementError: string;
  engagementLoading: boolean;
  engagementRefreshing: boolean;
  signInHref: () => string;
  onVoteSaved: (resourceId: string, vote: 1 | -1 | null) => void;
  onShareTracked: (resourceId: string) => void;
  onBookmarkChanged: (resourceId: string, saved: boolean) => void;
  onSubjectFilter: (v: string) => void;
  onShowAllSubjects: () => void;
  onTypeFilter: (v: string) => void;
  onSearch: (v: string) => void;
  onToggleNavigation: () => void;
  onToggleFilters: () => void;
  onSelectClass: (selection: { label: string; keys: string[] }) => void;
  readerHref: (row: Resource) => string;
  checkoutHref: (row: Resource) => string;
  base: string;
  homeHref: string;
  onBackToShelf: () => void;
}

const PAGE_SIZE = 50;

function ResourceShare({ row, apiBase, shareCount, readerHref, onShareTracked }: {
  row: Resource;
  apiBase: string;
  shareCount: number;
  readerHref: (row: Resource) => string;
  onShareTracked: (resourceId: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function shareResource() {
    const url = readerHref(row);
    setWorking(true);
    setMessage('');
    setError('');
    try {
      try {
        if (navigator.share) {
          await navigator.share({ title: row.title, text: `Study Hub resource: ${row.title}`, url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setMessage('Link copied');
        } else {
          throw new Error('Sharing is not available in this browser.');
        }
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === 'AbortError') return;
        setError(shareError instanceof Error ? shareError.message : 'This resource could not be shared.');
        return;
      }
      if (row.source === 'premium-resources') {
        setMessage('Link shared');
        return;
      }
      if (!apiBase) throw new Error('The share count service is not configured.');
      const response = await fetch(`${apiBase}/api/resources/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: row.id }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Share count request failed (HTTP ${response.status}).`);
      }
      onShareTracked(row.id);
    } catch (trackingError) {
      setError(trackingError instanceof Error
        ? `Shared successfully, but the share count could not be recorded: ${trackingError.message}`
        : 'Shared successfully, but the share count could not be recorded.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <span className="lib-resource-share">
      <button type="button" className="lib-resource-action" onClick={() => void shareResource()} aria-label={`Share ${row.title}`} disabled={working}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.6 6.6-4.2m-6.6 7 6.6 4.2" /></svg>
        <span>{working ? 'Sharing…' : 'Share'}</span>
      </button>
      <span className="lib-resource-share-count" aria-label={`${shareCount} ${shareCount === 1 ? 'recorded share' : 'recorded shares'}`}>
        {shareCount} {shareCount === 1 ? 'share' : 'shares'}
      </span>
      {message && <span className="lib-resource-action-message" role="status">{message}</span>}
      {working && <span className="lib-resource-action-progress" role="status">Sharing resource…</span>}
      {error && <span className="lib-resource-action-error" role="alert">{error}</span>}
    </span>
  );
}

interface ResourceEngagementProps {
  row: Resource;
  apiBase: string;
  stats?: ResourceStats;
  vote?: 1 | -1;
  bookmarked: boolean;
  signInHref: () => string;
  onVoteSaved: (resourceId: string, vote: 1 | -1 | null) => void;
  onBookmarkChanged: (resourceId: string, saved: boolean) => void;
}

function ResourceEngagement({
  row,
  apiBase,
  stats,
  vote,
  bookmarked,
  signInHref,
  onVoteSaved,
  onBookmarkChanged,
}: ResourceEngagementProps) {
  const [working, setWorking] = useState(false);
  const [workingAction, setWorkingAction] = useState<'rating' | 'bookmark' | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [error, setError] = useState('');

  async function updateVote(nextVote: 1 | -1) {
    const session = readAuthSession();
    if (!session) {
      setSignInPrompt(true);
      return;
    }
    if (!apiBase) {
      setError('Ratings are unavailable right now.');
      return;
    }

    const removeVote = vote === nextVote;
    setWorking(true);
    setWorkingAction('rating');
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/resources/vote`, {
        method: removeVote ? 'DELETE' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ resourceId: row.id, ...(removeVote ? {} : { vote: nextVote }) }),
      });
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        setSignInPrompt(true);
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Your rating could not be saved.');
      }
      onVoteSaved(row.id, removeVote ? null : nextVote);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your rating could not be saved.');
    } finally {
      setWorking(false);
      setWorkingAction(null);
    }
  }

  async function toggleBookmark() {
    const session = readAuthSession();
    if (!session) {
      setSignInPrompt(true);
      return;
    }
    if (!apiBase) {
      setError('Bookmarks are unavailable right now.');
      return;
    }

    setWorking(true);
    setWorkingAction('bookmark');
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/resources/bookmark`, {
        method: bookmarked ? 'DELETE' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ resourceId: row.id }),
      });
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        setSignInPrompt(true);
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'This document could not be saved.');
      }
      onBookmarkChanged(row.id, !bookmarked);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'This document could not be saved.');
    } finally {
      setWorking(false);
      setWorkingAction(null);
    }
  }

  const totalVotes = stats?.totalVotes ?? 0;
  const upPercent = totalVotes ? Math.round(((stats?.upVotes ?? 0) / totalVotes) * 100) : 0;
  const downPercent = totalVotes ? 100 - upPercent : 0;
  if (row.source === 'premium-resources') return <span className="lib-resource-meta">Public archive</span>;

  return (
    <div className="lib-engagement">
      <span className="lib-rating-summary" aria-label={totalVotes ? `${upPercent}% thumbs-up, ${downPercent}% thumbs-down, ${totalVotes} ratings` : 'No ratings yet'}>
        {totalVotes ? `${upPercent}% up · ${downPercent}% down` : 'No ratings'}
      </span>
      <button type="button" className={`lib-resource-action lib-vote-action ${vote === 1 ? 'is-active' : ''}`} aria-pressed={vote === 1} disabled={working} onClick={() => void updateVote(1)} aria-label={`Thumbs up ${row.title}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h5a3 3 0 0 1 3 3l-1.5 7a3 3 0 0 1-3 2H7" /></svg>
      </button>
      <button type="button" className={`lib-resource-action lib-vote-action lib-dislike-action ${vote === -1 ? 'is-active' : ''}`} aria-pressed={vote === -1} disabled={working} onClick={() => void updateVote(-1)} aria-label={`Thumbs down ${row.title}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h5a3 3 0 0 1 3 3l-1.5 7a3 3 0 0 1-3 2H7" /></svg>
      </button>
      <button type="button" className={`lib-resource-action lib-bookmark-action ${bookmarked ? 'is-active' : ''}`} aria-pressed={bookmarked} disabled={working} onClick={() => void toggleBookmark()} aria-label={bookmarked ? `Remove bookmark for ${row.title}` : `Bookmark ${row.title}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
      </button>
      {signInPrompt && (
        <span className="lib-sign-in-prompt" role="status">
          <a href={signInHref()}>Sign in to rate or bookmark</a>
        </span>
      )}
      {working && <span className="lib-resource-action-progress" role="status">{workingAction === 'rating' ? 'Saving your rating…' : bookmarked ? 'Removing bookmark…' : 'Saving bookmark…'}</span>}
      {error && <span className="lib-resource-action-error" role="alert">{error}</span>}
    </div>
  );
}

function ClassDashboard(props: DashboardProps) {
  const { selected, resources, loading, error, subjectFilter, typeFilter, search, preferredSubjects, showAllSubjects, navigationCollapsed, filtersCollapsed, base } = props;
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedSignInPrompt, setSavedSignInPrompt] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [classesHovered, setClassesHovered] = useState(false);
  const [filtersHovered, setFiltersHovered] = useState(false);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classDrawerOpen = classesOpen || classesHovered;

  function cancelHoverClose() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
  }

  function scheduleHoverClose(close: () => void) {
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(close, 400);
  }

  function closeMobileFilters() {
    if (window.matchMedia('(max-width: 640px)').matches && !filtersCollapsed) {
      props.onToggleFilters();
      setFiltersHovered(false);
    }
  }

  function chooseSubject(subject: string) {
    props.onSubjectFilter(subject);
    closeMobileFilters();
  }

  function chooseType(type: string) {
    props.onTypeFilter(type);
    closeMobileFilters();
  }

  useEffect(() => {
    if (!classDrawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setClassesOpen(false);
        setClassesHovered(false);
        setFiltersHovered(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [classDrawerOpen]);

  useEffect(() => () => cancelHoverClose(), []);

  const classResources = useMemo(
    () => resources.filter((r) => selected.keys.some((k) => r.keys.includes(k))),
    [resources, selected.keys]
  );

  const types = useMemo(
    () => Array.from(new Set(classResources.map((r) => r.type))).sort(),
    [classResources]
  );

  const subjects = useMemo(
    () => Array.from(new Set(classResources.map((r) => r.subject))).sort((a, b) => a.localeCompare(b)),
    [classResources]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searchAcrossSite = Boolean(q);
    const searchSource = searchAcrossSite || savedOnly ? resources : classResources;
    return searchSource.filter((r) => {
      if (!searchAcrossSite && !savedOnly && !showAllSubjects && preferredSubjects.length && !preferredSubjects.includes(r.subject)) return false;
      if (savedOnly && !props.bookmarks.includes(r.id)) return false;
      if (!savedOnly && subjectFilter !== 'all' && r.subject !== subjectFilter) return false;
      if (!savedOnly && typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (q && !(`${r.subject} ${r.title} ${r.type}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((left, right) => {
      const leftStats = props.resourceStats[left.id];
      const rightStats = props.resourceStats[right.id];
      const leftPercent = leftStats?.totalVotes ? leftStats.upVotes / leftStats.totalVotes : -1;
      const rightPercent = rightStats?.totalVotes ? rightStats.upVotes / rightStats.totalVotes : -1;
      return rightPercent - leftPercent
        || (rightStats?.totalVotes ?? 0) - (leftStats?.totalVotes ?? 0)
        || (rightStats?.shareCount ?? 0) - (leftStats?.shareCount ?? 0)
        || left.title.localeCompare(right.title);
    });
  }, [classResources, resources, subjectFilter, typeFilter, search, preferredSubjects, showAllSubjects, savedOnly, props.bookmarks, props.resourceStats]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [selected.label, subjectFilter, typeFilter, search, preferredSubjects, showAllSubjects, savedOnly]);

  const shown = filtered.slice(0, visible);

  return (
    <div className={`lib-dash ${props.embedded ? 'is-embedded' : ''} ${navigationCollapsed ? 'is-navigation-collapsed' : ''} ${filtersCollapsed && !filtersHovered ? 'is-filters-collapsed' : ''}`}>
      <aside id="lib-quick-navigation" className="lib-rail" aria-label="Quick navigation">
        <button
          type="button"
          className="lib-rail-toggle"
          onClick={props.onToggleNavigation}
          aria-label={navigationCollapsed ? 'Expand quick navigation' : 'Collapse quick navigation'}
          aria-expanded={!navigationCollapsed}
          title={navigationCollapsed ? 'Expand quick navigation' : 'Collapse quick navigation'}
        ><LibraryIcon name="menu" /></button>
        <a className="lib-rail-btn" href={props.homeHref} title="Home" aria-label="Home"><LibraryIcon name="home" /></a>
        <a className="lib-rail-btn" href={`${base}assistant.html`} title="AI Study" aria-label="AI Study"><LibraryIcon name="assistant" /></a>
        <button type="button" className="lib-rail-btn is-active" title="Class Shelf" aria-label="Back to class shelf" onClick={props.onBackToShelf}><LibraryIcon name="bookshelf" /></button>
        <button
          type="button"
          className={`lib-rail-btn lib-classes-trigger ${classesOpen ? 'is-open' : ''}`}
          title="Browse classes"
          aria-label="Browse classes"
          aria-expanded={classDrawerOpen}
          aria-controls="lib-class-drawer"
          onClick={() => {
            setClassesOpen((open) => !open);
            setClassesHovered(false);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'mouse') return;
            cancelHoverClose();
            setClassesHovered(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') scheduleHoverClose(() => setClassesHovered(false));
          }}
        ><LibraryIcon name="classes" /></button>
      </aside>

      {classDrawerOpen && (
        <>
          {classesOpen && (
            <button type="button" className="lib-class-drawer-backdrop" aria-label="Close class navigation" onClick={() => { setClassesOpen(false); setClassesHovered(false); }} />
          )}
          <aside
            id="lib-class-drawer"
            className="lib-class-drawer"
            aria-label="Browse all classes"
            onPointerEnter={(event) => {
              if (event.pointerType !== 'mouse') return;
              cancelHoverClose();
              setClassesHovered(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') scheduleHoverClose(() => setClassesHovered(false));
            }}
          >
            <div className="lib-class-drawer-head">
              <div>
                <span className="lib-side-kicker">Study Hub Library</span>
                <h2>Browse classes</h2>
              </div>
              <button type="button" className="lib-class-drawer-close" aria-label="Close class navigation" onClick={() => { setClassesOpen(false); setClassesHovered(false); }}>
                <LibraryIcon name="close" />
              </button>
            </div>
            <nav className="lib-class-drawer-body" aria-label="Classes by level">
              {libraryClassGroups.map((group) => (
                <section className="lib-class-drawer-group" key={group.group}>
                  <h3>{group.group}</h3>
                  {group.items.map((item) => {
                    const count = resources.filter((resource) => item.keys.some((key) => resource.keys.includes(key))).length;
                    const active = selected.label === item.label;
                    return (
                      <button
                        type="button"
                        key={item.label}
                        className={`lib-class-drawer-item ${active ? 'is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          props.onSelectClass({ label: item.label, keys: item.keys });
                          setClassesOpen(false);
                          setClassesHovered(false);
                        }}
                      >
                        <span>{item.label}</span>
                        <span className="lib-class-drawer-count">{count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </section>
              ))}
              <section className="lib-class-drawer-group" key="trending-2026">
                <h3>Trending resources</h3>
                <button
                  type="button"
                  className={`lib-class-drawer-item ${selected.label === TRENDING_2026_CLASS.label ? 'is-active' : ''}`}
                  aria-current={selected.label === TRENDING_2026_CLASS.label ? 'page' : undefined}
                  onClick={() => {
                    props.onSelectClass(TRENDING_2026_CLASS);
                    setClassesOpen(false);
                    setClassesHovered(false);
                  }}
                >
                  <span>2026 trending</span>
                  <span className="lib-class-drawer-count">
                    {resources.filter((resource) => TRENDING_2026_CLASS.keys.some((key) => resource.keys.includes(key))).length.toLocaleString()}
                  </span>
                </button>
              </section>
              <section className="lib-class-drawer-group" key="unsorted-resources">
                <h3>Resource archives</h3>
                <button
                  type="button"
                  className={`lib-class-drawer-item ${selected.label === UNSORTED_CLASS.label ? 'is-active' : ''}`}
                  aria-current={selected.label === UNSORTED_CLASS.label ? 'page' : undefined}
                  onClick={() => {
                    props.onSelectClass(UNSORTED_CLASS);
                    setClassesOpen(false);
                    setClassesHovered(false);
                  }}
                >
                  <span>Unsorted files</span>
                  <span className="lib-class-drawer-count">
                    {resources.filter((resource) => UNSORTED_CLASS.keys.some((key) => resource.keys.includes(key))).length.toLocaleString()}
                  </span>
                </button>
              </section>
            </nav>
          </aside>
        </>
      )}

      {!filtersCollapsed && (
        <button
          type="button"
          className="lib-mobile-drawer-backdrop"
          aria-label="Close class filters"
          onClick={props.onToggleFilters}
        />
      )}
      <aside
        id="lib-class-filters"
        className="lib-side"
        aria-label="Class filters"
        onPointerEnter={(event) => {
          if (event.pointerType !== 'mouse') return;
          cancelHoverClose();
          if (filtersCollapsed) setFiltersHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse' && filtersCollapsed) scheduleHoverClose(() => setFiltersHovered(false));
        }}
      >
        <div className="lib-side-head">
          <span className="lib-side-kicker">{selected.label} Workspace</span>
          <h2>Academic Library</h2>
        </div>
        <div className="lib-side-body">
          <div className="lib-term">
            <div className="lib-term-label">Subjects in {selected.label}</div>
            <button
              type="button"
              className={`lib-cat ${subjectFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => chooseSubject('all')}
            >
              All Subjects
              <span className="lib-cat-count">{classResources.length.toLocaleString()}</span>
            </button>
            {subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className={`lib-cat ${subjectFilter === subject ? 'is-active' : ''}`}
                onClick={() => chooseSubject(subject)}
              >
                {subject}
                <span className="lib-cat-count">
                  {classResources.filter((resource) => resource.subject === subject).length.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <div className="lib-term">
            <div className="lib-term-label">Type</div>
            <button type="button" className={`lib-cat ${typeFilter === 'all' ? 'is-active' : ''}`} onClick={() => chooseType('all')}>All Types</button>
            {types.map((t) => (
              <button key={t} type="button" className={`lib-cat ${typeFilter === t ? 'is-active' : ''}`} onClick={() => chooseType(t)}>{t}</button>
            ))}
          </div>
        </div>
      </aside>

        <div className="lib-main">
        <div className="lib-main-crumbs">
          <div className="lib-main-crumb-path">
            {props.embedded ? <span className="is-active">{selected.label}</span> : <>Home / Library / <span className="is-active">{selected.label}</span></>}
          </div>
          <div className="lib-panel-actions" aria-label="Library panels">
            <button
              type="button"
              className="lib-panel-toggle"
              onClick={props.onToggleNavigation}
              aria-expanded={!navigationCollapsed}
              aria-controls="lib-quick-navigation"
              title={navigationCollapsed ? 'Show quick navigation' : 'Hide quick navigation'}
            >
              <LibraryIcon name={navigationCollapsed ? 'panel-left-open' : 'panel-left'} />
              <span className="lib-panel-toggle-label">{navigationCollapsed ? 'Navigation' : 'Hide navigation'}</span>
            </button>
            <button
              type="button"
              className="lib-panel-toggle"
              onClick={props.onToggleFilters}
              aria-expanded={!filtersCollapsed || filtersHovered}
              aria-controls="lib-class-filters"
              title={filtersCollapsed ? 'Show class filters' : 'Hide class filters'}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse') return;
                cancelHoverClose();
                if (filtersCollapsed) setFiltersHovered(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse' && filtersCollapsed) scheduleHoverClose(() => setFiltersHovered(false));
              }}
            >
              <LibraryIcon name={filtersCollapsed && !filtersHovered ? 'panel-right-open' : 'panel-right'} />
              <span className="lib-panel-toggle-label">{filtersCollapsed && !filtersHovered ? 'Filters' : 'Hide filters'}</span>
            </button>
          </div>
        </div>
        <div className="lib-main-body">
          <section className="lib-resource-hero" aria-labelledby="lib-resource-heading">
            <div className="lib-resource-hero-art" aria-hidden="true">
              <img src={`${base}assets/library/resource-library.jpg`} alt="" loading="lazy" />
            </div>
            <div className="lib-resource-hero-content">
              <span className="lib-resource-eyebrow">{selected.label} · YOUR STUDY SPACE</span>
              <h1 id="lib-resource-heading">Room to explore.</h1>
              <p>Pick up where curiosity leads — your class resources are all gathered here.</p>
              <div className="lib-resource-stats">
                <span><strong>{classResources.length.toLocaleString()}</strong> resources</span>
                <span><strong>{new Set(classResources.map((resource) => resource.subject)).size}</strong> subjects</span>
              </div>
            </div>
            <a className="lib-resource-cta" href="#library-resources" aria-label="Browse class resources">↓</a>
          </section>
          <div className="lib-main-head">
            <div className="lib-resource-list-heading">
              <span className="lib-shelf-section-kicker">Made for your class</span>
              <h2>{savedOnly ? 'Your bookmarks' : search.trim() ? 'Search all resources' : 'Browse resources'} <span>{filtered.length.toLocaleString()}</span></h2>
            </div>
            <div className="lib-main-tools">
              <input
                type="search"
                className="lib-search"
                placeholder="Search all resources…"
                value={search}
                onChange={(e) => props.onSearch(e.target.value)}
                aria-label="Search resources"
              />
              <button
                type="button"
                className={`lib-saved-toggle ${savedOnly ? 'is-active' : ''}`}
                aria-pressed={savedOnly}
                onClick={() => {
                  if (!readAuthSession()) {
                    setSavedSignInPrompt(true);
                    return;
                  }
                  setSavedSignInPrompt(false);
                  setSavedOnly((current) => !current);
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
                Saved ({props.bookmarks.length})
              </button>
            </div>
          </div>
          {search.trim() && <p className="lib-search-scope">Searching all available resources across Study Hub.</p>}
          {savedSignInPrompt && <p className="lib-search-scope"><a href={props.signInHref()}>Sign in to access your saved documents.</a></p>}
          {savedOnly && <p className="lib-search-scope">Your bookmarks are private to your account. Click “Saved” again to return to the class list.</p>}
          {props.engagementError && <p className="lib-banner" role="status">{props.engagementError}</p>}
          {props.engagementLoading && <p className="lib-progress" role="status"><span className="lib-progress-spinner" aria-hidden="true" />Loading ratings and your saved documents…</p>}
          {props.engagementRefreshing && <p className="lib-progress" role="status"><span className="lib-progress-spinner" aria-hidden="true" />Updating rating totals…</p>}
          {preferredSubjects.length > 0 && (
            <p className="lib-personalization-note">
              {showAllSubjects ? `Showing all ${selected.label} subjects.` : `Showing your saved subjects: ${preferredSubjects.join(', ')}.`}
              <button type="button" onClick={props.onShowAllSubjects}>
                {showAllSubjects ? 'Show my subjects' : 'Show all subjects'}
              </button>
            </p>
          )}

          <div id="library-resources" className="lib-resource-results" aria-busy={loading}>
            {error && <p className="lib-banner" role="alert">{error}</p>}
            {loading && <p className="lib-progress" role="status" aria-live="polite"><span className="lib-progress-spinner" aria-hidden="true" />Loading class resources…</p>}

            {!loading && shown.length === 0 ? (
              <p className="lib-empty">No resources match these filters yet.</p>
            ) : (
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Rating</th>
                      <th>Save &amp; share</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => (
                      <tr key={row.id}>
                        <td className="lib-subject">{row.subject}</td>
                        <td className="lib-title">
                          <a className="lib-resource-preview-link" href={props.readerHref(row)} aria-label={`Open preview of ${row.title}`}>
                            <div
                              className={`dashboard-preview lib-resource-preview ${previewFormat(row.url) ? '' : 'preview-unavailable'}`}
                              data-preview-url={previewFormat(row.url) ? row.url : undefined}
                              data-preview-format={previewFormat(row.url) || undefined}
                              data-preview-worker={previewFormat(row.url) ? `${props.base}full_page_flipbook_viewer/js/pdf.worker.min.js` : undefined}
                              aria-hidden="true"
                            >
                              <span className="dashboard-preview-placeholder" aria-hidden="true">{previewFormat(row.url).toUpperCase() || 'FILE'}</span>
                              <span className="dashboard-preview-caption">
                                {previewFormat(row.url) ? 'Loading first-page preview…' : 'Preview unavailable · Open to view'}
                              </span>
                            </div>
                          </a>
                          <span className="lib-resource-preview-title">{row.title}</span>
                        </td>
                        <td><span className={`lib-tag ${row.type === 'Past Papers' ? 'lib-tag-exam' : 'lib-tag-notes'}`}>{row.type}</span></td>
                        <td>
                          <ResourceEngagement
                            row={row}
                            apiBase={props.apiBase}
                            stats={props.resourceStats[row.id]}
                            vote={props.myVotes[row.id]}
                            bookmarked={props.bookmarks.includes(row.id)}
                            signInHref={props.signInHref}
                            onVoteSaved={props.onVoteSaved}
                            onBookmarkChanged={props.onBookmarkChanged}
                          />
                        </td>
                        <td className="lib-resource-share-cell">
                          <ResourceShare
                            row={row}
                            apiBase={props.apiBase}
                            shareCount={props.resourceStats[row.id]?.shareCount ?? 0}
                            readerHref={props.readerHref}
                            onShareTracked={props.onShareTracked}
                          />
                        </td>
                        <td className="lib-resource-actions">
                          <a className="lib-view" href={props.readerHref(row)}>Read →</a>
                          <a className="lib-download-button" href={props.checkoutHref(row)}>Download</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {visible < filtered.length && (
              <div className="lib-more">
                <button type="button" className="lib-request" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more ({filtered.length - visible} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
