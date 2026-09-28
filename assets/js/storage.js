// Persistens i localStorage: favoriter, senast visade ort och inställningar.
// Alla anrop är skyddade – privat läge eller blockerad lagring ska inte krascha appen.

const KEYS = {
  favorites: 'vader.favorites.v2',
  lastPlace: 'vader.lastPlace.v2',
  settings: 'vader.settings.v2',
  legacyFavorites: 'lagratNamnOrt', // från den gamla appen – migreras vid första start
};

const MAX_FAVORITES = 12;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- favoriter ----------

export function getFavorites() {
  const list = read(KEYS.favorites, null);
  if (Array.isArray(list)) return list;
  return [];
}

export function isFavorite(place) {
  return getFavorites().some((f) => f.id === place.id);
}

/** Lägg till eller ta bort. Returnerar true om orten nu är favorit. */
export function toggleFavorite(place) {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === place.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(KEYS.favorites, list);
    return false;
  }
  const { id, name, admin1, country, countryCode, lat, lon } = place;
  list.unshift({ id, name, admin1, country, countryCode, lat, lon });
  write(KEYS.favorites, list.slice(0, MAX_FAVORITES));
  return true;
}

export function removeFavorite(id) {
  write(KEYS.favorites, getFavorites().filter((f) => f.id !== id));
}

export function clearFavorites() {
  write(KEYS.favorites, []);
}

/**
 * Den gamla appen sparade favoriter som en lista med ortnamn.
 * Returnerar namnen (och rensar nyckeln) så att appen kan geokoda dem en gång.
 */
export function takeLegacyFavoriteNames() {
  const names = read(KEYS.legacyFavorites, null);
  if (!Array.isArray(names) || names.length === 0) return [];
  try { localStorage.removeItem(KEYS.legacyFavorites); } catch { /* ignorera */ }
  return names.filter((n) => typeof n === 'string' && n.trim());
}

// ---------- senaste ort ----------

export function getLastPlace() {
  const p = read(KEYS.lastPlace, null);
  return p && typeof p.lat === 'number' && typeof p.lon === 'number' ? p : null;
}

export function setLastPlace(place) {
  const { id, name, admin1, country, countryCode, lat, lon } = place;
  write(KEYS.lastPlace, { id, name, admin1, country, countryCode, lat, lon });
}

// ---------- inställningar ----------

const DEFAULT_SETTINGS = { unit: 'celsius', theme: 'auto' };

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}
