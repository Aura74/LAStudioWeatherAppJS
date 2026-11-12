// Datakällor – alla utan API-nyckel, HTTPS och CORS-öppna.
//   Väder:        https://open-meteo.com  (gratis, ingen nyckel)
//   Ortsök:       Open-Meteo Geocoding
//   Position→ort: Nominatim (OpenStreetMap), reserv BigDataCloud

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const REVERSE_FALLBACK_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const REQUEST_TIMEOUT_MS = 12000;
// Väntetid före varje nytt försök när ett fel ser tillfälligt ut (serverfel, tappad anslutning).
const RETRY_DELAYS_MS = [600, 1800];

/** Fel med ett meddelande som går att visa för användaren som det är. */
export class ApiError extends Error {
  /** @param {{cause?: unknown, status?: number, transient?: boolean}} [details] transient = värt att försöka igen direkt */
  constructor(message, { cause, status, transient = false } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.transient = transient;
  }
}

function httpError(status) {
  if (status === 429) return new ApiError('Tjänsten har fått för många anrop just nu. Försök igen om en stund.', { status });
  if (status >= 500) return new ApiError('Tjänsten svarar inte just nu. Försök igen om en stund.', { status, transient: true });
  return new ApiError(`Tjänsten avvisade förfrågan (felkod ${status}).`, { status });
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Hämtar JSON. Kastar alltid ApiError, oavsett vad som gick fel.
 * Med retry görs upp till två nya försök om felet ser tillfälligt ut.
 */
async function getJson(url, { signal, retry = false } = {}) {
  const delays = retry ? RETRY_DELAYS_MS : [];
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestJson(url, signal);
    } catch (err) {
      if (!err.transient || attempt >= delays.length) throw err;
      await sleep(delays[attempt]);
      if (signal?.aborted) throw new ApiError('Avbruten', { cause: err });
    }
  }
}

/** Ett enda anrop med tidsgräns. */
async function requestJson(url, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw httpError(res.status);
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError(signal?.aborted ? 'Avbruten' : 'Det tog för lång tid att få svar. Kontrollera anslutningen.', { cause: err });
    }
    if (err instanceof SyntaxError) throw new ApiError('Oväntat svar från tjänsten.', { cause: err });
    if (!navigator.onLine) throw new ApiError('Du verkar vara offline.', { cause: err });
    throw new ApiError('Kunde inte nå tjänsten. Kontrollera anslutningen.', { cause: err, transient: true });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Sök orter. Returnerar [{id, name, admin1, country, countryCode, lat, lon}]
 * Svenska träffar sorteras först, sedan efter befolkning.
 */
export async function searchPlaces(query, { signal, count = 8 } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=${count}&language=sv&format=json`;
  const data = await getJson(url, { signal });

  const results = (data.results ?? []).map(normalizePlace);
  return results.sort((a, b) => {
    const aSe = a.countryCode === 'SE' ? 1 : 0;
    const bSe = b.countryCode === 'SE' ? 1 : 0;
    if (aSe !== bSe) return bSe - aSe;
    return (b.population ?? 0) - (a.population ?? 0);
  });
}

function normalizePlace(r) {
  return {
    id: String(r.id ?? `${r.latitude},${r.longitude}`),
    name: r.name,
    admin1: r.admin1 ?? '',
    country: r.country ?? '',
    countryCode: r.country_code ?? '',
    lat: r.latitude,
    lon: r.longitude,
    population: r.population ?? 0,
  };
}

/**
 * Hämta prognos för en punkt. Tider kommer i ortens lokala tid (timezone=auto).
 * @param {{lat:number, lon:number}} place
 * @param {{unit?: 'celsius'|'fahrenheit', signal?: AbortSignal}} opts
 */
export async function fetchForecast({ lat, lon }, { unit = 'celsius', signal } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ApiError('Orten saknar giltiga koordinater.');
  }

  // Bara de fält som appen faktiskt visar.
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: unit,
    wind_speed_unit: 'ms',
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'is_day',
    ].join(','),
    hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'sunrise', 'sunset', 'precipitation_sum', 'precipitation_probability_max', 'uv_index_max',
    ].join(','),
  });

  const data = await getJson(`${FORECAST_URL}?${params}`, { signal, retry: true });
  if (!isForecast(data)) throw new ApiError('Oväntat svar från vädertjänsten.');
  return data;
}

/** Minsta form som resten av appen förutsätter. */
function isForecast(d) {
  return Boolean(d?.current?.time && Array.isArray(d.hourly?.time) && Array.isArray(d.daily?.time));
}

/**
 * Omvänd geokodning: koordinater → ortnamn.
 * Provar Nominatim först (bäst ortnamn), sedan BigDataCloud.
 * Returnerar alltid ett place-objekt, i värsta fall "Min position".
 */
export async function reverseGeocode(lat, lon, { signal } = {}) {
  const base = { id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`, lat, lon, countryCode: '', admin1: '', country: '' };

  try {
    const url = `${REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`;
    const d = await getJson(url, { signal });
    const a = d.address ?? {};
    const name = a.city || a.town || a.village || a.municipality || d.name;
    if (name) {
      return { ...base, name, admin1: a.county ?? '', country: a.country ?? '', countryCode: (a.country_code ?? '').toUpperCase() };
    }
  } catch { /* prova nästa */ }

  try {
    const url = `${REVERSE_FALLBACK_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=sv`;
    const d = await getJson(url, { signal });
    const name = (d.city || d.locality || '').replace(/\s+kommun$/i, '');
    if (name) {
      return { ...base, name, admin1: d.principalSubdivision ?? '', country: d.countryName ?? '', countryCode: d.countryCode ?? '' };
    }
  } catch { /* faller igenom */ }

  return { ...base, name: 'Min position' };
}

/** Webbläsarens geolocation som ett Promise. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ApiError('Din webbläsare stödjer inte platstjänster'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: 'Du nekade åtkomst till din position',
          2: 'Positionen kunde inte fastställas',
          3: 'Det tog för lång tid att hitta din position',
        };
        reject(new ApiError(messages[err.code] ?? 'Kunde inte hämta position', { cause: err }));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
