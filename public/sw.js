/// <reference lib="webworker" />

const CACHE_NAME = "windping-v1";
const OFFLINE_URL = "/offline.html";

// Files to cache on install
const PRECACHE = [
  "/offline.html",
];

// Install: cache offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, offline fallback for navigation
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// Push notification handling
self.addEventListener("push", (event) => {
  let data = { title: "WindPing", body: "Je hebt een nieuwe wind alert!", url: "/" };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        url: payload.url || data.url,
      };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    tag: "windping-alert",
    renotify: true,
    data: { url: data.url },
    actions: [
      { action: "check", title: "Check spots" },
      { action: "dismiss", title: "Later" },
    ],
  };
  
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || "/alert";
  const targetUrl = event.action === "check" ? "/alert" : url;
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes("windping.com") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});