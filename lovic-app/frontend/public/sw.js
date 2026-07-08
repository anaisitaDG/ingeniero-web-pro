const CACHE = 'lovic-v10';

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

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'Lovic Athletica';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    const existing = list.find(c => c.url.includes(url) && 'focus' in c);
    if (existing) return existing.focus();
    return clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never intercept: API calls, navigation (HTML), SW itself, JS/CSS bundles (hashed, let browser cache)
  if (url.port === '4000') return;
  if (API_PATHS.some(p => url.pathname.startsWith(p))) return;
  if (e.request.mode === 'navigate') return;
  if (url.pathname === '/sw.js') return;
  if (url.pathname.startsWith('/static/js/') || url.pathname.startsWith('/static/css/')) return;

  // Cache-first for fonts and images only
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
