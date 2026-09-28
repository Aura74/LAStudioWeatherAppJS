// WMO-väderkoder (som Open-Meteo använder) → svensk beskrivning, ikon och tema.
// Tabell: https://open-meteo.com/en/docs#weathervariables

const CODES = {
  0:  { text: 'Klart',                     icon: 'clear',      theme: 'clear' },
  1:  { text: 'Mestadels klart',           icon: 'clear',      theme: 'clear' },
  2:  { text: 'Halvklart',                 icon: 'partly',     theme: 'partly' },
  3:  { text: 'Mulet',                     icon: 'cloudy',     theme: 'cloudy' },
  45: { text: 'Dimma',                     icon: 'fog',        theme: 'fog' },
  48: { text: 'Dimma med rimfrost',        icon: 'fog',        theme: 'fog' },
  51: { text: 'Lätt duggregn',             icon: 'drizzle',    theme: 'rain' },
  53: { text: 'Duggregn',                  icon: 'drizzle',    theme: 'rain' },
  55: { text: 'Tätt duggregn',             icon: 'drizzle',    theme: 'rain' },
  56: { text: 'Underkylt duggregn',        icon: 'sleet',      theme: 'rain' },
  57: { text: 'Underkylt duggregn',        icon: 'sleet',      theme: 'rain' },
  61: { text: 'Lätt regn',                 icon: 'rain',       theme: 'rain' },
  63: { text: 'Regn',                      icon: 'rain',       theme: 'rain' },
  65: { text: 'Kraftigt regn',             icon: 'heavy-rain', theme: 'rain' },
  66: { text: 'Underkylt regn',            icon: 'sleet',      theme: 'rain' },
  67: { text: 'Kraftigt underkylt regn',   icon: 'sleet',      theme: 'rain' },
  71: { text: 'Lätt snöfall',              icon: 'snow',       theme: 'snow' },
  73: { text: 'Snöfall',                   icon: 'snow',       theme: 'snow' },
  75: { text: 'Kraftigt snöfall',          icon: 'snow',       theme: 'snow' },
  77: { text: 'Snökorn',                   icon: 'snow',       theme: 'snow' },
  80: { text: 'Lätta regnskurar',          icon: 'rain',       theme: 'rain' },
  81: { text: 'Regnskurar',                icon: 'rain',       theme: 'rain' },
  82: { text: 'Kraftiga regnskurar',       icon: 'heavy-rain', theme: 'rain' },
  85: { text: 'Lätta snöbyar',             icon: 'snow',       theme: 'snow' },
  86: { text: 'Kraftiga snöbyar',          icon: 'snow',       theme: 'snow' },
  95: { text: 'Åska',                      icon: 'thunder',    theme: 'thunder' },
  96: { text: 'Åska med hagel',            icon: 'thunder',    theme: 'thunder' },
  99: { text: 'Kraftig åska med hagel',    icon: 'thunder',    theme: 'thunder' },
};

const FALLBACK = { text: 'Okänt väder', icon: 'cloudy', theme: 'cloudy' };

/** Beskrivning av en WMO-kod. */
export function describe(code) {
  return CODES[code] ?? FALLBACK;
}

/**
 * Ikonnyckel med dag/natt-variant där det är relevant
 * (klart och halvklart ser olika ut på natten).
 */
export function iconKey(code, isDay = true) {
  const { icon } = describe(code);
  if (icon === 'clear' || icon === 'partly') {
    return `${icon}-${isDay ? 'day' : 'night'}`;
  }
  return icon;
}

/** Temanyckel som styr bakgrundsgradienten, t.ex. "rain-night". */
export function themeKey(code, isDay = true) {
  const { theme } = describe(code);
  return `${theme}-${isDay ? 'day' : 'night'}`;
}
