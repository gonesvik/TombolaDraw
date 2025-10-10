const cacheName = 'tombola_draw_v4';

// A list of local resources we always want to be cached.
const cacheAssets = [
  '/index.html',
  '/css/tombola.css',
  '/js/main.js'
];

// Install event
self.addEventListener('install', event => {
  console.log('Service worker installed');

  event.waitUntil(
    caches
      .open(cacheName)
      .then(cache => {
        console.log('Service worker caching files');
        cache.addAll(cacheAssets);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service worker activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== cacheName) {
            console.log('Service worker clearing old cache');
            return caches.delete(cache);
          }
        })
      )
    })
  );
});

// Call fetch event
self.addEventListener('fetch', event => {
  // Skip cross-origin requests, like those for Google Analytics.
  if (event.request.url.startsWith(self.location.origin)) {
    console.log('Service worker fetching');
    event.respondWith(
      fetch(event.request)
      .catch(() => caches.match(event.request))
    );
  }
});
