/* Pocket Notes service worker (v39 PWA). Caches the app shell so the app opens
   offline after the first visit and works as a home-screen web app. The app is a
   single self-contained file, so the shell is just index.html + the manifest and
   icons. Notes themselves live in IndexedDB/localStorage on the device, not in
   this cache — the worker never touches them.
   v39: the cache name tracks the app version, and index.html is fetched
   network-first. The old worker (cache "pocket-notes-v17") was cache-first for
   everything, so a browser that had already installed the PWA kept serving its
   cached copy forever — a new index.html on the server never reached it, and
   even a cache-name bump alone would not have fixed it: during install the
   old worker intercepts the new worker's cache fill and hands it the OLD
   index.html. Network-first for index.html is what actually delivers a new
   version (with the cached copy as the offline fallback). */
const CACHE = "pocket-notes-v39";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isApp = url.pathname.endsWith("index.html") || url.pathname.endsWith("/");
  if (isApp) {
    // Network first for the app itself: a new version is picked up as soon as
    // it is deployed. The cached copy is only the offline fallback.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        // Cache a fresh copy of shell files for next time; anything else just passes through.
        try {
          if (SHELL.some((f) => url.pathname.endsWith(f.replace("./", "")))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
        } catch (err) {}
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});
