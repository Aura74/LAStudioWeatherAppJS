// Service worker: gör appen installerbar och användbar offline.
//
//  - Appskalet (html/css/js/ikoner): nätverk först, cache som reserv.
//    Då får man alltid senaste versionen när man är online, och appen
//    startar ändå utan nät.
//  - Väderdata: nätverk först, senast hämtade prognos som reserv.
//  - Typsnitt: cache först (ändras aldrig).
//
// Bumpa VERSION vid deploy så gamla cachar rensas.

const VERSION = 'v2.3.0';
const SHELL_CACHE = `vader-shell-${VERSION}`;
const DATA_CACHE = `vader-data-${VERSION}`;
const FONT_CACHE = 'vader-fonts';
const MAX_SAVED_FORECASTS = 24; // en per ort och enhet – räcker gott för favoriterna

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/astra.css',
  './assets/css/grok.css',
  './assets/js/design.js',
  './assets/js/boot-guard.js',
  './assets/js/app.js',
  './assets/js/api.js',
  './assets/js/format.js',
  './assets/js/icons.js',
  './assets/js/storage.js',
  './assets/js/weather-codes.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('vader-') && k !== SHELL_CACHE && k !== DATA_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event, SHELL_CACHE));
    return;
  }

  if (url.hostname === 'api.open-meteo.com') {
    event.respondWith(networkFirst(event, DATA_CACHE, MAX_SAVED_FORECASTS));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event, FONT_CACHE));
  }
  // Övrigt (geokodning m.m.) går direkt mot nätet.
});

async function networkFirst(event, cacheName, maxEntries) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) event.waitUntil(save(cache, request, response.clone(), maxEntries));
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) event.waitUntil(save(cache, request, response.clone()));
  return response;
}

/**
 * Sparar ett svar. Anropas via event.waitUntil så att svaret till sidan inte behöver
 * vänta, men service workern ändå hålls vid liv tills det är sparat. Går det inte att
 * spara (fullt lagringsutrymme t.ex.) fungerar appen ändå, bara inte offline.
 * Med maxEntries rensas de äldsta posterna bort så att cachen inte växer för evigt.
 */
async function save(cache, request, response, maxEntries) {
  try {
    await cache.put(request, response);
    if (!maxEntries) return;
    const keys = await cache.keys(); // äldst först
    await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
  } catch { /* cachen är en bonus, inget krav */ }
}
