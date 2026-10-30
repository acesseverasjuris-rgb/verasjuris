/* VerasJuris PWA — cache ONLY public shell assets. Never cache /api or private docs. */
const CACHE = "vj-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/brand/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

function isSensitive(url) {
  const path = new URL(url).pathname;
  if (path.startsWith("/api/")) return true;
  if (path.startsWith("/session/")) return true;
  if (path.includes("/documentos") && path.includes("/download")) return true;
  if (path.startsWith("/portal/") && path.includes("arquivo")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (isSensitive(request.url)) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first only for static public assets / shell navigations without auth headers.
  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/" ||
    url.pathname.startsWith("/institucional/") ||
    url.pathname.startsWith("/politicas/") ||
    url.pathname.startsWith("/acessibilidade") ||
    url.pathname === "/status" ||
    url.pathname === "/developers";

  if (!isAsset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (
          cached ||
          new Response("Offline", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        );
      }
    }),
  );
});
