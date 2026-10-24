// Captures Play Store phone screenshots (1080x1920) from the production build.
// Usage: npx vite preview --port 4173   then   node scripts/store-shots.mjs [url]
// Written as JPEG because Play rejects screenshots that carry an alpha channel.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = join('store', 'screenshots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const game = (moves, tc, clock) => ({ 'just-chess.game.v1': { v: 1, tc, moves, credits: [], clock, result: null } });

async function shot(name, seed, act) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((data) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(500);
  const tap = async (sq) => {
    const p = await page.evaluate((n) => {
      const b = document.getElementById('board');
      const r = b.getBoundingClientRect();
      const o = b.dataset.orientation;
      const f = n.charCodeAt(0) - 97;
      const rk = Number(n[1]) - 1;
      const x = o === 'w' ? f : 7 - f;
      const y = o === 'w' ? 7 - rk : rk;
      return { x: r.left + ((x + 0.5) * r.width) / 8, y: r.top + ((y + 0.5) * r.height) / 8 };
    }, sq);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(120);
  };
  await act(page, tap);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 92 });
  await ctx.close();
  console.log(`store shot ${name}.jpg`);
}

const sicilian = ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1e3', 'e7e5', 'd4b3', 'c8e6'];
await shot('1-play', game(sicilian, { minutes: 5, increment: 3 }, [241000, 236000]), async (page, tap) => {
  await page.tap('#paused');
  await page.waitForTimeout(250);
  await tap('d1');
});
await shot('2-time-control', {}, async (page) => {
  await page.waitForSelector('#sheet-new[open]');
  await page.waitForTimeout(300);
});
await shot('3-face-to-face', { ...game(sicilian.slice(0, 10), { minutes: 10, increment: 0 }, [512000, 497000]), 'just-chess.settings.v2': { orientation: 'facing', theme: 'green' } }, async (page, tap) => {
  await page.tap('#paused');
  await page.waitForTimeout(250);
  await tap('f1');
});
await shot('4-settings', {}, async (page) => {
  await page.tap('.tc[data-tc="10+0"]');
  await page.waitForTimeout(300);
  await page.tap('[data-action="settings"]');
  await page.waitForTimeout(450);
});
await browser.close();
