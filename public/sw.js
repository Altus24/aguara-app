/* Aguará PWA — shell + Web Push. */
const CACHE = "aguara-shell-v3";
const PRECACHE = ["/", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];
const DEFAULT_ICON = "/icons/icon-192x192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear el runtime de Next: evita HTML/JS desfasados (hydration mismatch).
  if (url.pathname.startsWith("/_next/")) return;

  // Navegación: red primero, fallback a cache (modo offline básico).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // Solo iconos / assets estáticos de marca.
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/landing/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Aguará",
    body: "",
    url: "/",
    tag: "aguara",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || "",
        url: parsed.url || "/",
        tag: parsed.tag || "aguara",
      };
    }
  } catch {
    try {
      const text = event.data?.text?.() || "";
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag: data.tag,
      renotify: true,
      silent: false,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client && targetUrl) {
              await client.navigate(targetUrl);
            }
            return;
          } catch {
            /* seguir */
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
