const CACHE = 'digu-v56';
const SHELL = [
  '/',
  '/leaderboard',
  '/matches',
  '/players',
  '/manifest.webmanifest',
  '/logo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for HTML pages: serve the cached page instantly, then
  // refresh it in the background. Only cache clean 200 responses (never redirects,
  // so a login/redirect is never stored and served stale).
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request)
          .then(res => {
            if (res && res.ok && res.status === 200 && !res.redirected && res.type === 'basic') {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached || caches.match('/'));
        return cached || network;
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets (serve cache fast, refresh in background)
  // so fixed-path assets like /badges/*.png and /logo.png self-update after a deploy.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetching = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
