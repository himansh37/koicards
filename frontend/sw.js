// KoiCards service worker — network-first caching with offline fallback.
// Only caches this app's own static shell; API calls (POST) always go
// straight to the network untouched.

const CACHE_NAME = 'koicards-v1';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './storage.js',
    './manifest.json',
    './favicon-96x96.png',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Never intercept API calls or other non-GET requests (e.g. POST /api/generate).
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseCopy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
                return response;
            })
            .catch(() =>
                caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
            )
    );
});
