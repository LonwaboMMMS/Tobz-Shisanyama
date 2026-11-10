/* Tobz Shisanyama PWA service worker */
const CACHE_NAME = "tobz-shisanyama-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./menu.html",
  "./about.html",
  "./contact.html",
  "./checkout.html",
  "./style.css",
  "./script.js",
  "./checkout.js",
  "./manifest.json",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("tobz-shisanyama-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept POSTs, API calls, or third-party requests.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Always try the live page first. A cached page is only an offline fallback.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const home = await caches.match("./index.html");
        if (home) return home;
        throw error;
      }
    })());
    return;
  }

  // Network-first for same-origin assets prevents stale files being served
  // while online; cached copies are used only when the network is unavailable.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
