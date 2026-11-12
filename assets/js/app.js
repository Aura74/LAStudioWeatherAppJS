// Vilket väder – huvudmodul.
// Håller appens tillstånd, kopplar händelser och renderar vyerna.

import { searchPlaces, fetchForecast, reverseGeocode, getCurrentPosition, ApiError } from './api.js';
import { describe, iconKey, themeKey } from './weather-codes.js';
import { weatherIcon, ICON_DEFS } from './icons.js';
import * as store from './storage.js';
import * as fmt from './format.js';

// Startort om inget annat finns sparat – som i originalappen.
const DEFAULT_PLACE = {
  id: '2712414', name: 'Gävle', admin1: 'Gävleborgs län', country: 'Sverige',
  countryCode: 'SE', lat: 60.6745, lon: 17.1417,
};

const HOURS_TO_SHOW = 24;
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;
// "Just nu" i ett färskt svar är högst en kvart gammalt. Är det äldre än så här
// kommer prognosen ur service workerns cache (offline) och ska inte kallas uppdaterad.
const SAVED_FORECAST_AFTER_MS = 45 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 220;
const TOAST_FADE_MS = 250; // samma som övergången i .toast
const BACKGROUND_FADE_MS = 1200; // samma som övergången på body i style.css och grok.css

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

const $ = (id) => document.getElementById(id);
const els = {
  body: document.body,
  html: document.documentElement,
  defs: $('wx-defs'),
  themeColor: $('theme-color'),
  searchForm: $('search-form'),
  searchInput: $('search-input'),
  searchClear: $('search-clear'),
  searchResults: $('search-results'),
  btnLocate: $('btn-locate'),
  btnUnit: $('btn-unit'),
  btnTheme: $('btn-theme'),
  btnFav: $('btn-fav'),
  btnRefresh: $('btn-refresh'),
  favorites: $('favorites'),
  favoritesList: $('favorites-list'),
  hero: $('hero'),
  heroPlace: $('hero-place'),
  heroSub: $('hero-sub'),
  heroIcon: $('hero-icon'),
  heroTemp: $('hero-temp'),
  heroUnit: $('hero-unit'),
  heroDesc: $('hero-desc'),
  heroRange: $('hero-range'),
  stats: $('stats'),
  hourly: $('hourly'),
  hourlyHint: $('hourly-hint'),
  hourlyNavigation: $('hourly-navigation'),
  hourlyPrev: $('hourly-prev'),
  hourlyNext: $('hourly-next'),
  daily: $('daily'),
  updated: $('updated'),
  toast: $('toast'),
  toastText: $('toast-text'),
  toastAction: $('toast-action'),
};

const state = {
  place: null,
  data: null,       // prognosen som visas, eller null medan vi laddar / vid fel
  fetchedAt: 0,
  settings: store.getSettings(),
  forecastAbort: null,
  searchAbort: null,
  searchTimer: null,
  searchResults: [],
  searchQuery: '',  // söktexten som searchResults hör till
  activeIndex: -1,
  toastTimer: null,
  toastHideTimer: null,
  themeColorTimer: null,
};

// ============================================================ init

function init() {
  els.defs.innerHTML = ICON_DEFS;

  applyTheme(state.settings.theme);
  updateUnitButton();
  bindEvents();
  renderFavorites();
  migrateLegacyFavorites();

  const saved = store.getLastPlace();
  loadPlace(saved ?? DEFAULT_PLACE);

  // Första besöket, och platsåtkomst är redan beviljad: byt tyst till riktig position.
  if (!saved && navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((p) => { if (p.state === 'granted') locate({ quiet: true }); })
      .catch(() => {});
  }

  setInterval(() => {
    if (document.visibilityState === 'visible') refresh({ quiet: true });
  }, AUTO_REFRESH_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.fetchedAt > STALE_AFTER_MS) {
      refresh({ quiet: true });
    }
  });

  window.addEventListener('online', () => refresh({ quiet: true }));

  registerServiceWorker();
  els.html.dataset.app = 'started'; // kvitto till boot-guard.js: appen kom igång
}

function bindEvents() {
  els.searchInput.addEventListener('input', onSearchInput);
  els.searchInput.addEventListener('keydown', onSearchKeydown);
  els.searchInput.addEventListener('focus', () => { if (state.searchResults.length) openResults(); });
  els.searchForm.addEventListener('submit', onSearchSubmit);
  els.searchClear.addEventListener('click', clearSearch);
  els.searchResults.addEventListener('mousedown', (e) => e.preventDefault()); // behåll fokus i fältet
  els.searchResults.addEventListener('click', (e) => {
    const li = e.target.closest('[data-index]');
    if (li) choosePlace(state.searchResults[Number(li.dataset.index)]);
  });
  document.addEventListener('click', (e) => {
    if (!els.searchForm.contains(e.target)) closeResults();
  });

  els.btnLocate.addEventListener('click', () => locate());
  els.btnUnit.addEventListener('click', toggleUnit);
  els.btnTheme.addEventListener('click', toggleTheme);
  document.addEventListener('designchange', syncThemeColor);
  document.addEventListener('designchange', () => requestAnimationFrame(syncHourlyNavigation));
  els.btnFav.addEventListener('click', toggleFavorite);
  els.btnRefresh.addEventListener('click', () => refresh());

  els.favoritesList.addEventListener('click', onFavoritesClick);
  els.hourly.addEventListener('wheel', onHourlyWheel, { passive: false });
  els.hourly.addEventListener('scroll', syncHourlyNavigation, { passive: true });
  els.hourlyPrev.addEventListener('click', () => scrollHours(-1));
  els.hourlyNext.addEventListener('click', () => scrollHours(1));
  new ResizeObserver(syncHourlyNavigation).observe(els.hourly);

  systemDark.addEventListener('change', () => {
    if (state.settings.theme === 'auto') syncThemeColor();
  });
}

