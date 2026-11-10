/* Tobz Shisanyama PWA service worker */
const CACHE_NAME = "tobz-shisanyama-v7";
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
  "./script.js",
  "./checkout.js",
  "./manifest.json",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each resource independently so one optional/missing asset cannot
    // prevent the service worker from installing.
    await Promise.allSettled(APP_SHELL.map(async path => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("tobz-shisanyama-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Leave forms, payment/API requests, and third-party services untouched.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.includes("/api/")) return;

  event.respondWith((async () => {
    try {
      // Network-first: users always receive the deployed version when online.
      const response = await fetch(request, { cache: "no-store" });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const home = await caches.match("./index.html");
        if (home) return home;
      }
      throw error;
    }
  })());
});