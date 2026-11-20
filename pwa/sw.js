// Guarda o Orvia no aparelho para abrir sem internet. Não guarda nem envia dados do usuário:
// arquivos, cenários e favoritos ficam no IndexedDB e no localStorage do próprio app.
// O build troca a versão abaixo a cada publicação, e o cache antigo é apagado.
const CACHE = 'orvia-__VERSAO__';
const APP = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('orvia-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // A página tenta a versão nova primeiro e, sem internet, abre a guardada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('./', copy)));
          }
          return response;
        })
        .catch(() => caches.match('./', { cacheName: CACHE })),
    );
    return;
  }

  event.respondWith(caches.match(request, { cacheName: CACHE }).then((cached) => cached || fetch(request)));
});
