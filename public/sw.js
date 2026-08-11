const CACHE_NAME = "curio-v4";
const ASSETS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigation =
    event.request.mode === "navigate" ||
    event.request.headers.get("accept")?.includes("text/html");

  // Always fetch HTML fresh — stale cached pages break React interactivity
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.respondWith(
      self.registration.showNotification(payload.title ?? "Curio", {
        body: payload.body ?? "Your lesson is ready",
        icon: "/icon",
        badge: "/icon",
        data: { url: payload.url ?? "/" },
      }),
    );
  } catch {
    event.respondWith(
      self.registration.showNotification("Curio", {
        body: event.data?.text() ?? "Your lesson is ready",
        icon: "/icon",
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.respondWith(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
