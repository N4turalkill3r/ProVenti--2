// Service worker de Prosventi V-2.0. Guarda en caché los recursos esenciales para usar el simulador sin conexión.
// Para publicar una versión nueva: cambie VERSION aquí, en js/version.js y en package.json.
const VERSION = '1.2.1';
const CACHE = `prosventi-${VERSION}`;

// Todos los recursos esenciales (rutas relativas: funcionan en la raíz y en subcarpetas de GitHub Pages).
// tests/pwa-tests.js comprueba que esta lista cubre todo lo que carga la aplicación.
const RECURSOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/variables.css', './css/reset.css', './css/layout.css', './css/ventilator.css',
  './css/controls.css', './css/projection.css', './css/responsive.css',
  './js/app.js', './js/audio.js', './js/brand.config.js', './js/config.js', './js/dynamics.js', './js/engine.js',
  './js/indicators.js', './js/interaction.js', './js/modes.js', './js/pwa.js', './js/random.js', './js/state.js',
  './js/utils.js', './js/ventilator-renderer.js', './js/version.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' evita guardar copias viejas del caché HTTP del navegador. Si falla un solo recurso, la instalación falla
    // y se sigue usando la versión anterior: nunca queda una caché incompleta activa.
    await cache.addAll(RECURSOS.map((url) => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith('prosventi-') && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

// La página pide activar la versión nueva cuando la persona acepta actualizar.
self.addEventListener('message', (evento) => {
  if (evento.data === 'SALTAR_ESPERA') self.skipWaiting();
  if (evento.data === 'VERSION' && evento.source) evento.source.postMessage({ tipo: 'version', version: VERSION, cache: CACHE, recursos: RECURSOS });
});

async function navegacion(peticion) {
  // Con conexión se prefiere la red (así llegan las actualizaciones); sin conexión o muy lenta, la copia guardada.
  try {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 4000);
    const respuesta = await fetch(peticion, { signal: controlador.signal });
    clearTimeout(limite);
    if (respuesta.ok) return respuesta;
  } catch { /* sin red */ }
  const cache = await caches.open(CACHE);
  return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
}

async function recurso(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion, { ignoreSearch: true });
  if (guardada) return guardada;
  try { return await fetch(peticion); } catch {
    return new Response('Recurso no disponible sin conexión.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // solo recursos propios
  evento.respondWith(peticion.mode === 'navigate' ? navegacion(peticion) : recurso(peticion));
});
