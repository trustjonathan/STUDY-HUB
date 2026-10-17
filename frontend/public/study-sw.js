const CACHE_NAME = 'study-hub-ai-study-v1';
const APP_SCOPE = self.registration.scope;
const APP_SHELL = new URL('study.html', APP_SCOPE).href;
const OFFLINE_PAGES = [
  APP_SHELL,
  new URL('assistant.html', APP_SCOPE).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = new Set();
    for (const page of OFFLINE_PAGES) {
      try {
        const response = await fetch(page, { cache: 'reload' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.clone().text();
        await cache.put(page, response);
        for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
          const asset = new URL(match[1], page);
          if (asset.origin === self.location.origin
            && asset.href.startsWith(APP_SCOPE)
            && (asset.pathname.includes('/_astro/') || asset.pathname.endsWith('/favicon.svg') || asset.pathname.endsWith('/study.webmanifest'))) {
            assets.add(asset.href);
          }
        }
      } catch (error) {
        if (page === APP_SHELL) throw new Error(`Could not cache AI Study app shell: ${error instanceof Error ? error.message : 'network error'}`);
        console.warn('The AI tutor page could not be cached for offline use:', error);
      }
    }

    const failures = [];
    for (const asset of assets) {
      try {
        await cache.add(asset);
      } catch {
        failures.push(asset);
      }
    }
    if (failures.length) console.warn('Some optional AI Study assets could not be cached for offline use:', failures);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('study-hub-ai-study-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(APP_SCOPE)) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (OFFLINE_PAGES.includes(url.href) && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(url.href, response.clone());
        }
        return response;
      } catch (error) {
        if (OFFLINE_PAGES.includes(url.href)) {
          const cachedShell = await caches.match(url.href);
          if (cachedShell) return cachedShell;
        }
        throw error;
      }
    })());
    return;
  }

  if (url.pathname.includes('/_astro/') || url.pathname.endsWith('/favicon.svg') || url.pathname.endsWith('/study.webmanifest')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
