const CACHE_NAME = "gpt-plant-walk-v0-8-1-alpha2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./settings.css",
  "./storage.js",
  "./app.js",
  "./settings.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
