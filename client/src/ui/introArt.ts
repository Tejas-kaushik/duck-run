// Flat SVG art for the story intro (Vansh). Every scene is 400x225 and built from simple shapes,
// in the same palette as the 3D Bill (render/character.ts) and the Don (phases/boss/pigeonView.ts).
// Groups with an `a-` class are animated by the shot timeline in intro.ts; other classes are CSS loops.

export const C = {
  feathers: '#fdfaf2',
  beak: '#f39c32',
  coat: '#7a5c3e',
  lapel: '#6a4e33',
  tie: '#c0392b',
  cap: '#4b4f58',
  capBrim: '#3c4048',
  shades: '#1f1f1f',
  pigeon: '#8f95a3',
  neck: '#5f8f78',
  felt: '#2b2d33',
  gold: '#ffc83d',
  dog: '#9a6233',
  dogDark: '#6e4322',
  cash: '#7fb77e',
};

export type BillMood = 'cool' | 'scared' | 'dollar' | 'ko';

/** Bill, facing right, standing on (0, 0). About 150 tall at scale 1. */
export function bill(x: number, y: number, scale = 1, mood: BillMood = 'cool'): string {
  const eyes =
    mood === 'cool'
      ? `<rect x="2" y="-112" width="30" height="11" rx="5" fill="${C.shades}"/><rect x="6" y="-110" width="8" height="3" rx="1.5" fill="#fff" opacity=".5"/>`
      : mood === 'ko'
        ? `<path d="M4 -112 l10 10 m0 -10 l-10 10 M20 -112 l10 10 m0 -10 l-10 10" stroke="#222" stroke-width="3" stroke-linecap="round"/>`
        : mood === 'dollar'
        ? `<text x="4" y="-100" font-size="18" font-weight="900" fill="#2e9d4f" font-family="Arial">$</text><text x="20" y="-100" font-size="18" font-weight="900" fill="#2e9d4f" font-family="Arial">$</text>`
        : `<circle cx="10" cy="-106" r="6" fill="#fff" stroke="#222" stroke-width="1.5"/><circle cx="26" cy="-106" r="6" fill="#fff" stroke="#222" stroke-width="1.5"/><circle cx="12" cy="-105" r="2.5" fill="#222"/><circle cx="28" cy="-105" r="2.5" fill="#222"/>
         <path class="sweat" d="M-14 -118 q-5 8 0 11 q5 -3 0 -11z" fill="#7fd3ff"/>`;
  const tongue = mood === 'dollar' ? `<path d="M40 -90 q8 14 -2 18 q-6 -6 2 -18z" fill="#ff7aa8"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-16" y="-14" width="8" height="14" fill="${C.beak}"/><rect x="6" y="-14" width="8" height="14" fill="${C.beak}"/>
    <ellipse cx="-12" cy="0" rx="12" ry="4" fill="${C.beak}"/><ellipse cx="12" cy="0" rx="12" ry="4" fill="${C.beak}"/>
    <ellipse cx="0" cy="-46" rx="36" ry="40" fill="${C.feathers}"/>
    <path d="M-36 -52 Q-38 -12 -18 -10 L18 -10 Q38 -12 36 -52 Q28 -78 0 -78 Q-28 -78 -36 -52Z" fill="${C.coat}"/>
    <path d="M-12 -76 L0 -40 L12 -76Z" fill="#fff"/>
    <path d="M-4 -72 L4 -72 L6 -46 L0 -38 L-6 -46Z" fill="${C.tie}"/>
    <path d="M-12 -76 L-4 -50 L-16 -60Z M12 -76 L4 -50 L16 -60Z" fill="${C.lapel}"/>
    <circle cx="-10" cy="-28" r="2.5" fill="${C.gold}"/><circle cx="10" cy="-28" r="2.5" fill="${C.gold}"/>
    <path d="M-33 -68 Q-46 -44 -35 -22 Q-27 -34 -28 -62Z" fill="${C.lapel}"/>
    <circle cx="0" cy="-104" r="30" fill="${C.feathers}"/>
    <path d="M18 -98 Q50 -102 52 -92 Q50 -84 18 -86Z" fill="${C.beak}"/>
    <line x1="44" y1="-90" x2="62" y2="-84" stroke="#d9b77a" stroke-width="2.5" stroke-linecap="round"/>
    ${tongue}
    ${eyes}
    <path d="M-30 -116 Q0 -150 30 -116Z" fill="${C.cap}"/>
    <rect x="8" y="-121" width="34" height="7" rx="3.5" fill="${C.capBrim}"/>
  </g>`;
}

