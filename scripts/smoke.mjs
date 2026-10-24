// End-to-end smoke test: drives the built app in headless Chrome and captures screenshots.
// Usage: npm run build && npx vite preview --port 4173   then   node scripts/smoke.mjs [url] [outDir]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });

const errors = [];
const checks = [];
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const PHONE = { viewport: { width: 412, height: 915 }, dpr: 2.625, touch: true };

function check(label, ok, detail = '') {
  checks.push(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
}

/** Opens the app in a fresh context, optionally seeding storage before the app boots. */
async function open(label, device, seed = {}) {
  const ctx = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.dpr,
    isMobile: device.touch && device.viewport.width < 900,
    hasTouch: device.touch,
  });
  await ctx.addInitScript(() => {
    // Count every sound the app actually starts.
    window.__sounds = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__sounds++;
      return start.apply(this, args);
    };
  });
  await ctx.addInitScript((data) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForTimeout(450);
  const cdp = await ctx.newCDPSession(page);
  const sq = (name) =>
    page.evaluate((n) => {
      const b = document.getElementById('board');
      const r = b.getBoundingClientRect();
      const o = b.dataset.orientation;
      const f = n.charCodeAt(0) - 97;
      const rk = Number(n[1]) - 1;
      const x = o === 'w' ? f : 7 - f;
      const y = o === 'w' ? 7 - rk : rk;
      return { x: r.left + ((x + 0.5) * r.width) / 8, y: r.top + ((y + 0.5) * r.height) / 8 };
    }, name);
  const h = {
    page,
    ctx,
    shot: (name) => page.screenshot({ path: join(out, `${name}.png`) }),
    tap: async (name) => {
      const p = await sq(name);
      if (device.touch) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(60);
    },
    drag: async (a, b, during) => {
      const p = await sq(a);
      const q = await sq(b);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }] });
        await page.waitForTimeout(12);
      }
      if (during) await during();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(60);
    },
    settle: () => page.waitForTimeout(750),
    moves: () => page.evaluate(() => JSON.parse(localStorage.getItem('just-chess.game.v1') ?? '{}').moves?.join(' ') ?? ''),
    text: (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? '', sel),
    tool: (action) => page.tap(`[data-action="${action}"]`).then(() => page.waitForTimeout(300)),
  };
  return h;
}

const game = (moves, tc, clock, extra = {}) => ({ 'just-chess.game.v1': { v: 1, tc, moves, credits: [], clock, result: null, ...extra } });

// ------------------------------------------------------------ 1. first launch and a full game
{
  const h = await open('phone', PHONE);
  check('time-control sheet opens on first launch', await h.page.evaluate(() => document.getElementById('sheet-new').open));
  await h.shot('phone-01-time-control');
  await h.page.tap('.tc[data-tc="5+3"]');
  await h.page.waitForTimeout(450);
  await h.shot('mobile');

  await h.tap('e2');
  await h.shot('phone-02-selected');
  await h.tap('e4');
  await h.settle();
  const facing = await h.page.evaluate(() => ({
    orientation: document.getElementById('board').dataset.orientation,
    turned: [...document.querySelectorAll('.board__pieces .piece:not(.is-ghost)')].every((p) => p.style.transform.includes('rotate(180deg)')),
    blackBarFacesAway: document.getElementById('bar-top').classList.contains('is-flipped'),
  }));
  check('default: board stays put after 1.e4', facing.orientation === 'w');
  check('default: every piece turns to face Black', facing.turned);
  check("default: Black's bar faces the far side", facing.blackBarFacesAway);
  check('the move played a sound', (await h.page.evaluate(() => window.__sounds)) >= 1);
  await h.shot('phone-03-pieces-face-black');
  await h.drag('e7', 'e5', () => h.shot('phone-04-dragging'));
  await h.settle();
  await h.tap('d1');
  await h.tap('h5');
  await h.settle();
  await h.tap('b8');
  await h.tap('c6');
  await h.settle();
  await h.drag('f1', 'c4');
  await h.settle();
  await h.tap('g8');
  await h.tap('f6');
  await h.settle();
  await h.tap('h5');
  await h.shot('phone-05-capture-hint');
  await h.tap('f7');
  await h.page.waitForTimeout(900);
  check('Scholar mate recorded', (await h.moves()) === 'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7', await h.moves());
  check('result card shows the win', (await h.text('#result-title')) === 'White wins' && (await h.text('#result-reason')).startsWith('Checkmate'));
  await h.shot('phone-06-checkmate');

  await h.page.tap('#dlg-result [data-close]');
  await h.page.waitForTimeout(350);
  await h.tool('prev');
  await h.shot('phone-07-review');
  await h.tool('settings');
  await h.page.waitForTimeout(200);
  await h.shot('phone-08-settings');
  await h.page.evaluate(() => document.querySelector('#page-settings .page__scroll').scrollTo(0, 9999));
  await h.page.waitForTimeout(150);
  await h.shot('phone-09-settings-bottom');

  // Post-game analysis with the local Stockfish (still on the position after 3...Nf6).
  await h.page.tap('#page-settings [data-close]');
  await h.page.waitForTimeout(350);
  await h.tool('analyze');
  await h.page.waitForSelector('.engine-line .engine-score', { timeout: 30000 });
  await h.page.waitForTimeout(2500);
  const analysis = await h.page.evaluate(() => ({
    best: document.querySelector('.engine-line .engine-score')?.textContent,
    firstMove: document.querySelector('.engine-line .engine-moves b')?.textContent,
    lines: document.querySelectorAll('.engine-line').length,
    arrows: document.querySelectorAll('.board__arrows polygon').length,
    meta: document.getElementById('engine-meta')?.textContent,
  }));
  check('analysis finds the mate in one', analysis.best === '#1' && analysis.firstMove === '4. Qxf7#', JSON.stringify(analysis));
  check('analysis shows three lines and three arrows', analysis.lines === 3 && analysis.arrows === 3, JSON.stringify(analysis));
  await h.shot('phone-18-analysis');
  await h.tool('next');
  await h.page.waitForTimeout(700);
  check('final position reports the checkmate', (await h.text('#engine-lines')).startsWith('Checkmate'), await h.text('#engine-lines'));
  await h.shot('phone-19-analysis-final');
  await h.tool('analyze');
  check('leaving analysis clears the arrows', (await h.page.locator('.board__arrows polygon').count()) === 0);
  await h.ctx.close();
}

