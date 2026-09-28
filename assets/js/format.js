// Formatering på svenska. Open-Meteo skickar tider som "2026-09-28T14:00"
// i ortens lokala tid utan tidszon. new Date() tolkar det som webbläsarens
// lokala tid – och eftersom vi bara formaterar (aldrig räknar om) visas
// rätt klockslag för orten oavsett var användaren befinner sig.

const LOCALE = 'sv-SE';

const fmtWeekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const fmtWeekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const fmtDateLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

export function parseLocal(iso) {
  return new Date(iso);
}

export function dateKey(iso) {
  return iso.slice(0, 10);
}

export function capitalize(s) {
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

/** "Idag", "Imorgon" eller veckodag. */
export function formatDayLabel(iso, todayKey, { long = false } = {}) {
  const key = dateKey(iso);
  if (key === todayKey) return 'Idag';
  const tomorrow = new Date(`${todayKey}T12:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === tomorrow.toISOString().slice(0, 10) || key === localDateKey(tomorrow)) return 'Imorgon';
  const f = long ? fmtWeekdayLong : fmtWeekdayShort;
  return capitalize(f.format(parseLocal(iso)).replace('.', ''));
}

function localDateKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatTemp(value, unit = 'celsius') {
  if (value == null || Number.isNaN(value)) return '–';
  return `${Math.round(value)}°`;
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

export function formatPressure(hpa) {
  if (hpa == null) return '–';
  return `${Math.round(hpa)} hPa`;
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