/** The Don, a mafia pigeon, facing left, standing on (0, 0). Knocked out: X eyes, and his hat is
 * its own `a-hat` group so it can fly off. */
export function don(x: number, y: number, scale = 1, angry = false, ko = false): string {
  const eye = ko
    ? `<path d="M-18 -116 l10 10 m0 -10 l-10 10" stroke="#222" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="-12" cy="-110" r="6" fill="#fff"/><circle cx="-14" cy="-109" r="3" fill="#c23"/>`;
  const cigar = ko
    ? ''
    : `<rect x="-62" y="-97" width="22" height="6" rx="2" fill="#7a4a24"/>
    <circle cx="-62" cy="-94" r="3.5" fill="#ff7a2f" class="ember"/>
    <circle class="smoke s1" cx="-64" cy="-104" r="5" fill="#ccc" opacity=".6"/>
    <circle class="smoke s2" cx="-60" cy="-112" r="7" fill="#ccc" opacity=".45"/>`;
  const hat = `<rect x="-24" y="-140" width="48" height="22" rx="4" fill="${C.felt}"/>
    <rect x="-24" y="-124" width="48" height="5" fill="#b3202a"/>
    <ellipse cx="0" cy="-118" rx="40" ry="7" fill="${C.felt}"/>`;
  const brow = ko ? '' : angry
    ? `<path d="M-22 -120 L-4 -112" stroke="#222" stroke-width="4" stroke-linecap="round"/>`
    : `<path d="M-22 -116 L-4 -116" stroke="#222" stroke-width="3" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <defs><pattern id="pin" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f2f2f2"/><rect width="1" height="6" fill="#c9ccd3"/></pattern></defs>
    <rect x="-14" y="-14" width="7" height="14" fill="#c46a6a"/><rect x="6" y="-14" width="7" height="14" fill="#c46a6a"/>
    <ellipse cx="0" cy="-50" rx="40" ry="44" fill="${C.pigeon}"/>
    <path d="M-40 -56 Q-40 -12 -20 -10 L20 -10 Q40 -12 40 -56 Q30 -84 0 -84 Q-30 -84 -40 -56Z" fill="url(#pin)"/>
    <path d="M-10 -82 L0 -48 L10 -82Z" fill="#f4f1ea"/>
    <path d="M-4 -78 L4 -78 L6 -52 L0 -44 L-6 -52Z" fill="#b3202a"/>
    <path d="M-28 -40 Q0 -20 28 -40" stroke="${C.gold}" stroke-width="3" fill="none"/>
    <ellipse cx="0" cy="-86" rx="24" ry="10" fill="${C.neck}"/>
    <circle cx="0" cy="-108" r="27" fill="${C.pigeon}"/>
    <path d="M-20 -104 Q-50 -100 -48 -94 Q-40 -90 -20 -94Z" fill="#2e2e33"/>
    ${eye}
    ${brow}
    ${cigar}
    ${ko ? `<g class="a-hat">${hat}</g>` : hat}
  </g>`;
}

