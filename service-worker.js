const CACHE_NAME = 'widget-parcels-pwa-v51';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './vendor/maplibre-gl/maplibre-gl.mjs',
  './vendor/maplibre-gl/maplibre-gl-worker.mjs',
  './vendor/maplibre-gl/maplibre-gl-shared.mjs',
  './vendor/maplibre-gl/maplibre-gl.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/carriers/aramex.svg',
  './icons/carriers/bpost.svg',
  './icons/carriers/budbee.svg',
  './icons/carriers/canadapost.svg',
  './icons/carriers/canadapost_symbol.svg',
  './icons/carriers/chronopost.svg',
  './icons/carriers/chronopost_symbol.svg',
  './icons/carriers/colissimo.svg',
  './icons/carriers/colissimo_symbol.svg',
  './icons/carriers/correos.svg',
  './icons/carriers/correos_symbol.svg',
  './icons/carriers/dao.svg',
  './icons/carriers/dhl.svg',
  './icons/carriers/dpd.svg',
  './icons/carriers/dpd_symbol.svg',
  './icons/carriers/evri.svg',
  './icons/carriers/fedex.svg',
  './icons/carriers/gls.svg',
  './icons/carriers/helthjem.svg',
  './icons/carriers/instabox.svg',
  './icons/carriers/israelpost.svg',
  './icons/carriers/laposte.svg',
  './icons/carriers/mondialrelay.svg',
  './icons/carriers/mondialrelay_symbol.svg',
  './icons/carriers/naqelexpress.svg',
  './icons/carriers/porterbuddy.svg',
  './icons/carriers/posteitaliane.svg',
  './icons/carriers/posten.svg',
  './icons/carriers/postnl.svg',
  './icons/carriers/postnord.svg',
  './icons/carriers/royalmail.svg',
  './icons/carriers/sendle.svg',
  './icons/carriers/smsaexpress.svg',
  './icons/carriers/ups.svg',
  './icons/carriers/usps.svg',
  './icons/carriers/usps_symbol.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('widget-parcels-pwa-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', responseCopy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => cachedResponse || fetch(event.request))
  );
});
