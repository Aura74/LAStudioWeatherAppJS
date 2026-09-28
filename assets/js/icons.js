// Inline-SVG-väderikoner. Alla ritas i en 64×64-box och delar gradienterna
// som ligger i <svg id="wx-defs"> i index.html. Animationerna ligger i CSS
// (.wx-rays, .wx-drop, .wx-flake, .wx-bolt, .wx-fog, .wx-cloud-drift).

// ---------- primitiver ----------

function sun(cx, cy, r) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 4);
    const y1 = cy + Math.sin(a) * (r + 4);
    const x2 = cx + Math.cos(a) * (r + 9);
    const y2 = cy + Math.sin(a) * (r + 9);
    rays.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
  }
  return `
    <g class="wx-rays" style="transform-origin:${cx}px ${cy}px" stroke="url(#wx-sun)" stroke-width="3" stroke-linecap="round">
      ${rays.join('')}
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wx-sun)"/>`;
}

function moon(cx, cy, r) {
  const r2 = r * 1.18;
  return `<path class="wx-moon" fill="url(#wx-moon)"
    d="M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r2},${r2} 0 0 0 ${cx},${cy - r} Z"/>`;
}

/** Moln uppbyggt av rektangel + tre "puffar" som smälter ihop via gemensam gradient. */
function cloud({ x = 0, y = 0, s = 1, fill = 'url(#wx-cloud)', cls = 'wx-cloud' } = {}) {
  return `
    <g class="${cls}" transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
      <rect x="14" y="34" width="40" height="12" rx="7"/>
      <circle cx="26" cy="32" r="10"/>
      <circle cx="38" cy="28" r="13"/>
      <circle cx="46" cy="36" r="9"/>
    </g>`;
}

function drops(n, { y = 48, len = 6, spread = 22, x0 = 24, light = false } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (spread / Math.max(1, n - 1)) * i;
    const delay = ((i * 0.35) % 1.2).toFixed(2);
    out.push(`<line class="wx-drop" style="animation-delay:${delay}s"
      x1="${x}" y1="${y}" x2="${x - 1.5}" y2="${y + len}"
      stroke="url(#wx-drop)" stroke-width="${light ? 2 : 2.6}" stroke-linecap="round"/>`);
  }
  return out.join('');
}

function flakes(n, { y = 50, spread = 22, x0 = 24 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (spread / Math.max(1, n - 1)) * i;
    const delay = ((i * 0.5) % 1.6).toFixed(2);
    out.push(`<circle class="wx-flake" style="animation-delay:${delay}s" cx="${x}" cy="${y + (i % 2) * 4}" r="2.2" fill="#fff"/>`);
  }
  return out.join('');
}

function bolt() {
  return `<path class="wx-bolt" fill="url(#wx-bolt)" d="M35 44 L27 56 H33 L30 64 L41 50 H35 L39 44 Z"/>`;
}

function fog() {
  return `
    <g class="wx-fog" stroke="url(#wx-fogline)" stroke-width="3" stroke-linecap="round" fill="none">
      <line x1="14" y1="40" x2="50" y2="40"/>
      <line x1="20" y1="47" x2="56" y2="47" style="animation-delay:.6s"/>
      <line x1="12" y1="54" x2="44" y2="54" style="animation-delay:1.2s"/>
    </g>`;
}

// ---------- ikoner ----------

