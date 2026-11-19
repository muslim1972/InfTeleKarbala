// public/sw-kiosk.js
// Service Worker لطرفية البصمة البايومترية العامة (PWA WebAPK)
const KIOSK_CACHE = 'kiosk-cache-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== KIOSK_CACHE).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler — مطلوب إلزامياً لمعايير WebAPK على نظام أندرويد
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
