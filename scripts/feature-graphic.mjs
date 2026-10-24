// Renders the Play Store feature graphic (1024x500 JPEG) to store/feature-graphic.jpg.
// Usage: node scripts/feature-graphic.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

// Position after 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 (as in the screenshots).
const fen = 'rn1qkb1r/1p3ppp/p2pbn2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R';
const lastMove = ['c8', 'e6'];

const piece = (code) => {
  const color = code === code.toUpperCase() ? 'w' : 'b';
  const svg = readFileSync(join('src', 'pieces', `${color}${code.toLowerCase()}.svg`));
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
};

let squares = '';
fen.split('/').forEach((row, r) => {
  let f = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) {
      for (let i = 0; i < Number(ch); i++, f++) squares += square(r, f, null);
    } else {
      squares += square(r, f, ch);
      f++;
    }
  }
});

function square(r, f, code) {
  const name = String.fromCharCode(97 + f) + (8 - r);
  const cls = ['sq', (r + f) % 2 ? 'dark' : 'light', lastMove.includes(name) ? 'last' : ''].join(' ');
  return `<div class="${cls}">${code ? `<img src="${piece(code)}" alt="">` : ''}</div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #1b1a18; color: #ece9e4;
    font-family: 'Segoe UI', system-ui, Roboto, sans-serif; position: relative; }
  .glow { position: absolute; inset: 0; background: radial-gradient(circle at 76% 50%, rgb(212 162 76 / 0.16), transparent 55%); }
  .text { position: absolute; left: 72px; top: 50%; transform: translateY(-50%); width: 430px; }
  .rule { width: 56px; height: 4px; border-radius: 2px; background: #d4a24c; margin-bottom: 26px; }
  h1 { font-size: 72px; font-weight: 700; letter-spacing: -1.5px; line-height: 1; }
  p { margin-top: 22px; font-size: 27px; line-height: 1.35; color: #aaa49d; }
  .board { position: absolute; right: 64px; top: 50%; width: 400px; height: 400px; transform: translateY(-50%) rotate(-4deg);
    display: grid; grid-template-columns: repeat(8, 1fr); border-radius: 6px; overflow: hidden;
    box-shadow: 0 30px 60px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.06); }
  .sq { position: relative; } .light { background: #f0d9b5; } .dark { background: #b58863; }
  .last::after { content: ''; position: absolute; inset: 0; background: rgb(155 199 0 / 0.41); }
  .sq img { position: relative; z-index: 1; width: 100%; height: 100%; display: block; }
</style></head><body>
  <div class="glow"></div>
  <div class="text"><div class="rule"></div><h1>Simple Chess</h1><p>Two players, one device.<br>Just the board and the clock.</p></div>
  <div class="board">${squares}</div>
</body></html>`;

mkdirSync('store', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(html);
await page.waitForTimeout(200);
await page.screenshot({ path: join('store', 'feature-graphic.jpg'), type: 'jpeg', quality: 95 });
await browser.close();
console.log('store/feature-graphic.jpg');
