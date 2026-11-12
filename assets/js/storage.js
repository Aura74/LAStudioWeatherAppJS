// Persistens i localStorage: favoriter, senast visade ort och inställningar.
// Allt som läses valideras – trasig eller gammal data ska aldrig kunna krascha appen,
// och privat läge eller blockerad lagring ska bara betyda att inget sparas.

const KEYS = {
  favorites: 'vader.favorites.v2',
  lastPlace: 'vader.lastPlace.v2',
  settings: 'vader.settings.v2',
  legacyFavorites: 'lagratNamnOrt', // från den gamla appen – migreras vid första start
};

const MAX_FAVORITES = 12;
const UNITS = ['celsius', 'fahrenheit'];
const THEMES = ['auto', 'light', 'dark'];
const DEFAULT_SETTINGS = { unit: 'celsius', theme: 'auto' };

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

const text = (value) => (typeof value === 'string' ? value : '');

/** Plockar ut fälten vi sparar för en ort. Returnerar null om objektet inte går att använda. */
function toPlace(p) {
  if (!p || typeof p !== 'object') return null;
  const { lat, lon } = p;
  if (!text(p.name).trim()) return null;
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  return {
    id: String(p.id ?? `${lat},${lon}`),
    name: p.name,
    admin1: text(p.admin1),
    country: text(p.country),
    countryCode: text(p.countryCode),
    lat,
    lon,
  };
}

// ---------- favoriter ----------

export function getFavorites() {
  const list = read(KEYS.favorites, []);
  return Array.isArray(list) ? list.map(toPlace).filter(Boolean) : [];
}

/** Ersätter hela listan – används bland annat för att ångra en borttagning. */
export function setFavorites(list) {
  write(KEYS.favorites, list.map(toPlace).filter(Boolean).slice(0, MAX_FAVORITES));
}

export function isFavorite(place) {
  return getFavorites().some((f) => f.id === place.id);
}

/** Lägg till eller ta bort. Returnerar true om orten nu är favorit. */
export function toggleFavorite(place) {
  const list = getFavorites();
  if (list.some((f) => f.id === place.id)) {
    setFavorites(list.filter((f) => f.id !== place.id));
    return false;
  }
  const entry = toPlace(place);
  if (!entry) return false;
  setFavorites([entry, ...list]);
  return true;
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
  return toPlace(read(KEYS.lastPlace, null));
}

export function setLastPlace(place) {
  const entry = toPlace(place);
  if (entry) write(KEYS.lastPlace, entry);
}

// ---------- inställningar ----------

export function getSettings() {
  const saved = read(KEYS.settings, null);
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    unit: UNITS.includes(s.unit) ? s.unit : DEFAULT_SETTINGS.unit,
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
  };
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}
