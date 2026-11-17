/* Tobz Shisanyama PWA service worker */
const CACHE_NAME = "tobz-shisanyama-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./menu.html",
  "./about.html",
  "./contact.html",
  "./checkout.html",
  "./payment-return.html",
  "./style.css",
  "./images/Pork.png",
  "./images/Beef.png",
  "./images/Wors.png",
  "./images/Hero%20Image.jpg",
  "./script.js",
  "./checkout.js",
  "./manifest.json",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

const toURL = path => new URL(path, self.registration.scope);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // The offline fallback is essential: do not finish installing without it.
    const offlineURL = toURL("./offline.html");
    const offlineResponse = await fetch(offlineURL, { cache: "reload" });
    if (!offlineResponse.ok) {
      throw new Error("Could not download offline.html");
    }
    await cache.put(offlineURL, offlineResponse.clone());

    // Cache the rest of the app shell independently.
    await Promise.allSettled(APP_SHELL.map(async path => {
      const url = toURL(path);
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith("tobz-shisanyama-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Leave POST requests, APIs, payment requests and third-party traffic alone.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Page navigation: use the live page when available.
    if (request.mode === "navigate") {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
      } catch (error) {
        // Network unavailable: continue to the offline fallback.
      }

      // Show the branded offline screen whenever a page cannot be reached.
      const offline = await cache.match(toURL("./offline.html"));
      if (offline) return offline;

      return new Response("You are offline. Please reconnect and try again.", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // For images, scripts, styles and other assets, prefer the live version.
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;

      return new Response("You are offline. Please reconnect and try again.", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