// Lämna överlapp även när scroll-snap justerar till närmaste timkort.
function scrollHours(direction) {
  const hourWidth = els.hourly.querySelector('.hour')?.getBoundingClientRect().width ?? 73;
  els.hourly.scrollBy({
    left: direction * Math.max(hourWidth, els.hourly.clientWidth - 2 * hourWidth),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

function syncHourlyNavigation() {
  const max = els.hourly.scrollWidth - els.hourly.clientWidth;
  els.hourlyNavigation.hidden = els.html.dataset.design !== 'astra'
    || els.body.dataset.state !== 'ready' || max <= 1;
  els.hourlyPrev.disabled = els.hourly.scrollLeft <= 1;
  els.hourlyNext.disabled = els.hourly.scrollLeft >= max - 1;
}

/**
 * Mushjul över timprognosen rullar raden i sidled. Vid radens ändar släpps
 * hjulet igenom till sidan, så att man aldrig fastnar ovanför den.
 */
function onHourlyWheel(e) {
  if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  const el = els.hourly;
  const max = el.scrollWidth - el.clientWidth;
  const atEnd = e.deltaY < 0 ? el.scrollLeft <= 0 : el.scrollLeft >= max - 1;
  if (max <= 0 || atEnd) return;

  // deltaY anges i pixlar, rader eller sidor beroende på webbläsare och mus.
  const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 32
    : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
  el.scrollLeft += e.deltaY * unit;
  e.preventDefault();
}

// ============================================================ data

/**
 * Hämtar och visar prognosen för en ort.
 *
 * keep   Behåll prognosen som redan visas medan den nya hämtas, och även om
 *        hämtningen misslyckas. Används för uppdateringar av samma ort.
 * quiet  Säg inget till användaren om hämtningen misslyckas (automatiska försök).
 */
async function loadPlace(place, { keep = false, quiet = false } = {}) {
  state.forecastAbort?.abort();
  const controller = new AbortController();
  state.forecastAbort = controller;

  state.place = place;
  store.setLastPlace(place);
  document.title = `${place.name} · Vilket väder`;
  renderFavorites();

  const keeping = keep && state.data !== null;
  if (keeping) {
    els.updated.textContent = 'Uppdaterar…';
  } else if (!quiet) {
    state.data = null; // det som visades gällde en annan ort eller enhet
    setLoading();
  }

  let data;
  try {
    data = await fetchForecast(place, { unit: state.settings.unit, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error(err);
    if (keeping) {
      renderStatus();
      if (!quiet) showToast('Kunde inte uppdatera – visar senast hämtade prognos.');
    } else if (!quiet) {
      setError(err instanceof ApiError ? err.message : 'Något gick fel när prognosen skulle hämtas.');
    }
    return;
  }
  if (controller.signal.aborted) return;

  state.data = data;
  state.fetchedAt = Date.now();
  try {
    render();
  } catch (err) {
    console.error(err);
    state.data = null;
    setError('Prognosen gick inte att visa. Försök igen om en stund.');
  }
}

/** Hämtar om prognosen för orten som visas, utan att tömma vyn under tiden. */
function refresh({ quiet = false } = {}) {
  if (state.place) loadPlace(state.place, { keep: true, quiet });
}

async function locate({ quiet = false } = {}) {
  els.btnLocate.classList.add('is-busy');
  els.btnLocate.disabled = true;
  try {
    const { lat, lon } = await getCurrentPosition();
    const place = await reverseGeocode(lat, lon);
    loadPlace(place);
  } catch (err) {
    if (!quiet) showToast(err.message || 'Kunde inte hämta din position');
  } finally {
    els.btnLocate.classList.remove('is-busy');
    els.btnLocate.disabled = false;
  }
}

// ============================================================ sök

function onSearchInput() {
  const q = els.searchInput.value.trim();
  els.searchClear.hidden = els.searchInput.value.length === 0;
  cancelPendingSearch();

  if (q.length < 2) {
    setSearchResults([], '');
    closeResults();
    return;
  }

  state.searchTimer = setTimeout(async () => {
    const controller = new AbortController();
    state.searchAbort = controller;
    try {
      const results = await searchPlaces(q, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setSearchResults(results, q);
      renderResults(results, q);
    } catch (err) {
      if (!controller.signal.aborted) console.warn('Ortsök misslyckades', err);
    }
  }, SEARCH_DEBOUNCE_MS);
}

/** Stoppar både den väntande och den pågående sökningen, så att inget sent svar öppnar listan igen. */
function cancelPendingSearch() {
  clearTimeout(state.searchTimer);
  state.searchAbort?.abort();
}

function setSearchResults(results, query) {
  state.searchResults = results;
  state.searchQuery = query;
  state.activeIndex = -1;
}

function onSearchKeydown(e) {
  const n = state.searchResults.length;
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault();
    openResults();
    setActive((state.activeIndex + 1) % n);
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault();
    setActive((state.activeIndex - 1 + n) % n);
  } else if (e.key === 'Escape') {
    if (els.searchResults.hidden) clearSearch(); else closeResults();
  } else if (e.key === 'Tab') {
    closeResults();
  }
}

async function onSearchSubmit(e) {
  e.preventDefault();
  cancelPendingSearch();
  const q = els.searchInput.value.trim();

  // Träfflistan får bara användas om den hör till det som står i fältet just nu –
  // annars hinner man trycka Enter och få en ort från en äldre sökning.
  if (state.searchQuery === q && state.searchResults.length) {
    choosePlace(state.searchResults[Math.max(0, state.activeIndex)]);
    return;
  }
  if (q.length < 2) return;

  els.searchForm.classList.add('is-busy');
  try {
    const results = await searchPlaces(q);
    if (results.length) choosePlace(results[0]);
    else showToast(`Hittade ingen ort som heter "${q}".`);
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Sökningen misslyckades.');
  } finally {
    els.searchForm.classList.remove('is-busy');
  }
}

function choosePlace(place) {
  if (!place) return;
  resetSearch();
  els.searchInput.blur();
  loadPlace(place);
}

function clearSearch() {
  resetSearch();
  els.searchInput.focus();
}

function resetSearch() {
  cancelPendingSearch();
  els.searchInput.value = '';
  els.searchClear.hidden = true;
  setSearchResults([], '');
  closeResults();
}

function renderResults(results, query) {
  if (!results.length) {
    els.searchResults.innerHTML = `<li class="search__empty" role="option" aria-disabled="true" aria-selected="false">Ingen ort hittades för "${esc(query)}"</li>`;
    openResults();
    return;
  }
  els.searchResults.innerHTML = results.map((r, i) => `
    <li class="search__item" role="option" id="search-opt-${i}" data-index="${i}" aria-selected="false">
      <span class="search__flag" aria-hidden="true">${flag(r.countryCode)}</span>
      <span class="search__name">${esc(r.name)}</span>
      <span class="search__meta">${esc([r.admin1, r.country].filter(Boolean).join(', '))}</span>
    </li>`).join('');
  openResults();
}

function setActive(index) {
  state.activeIndex = index;
  const items = els.searchResults.querySelectorAll('.search__item');
  items.forEach((li, i) => {
    const on = i === index;
    li.classList.toggle('is-active', on);
    li.setAttribute('aria-selected', String(on));
    if (on) li.scrollIntoView({ block: 'nearest' });
  });
  els.searchInput.setAttribute('aria-activedescendant', index >= 0 ? `search-opt-${index}` : '');
}

function openResults() {
  els.searchResults.hidden = false;
  els.searchInput.setAttribute('aria-expanded', 'true');
}

function closeResults() {
  els.searchResults.hidden = true;
  els.searchInput.setAttribute('aria-expanded', 'false');
  els.searchInput.removeAttribute('aria-activedescendant');
  state.activeIndex = -1;
}

// ============================================================ favoriter

function toggleFavorite() {
  if (!state.place) return;
  const added = store.toggleFavorite(state.place);
  renderFavorites();
  showToast(added ? `${state.place.name} sparad som favorit` : `${state.place.name} borttagen från favoriter`);
}

function onFavoritesClick(e) {
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    removeFavorites((f) => f.id === remove.dataset.remove, `${remove.dataset.name} borttagen`);
    return;
  }
  if (e.target.closest('[data-clear]')) {
    removeFavorites(() => true, 'Alla favoriter borttagna');
    return;
  }
  const chip = e.target.closest('[data-id]');
  if (chip) {
    const fav = store.getFavorites().find((f) => f.id === chip.dataset.id);
    if (fav) loadPlace(fav);
  }
}

/** Tar bort direkt och erbjuder "Ångra", i stället för att avbryta med en fråga först. */
function removeFavorites(shouldRemove, message) {
  const before = store.getFavorites();
  store.setFavorites(before.filter((f) => !shouldRemove(f)));
  renderFavorites();
  showToast(message, {
    duration: 6000,
    action: {
      label: 'Ångra',
      onClick: () => { store.setFavorites(before); renderFavorites(); },
    },
  });
}

function renderFavorites() {
  const favs = store.getFavorites();
  const currentId = state.place?.id;
  const isFav = favs.some((f) => f.id === currentId);

  els.btnFav.setAttribute('aria-pressed', String(isFav));
  els.btnFav.setAttribute('aria-label', isFav ? 'Ta bort från favoriter' : 'Spara som favorit');
  els.btnFav.title = isFav ? 'Ta bort från favoriter' : 'Spara som favorit';

  els.favorites.hidden = favs.length === 0;
  if (!favs.length) { els.favoritesList.innerHTML = ''; return; }

  els.favoritesList.innerHTML = favs.map((f) => `
    <div class="chip ${f.id === currentId ? 'is-active' : ''}" data-id="${esc(f.id)}">
      <button type="button" class="chip__main" aria-current="${f.id === currentId ? 'true' : 'false'}">
        <span class="chip__flag" aria-hidden="true">${flag(f.countryCode)}</span>${esc(f.name)}
      </button>
      <button type="button" class="chip__remove" data-remove="${esc(f.id)}" data-name="${esc(f.name)}" aria-label="Ta bort ${esc(f.name)} från favoriter">
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
      </button>
    </div>`).join('')
    + (favs.length > 1 ? `<button type="button" class="chip chip--ghost" data-clear>Rensa alla</button>` : '');
}

/** Den gamla appen sparade favoriter som ortnamn – geokoda dem en gång. */
async function migrateLegacyFavorites() {
  const names = store.takeLegacyFavoriteNames();
  for (const name of names) {
    try {
      const [hit] = await searchPlaces(name, { count: 1 });
      if (hit && !store.isFavorite(hit)) store.toggleFavorite(hit);
    } catch { /* hoppa över */ }
  }
  if (names.length) renderFavorites();
}

// ============================================================ tema & enhet

function applyTheme(theme) {
  els.html.dataset.theme = theme;
  syncThemeColor();
}

function toggleTheme() {
  const { theme } = state.settings;
  const isDark = theme === 'dark' || (theme === 'auto' && systemDark.matches);
  const next = isDark ? 'light' : 'dark';
  // Blir valet samma som systemets går vi tillbaka till "auto", så att appen följer systemet igen.
  const followsSystem = (next === 'dark') === systemDark.matches;
  state.settings = store.updateSettings({ theme: followsSystem ? 'auto' : next });
  applyTheme(state.settings.theme);
}

/**
 * Sätter webbläsarens temafärg (adressfält/statusrad) till sidans bakgrund högst upp.
 * Bakgrunden tonas om via registrerade CSS-variabler, och mitt i toningen ger
 * getComputedStyle ett mellanvärde – därför läses färgen av en gång till när den är klar.
 */
function syncThemeColor() {
  clearTimeout(state.themeColorTimer);
  requestAnimationFrame(readThemeColor);
  state.themeColorTimer = setTimeout(readThemeColor, BACKGROUND_FADE_MS + 150);
}

/** Färgen styrs av data-weather + tema i CSS, så den läses av därifrån. */
function readThemeColor() {
  const design = els.html.dataset.design;
  if (design === 'grok') {
    const sky = document.querySelector('.grok-sky');
    const c = sky ? getComputedStyle(sky).backgroundColor : '';
    if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') els.themeColor.setAttribute('content', c);
    return;
  }
  const c = getComputedStyle(els.body).getPropertyValue(design === 'astra' ? '--astra-page' : '--bg-1').trim();
  if (c) els.themeColor.setAttribute('content', c);
}

function toggleUnit() {
  const unit = state.settings.unit === 'celsius' ? 'fahrenheit' : 'celsius';
  state.settings = store.updateSettings({ unit });
  updateUnitButton();
  if (state.place) loadPlace(state.place);
}

function updateUnitButton() {
  const isC = state.settings.unit === 'celsius';
  els.btnUnit.textContent = isC ? '°C' : '°F';
  els.btnUnit.title = isC ? 'Visa i Fahrenheit' : 'Visa i Celsius';
}

// ============================================================ rendering

function setLoading() {
  els.body.dataset.state = 'loading';
  els.hero.setAttribute('aria-busy', 'true');
  els.heroPlace.innerHTML = '<span class="skel skel--title"></span>';
  els.heroSub.innerHTML = '<span class="skel skel--text"></span>';
  els.heroIcon.innerHTML = '<span class="skel skel--icon"></span>';
  els.heroTemp.innerHTML = '<span class="skel skel--big"></span>';
  els.heroUnit.textContent = '';
  els.heroDesc.innerHTML = '<span class="skel skel--text"></span>';
  els.heroRange.textContent = '';
  els.stats.innerHTML = Array.from({ length: 6 }, () => '<div class="stat"><span class="skel skel--text"></span><span class="skel skel--value"></span></div>').join('');
  els.hourly.innerHTML = Array.from({ length: 8 }, () => '<div class="hour"><span class="skel skel--text"></span><span class="skel skel--icon-sm"></span><span class="skel skel--text"></span></div>').join('');
  els.daily.innerHTML = Array.from({ length: 7 }, () => '<li class="day"><span class="skel skel--text"></span><span class="skel skel--icon-sm"></span><span class="skel skel--bar"></span></li>').join('');
  els.hourly.scrollLeft = 0;
  syncHourlyNavigation();
  els.updated.textContent = 'Hämtar…';
  clearGrok();
}

function setError(message) {
  els.body.dataset.state = 'error';
  els.hero.setAttribute('aria-busy', 'false');
  els.heroPlace.textContent = state.place?.name ?? 'Vilket väder';
  els.heroSub.textContent = message;
  els.heroIcon.innerHTML = weatherIcon('cloudy', { size: 96 });
  els.heroTemp.textContent = '';
  els.heroUnit.textContent = '';
  els.heroDesc.textContent = 'Kunde inte hämta prognosen';
  els.stats.innerHTML = '';
  els.hourly.innerHTML = '';
  syncHourlyNavigation();
  els.daily.innerHTML = '';
  els.updated.textContent = '';
  clearGrok();

  // Knappen ligger kvar i vyn så länge felet gör det – en toast hinner försvinna.
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'link-btn';
  retry.textContent = 'Försök igen';
  retry.addEventListener('click', () => refresh());
  els.heroRange.replaceChildren(retry);
}

function render() {
  const d = state.data;
  const cur = d.current;
  const isDay = cur.is_day === 1;
  const unit = state.settings.unit;
  const todayKey = fmt.dateKey(cur.time);
  const today = dailyAt(d, 0);
  const wx = describe(cur.weather_code);

  els.body.dataset.weather = themeKey(cur.weather_code, isDay);
  els.body.dataset.state = 'ready';
  els.hero.setAttribute('aria-busy', 'false');
  syncThemeColor();

  // --- hero
  const p = state.place;
  const where = [p.admin1, p.countryCode !== 'SE' ? p.country : ''].filter(Boolean).join(', ');
  els.heroPlace.textContent = p.name;
  els.heroSub.textContent = [where, fmt.formatLongDate(cur.time)].filter(Boolean).join(' · ');
  els.heroIcon.innerHTML = weatherIcon(iconKey(cur.weather_code, isDay), { size: 128, label: wx.text });
  els.heroTemp.textContent = fmt.formatNumber(cur.temperature_2m);
  els.heroUnit.textContent = fmt.unitSymbol(unit);
  els.heroDesc.textContent = wx.text;
  els.heroRange.innerHTML = today
    ? `<span>Högst <b>${fmt.formatTemp(today.max)}</b></span><span>Lägst <b>${fmt.formatTemp(today.min)}</b></span>`
    : '';

  // --- detaljer
  els.stats.innerHTML = [
    stat('Känns som', fmt.formatTemp(cur.apparent_temperature), fmt.feelsLikeNote(cur.temperature_2m, cur.apparent_temperature)),
    stat('Vind', fmt.formatWind(cur.wind_speed_10m), `${fmt.compass(cur.wind_direction_10m)} · ${fmt.windLabel(cur.wind_speed_10m)}${cur.wind_gusts_10m ? ` · byar ${Math.round(cur.wind_gusts_10m)}` : ''}`, windArrow(cur.wind_direction_10m)),
    stat('Luftfuktighet', fmt.formatPercent(cur.relative_humidity_2m), humidityNote(cur.relative_humidity_2m)),
    stat('Nederbörd idag', fmt.formatMm(today?.precip), today?.precipProb != null ? `${Math.round(today.precipProb)} % sannolikhet` : ''),
    stat('UV-index', today?.uv != null ? String(Math.round(today.uv)) : '–', fmt.uvLabel(today?.uv)),
    stat('Sol upp och ner', today ? `${fmt.formatTime(today.sunrise)} – ${fmt.formatTime(today.sunset)}` : '–', today ? daylightNote(today.sunrise, today.sunset) : '', sunIcon(), 'stat__value--compact'),
  ].join('');

  const hours = upcomingHours(d);
  renderHourly(hours, todayKey);
  renderDaily(d, todayKey);

  // --- sidfot
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  els.hourlyHint.textContent = d.timezone && d.timezone !== browserTz ? `Lokal tid (${d.timezone_abbreviation})` : '';
  renderStatus();
  renderGrok(hours);
}

/** Sidfotens statusrad: när prognosen hämtades, eller att den är sparad sedan tidigare. */
function renderStatus() {
  const observed = observedAt(state.data);
  const isSaved = Number.isFinite(observed) && state.fetchedAt - observed > SAVED_FORECAST_AFTER_MS;
  els.updated.textContent = isSaved
    ? `Sparad prognos från ${fmt.formatTimestamp(observed)}`
    : `Uppdaterad ${fmt.formatTimestamp(state.fetchedAt)}`;
}

/**
 * Tidpunkten (ms) som prognosens "just nu" gäller. Open-Meteo anger den i ortens
 * lokala tid utan zon, tillsammans med ortens avstånd till UTC.
 */
function observedAt(d) {
  const localAsUtc = Date.parse(`${d.current.time}:00Z`);
  return localAsUtc - (d.utc_offset_seconds ?? 0) * 1000;
}

/**
 * De kommande timmarna med början i den pågående. Den första posten får
 * mätvärdena för just nu, så att den alltid stämmer med det stora kortet.
 */
function upcomingHours(d) {
  const h = d.hourly;
  const cur = d.current;
  const currentHour = cur.time.slice(0, 13);
  const start = Math.max(0, h.time.findIndex((t) => t >= currentHour));
  const hours = [];

  for (let i = start; i < Math.min(h.time.length, start + HOURS_TO_SHOW); i++) {
    hours.push({
      time: h.time[i],
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      isDay: h.is_day?.[i] === 1,
      precipProb: h.precipitation_probability?.[i],
      isNow: false,
    });
  }

  if (hours[0]?.time.startsWith(currentHour)) {
    Object.assign(hours[0], { temp: cur.temperature_2m, code: cur.weather_code, isDay: cur.is_day === 1, isNow: true });
  }
  return hours;
}

function renderHourly(hours, todayKey) {
  let lastDay = todayKey;

  els.hourly.innerHTML = hours.map((hour) => {
    const day = fmt.dateKey(hour.time);
    const separator = day === lastDay ? ''
      : `<div class="hour hour--sep" aria-hidden="true"><span>${esc(fmt.formatDayLabel(hour.time, todayKey))}</span></div>`;
    lastDay = day;

    const time = hour.isNow ? 'Nu' : fmt.formatTime(hour.time);
    const temp = fmt.formatTemp(hour.temp);
    const rain = precipLabel(hour.precipProb);
    const summary = [`${time}: ${describe(hour.code).text}`, temp, rain && `${rain} risk för nederbörd`].filter(Boolean).join(', ');

    return `${separator}
      <div class="hour" role="group" aria-label="${esc(summary)}">
        <span class="hour__time">${time}</span>
        <span class="hour__icon">${weatherIcon(iconKey(hour.code, hour.isDay), { size: 36 })}</span>
        <span class="hour__temp">${temp}</span>
        <span class="hour__prob ${rain ? '' : 'is-empty'}">${rain}</span>
      </div>`;
  }).join('');
  requestAnimationFrame(syncHourlyNavigation);
}

function renderDaily(d, todayKey) {
  const days = d.daily.time.map((_, i) => dailyAt(d, i)).filter(Boolean);
  const weekMin = Math.min(...days.map((x) => x.min));
  const weekMax = Math.max(...days.map((x) => x.max));
  const span = Math.max(1, weekMax - weekMin);

  // Raden läses upp som en mening; de visuella kolumnerna döljs för skärmläsare.
  els.daily.innerHTML = days.map((day) => {
    const left = ((day.min - weekMin) / span) * 100;
    const width = ((day.max - day.min) / span) * 100;
    const wx = describe(day.code);
    const min = fmt.formatTemp(day.min);
    const max = fmt.formatTemp(day.max);
    const rain = precipLabel(day.precipProb);
    const summary = [
      `${fmt.formatDayLabel(day.time, todayKey, { long: true })}: ${wx.text}`,
      `lägst ${min}`,
      `högst ${max}`,
      rain && `${rain} risk för nederbörd`,
    ].filter(Boolean).join(', ');

    return `
      <li class="day">
        <span class="visually-hidden">${esc(summary)}</span>
        <span class="day__name" aria-hidden="true">${esc(fmt.formatDayLabel(day.time, todayKey))}<small>${esc(fmt.formatDayMonth(day.time))}</small></span>
        <span class="day__icon" aria-hidden="true" title="${esc(wx.text)}">${weatherIcon(iconKey(day.code, true), { size: 36 })}</span>
        <span class="day__prob ${rain ? '' : 'is-empty'}" aria-hidden="true">${rain}</span>
        <span class="day__min" aria-hidden="true">${min}</span>
        <span class="day__bar" aria-hidden="true">
          <span class="day__fill" style="left:${left.toFixed(1)}%;width:${Math.max(width, 6).toFixed(1)}%;background:${tempGradient(day.min, day.max, state.settings.unit)}"></span>
        </span>
        <span class="day__max" aria-hidden="true">${max}</span>
      </li>`;
  }).join('');
}

/** "62 %" om nederbördsrisken är värd att visa, annars ''. */
function precipLabel(prob) {
  return prob >= 10 ? `${Math.round(prob)} %` : '';
}

function dailyAt(d, i) {
  const dl = d.daily;
  if (!dl || dl.time[i] == null) return null;
  return {
    time: dl.time[i],
    code: dl.weather_code[i],
    max: dl.temperature_2m_max[i],
    min: dl.temperature_2m_min[i],
    sunrise: dl.sunrise[i],
    sunset: dl.sunset[i],
    precip: dl.precipitation_sum?.[i],
    precipProb: dl.precipitation_probability_max?.[i],
    uv: dl.uv_index_max?.[i],
  };
}

// ---------- byggstenar

function stat(label, value, note = '', extra = '', valueClass = '') {
  return `
    <div class="stat">
      <span class="stat__label">${esc(label)}</span>
      <span class="stat__value ${valueClass}">${extra}${esc(value)}</span>
      ${note ? `<span class="stat__note">${esc(note)}</span>` : ''}
    </div>`;
}

function windArrow(deg) {
  if (deg == null) return '';
  // Pilen pekar dit vinden blåser (meteorologisk riktning + 180°).
  return `<svg class="stat__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="transform:rotate(${(deg + 180) % 360}deg)">
    <path d="M12 3l5 9h-3.5v9h-3v-9H7z" fill="currentColor"/></svg>`;
}

function sunIcon() {
  return `<svg class="stat__glyph" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M4 17h16M7 13a5 5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 4v2M5 7.5l1.5 1.5M19 7.5l-1.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function humidityNote(rh) {
  if (rh == null) return '';
  if (rh < 30) return 'Torr luft';
  if (rh < 60) return 'Behaglig';
  if (rh < 80) return 'Fuktigt';
  return 'Mycket fuktigt';
}

function daylightNote(sunrise, sunset) {
  const duration = fmt.formatDuration(sunrise, sunset);
  return duration ? `${duration} dagsljus` : '';
}

/**
 * Temperaturfärg: divergerande skala kallt (blått) → neutralt → varmt (orange/rött).
 * Stoppen anges i °C och räknas om om Fahrenheit är valt.
 */
const TEMP_STOPS = [
  [-20, [58, 96, 224]],
  [0, [92, 160, 240]],
  [10, [205, 212, 222]],
  [20, [244, 168, 74]],
  [32, [226, 72, 48]],
];

function tempColor(t, unit) {
  const c = unit === 'fahrenheit' ? ((t - 32) * 5) / 9 : t;
  if (c <= TEMP_STOPS[0][0]) return rgb(TEMP_STOPS[0][1]);
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    if (c <= t1) {
      const [t0, c0] = TEMP_STOPS[i - 1];
      const k = (c - t0) / (t1 - t0);
      return rgb(c0.map((v, j) => v + (c1[j] - v) * k));
    }
  }
  return rgb(TEMP_STOPS[TEMP_STOPS.length - 1][1]);
}

function tempGradient(min, max, unit) {
  return `linear-gradient(90deg, ${tempColor(min, unit)}, ${tempColor(max, unit)})`;
}

function rgb([r, g, b]) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function flag(cc) {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================ Grok-temat

const GROK_LINES = {
  'clear-day': (name) => `Hög och klar himmel över ${name}.`,
  'clear-night': (name) => `Stjärnklar natt över ${name}.`,
  'partly-day': (name) => `Solglimtar mellan molnen över ${name}.`,
  'partly-night': (name) => `Månen syns mellan molnen över ${name}.`,
  'cloudy-day': (name) => `Ett jämnt molntäcke över ${name}.`,
  'cloudy-night': (name) => `Molnen sluter himlen över ${name}.`,
  'rain-day': (name) => `Regn över ${name}.`,
  'rain-night': (name) => `Regn i natten över ${name}.`,
  'snow-day': (name) => `Snöfall över ${name}.`,
  'snow-night': (name) => `Snö i natten över ${name}.`,
  'thunder-day': (name) => `Åska över ${name}.`,
  'thunder-night': (name) => `Åska i natten över ${name}.`,
  'fog-day': (name) => `Tät dimma över ${name}.`,
  'fog-night': (name) => `Dimma i natten över ${name}.`,
};

const WIND_WORD = {
  N: 'nordlig', NO: 'nordostlig', O: 'ostlig', SO: 'sydostlig',
  S: 'sydlig', SV: 'sydvästlig', V: 'västlig', NV: 'nordvästlig',
};

function clearGrok() {
  const line = $('grok-line');
  const aside = $('grok-aside');
  const dial = $('grok-dial');
  const spark = $('grok-spark');
  if (line) line.textContent = '';
  if (aside) aside.textContent = '';
  if (dial) dial.hidden = true;
  if (spark) spark.replaceChildren();
}

function renderGrok(hours) {
  const d = state.data;
  const cur = d?.current;
  const line = $('grok-line');
  const aside = $('grok-aside');
  if (!line || !aside || !cur || !state.place) return;

  const key = els.body.dataset.weather;
  const say = GROK_LINES[key] ?? ((name) => `${describe(cur.weather_code).text} över ${name}.`);
  line.textContent = say(state.place.name);

  const bits = [];
  if (cur.apparent_temperature != null && cur.temperature_2m != null
      && Math.abs(Math.round(cur.apparent_temperature) - Math.round(cur.temperature_2m)) >= 2) {
    bits.push(`Känns som ${fmt.formatTemp(cur.apparent_temperature)}`);
  }
  if (cur.wind_speed_10m != null) {
    const label = fmt.windLabel(cur.wind_speed_10m);
    const dir = WIND_WORD[fmt.compass(cur.wind_direction_10m)];
    const speed = `${Math.round(cur.wind_speed_10m)} m/s`;
    if (label === 'Lugnt') bits.push('Luften är stilla');
    else if (label === 'Storm' || label === 'Orkan') bits.push(dir ? `${label}, ${dir} ${speed}` : `${label}, ${speed}`);
    else bits.push(dir ? `${label.replace(/ vind$/, '')} ${dir} vind, ${speed}` : `${label}, ${speed}`);
  }
  aside.textContent = bits.length ? `${bits.join('. ')}.` : '';

  renderGrokSpark(hours);
  renderGrokDial(d);
}

/** Temperaturkurva över samma timmar som timprognosen visar. */
function renderGrokSpark(hours) {
  const el = $('grok-spark');
  if (!el) return;
  const temps = hours.map((hour) => hour.temp);
  const known = temps.filter((t) => t != null && !Number.isNaN(t));
  if (known.length < 2) { el.replaceChildren(); return; }

  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = Math.max(0.5, max - min);
  const w = 1000;
  const ht = 100;
  const padY = 12;
  const left = 10;
  const right = 48;
  const pts = [];
  temps.forEach((t, i) => {
    if (t == null || Number.isNaN(t)) return;
    const x = left + (i / (temps.length - 1)) * (w - left - right);
    const y = padY + (1 - (t - min) / span) * (ht - padY * 2);
    pts.push([x, y]);
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fill = `${line} L${pts.at(-1)[0].toFixed(1)} ${ht} L${pts[0][0].toFixed(1)} ${ht} Z`;
  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none">
      <path class="grok-spark__fill" d="${fill}"/>
      <path class="grok-spark__line" d="${line}"/>
    </svg>
    <i class="grok-spark__now" style="left:${(pts[0][0] / w * 100).toFixed(2)}%;top:${(pts[0][1] / ht * 100).toFixed(2)}%"></i>
    <span class="grok-spark__hi">${fmt.formatTemp(max)}</span>
    <span class="grok-spark__lo">${fmt.formatTemp(min)}</span>`;
}

function renderGrokDial(d) {
  const dial = $('grok-dial');
  const today = dailyAt(d, 0);
  if (!dial || !today?.sunrise || !today?.sunset) {
    if (dial) dial.hidden = true;
    return;
  }
  const now = new Date(d.current.time).getTime();
  const rise = new Date(today.sunrise).getTime();
  const set = new Date(today.sunset).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(rise) || set <= rise) {
    dial.hidden = true;
    return;
  }

  const t = (now - rise) / (set - rise);
  const shown = Math.min(1, Math.max(0, t));
  const point = arcPoint(shown);
  const dot = $('grok-sun-dot');
  const progress = $('grok-dial-progress');
  if (dot) {
    dot.setAttribute('cx', point.x.toFixed(1));
    dot.setAttribute('cy', point.y.toFixed(1));
  }
  if (progress) progress.setAttribute('stroke-dasharray', `${(shown * 100).toFixed(1)} 100`);

  const up = $('grok-rise');
  const down = $('grok-set');
  const note = $('grok-dial-note');
  if (up) up.textContent = `Upp ${fmt.formatTime(today.sunrise)}`;
  if (down) down.textContent = `Ner ${fmt.formatTime(today.sunset)}`;
  if (note) {
    if (t < 0) note.textContent = 'Före soluppgång';
    else if (t > 1) note.textContent = 'Efter solnedgång';
    else note.textContent = daylightNote(today.sunrise, today.sunset);
  }
  dial.classList.toggle('is-down', t < 0 || t > 1);
  dial.hidden = false;
}

/** Punkt på solbågen. t = 0 vid uppgång, 1 vid nedgång. */
function arcPoint(t) {
  const u = Math.min(1, Math.max(0, t));
  const o = 1 - u;
  return {
    x: o * o * 18 + 2 * o * u * 160 + u * u * 302,
    y: o * o * 70 + 2 * o * u * 8 + u * u * 70,
  };
}

// ============================================================ toast

function showToast(text, { action = null, duration = 4000 } = {}) {
  // Även den fördröjda döljningen måste avbrytas, annars släcker en gammal toast den nya.
  clearTimeout(state.toastTimer);
  clearTimeout(state.toastHideTimer);

  els.toastText.textContent = text;
  els.toastAction.hidden = !action;
  els.toastAction.textContent = action?.label ?? '';
  els.toastAction.onclick = action ? () => { hideToast(); action.onClick(); } : null;

  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('is-visible'));
  state.toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(state.toastTimer);
  els.toast.classList.remove('is-visible');
  state.toastHideTimer = setTimeout(() => { els.toast.hidden = true; }, TOAST_FADE_MS);
}

// ============================================================ service worker

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const register = () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker kunde inte registreras', err));
  };
  // Vänta tills sidan laddat klart så att registreringen inte konkurrerar med första visningen.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

init();
