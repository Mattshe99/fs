const STATIC_CACHE = "earwax-static-v3";
const RUNTIME_CACHE = "earwax-runtime-v3";

// Get the base path from the service worker's location
const BASE_PATH = self.location.pathname.replace(/\/[^/]*$/, '/');

const CORE_ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "data/audio.json",
  "data/prompts.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
].map(path => new URL(path, BASE_PATH).pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle Audio folder - cache on demand for audio files
  if (url.pathname.includes("/Audio/") || url.pathname.endsWith(".ogg")) {
    event.respondWith(cacheOnDemand(request));
    return;
  }

  if (request.mode === "navigate") {
    const fallbackUrl = new URL("index.html", BASE_PATH).pathname;
    event.respondWith(
      fetch(request).catch(() => caches.match(fallbackUrl)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => new Response("", { status: 503, statusText: "Offline" }));
    }),
  );
});

function cacheOnDemand(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      // Return cached response directly (preserve original headers)
      return cached.clone();
    }
    // Try to fetch, but if offline, return empty response
    return fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clone).catch((err) => {
              console.warn("Failed to cache:", request.url, err);
            });
          });
        }
        return response;
      })
      .catch((error) => {
        // If fetch fails (offline), try cache one more time
        return caches.match(request).then((cached) => {
          if (cached) {
            // Return cached response directly (preserve original headers)
            return cached.clone();
          }
          // Return error response
          console.warn("Audio not cached and offline:", request.url);
          return new Response("", { status: 503, statusText: "Offline" });
        });
      });
  });
}

