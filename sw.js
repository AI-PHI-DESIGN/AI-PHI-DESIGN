// Service worker: deja la app disponible sin conexión y al día cuando hay cobertura.
// Estrategia: al abrir la app se pide la versión del servidor con un tiempo de espera corto;
// si la red responde, esa es la que se ve (y se guarda), y si no responde a tiempo se sirve la
// copia guardada. El resto (iconos, manifest, tipografías) sale de la caché y se refresca detrás.
const CACHE = 'visitas-obra-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const ESPERA_RED = 4000; // ms que se espera a la red antes de tirar de la copia guardada

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
const guardada = () => caches.match('./index.html', { ignoreSearch: true });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = req.url.startsWith(self.location.origin);
  const isFont = FONTS.test(req.url);
  if (!sameOrigin && !isFont) return;

  // Navegaciones: la red manda, con la copia guardada como respaldo si tarda o no hay cobertura.
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let resuelto = false;
      const responder = r => { if (!resuelto && r) { resuelto = true; resolve(r); } };
      const reserva = () => guardada().then(hit => responder(hit || fetch(req).catch(() => new Response('Sin conexión', { status: 503 }))));
      setTimeout(reserva, ESPERA_RED);
      refresh(req).then(responder).catch(reserva);
    }));
    return;
  }

  // Resto (esqueleto, iconos, tipografías): caché primero, red como respaldo.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    if (hit) { refresh(req).catch(() => {}); return hit; }
    return refresh(req).catch(() => guardada());
  }));
});
