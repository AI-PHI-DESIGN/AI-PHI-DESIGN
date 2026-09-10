// Service worker: deja la app disponible sin conexión.
// Estrategia: el "esqueleto" de la app (HTML, manifest, iconos) se sirve desde la caché
// y se refresca en segundo plano, así arranca aunque no haya cobertura. La tipografía
// de Google se guarda la primera vez que se carga con conexión.
const CACHE = 'visitas-obra-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Guarda una copia en caché sin romper si falla la red.
function refresh(req) {
  return fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = req.url.startsWith(self.location.origin);
  const isFont = FONTS.test(req.url);
  if (!sameOrigin && !isFont) return;

  // Navegaciones: se responde siempre con el index cacheado (arranca al instante y sin cobertura).
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then(hit => {
      if (hit) { refresh(req).catch(() => {}); return hit; }
      return refresh(req).catch(() => caches.match('./index.html', { ignoreSearch: true }));
    }));
    return;
  }

  // Resto (esqueleto, iconos, tipografías): caché primero, red como respaldo.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    if (hit) { refresh(req).catch(() => {}); return hit; }
    return refresh(req).catch(() => caches.match('./index.html', { ignoreSearch: true }));
  }));
});
