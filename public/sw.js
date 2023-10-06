const cacheName = 'v3';

// A list of local resources we always want to be cached.
const cacheAssets = [
  'index.html',
  '/css/tombola.css',
  '/js/main.js'
];

// Call install event
self.addEventListener('install', e => {
  console.log('Service worker installed');

  e.waitUntil(
    caches
      .open(cacheName)
      .then(cache => {
        console.log('Service worker caching files');
        cache.addAll(cacheAssets);
      })
      .then(() => self.skipWaiting())
  );
});

// Call activate event
self.addEventListener('activate', e => {
  console.log('Service worker activated');
  e.waitUntil(
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
self.addEventListener('fetch', e => {
  // Skip cross-origin requests, like those for Google Analytics.
  if (e.request.url.startsWith(self.location.origin)) {
    console.log('Service worker fetching');
    e.respondWith(
      fetch(e.request)
      .catch(() => caches.match(e.request))      
    );
  }
});
