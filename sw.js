const CACHE_NAME = "gpt-plant-walk-walk-reset-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./settings.css",
  "./report-branding.css",
  "./sprint8.css",
  "./sprint8-alpha6-fix.css",
  "./sprint8-alpha7-fix.css",
  "./storage.js",
  "./app.js",
  "./issue-deletion.js",
  "./walk-reset.js",
  "./settings.js",
  "./report-branding.js",
  "./pdfbolt.js",
  "./release.js",
  "./sprint8.js",
  "./sprint8-alpha7-fix.js",
  "./sprint9-direct.js",
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
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
