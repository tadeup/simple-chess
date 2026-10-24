// Rasterises the app icon into every size the PWA and the Android launcher need.
// Uses the locally installed Chrome/Edge through playwright-core (no browser download).
// Usage: node scripts/build-icons.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIGHT = '#f0d9b5';
const DARK = '#b58863';
// cburnett knight (Colin M. L. Burnett, BSD license), 45x45 units.
const KNIGHT = `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/>
<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/>
<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#000"/></g>`;

const ORIGIN =
  'Origin: rasterized by scripts/build-icons.mjs from the app icon SVG (assets/icon.svg): the cburnett knight by Colin M. L. Burnett (BSD license) on a 2x2 wood checker. Not AI-generated.';

/** Inserts PNG tEXt chunks right after IHDR so every icon carries its provenance. */
function withText(png, entries) {
  const afterIhdr = 8 + 4 + 4 + 13 + 4;
  const chunks = entries.map(([key, value]) => {
    const data = Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]);
    const type = Buffer.from('tEXt', 'latin1');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
    return Buffer.concat([len, type, data, crc]);
  });
  return Buffer.concat([png.subarray(0, afterIhdr), ...chunks, png.subarray(afterIhdr)]);
}

/**
 * @param {object} o
 * @param {'square'|'rounded'|'circle'|'none'} o.shape  background shape ('none' = transparent foreground layer)
 * @param {number} o.knight  size of the 45-unit knight box as a fraction of the canvas
 */
function svg({ shape, knight }) {
  const S = 512;
  const k = S * knight;
  const scale = k / 45;
  const offset = (S - k) / 2;
  const clip =
    shape === 'rounded' ? `<clipPath id="c"><rect width="${S}" height="${S}" rx="${S * 0.22}"/></clipPath>` : shape === 'circle' ? `<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>` : '';
  const bg =
    shape === 'none'
      ? ''
      : `<g${clip ? ' clip-path="url(#c)"' : ''}><rect width="${S}" height="${S}" fill="${LIGHT}"/><path d="M256 0h256v256H256zM0 256h256v256H0z" fill="${DARK}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><defs>${clip}</defs>${bg}<g transform="translate(${offset} ${offset + S * 0.008}) scale(${scale})">${KNIGHT}</g></svg>`;
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, shape: 'rounded', knight: 0.72 },
  { file: 'public/icons/icon-512.png', size: 512, shape: 'rounded', knight: 0.72 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, shape: 'square', knight: 0.6 },
];

const android = join(root, 'android/app/src/main/res');
if (existsSync(android)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(densities)) {
    targets.push({ file: `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, size: 48 * m, shape: 'rounded', knight: 0.74 });
    targets.push({ file: `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, size: 48 * m, shape: 'circle', knight: 0.7 });
    // Adaptive icon foreground: 108dp canvas, art kept inside the 66dp safe zone.
    targets.push({ file: `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, size: 108 * m, shape: 'none', knight: 0.58 });
  }
}

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const markup = svg(t).replace(/width="512" height="512"/, `width="${t.size}" height="${t.size}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  const out = join(root, t.file);
  mkdirSync(dirname(out), { recursive: true });
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(out, withText(png, [['Description', ORIGIN], ['impeccable:prompt', ORIGIN]]));
  console.log(`icon ${t.file} (${t.size}px)`);
}
await browser.close();

writeFileSync(join(root, 'public/icons/favicon.svg'), svg({ shape: 'rounded', knight: 0.74 }));
console.log('icon public/icons/favicon.svg');

if (existsSync(android)) {
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  mkdirSync(join(android, 'mipmap-anydpi-v26'), { recursive: true });
  writeFileSync(join(android, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
  writeFileSync(join(android, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
  mkdirSync(join(android, 'drawable'), { recursive: true });
  writeFileSync(
    join(android, 'drawable/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="${LIGHT}" android:pathData="M0,0h108v108h-108z" />
    <path android:fillColor="${DARK}" android:pathData="M54,0h54v54h-54zM0,54h54v54h-54z" />
</vector>
`,
  );
  console.log('icon android adaptive icon xml');
}