/** Biscuit, the Don's dog: a big angry head, facing left. */
export function dog(x: number, y: number, scale = 1): string {
  const spikes = [-30, -15, 0, 15, 30].map((sx) => `<path d="M${sx - 5} 34 L${sx} 22 L${sx + 5} 34Z" fill="#ddd"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="-34" cy="-38" rx="14" ry="30" fill="${C.dogDark}" transform="rotate(20 -34 -38)"/>
    <ellipse cx="34" cy="-38" rx="14" ry="30" fill="${C.dogDark}" transform="rotate(-20 34 -38)"/>
    <circle cx="0" cy="-10" r="44" fill="${C.dog}"/>
    <ellipse cx="-14" cy="12" rx="30" ry="20" fill="#e2b98a"/>
    <ellipse cx="-30" cy="2" rx="9" ry="7" fill="#1a1a1a"/>
    <path d="M-40 22 L-34 30 L-28 22 L-22 30 L-16 22 L-10 30 L-4 22Z" fill="#fff"/>
    <path d="M-34 -26 L-14 -18 M4 -18 L22 -26" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="-22" cy="-14" r="5" fill="#fff"/><circle cx="12" cy="-14" r="5" fill="#fff"/>
    <circle cx="-23" cy="-13" r="2.5" fill="#c23"/><circle cx="11" cy="-13" r="2.5" fill="#c23"/>
    <rect x="-40" y="30" width="80" height="10" rx="5" fill="#222"/>
    ${spikes}
  </g>`;
}

export function bread(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-20 0 Q-24 -22 0 -22 Q24 -22 20 0Z" fill="#d99a4e"/>
    <path d="M-16 -2 Q-18 -16 0 -16 Q18 -16 16 -2Z" fill="#f6dfb0"/>
  </g>`;
}

export const sky = (top: string, bottom: string, id: string) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
   <rect width="400" height="225" fill="url(#${id})"/>`;

export const svg = (body: string) => `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

/** Coin positions in the pond shot; intro.ts times each pickup to when Bill swims past. */
export const POND_COINS: [number, number][] = [
  [120, 182], [150, 190], [180, 174], [210, 186], [240, 178], [270, 190], [300, 182],
];

/**
 * One scene per shot. Groups with an `a-` class are moved by the shot timeline in intro.ts
 * (Web Animations, so they can be seeked for rooms); the plain classes are idle CSS loops.
 */
export const SCENES = {
  bill: svg(`${sky('#ffd7a1', '#ff9f68', 'g1')}
    <g class="a-sun"><circle cx="320" cy="60" r="34" fill="#fff3c4"/></g>
    <rect y="170" width="400" height="55" fill="#4fa3c7"/>
    <path d="M0 176 Q50 170 100 176 T200 176 T300 176 T400 176 T500 176" stroke="#bfe8ff" stroke-width="3" fill="none" class="ripple"/>
    <g class="a-bill">${bill(200, 180, 1)}</g>
    <g class="a-joke"><text x="24" y="40" font-size="14" fill="#7a3d12" font-family="Georgia" font-style="italic">*not a real banker*</text></g>`),

  iou: svg(`${sky('#2b2233', '#151018', 'g2')}
    <g class="a-iou"><g transform="rotate(-4 200 110)">
      <rect x="110" y="34" width="180" height="150" rx="6" fill="#f7efd9"/>
      <text x="200" y="68" text-anchor="middle" font-size="22" font-weight="700" fill="#3b2a1a" font-family="Georgia">I.O.U.</text>
      <text x="200" y="96" text-anchor="middle" font-size="13" fill="#3b2a1a" font-family="Georgia">1,000 breadcrumbs</text>
      <text x="200" y="114" text-anchor="middle" font-size="10" fill="#6b5a44" font-family="Georgia">payable to: The Don</text>
      <path d="M140 150 q12 -14 22 0 t22 0 t20 -4" stroke="#1d3a8a" stroke-width="2" fill="none"/>
      <text x="230" y="154" font-size="9" fill="#6b5a44" font-family="Georgia">(Bill)</text>
    </g></g>
    <g class="a-stamp"><g transform="rotate(-18 280 160)">
      <rect x="226" y="140" width="110" height="38" rx="6" fill="none" stroke="#d1242f" stroke-width="4"/>
      <text x="281" y="167" text-anchor="middle" font-size="20" font-weight="900" fill="#d1242f" font-family="Arial">400%/WK</text>
    </g></g>`),

  don: svg(`${sky('#1b1b24', '#0d0d12', 'g3')}
    <g class="a-light"><path d="M175 0 L225 0 L330 225 L70 225Z" fill="#fff6c8" opacity=".09"/></g>
    <rect x="0" y="182" width="400" height="43" fill="#2a1f18"/>
    <g class="a-don">${don(200, 196, 1.15, false)}</g>
    ${bread(80, 190, 0.9)}${bread(110, 196, 0.8)}${bread(330, 192, 0.85)}`),

  dog: svg(`${sky('#3a0f12', '#140405', 'g4')}
    <g class="a-dog">${dog(200, 140, 1.5)}</g>
    <g class="a-don">${don(352, 220, 0.55, true)}</g>`),

  pond: svg(`${sky('#0b5f84', '#032338', 'g5')}
    <path d="M0 20 Q100 34 200 20 T400 20 L400 0 L0 0Z" fill="#6fd0f2" opacity=".5"/>
    <path d="M60 225 L90 120 L120 225Z" fill="#0e7a55" class="sway"/>
    <path d="M330 225 L350 110 L375 225Z" fill="#0e7a55" class="sway"/>
    ${POND_COINS.map(([cx, cy], i) => `<g class="a-coin a-coin-${i}"><circle cx="${cx}" cy="${cy}" r="10" fill="${C.gold}"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="900" fill="#b8860b" font-family="Arial">$</text></g>`).join('')}
    ${[40, 100, 300, 370].map((cx, i) => `<circle class="air" style="animation-delay:${i * 0.5}s" cx="${cx}" cy="200" r="${4 + (i % 2) * 3}" fill="none" stroke="#bfe8ff" stroke-width="1.5"/>`).join('')}
    <g class="a-splash">${[-1, 0, 1].map((d) => `<circle cx="${70 + d * 14}" cy="18" r="${8 - Math.abs(d) * 2}" fill="#fff" opacity=".8"/>`).join('')}</g>
    <g class="a-diver">${bill(70, 190, 0.5, 'cool')}</g>`),

  hook: svg(`${sky('#0b5f84', '#032338', 'g6')}
    <g class="a-hook">
      <line x1="250" y1="-60" x2="250" y2="110" stroke="#ddd" stroke-width="1.5"/>
      <path d="M250 110 q0 20 -12 20 q-12 0 -12 -12" stroke="#bbb" stroke-width="4" fill="none"/>
      <rect x="226" y="122" width="56" height="28" rx="3" fill="${C.cash}"/>
      <text x="254" y="142" text-anchor="middle" font-size="16" font-weight="900" fill="#1e5631" font-family="Arial">$1</text>
    </g>
    <g class="a-bill">${bill(120, 220, 0.9, 'dollar')}</g>`),

  run: svg(`${sky('#ffcf8a', '#ff7f50', 'g7')}
    <g class="a-scroll">
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${i * 100} 168 l18 -40 l18 40z" fill="#3e8e5a" opacity=".55"/><path d="M${i * 100 + 50} 168 l10 -26 l10 26z" fill="#2f6f45" opacity=".55"/>`).join('')}
    </g>
    <rect y="168" width="400" height="57" fill="#3f8fb5"/>
    <g class="a-scroll">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${i * 100} 190 q25 -6 50 0" stroke="#bfe8ff" stroke-width="3" fill="none"/>`).join('')}</g>
    ${[150, 200, 120, 180, 140].map((sx, i) => `<line class="speed" style="animation-delay:${i * 0.06}s" x1="${sx}" y1="${70 + i * 18}" x2="${sx - 50}" y2="${70 + i * 18}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`).join('')}
    <g class="a-runner">${bill(250, 178, 0.95, 'scared')}</g>
    <g class="a-chaser"><g transform="scale(-1 1)">${dog(-70, 150, 0.7)}</g></g>`),
};

export type SceneName = keyof typeof SCENES;
