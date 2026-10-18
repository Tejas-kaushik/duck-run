// The title screen's backdrop (Tejas): a looping chase in the intro's flat art style. Bill runs down
// the muddy forest road with Biscuit on his tail while Don Crumbs circles overhead. Pure SVG + CSS
// loops (lobby.css), so it costs nothing on phones.

import { bill, dog, don } from './introArt';

const W = 400;

const tree = (x: number, s: number, shade: string) =>
  `<g transform="translate(${x} 150) scale(${s})"><rect x="-3" y="-8" width="6" height="12" fill="#5a3d24"/>
   <path d="M0 -58 L-18 -20 L-8 -22 L-22 4 L22 4 L8 -22 L18 -20Z" fill="${shade}"/></g>`;

const cloud = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="22" ry="10"/>
   <ellipse cx="-14" cy="3" rx="14" ry="8"/><ellipse cx="16" cy="4" rx="15" ry="7"/><ellipse cx="4" cy="-6" rx="13" ry="9"/></g>`;

/** Content drawn twice, side by side, so a -400 translate loops seamlessly. */
const loop = (cls: string, body: string) => `<g class="${cls}">${body}<g transform="translate(${W} 0)">${body}</g></g>`;

const hills = `<path d="M0 150 Q40 108 90 128 T190 120 T290 112 T400 150Z" fill="#8fcf8a"/>`;
const forest = [12, 48, 80, 118, 160, 205, 240, 282, 318, 360, 392]
  .map((x, i) => tree(x, 0.8 + ((i * 37) % 5) / 10, i % 2 ? '#2f7d4a' : '#3e9a5a'))
  .join('');
const roadMarks = [0, 80, 160, 240, 320].map((x) => `<ellipse cx="${x + 30}" cy="${196 + (x % 3) * 6}" rx="16" ry="3" fill="#6e4b2e" opacity=".55"/>`).join('');
const clouds = [cloud(40, 40, 1), cloud(170, 26, 0.8), cloud(300, 52, 1.2)].join('');
const coins = [0, 1, 2, 3, 4]
  .map((i) => `<g class="t-coin" style="animation-delay:${i * 0.18}s"><circle cx="${300 + i * 24}" cy="${150 - (i % 2) * 10}" r="6" fill="#ffc83d" stroke="#b8860b" stroke-width="1.5"/></g>`)
  .join('');

export const TITLE_SCENE = `<svg class="title-bg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="t-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec8f0"/><stop offset=".7" stop-color="#c9ecff"/><stop offset="1" stop-color="#fff1cf"/></linearGradient>
    <linearGradient id="t-mud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a57a4f"/><stop offset="1" stop-color="#7d5634"/></linearGradient>
  </defs>
  <rect width="400" height="225" fill="url(#t-sky)"/>
  <circle class="t-sun" cx="330" cy="46" r="26" fill="#fff6c2"/>
  ${loop('t-clouds', clouds)}
  ${loop('t-hills', hills)}
  ${loop('t-forest', forest)}
  <rect y="160" width="400" height="65" fill="url(#t-mud)"/>
  <rect y="158" width="400" height="5" fill="#5f9e4f"/>
  ${loop('t-road', roadMarks)}
  <g class="t-don"><g class="t-don-bob">${don(0, 0, 0.32, true)}</g></g>
  ${coins}
  <g class="t-dog"><g class="t-dog-bob"><g transform="translate(100 200) scale(-1 1)">${dog(0, -26, 0.5)}</g></g></g>
  <g class="t-bill"><g class="t-bill-bob">${bill(205, 206, 0.62, 'scared')}</g></g>
  <g class="t-dust">${[0, 1, 2].map((i) => `<circle cx="${178 - i * 10}" cy="${204 - i * 2}" r="${5 - i}" fill="#c9a77e" style="animation-delay:${i * 0.12}s"/>`).join('')}</g>
</svg>`;
