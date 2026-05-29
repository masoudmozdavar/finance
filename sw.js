const CACHE_NAME = 'masoud-finance-v2';
const BASE = '/finance';
const FILES_TO_CACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdn.jsdelivr.net/npm/jalaali-js@1.2.6/dist/jalaali.min.js',
  'https://cdn.jsdelivr.net/npm/@majidh1/jalalidatepicker/dist/jalalidatepicker.min.js',
  'https://cdn.jsdelivr.net/npm/@majidh1/jalalidatepicker/dist/jalalidatepicker.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ===== نصب =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // فایل‌های محلی و CDN جدا کش می‌شن
      return cache.addAll(FILES_TO_CACHE).catch(err => {
        console.log('Cache addAll error:', err);
        // اگه یه فایل خطا داد، بقیه رو جداگانه کش کن
        return Promise.allSettled(
          FILES_TO_CACHE.map(url => cache.add(url).catch(e => console.log('Failed:', url, e)))
        );
      });
    })
  );
  self.skipWaiting();
});

// ===== فعال‌سازی =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== دریافت درخواست =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // فقط GET رو هندل کن
  if (event.request.method !== 'GET') return;

  // درخواست‌های chrome-extension و غیره رو نادیده بگیر
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // از کش برگردون و در پس‌زمینه آپدیت کن (stale-while-revalidate)
        fetch(event.request)
          .then(fresh => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, fresh);
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // کش نداشت → از شبکه بگیر
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;

          // کپی بگیر و کش کن
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // آفلاین
          if (event.request.destination === 'document') {
            return caches.match(BASE + '/index.html');
          }
          // برای فونت‌ها و CSS یه response خالی برگردون
          return new Response('', {
            status: 408,
            statusText: 'Offline'
          });
        });
    })
  );
});

// ===== پیام از صفحه =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