const ICONS = {
  'clear-day': () => sun(32, 32, 12),
  'clear-night': () => moon(34, 32, 13),
  'partly-cloudy-day': () => sun(24, 24, 9) + cloud({ x: 6, y: 6, s: 0.95 }),
  'partly-cloudy-night': () => moon(26, 22, 9) + cloud({ x: 6, y: 6, s: 0.95 }),
  cloudy: () => cloud({ x: 10, y: -4, s: 0.7, fill: 'url(#wx-cloud-dark)', cls: 'wx-cloud wx-cloud-back' }) + cloud({ x: -2, y: 4 }),
  fog: () => cloud({ x: -2, y: -8, s: 0.9, fill: 'url(#wx-cloud-dark)' }) + fog(),
  drizzle: () => cloud({ x: -2, y: -6 }) + drops(4, { y: 48, len: 4, light: true, x0: 22, spread: 22 }),
  rain: () => cloud({ x: -2, y: -8, fill: 'url(#wx-cloud-dark)' }) + drops(4, { y: 46, len: 8, x0: 21, spread: 24 }),
  'heavy-rain': () => cloud({ x: -2, y: -10, fill: 'url(#wx-cloud-dark)' }) + drops(6, { y: 44, len: 10, x0: 18, spread: 30 }),
  sleet: () => cloud({ x: -2, y: -8, fill: 'url(#wx-cloud-dark)' }) + drops(2, { y: 46, len: 8, x0: 22, spread: 20 }) + flakes(2, { y: 50, x0: 32, spread: 10 }),
  snow: () => cloud({ x: -2, y: -8 }) + flakes(4, { y: 48, x0: 20, spread: 26 }),
  thunder: () => cloud({ x: -2, y: -10, fill: 'url(#wx-cloud-dark)' }) + bolt() + drops(2, { y: 44, len: 7, x0: 18, spread: 30 }),
};

/**
 * Returnerar SVG-markup för en ikonnyckel (från weather-codes.iconKey).
 * @param {string} key
 * @param {{size?: number, className?: string, label?: string}} opts
 */
export function weatherIcon(key, { size = 64, className = '', label = '' } = {}) {
  const draw = ICONS[key] ?? ICONS.cloudy;
  const a11y = label
    ? `role="img" aria-label="${escapeAttr(label)}"`
    : 'aria-hidden="true"';
  return `<svg class="wx wx-${key} ${className}" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y} focusable="false">${draw()}</svg>`;
}

/** Delade gradienter – renderas en gång i index.html via <svg id="wx-defs">. */
export const ICON_DEFS = `
  <defs>
    <radialGradient id="wx-sun" gradientUnits="userSpaceOnUse" cx="30" cy="28" r="22">
      <stop offset="0" stop-color="#fff3b0"/>
      <stop offset=".55" stop-color="#ffd166"/>
      <stop offset="1" stop-color="#ff9f1c"/>
    </radialGradient>
    <linearGradient id="wx-moon" gradientUnits="userSpaceOnUse" x1="20" y1="18" x2="46" y2="46">
      <stop offset="0" stop-color="#fffbe8"/>
      <stop offset="1" stop-color="#c9d1e0"/>
    </linearGradient>
    <linearGradient id="wx-cloud" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="48">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cfd8e6"/>
    </linearGradient>
    <linearGradient id="wx-cloud-dark" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="48">
      <stop offset="0" stop-color="#d4dce8"/>
      <stop offset="1" stop-color="#8d9bb0"/>
    </linearGradient>
    <linearGradient id="wx-drop" gradientUnits="userSpaceOnUse" x1="0" y1="44" x2="0" y2="58">
      <stop offset="0" stop-color="#9fd4ff"/>
      <stop offset="1" stop-color="#3d8ff2"/>
    </linearGradient>
    <linearGradient id="wx-bolt" gradientUnits="userSpaceOnUse" x1="0" y1="44" x2="0" y2="64">
      <stop offset="0" stop-color="#fff2a8"/>
      <stop offset="1" stop-color="#ffb703"/>
    </linearGradient>
    <linearGradient id="wx-fogline" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="56" y2="0">
      <stop offset="0" stop-color="#e6ecf5" stop-opacity=".2"/>
      <stop offset=".5" stop-color="#e6ecf5"/>
      <stop offset="1" stop-color="#e6ecf5" stop-opacity=".2"/>
    </linearGradient>
  </defs>`;

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
