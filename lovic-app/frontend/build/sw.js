const CACHE = 'lovic-v7';

const API_PATHS = ['/auth/', '/food/', '/dashboard/', '/measurements/', '/bioimpedance/', '/questionnaire/', '/trainer/', '/profile', '/progress-photos', '/workout'];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never cache: API calls, HTML (navigation requests), service worker itself
  if (url.port === '4000') return;
  if (API_PATHS.some(p => url.pathname.startsWith(p))) return;
  if (e.request.mode === 'navigate') return;
  if (url.pathname === '/sw.js') return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          cache.put(e.request, res.clone());
          return res;
        });
        return cached || network;
      })
    )
  );
});