// ------------------------------------------------------------ 1b. "board turns each move" still works
{
  const h = await open('rotate', PHONE, { 'just-chess.settings.v2': { orientation: 'rotate' } });
  await h.page.tap('.tc[data-tc="5+3"]');
  await h.page.waitForTimeout(400);
  await h.tap('e2');
  await h.tap('e4');
  await h.settle();
  check('rotate mode: board turns to Black after 1.e4', (await h.page.evaluate(() => document.getElementById('board').dataset.orientation)) === 'b');
  await h.shot('phone-03b-board-rotated');
  await h.ctx.close();
}

// ------------------------------------------------------------ 2. restore, pause, promotion
{
  const h = await open('promotion', PHONE, game(['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'b8c6'], { minutes: 3, increment: 2 }, [150000, 171000]));
  check('restored timed game starts paused', await h.page.evaluate(() => !document.getElementById('paused').hidden));
  await h.shot('phone-10-restored-paused');
  await h.page.tap('#paused');
  await h.page.waitForTimeout(250);
  await h.tap('b7');
  await h.tap('b8');
  await h.page.waitForTimeout(250);
  check('promotion picker offers four pieces', (await h.page.locator('.promo__opt').count()) === 4);
  await h.shot('phone-11-promotion');
  await h.page.tap('.promo__opt[aria-label="Knight"]');
  await h.settle();
  check('under-promotion to a knight', (await h.moves()).endsWith('b7b8n'), await h.moves());
  await h.shot('phone-12-after-underpromotion');
  // Black captures the new knight, then White takes it back with Undo.
  await h.tap('d8');
  await h.page.waitForTimeout(30);
  await h.ctx.close();
}

// ------------------------------------------------------------ 3. undo and the end sheet
{
  const h = await open('undo', PHONE, game(['e2e4', 'd7d5'], { minutes: 10, increment: 0 }, [598000, 596000]));
  await h.page.tap('#paused');
  await h.page.waitForTimeout(200);
  await h.tap('e4');
  await h.tap('d5');
  await h.settle();
  check('capture played', (await h.moves()) === 'e2e4 d7d5 e4d5');
  await h.tool('undo');
  await h.settle();
  check('undo takes the capture back', (await h.moves()) === 'e2e4 d7d5');
  await h.shot('phone-13-after-undo');
  await h.tool('end');
  await h.shot('phone-14-end-sheet');
  await h.page.tap('[data-end="draw"]');
  await h.page.waitForTimeout(900);
  check('draw by agreement', (await h.text('#result-title')) === 'Draw');
  await h.ctx.close();
}

// ------------------------------------------------------------ 4. low time and flag fall
{
  const h = await open('flag', PHONE, game(['e2e4', 'e7e5'], { minutes: 1, increment: 0 }, [2600, 41000]));
  await h.page.tap('#paused');
  await h.page.waitForTimeout(700);
  await h.shot('phone-15-low-time');
  await h.page.waitForTimeout(2600);
  check('flag fall ends the game', (await h.text('#result-reason')).startsWith('White ran out of time'), await h.text('#result-reason'));
  await h.shot('phone-16-flag');
  await h.ctx.close();
}

// ------------------------------------------------------------ 5. face to face, other theme
{
  const h = await open('facing', PHONE, {
    ...game(['e2e4', 'c7c5', 'g1f3', 'd7d6'], { minutes: 0, increment: 0 }, [0, 0]),
    'just-chess.settings.v2': { orientation: 'facing', theme: 'green' },
  });
  await h.tap('d2');
  await h.shot('phone-17-face-to-face');
  await h.ctx.close();
}

// ------------------------------------------------------------ 6. other screens
const sicilian = game(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'], { minutes: 10, increment: 0 }, [541000, 517000]);
for (const [name, device] of [
  ['small-phone', { viewport: { width: 360, height: 640 }, dpr: 3, touch: true }],
  ['phone-landscape', { viewport: { width: 915, height: 412 }, dpr: 2.625, touch: true }],
  ['tablet-landscape', { viewport: { width: 1280, height: 800 }, dpr: 1.5, touch: true }],
  ['tablet-portrait', { viewport: { width: 800, height: 1280 }, dpr: 1.5, touch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, dpr: 1, touch: false }],
]) {
  const h = await open(name, device, sicilian);
  await h.page.click('#paused');
  await h.page.waitForTimeout(250);
  await h.tap('f1');
  await h.page.waitForTimeout(120);
  await h.shot(name);
  await h.ctx.close();
}

// ------------------------------------------------------------ 6b. Fischer Random
{
  const h = await open('chess960-start', PHONE);
  await h.page.tap('#custom-toggle');
  await h.page.waitForTimeout(250);
  await h.page.tap('#custom-960');
  await h.shot('phone-20-custom-chess960');
  await h.page.tap('#custom-start');
  await h.page.waitForTimeout(500);
  const saved = await h.page.evaluate(() => JSON.parse(localStorage.getItem('just-chess.game.v1') ?? '{}'));
  const backRank = (saved.start ?? '').split('/')[7]?.split(' ')[0] ?? '';
  check('custom toggle starts a Chess960 game', saved.chess960 === true && /^[RNBQK]{8}$/.test(backRank), `${saved.start}`);
  await h.shot('phone-21-chess960-start');
  await h.ctx.close();
}
{
  // King f1 and rook g1: castling swaps them. The king is dropped onto its own rook.
  const h = await open('chess960-castle', PHONE, {
    'just-chess.game.v1': { v: 1, tc: { minutes: 0, increment: 0 }, chess960: true, start: 'r3k3/8/8/8/8/8/8/5KR1 w Ga - 0 1', moves: [], credits: [], clock: [0, 0], result: null },
  });
  await h.tap('f1');
  await h.shot('phone-22-chess960-castle-hint');
  await h.tap('g1');
  await h.page.waitForTimeout(400);
  const after = await h.page.evaluate(() => JSON.parse(localStorage.getItem('just-chess.game.v1') ?? '{}').moves?.join(' '));
  const pieces = await h.page.evaluate(() =>
    [...document.querySelectorAll('.board__pieces .piece')].map((p) => `${p.dataset.piece}@${p.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)?.slice(1).join(',')}`),
  );
  check('Chess960 castling by king-onto-rook', after === 'f1g1' && pieces.includes('wk@600,700') && pieces.includes('wr@500,700'), `${after} ${pieces.join(' ')}`);
  await h.ctx.close();
}
{
  const h = await open('chess960-analysis', PHONE, {
    'just-chess.game.v1': {
      v: 1,
      tc: { minutes: 0, increment: 0 },
      chess960: true,
      start: 'r3k3/8/8/8/8/8/8/5KR1 w Ga - 0 1',
      moves: ['f1g1'],
      credits: [false],
      clock: [0, 0],
      result: { winner: null, reason: 'agreement' },
    },
  });
  await h.page.tap('#sheet-new [data-close]');
  await h.page.waitForTimeout(300);
  await h.tool('prev');
  await h.tool('analyze');
  await h.page.waitForSelector('.engine-line .engine-score', { timeout: 30000 });
  await h.page.waitForTimeout(2000);
  const lines = await h.page.evaluate(() => [...document.querySelectorAll('.engine-line .engine-moves')].map((l) => l.textContent));
  check('Stockfish analyses a Chess960 position', lines.length === 3 && lines.every((l) => l && l.length > 3), lines.join(' | '));
  await h.shot('phone-23-chess960-analysis');
  await h.ctx.close();
}

// ------------------------------------------------------------ 7. analysis in landscape layouts
const scholar = {
  'just-chess.game.v1': {
    v: 1,
    tc: { minutes: 5, increment: 3 },
    moves: ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'],
    credits: [],
    clock: [290000, 284000],
    result: { winner: 'w', reason: 'checkmate' },
  },
};
for (const [name, device] of [
  ['phone-landscape-analysis', { viewport: { width: 915, height: 412 }, dpr: 2.625, touch: true }],
  ['desktop-analysis', { viewport: { width: 1440, height: 900 }, dpr: 1, touch: false }],
]) {
  const h = await open(name, device, scholar);
  await h.page.click('#sheet-new [data-close]');
  await h.page.waitForTimeout(350);
  await h.page.click('[data-action="prev"]');
  await h.page.click('[data-action="prev"]');
  await h.page.click('[data-action="analyze"]');
  await h.page.waitForSelector('.engine-line .engine-score', { timeout: 30000 });
  await h.page.waitForTimeout(2500);
  await h.shot(name);
  await h.ctx.close();
}

await browser.close();
console.log(checks.join('\n'));
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log('no console errors');
