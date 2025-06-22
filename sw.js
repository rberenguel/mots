const CACHE_NAME = "mots-cache-v0.0.10";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./js/config.js",
  "./js/events.js",
  "./js/game.js",
  "./js/haptic.js",
  "./js/keyboard.js",
  "./js/main.js",
  "./js/ui.js",
  "./icon.png",
  "./icon192.png",
  "./fonts/InterDisplay-Bold.woff2",
  "./fonts/InterDisplay-Italic.woff2",
  "./fonts/InterDisplay-Regular.woff2",
  "./fonts/iconoir/iconoir.css",
  "./fonts/inter.css",
  "./dict/words.txt",
];

// Install event: opens a cache and adds the core files to it.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    }),
  );
});

// Fetch event: serves assets from cache if available, otherwise fetches from network.
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // Cache hit - return response
      if (response) {
        return response;
      }
      return fetch(event.request);
    }),
  );
});

// Activate event: cleans up old caches.
self.addEventListener("activate", function (event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});
