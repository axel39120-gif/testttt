// Bump this version on every deploy to force old caches to be purged.
const CACHE_NAME = 'racing-journey-pwa-v208';

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
        if (cached) return cached;
        /* Repli sur la page d'accueil UNIQUEMENT pour une navigation.
           Auparavant, toute requête échouée recevait index.html en
           réponse — y compris les fichiers JavaScript. Le navigateur
           recevait alors du HTML là où il attendait du code, refusait de
           l'exécuter, et les modules concernés ne s'installaient pas :
           les boutons de l'accueil ne répondaient plus. Un simple passage
           hors ligne, ou une coupure d'un instant, suffisait à mettre
           l'application dans cet état jusqu'au vidage du cache. */
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
