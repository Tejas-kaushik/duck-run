// Flat SVG art for the endings (Vansh): how Bill goes out (log, dog or boss) and the win.
// Same 400x225 frame and palette as the intro. Groups with an `a-` class are animated by endings.ts.

import { C, bill, don, dog, sky, svg } from './introArt';

const log = (x: number, y: number) => `<g transform="translate(${x} ${y})">
  <rect x="-70" y="-14" width="140" height="28" rx="14" fill="#7a4a24"/>
  <ellipse cx="70" cy="0" rx="9" ry="14" fill="#c48a52"/>
  <ellipse cx="70" cy="0" rx="4" ry="7" fill="none" stroke="#7a4a24" stroke-width="2"/>
  <path d="M-40 -14 l6 -10 l4 10" fill="#3e8e5a"/>
</g>`;

/** Little yellow stars that circle a knocked-out head. */
const stars = (cx: number, cy: number) =>
  `<g class="a-stars">${[0, 120, 240]
    .map((deg) => {
      const r = (deg * Math.PI) / 180;
      const x = cx + Math.cos(r) * 24;
      const y = cy + Math.sin(r) * 7;
      return `<path d="M${x} ${y - 6} l2 4 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 l5 -1z" fill="#ffd23f" stroke="#a67c00" stroke-width=".8"/>`;
    })
    .join('')}</g>`;

const feathers = [
  [-40, -50, -30], [30, -60, 40], [-60, 10, -70], [60, 0, 80], [0, -80, 10], [-20, 40, 160],
] as const;

const tommyGun = `<g transform="translate(-50 -70)">
  <rect x="-46" y="-5" width="50" height="9" rx="2" fill="#2b2d33"/>
  <rect x="-60" y="-3" width="16" height="5" fill="#2b2d33"/>
  <circle cx="-14" cy="10" r="9" fill="#2b2d33"/>
  <rect x="0" y="-6" width="20" height="12" rx="3" fill="#7a4a24"/>
</g>`;

