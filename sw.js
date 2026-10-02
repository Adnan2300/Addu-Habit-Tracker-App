const CACHE_NAME = 'habit-tracker-v4';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];
const CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(LOCAL_ASSETS);
      try { await cache.add(CHART_URL); } catch (e) { /* cached later on first online load */ }
    }).then(() => self.skipWaiting())
  );
});

// Remove old caches (e.g. habit-tracker-v3) so stale files are never served
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive), cache fallback (so it works offline)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});