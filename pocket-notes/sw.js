/* Pocket Notes service worker (v17 PWA). Caches the app shell so the app opens
   offline after the first visit and works as a home-screen web app. The app is a
   single self-contained file, so the shell is just index.html + the manifest and
   icons. Notes themselves live in IndexedDB/localStorage on the device, not in
   this cache — the worker never touches them. */
const CACHE = "pocket-notes-v17";
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
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        // Cache a fresh copy of shell files for next time; anything else just passes through.
        try {
          const url = new URL(e.request.url);
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
