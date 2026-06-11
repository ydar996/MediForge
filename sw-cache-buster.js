// Service Worker for Automatic Cache Busting
// This ensures users always get the latest version without manual cache clearing

const CACHE_NAME = 'mediforge-v20251022120000';
const STATIC_CACHE_NAME = 'mediforge-static-v20251022120000';

// Force cache invalidation on every page load
self.addEventListener('install', function(event) {
  console.log('🔄 Service Worker: Installing with cache busting');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('🔄 Service Worker: Activating with cache clearing');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName.startsWith('mediforge-')) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercept all requests and add cache-busting parameters
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Only handle requests from our domain to avoid CORS issues
  if (url.origin !== self.location.origin) {
    // For external requests, just pass through without modification
    return;
  }
  
  // Add timestamp to all JS and CSS requests from our domain
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    const cacheBustUrl = new URL(event.request.url);
    cacheBustUrl.searchParams.set('v', new Date().getTime());
    
    event.respondWith(
      fetch(cacheBustUrl.toString(), {
        cache: 'no-cache'
      }).catch(function() {
        return caches.match(event.request);
      })
    );
  } else {
    // For other requests, use network-first strategy
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache'
      }).catch(function() {
        return caches.match(event.request);
      })
    );
  }
});

// Force reload on service worker update
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
