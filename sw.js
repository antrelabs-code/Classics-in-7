// Service worker for Classics in 7.
// Strategy: NETWORK-FIRST for everything on our own origin, with the cache as an offline
// fallback. Fresh files always win when online (so edits show up right after deploy);
// the cache only matters when there is no connection. Bump CACHE_VERSION to drop old caches.
// Cross-origin requests (e.g. YouTube) are never touched.

const CACHE_VERSION = "cif7-v1";

const APP_SHELL = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "storage.js",
    "access.js",
    "muz-content.json",
    "manifest.webmanifest",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png",
    // Optional self-hosted fonts: cached if present, skipped if not (see style.css).
    "fonts/inter-latin-wght-normal.woff2",
    "fonts/inter-latin-ext-wght-normal.woff2"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            // allSettled: one missing optional file must not break the whole install
            Promise.allSettled(
                APP_SHELL.map((url) =>
                    fetch(url, { cache: "no-cache" }).then((response) => {
                        if (!response.ok) throw new Error(url + " " + response.status);
                        return cache.put(url, response);
                    })
                )
            )
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    if (new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(request, { cache: "no-cache" })
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() =>
                caches.match(request, { ignoreSearch: true }).then((cached) => {
                    if (cached) return cached;
                    // Offline navigation to any URL falls back to the app itself.
                    if (request.mode === "navigate") return caches.match("index.html");
                    return Response.error();
                })
            )
    );
});