export const ENDING_SCENES = {
  // Log: a log flies in, Bill is flattened into the river and floats with stars.
  logHit: svg(`${sky('#ffd7a1', '#ff9f68', 'e1')}
    <rect y="170" width="400" height="55" fill="#4fa3c7"/>
    <path d="M0 176 Q50 170 100 176 T200 176 T300 176 T400 176 T500 176" stroke="#bfe8ff" stroke-width="3" fill="none" class="ripple"/>
    <g class="a-bill">${bill(170, 180, 0.9, 'scared')}</g>
    <g class="a-ko"><g transform="rotate(-90 170 176)">${bill(170, 195, 0.6, 'ko')}</g></g>
    <g class="a-splash">${[-1, 0, 1].map((d) => `<circle cx="${150 + d * 26}" cy="172" r="${10 - Math.abs(d) * 3}" fill="#fff" opacity=".85"/>`).join('')}</g>
    <g class="a-log">${log(280, 110)}</g>
    ${stars(127, 148)}`),

  // Dog: Biscuit lunges, a cartoon fight cloud, feathers everywhere.
  dogBite: svg(`${sky('#3a0f12', '#140405', 'e2')}
    <g class="a-bill">${bill(260, 200, 0.85, 'scared')}</g>
    <g class="a-dog"><g transform="scale(-1 1)">${dog(-110, 140, 0.9)}</g></g>
    <g class="a-cloud">${[[200, 120, 50], [250, 100, 40], [160, 100, 38], [230, 150, 42], [175, 150, 36]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#efe6d8"/>`).join('')}</g>
    ${feathers.map((_, i) => `<g class="a-feather a-feather-${i}"><ellipse cx="205" cy="115" rx="5" ry="13" fill="#fdfaf2" stroke="#d8d0c0"/></g>`).join('')}`),

  // Dog, after: Biscuit wearing Bill's cap, very pleased with himself.
  dogAfter: svg(`${sky('#3a0f12', '#140405', 'e3')}
    <g class="a-dog">${dog(200, 150, 1.3)}
      <g transform="translate(200 82) rotate(-12)"><path d="M-30 4 Q0 -32 30 4Z" fill="${C.cap}"/><rect x="8" y="-1" width="34" height="7" rx="3.5" fill="${C.capBrim}"/></g>
    </g>
    <g class="a-don">${don(355, 220, 0.5, false)}</g>`),

  // Boss: the Don fires, Bill spins and drops.
  bossShot: svg(`${sky('#1b1b24', '#0d0d12', 'e4')}
    <rect x="0" y="182" width="400" height="43" fill="#2a1f18"/>
    <g class="a-bill">${bill(90, 190, 0.85, 'scared')}</g>
    <g class="a-don">${don(310, 196, 1, true)}<g transform="translate(310 196)">${tommyGun}</g></g>
    <g class="a-flash"><path d="M208 126 l-26 -12 l10 12 l-22 2 l22 6 l-12 12 l28 -10z" fill="#ffd23f"/></g>`),

  // Boss, after: Bill's ghost floats up with a halo while the Don blows smoke off the gun.
  bossAfter: svg(`${sky('#1b1b24', '#0d0d12', 'e5')}
    <rect x="0" y="182" width="400" height="43" fill="#2a1f18"/>
    <g transform="rotate(-90 110 190)">${bill(110, 230, 0.8, 'ko')}</g>
    <g class="a-ghost">
      <ellipse cx="160" cy="110" rx="48" ry="64" fill="#dff6ff" opacity=".35"/>
      <ellipse cx="160" cy="44" rx="22" ry="5" fill="none" stroke="#ffd23f" stroke-width="3"/>
      <g opacity=".85">${bill(160, 172, 0.72, 'ko')}</g>
    </g>
    <g class="a-don">${don(310, 196, 1, false)}<g transform="translate(310 196)">${tommyGun}</g></g>`),

  // Win: the Don's hat flies off and he keels over.
  bossDown: svg(`${sky('#3a2a10', '#120c04', 'e6')}
    <rect x="0" y="182" width="400" height="43" fill="#2a1f18"/>
    <g class="a-topple">${don(200, 196, 1.15, false, true)}</g>
    ${stars(334, 126)}`),

  // Win: the IOU, stamped PAID IN FULL, confetti, and a very smug Bill.
  paid: svg(`${sky('#ffd7a1', '#ff9f68', 'e7')}
    <g transform="rotate(-4 150 110)">
      <rect x="60" y="34" width="180" height="150" rx="6" fill="#f7efd9"/>
      <text x="150" y="68" text-anchor="middle" font-size="22" font-weight="700" fill="#3b2a1a" font-family="Georgia">I.O.U.</text>
      <text x="150" y="96" text-anchor="middle" font-size="13" fill="#3b2a1a" font-family="Georgia">1,000 breadcrumbs</text>
      <text x="150" y="114" text-anchor="middle" font-size="10" fill="#6b5a44" font-family="Georgia">payable to: The Don</text>
    </g>
    <g class="a-paid"><g transform="rotate(-14 150 140)">
      <rect x="78" y="118" width="144" height="42" rx="6" fill="none" stroke="#2e9d4f" stroke-width="4"/>
      <text x="150" y="147" text-anchor="middle" font-size="19" font-weight="900" fill="#2e9d4f" font-family="Arial">PAID IN FULL</text>
    </g></g>
    <g class="a-bill">${bill(320, 200, 0.95, 'cool')}</g>
    ${Array.from({ length: 18 }, (_, i) => `<rect class="a-conf a-conf-${i}" x="${20 + ((i * 53) % 360)}" y="-10" width="6" height="10" fill="${['#e5484d', '#ffd23f', '#37d67a', '#2e86de', '#f39c32'][i % 5]}"/>`).join('')}`),
};

export type EndingScene = keyof typeof ENDING_SCENES;
export const FEATHER_PATHS = feathers;
export const CONFETTI_COUNT = 18;
