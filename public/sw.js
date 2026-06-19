/* Kiwoko Spark — Service Worker
 * Estrategia conservadora para una app con SSR + auth:
 *  - Precachea SOLO un shell offline mínimo y los iconos.
 *  - Navegaciones: network-first, fallback al shell offline si no hay red.
 *  - Assets estáticos del build (mismo origen, hashed): cache-first runtime.
 *  - NUNCA cachea llamadas a Supabase, Edge Functions, auth ni APIs.
 */

const VERSION = "kiwoko-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kiwoko-sw-") && !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Hostnames/paths que NUNCA deben tocar el SW (bypass total).
function shouldBypass(url, request) {
  if (request.method !== "GET") return true;
  // Supabase (cualquier subdominio)
  if (/\.supabase\.(co|in|net)$/i.test(url.hostname)) return true;
  // Edge Functions de Supabase
  if (url.pathname.startsWith("/functions/v1/")) return true;
  // API y endpoints internos (públicos o privados) de TanStack Start
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_serverFn/")) return true;
  // Auth y OAuth callbacks
  if (url.pathname.startsWith("/auth")) return true;
  if (url.pathname.includes("/auth/v1/")) return true;
  // Lovable AI Gateway
  if (url.hostname.endsWith("gateway.lovable.dev")) return true;
  // Hot updates (por si acaso)
  if (url.pathname.includes("/@vite/") || url.pathname.includes("__vite")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (shouldBypass(url, request)) return; // deja pasar a la red sin tocar

  const sameOrigin = url.origin === self.location.origin;

  // Navegaciones HTML: network-first con fallback al shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          return res;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return offline ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Solo runtime-cache de assets estáticos same-origin (hashed) o iconos.
  if (sameOrigin && /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok && res.type === "basic") cache.put(request, res.clone());
          return res;
        } catch {
          if (cached) return cached;
          throw new Error("offline");
        }
      })(),
    );
  }
});
