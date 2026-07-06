// Service worker — cache do shell para funcionar offline e abrir instantâneo.
const CACHE = 'ftd-v1';
const SHELL = [
  '.', 'index.html', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/calc.js', 'js/charts.js', 'js/ia.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // nunca intercepta chamadas de API (IA)
  if (url.origin !== location.origin && !url.host.includes('fonts.')) return;
  if (e.request.method !== 'GET') return;

  // network-first para o app (pega atualizações), cache como fallback offline
  e.respondWith(
    fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
