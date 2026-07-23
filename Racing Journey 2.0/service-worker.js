// Bump this version on every deploy to force old caches to be purged.
const CACHE_NAME = 'racing-journey-pwa-v96';

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  // Take over as soon as installed, don't wait for the old SW to release.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        // Delete EVERY cache that isn't the current one (purges stale builds).
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try the network so fresh deploys reach the user.
// Fall back to cache only when offline. Prevents stale builds being served.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (networkResponse.ok && networkResponse.type === 'basic') {
            cache.put(event.request, copy);
          }
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then(cached => {
        return cached || caches.match('./index.html');
      }))
  );
});
