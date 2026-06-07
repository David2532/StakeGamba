/**
 * Generates simple, royalty-free placeholder football/stadium SVG assets for
 * "Golden Goal Rush". These are intentionally lightweight vector placeholders
 * for the visual cycle - not final art. Re-run with: `node scripts/generate-placeholder-assets.mjs`
 *
 * No external dependencies, no brand/club/FIFA marks, no real players.
 * Pixi v8 loads .svg via its loadSVG parser as a Texture (explicit width/height required).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'static', 'assets', 'ggr');
mkdirSync(OUT, { recursive: true });

const GOLD_DEFS = `
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff3c4"/>
    <stop offset="45%" stop-color="#ffd24a"/>
    <stop offset="100%" stop-color="#b97d11"/>
  </linearGradient>
  <radialGradient id="dark" cx="50%" cy="38%" r="70%">
    <stop offset="0%" stop-color="#1c2b22"/>
    <stop offset="100%" stop-color="#070d0a"/>
  </radialGradient>`;

// 512x512 symbol with a dark badge + gold ring
const symbol = (inner, accent = '#ffd24a') => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>${GOLD_DEFS}
    <radialGradient id="acc" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="236" fill="url(#dark)" stroke="url(#gold)" stroke-width="16"/>
  <circle cx="256" cy="256" r="214" fill="url(#acc)"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="3"/>
  ${inner}
</svg>`;

// big stadium-style letter / number
const letter = (text, accent) => symbol(
  `<text x="256" y="300" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"
     font-size="${text.length > 1 ? 230 : 300}" fill="url(#gold)" stroke="#3a2600" stroke-width="8"
     paint-order="stroke" style="letter-spacing:-6px">${text}</text>
   <text x="256" y="300" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"
     font-size="${text.length > 1 ? 230 : 300}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.6"
     style="letter-spacing:-6px">${text}</text>`,
  accent);

const ribbon = (label) => `<g>
   <rect x="116" y="372" width="280" height="64" rx="14" fill="#7a1020" stroke="url(#gold)" stroke-width="5"/>
   <text x="256" y="416" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"
     font-size="40" fill="#fff3c4">${label}</text>
 </g>`;

// football (ball) icon centered
const ball = (cx, cy, r) => {
  const pent = (a, d) => {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2 + a;
      pts.push(`${(cx + Math.cos(ang) * d).toFixed(1)},${(cy + Math.sin(ang) * d).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="#10110f"/>`;
  };
  // center pentagon + 5 small surrounding marks
  let marks = pent(0, r * 0.34);
  for (let i = 0; i < 5; i++) {
    const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = cx + Math.cos(ang) * r * 0.74;
    const py = cy + Math.sin(ang) * r * 0.74;
    marks += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="#10110f"/>`;
  }
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#cdd2d6" stroke-width="6"/>
    ${marks}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-opacity="0.15" stroke-width="3"/>
  </g>`;
};

const trophy = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})" stroke="#6b4708" stroke-width="4">
   <path d="M-70,-90 q-46,0 -46,40 q0,46 56,52 M70,-90 q46,0 46,40 q0,46 -56,52" fill="none" stroke="url(#gold)" stroke-width="14"/>
   <path d="M-72,-96 L72,-96 L60,10 q-60,46 -120,0 Z" fill="url(#gold)"/>
   <rect x="-16" y="6" width="32" height="46" fill="url(#gold)"/>
   <rect x="-52" y="52" width="104" height="22" rx="6" fill="url(#gold)"/>
   <rect x="-66" y="74" width="132" height="20" rx="6" fill="#b97d11"/>
   <path d="M-44,-86 q44,40 88,0" fill="none" stroke="#fff3c4" stroke-width="6" opacity="0.7"/>
 </g>`;

const shirt = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})">
   <path d="M-60,-70 L-20,-90 q40,28 80,0 L60,-70 L104,-30 L74,6 L60,-10 L60,96 L-60,96 L-60,-10 L-74,6 L-104,-30 Z"
     fill="#c0182e" stroke="#3a0a12" stroke-width="5"/>
   <rect x="-14" y="-6" width="28" height="102" fill="#fff" opacity="0.85"/>
   <path d="M-20,-90 q20,30 40,0 L34,-72 q-34,22 -68,0 Z" fill="#fff" opacity="0.9"/>
   <text x="0" y="70" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" fill="#c0182e">9</text>
 </g>`;

const gloves = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})">
   ${[-58, 58].map((dx, i) => `<g transform="translate(${dx} 0) ${i ? 'scale(-1,1)' : ''}">
     <path d="M-34,-70 q-10,-26 8,-30 q14,-3 16,18 l2,30 l8,-2 l4,-40 q2,-18 16,-16 q14,2 12,22 l-2,40
              l30,8 q22,8 18,40 l-8,52 q-6,30 -40,30 l-44,0 q-26,0 -30,-26 Z"
       fill="url(#gold)" stroke="#6b4708" stroke-width="5"/>
     <path d="M-30,40 q40,16 78,0" fill="none" stroke="#6b4708" stroke-width="4" opacity="0.6"/>
   </g>`).join('')}
 </g>`;

const boot = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})">
   <path d="M-110,-30 q10,-34 56,-34 q40,0 56,26 q12,20 70,30 q44,8 44,40 l0,18 q0,16 -18,16 l-196,0
            q-22,0 -22,-22 Z" fill="#111418" stroke="url(#gold)" stroke-width="7"/>
   <path d="M-96,-26 q14,-22 44,-22 q30,0 40,20" fill="none" stroke="url(#gold)" stroke-width="6"/>
   ${[-70, -30, 14, 60].map((x) => `<circle cx="${x}" cy="74" r="9" fill="url(#gold)"/>`).join('')}
   <path d="M-40,-18 l24,30 M-14,-22 l24,30 M12,-22 l22,28" stroke="#fff" stroke-width="5" opacity="0.7" fill="none"/>
 </g>`;

// ---- write symbol files ----
const files = {
  'l1.svg': letter('10', '#3a8bff'),
  'l2.svg': letter('J', '#34c759'),
  'l3.svg': letter('Q', '#b06bff'),
  'l4.svg': letter('K', '#ff4d4d'),
  'l5.svg': letter('A', '#ffae34'),
  'h1.svg': symbol(trophy(256, 250, 1.35)),
  'h2.svg': symbol(shirt(256, 252, 1.5)),
  'h3.svg': symbol(gloves(256, 256, 1.25)),
  'h4.svg': symbol(boot(256, 250, 1.15)),
  's.svg': symbol(`${trophy(256, 214, 1.05)}${ribbon('SCATTER')}`),
  'w.svg': symbol(`${ball(256, 226, 116)}${ribbon('WILD')}`),
};

// ---- background: night stadium with floodlights ----
files['background.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#08160e"/>
      <stop offset="55%" stop-color="#0c2a18"/>
      <stop offset="100%" stop-color="#03070500"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="20%" r="62%">
      <stop offset="0%" stop-color="#ffe9a8" stop-opacity="0.44"/>
      <stop offset="100%" stop-color="#ffe9a8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pitchglow" cx="50%" cy="78%" r="40%">
      <stop offset="0%" stop-color="#eafff0" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#eafff0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffbe6"/>
      <stop offset="100%" stop-color="#fffbe6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1d7a3a"/>
      <stop offset="100%" stop-color="#0a3d1c"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="#04080500"/>
  <rect width="1600" height="1000" fill="#050a07"/>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <rect width="1600" height="640" fill="url(#spot)"/>
  <!-- stands -->
  <path d="M0,360 L1600,360 L1600,560 L0,560 Z" fill="#0a1813"/>
  ${Array.from({ length: 90 }).map(() => {
    const x = Math.floor(Math.random() * 1600);
    const y = 370 + Math.floor(Math.random() * 170);
    const c = ['#1c3a2a', '#274b34', '#c0182e', '#ffd24a', '#2b6cff'][Math.floor(Math.random() * 5)];
    return `<rect x="${x}" y="${y}" width="6" height="6" fill="${c}" opacity="0.5"/>`;
  }).join('')}
  <!-- floodlight towers -->
  ${[150, 1450].map((x) => `<g>
    <rect x="${x - 8}" y="120" width="16" height="280" fill="#16201b"/>
    <rect x="${x - 70}" y="70" width="140" height="64" rx="10" fill="#0e1714" stroke="#2a3a30" stroke-width="3"/>
    ${[0, 1, 2, 3].map((i) => `<circle cx="${x - 48 + i * 32}" cy="92" r="11" fill="#fffbe6"/>`).join('')}
    ${[0, 1, 2, 3].map((i) => `<circle cx="${x - 48 + i * 32}" cy="116" r="11" fill="#fff1b8"/>`).join('')}
    <circle cx="${x}" cy="102" r="170" fill="url(#lamp)" opacity="0.6"/>
  </g>`).join('')}
  <!-- pitch -->
  <path d="M-120,1000 L1720,1000 L1360,560 L240,560 Z" fill="url(#grass)"/>
  <path d="M-120,1000 L1720,1000 L1360,560 L240,560 Z" fill="none" stroke="#bfeccb" stroke-opacity="0.35" stroke-width="6"/>
  <ellipse cx="800" cy="780" rx="190" ry="70" fill="none" stroke="#eafff0" stroke-opacity="0.5" stroke-width="6"/>
  <line x1="800" y1="560" x2="800" y2="1000" stroke="#eafff0" stroke-opacity="0.4" stroke-width="6"/>
  <rect width="1600" height="1000" fill="url(#pitchglow)"/>
  <!-- vignette for darker stadium contrast -->
  <radialGradient id="vig" cx="50%" cy="50%" r="72%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <rect width="1600" height="1000" fill="url(#vig)"/>
  <rect width="1600" height="1000" fill="#02060400" />
</svg>`;

// ---- board frame: gold border + dark reel backdrop, transparent outside ----
files['frame.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="720" viewBox="0 0 1250 720">
  <defs>${GOLD_DEFS}
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- clearer, darker reel area for symbol contrast -->
  <rect x="123" y="58" width="1004" height="604" rx="34" fill="#020a06" fill-opacity="0.82"/>
  <rect x="123" y="58" width="1004" height="604" rx="34" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="3"/>
  <!-- soft outer gold glow -->
  <rect x="44" y="36" width="1162" height="648" rx="48" fill="none" stroke="#ffd24a" stroke-opacity="0.35" stroke-width="40" filter="url(#glow)"/>
  <!-- main heavy gold border -->
  <rect x="46" y="38" width="1158" height="644" rx="48" fill="none" stroke="url(#gold)" stroke-width="34"/>
  <rect x="46" y="38" width="1158" height="644" rx="48" fill="none" stroke="#3a2600" stroke-opacity="0.55" stroke-width="3"/>
  <rect x="106" y="46" width="1038" height="628" rx="32" fill="none" stroke="#7a1020" stroke-width="7" opacity="0.85"/>
  <rect x="116" y="52" width="1018" height="616" rx="28" fill="none" stroke="#fff3c4" stroke-opacity="0.5" stroke-width="2"/>
  <!-- LED corner accents -->
  ${[[78, 70], [1172, 70], [78, 650], [1172, 650]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="url(#gold)" filter="url(#glow)"/>`).join('')}
  ${Array.from({ length: 18 }).map((_, i) => `<circle cx="${130 + i * 55}" cy="38" r="5" fill="#ffd24a" opacity="0.85"/>`).join('')}
  ${Array.from({ length: 18 }).map((_, i) => `<circle cx="${130 + i * 55}" cy="682" r="5" fill="#ffd24a" opacity="0.85"/>`).join('')}
</svg>`;

// ---- logo (generated for later use; not wired into HUD yet) ----
files['logo.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260" viewBox="0 0 900 260">
  <defs>${GOLD_DEFS}</defs>
  ${ball(96, 120, 70)}
  <text x="200" y="118" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="92"
    fill="url(#gold)" stroke="#3a2600" stroke-width="6" paint-order="stroke">GOLDEN</text>
  <text x="200" y="216" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="92"
    fill="url(#gold)" stroke="#3a2600" stroke-width="6" paint-order="stroke">GOAL RUSH</text>
</svg>`;

let count = 0;
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content.trim() + '\n', 'utf8');
  count++;
}
console.log(`Wrote ${count} placeholder assets to ${OUT}`);
