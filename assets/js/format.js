// Formatering på svenska. Open-Meteo skickar tider som "2026-09-28T14:00"
// i ortens lokala tid utan tidszon. new Date() tolkar det som webbläsarens
// lokala tid – och eftersom vi bara formaterar (aldrig räknar om) visas
// rätt klockslag för orten oavsett var användaren befinner sig.

const LOCALE = 'sv-SE';
const MINUS = '−'; // riktigt minustecken – bindestreck ser fel ut framför siffror

const fmtWeekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const fmtWeekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const fmtDateLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

function parseLocal(iso) {
  return new Date(iso);
}

/** "2026-09-28" ur en ISO-tid. */
export function dateKey(iso) {
  return iso.slice(0, 10);
}

function localDateKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(key, days) {
  const d = new Date(`${key}T12:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatLongDate(iso) {
  return capitalize(fmtDateLong.format(parseLocal(iso)));
}

export function formatDayMonth(iso) {
  return fmtDayMonth.format(parseLocal(iso)).replace('.', '');
}

export function formatTime(iso) {
  return fmtTime.format(parseLocal(iso));
}

/** Klockslag för en tidpunkt (ms). Datumet tas med om det inte är idag. */
export function formatTimestamp(ms) {
  const d = new Date(ms);
  const time = fmtTime.format(d);
  return localDateKey(d) === localDateKey(new Date()) ? time : `${fmtDayMonth.format(d).replace('.', '')} ${time}`;
}

/** "Idag", "Imorgon" eller veckodag. */
export function formatDayLabel(iso, todayKey, { long = false } = {}) {
  const key = dateKey(iso);
  if (key === todayKey) return 'Idag';
  if (key === addDays(todayKey, 1)) return 'Imorgon';
  const f = long ? fmtWeekdayLong : fmtWeekdayShort;
  return capitalize(f.format(parseLocal(iso)).replace('.', ''));
}

/** "7 h 39 min" mellan två ISO-tider, eller '' om det inte går att räkna ut. */
export function formatDuration(fromIso, toIso) {
  const minutes = Math.round((parseLocal(toIso) - parseLocal(fromIso)) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Avrundat heltal med riktigt minustecken. Saknas värdet blir det ett tankstreck. */
export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '–';
  const n = Math.round(value);
  return n < 0 ? `${MINUS}${-n}` : String(Math.abs(n)); // Math.abs: "-0" ska bli "0"
}

export function formatTemp(value) {
  const n = formatNumber(value);
  return n === '–' ? n : `${n}°`;
}

export function unitSymbol(unit) {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

export function formatWind(ms) {
  if (ms == null) return '–';
  return `${Math.round(ms)} m/s`;
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];

export function compass(deg) {
  if (deg == null) return '';
  return COMPASS[Math.round(deg / 45) % 8];
}

export function formatPercent(v) {
  if (v == null) return '–';
  return `${Math.round(v)} %`;
}

export function formatMm(v) {
  if (v == null) return '–';
  if (v === 0) return '0 mm';
  return `${v < 1 ? v.toFixed(1).replace('.', ',') : Math.round(v)} mm`;
}

export function uvLabel(uv) {
  if (uv == null) return '–';
  if (uv < 3) return 'Låg';
  if (uv < 6) return 'Måttlig';
  if (uv < 8) return 'Hög';
  if (uv < 11) return 'Mycket hög';
  return 'Extrem';
}

/** Vindstyrka i ord enligt SMHI:s skala (m/s). */
export function windLabel(ms) {
  if (ms == null) return '';
  if (ms < 0.3) return 'Lugnt';
  if (ms < 3.4) return 'Svag vind';
  if (ms < 8) return 'Måttlig vind';
  if (ms < 14) return 'Frisk vind';
  if (ms < 21) return 'Hård vind';
  if (ms < 25) return 'Storm';
  return 'Orkan';
}

/** Hur mycket varmare/kallare det känns. */
export function feelsLikeNote(actual, apparent) {
  if (actual == null || apparent == null) return '';
  const diff = Math.round(apparent) - Math.round(actual);
  if (Math.abs(diff) < 2) return 'Ungefär som det är';
  return diff < 0 ? 'Vinden gör det kallare' : 'Fukten gör det varmare';
}
