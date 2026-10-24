import { Engine, type EngineStatus, type EngineUpdate } from './analysis/engine';
import { favoursWhite, formatScore, whiteShare, type EngineLine } from './analysis/uci';
import { Chess, chess960Fen, FLAG_CASTLE_K, FLAG_CASTLE_Q, parseSquare, START_FEN, type Color, type Move, type PieceId, type PieceType } from './engine/chess';
import { Clock, formatClock, formatTimeControl, speedName, type Side, type TimeControl } from './game/clock';
import { loadSettings, read, saveSettings, THEMES, write, type Orientation, type Settings } from './game/settings';
import * as platform from './platform';
import { Board, type Arrow, type PieceFlip } from './ui/board';
import { Sound, type SoundName } from './ui/sound';

type Result =
  | { winner: Color; reason: 'checkmate' | 'resign' | 'timeout' }
  | { winner: null; reason: 'stalemate' | 'insufficient' | 'threefold' | 'fifty' | 'agreement' }
  | { winner: null; reason: 'timeout'; flagged: Color };

interface SavedGame {
  v: 1;
  tc: TimeControl;
  /** Starting position (Chess960 games). */
  start?: string;
  chess960?: boolean;
  moves: string[];
  credits: boolean[];
  clock: [number, number];
  result: Result | null;
}

interface GameSetup {
  /** Fischer Random: start from one of the 960 shuffled setups. */
  chess960?: boolean;
  /** Reuse this starting position (a Chess960 rematch). */
  startFen?: string;
}

interface Bar {
  root: HTMLElement;
  dot: HTMLElement;
  label: Text;
  name: HTMLElement;
  caps: HTMLElement;
  clock: HTMLElement;
  color: Color | null;
}

interface ReviewFrame {
  pieces: (PieceId | null)[];
  lastMove: [number, number] | null;
  check: number;
  fen: string;
}

const PRESETS: TimeControl[] = [
  { minutes: 1, increment: 0 },
  { minutes: 2, increment: 1 },
  { minutes: 3, increment: 0 },
  { minutes: 3, increment: 2 },
  { minutes: 5, increment: 0 },
  { minutes: 5, increment: 3 },
  { minutes: 10, increment: 0 },
  { minutes: 10, increment: 5 },
  { minutes: 15, increment: 10 },
  { minutes: 30, increment: 0 },
  { minutes: 30, increment: 20 },
  { minutes: 0, increment: 0 },
];
const MINUTE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 150, 180];
const INCREMENT_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60];
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const CAPTURE_ORDER = 'pnbrq';

const GAME_KEY = 'just-chess.game.v1';
const TC_KEY = 'just-chess.tc.v1';
const CUSTOM_KEY = 'just-chess.custom.v1';

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const sideOf = (c: Color): Side => (c === 'w' ? 0 : 1);
const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');
const sameTc = (a: TimeControl, b: TimeControl) => a.minutes === b.minutes && a.increment === b.increment;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function minutesLabel(m: number): string {
  const frac: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1.5: '1½' };
  return frac[m] ?? String(m);
}

function isTimeControl(v: unknown): v is TimeControl {
  const t = v as TimeControl;
  return !!t && typeof t.minutes === 'number' && typeof t.increment === 'number' && t.minutes >= 0 && t.increment >= 0 && t.minutes <= 600;
}

export class App {
  private readonly appEl = $('app');
  private readonly boardEl = $('board');
  private readonly pausedEl = $('paused');
  private readonly toolbar = $('toolbar');
  private readonly sheetNew = $('sheet-new') as HTMLDialogElement;
  private readonly sheetEnd = $('sheet-end') as HTMLDialogElement;
  private readonly dlgResult = $('dlg-result') as HTMLDialogElement;
  private readonly pageSettings = $('page-settings') as HTMLDialogElement;
  private readonly toastEl = $('toast');
  private readonly statusEl = $('status');
  private readonly engineEval = $('engine-eval');
  private readonly engineMeta = $('engine-meta');
  private readonly gaugeWhite = $('gauge-white');
  private readonly engineLines = $('engine-lines');
  private readonly top: Bar;
  private readonly bottomBar: Bar;
  private readonly board: Board;
  private readonly sound = new Sound();
  private settings: Settings = loadSettings();
  private chess = new Chess();
  private tc: TimeControl;
  private clock: Clock;
  private credits: boolean[] = [];
  private result: Result | null = null;
  private hasGame = false;
  private review: number | null = null;
  private frames: ReviewFrame[] | null = null;
  /** Colour at the bottom of the board, and (after any rotation finishes) of the player bars. */
  private bottom: Color = 'w';
  private barsBottom: Color = 'w';
  /** "Pieces face the player to move" mode: whether the pieces currently face Black. */
  private flipped = false;
  private rotateTimer = 0;
  private resultTimer = 0;
  private toastTimer = 0;
  private warned: [boolean, boolean] = [false, false];
  /** Post-game analysis with the local Stockfish. */
  private analyzing = false;
  private engine: Engine | null = null;
  private analysisTimer = 0;
  private analysisFen = '';
  private sanCache = new Map<string, string>();

  constructor() {
    const savedTc = read<TimeControl>(TC_KEY);
    this.tc = isTimeControl(savedTc) ? savedTc : { minutes: 10, increment: 0 };
    this.clock = this.makeClock(this.tc, null);
    this.top = this.buildBar($('bar-top'));
    this.bottomBar = this.buildBar($('bar-bottom'));
    this.board = new Board(this.boardEl, {
      move: (from, to, promotion, animate) => this.userMove(from, to, promotion, animate),
      isPromotion: (from, to) => this.chess.isPromotion(from, to),
      autoQueen: () => this.settings.autoQueen,
    });

    this.bindToolbar();
    this.bindDialogs();
    this.buildTimeControls();
    this.buildSettings();
    this.applySettings();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('pointerdown', () => this.sound.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.save());

    if (!this.restore()) {
      this.renderAll(false);
      this.openNewGame();
    }
    this.appEl.classList.add('is-ready');
    void platform.initPlatform(() => this.onBack()).then(() => this.updateAwake());
  }

  /* ------------------------------------------------------------ game flow */

  private makeClock(tc: TimeControl, remaining: [number, number] | null): Clock {
    return new Clock(
      tc,
      remaining,
      () => this.renderClocks(),
      (side) => this.flag(side),
    );
  }

  private startGame(tc: TimeControl, setup: GameSetup = {}): void {
    this.leaveAnalysis();
    this.engine?.terminate();
    this.engine = null;
    this.clock.stop();
    clearTimeout(this.rotateTimer);
    clearTimeout(this.resultTimer);
    this.tc = { ...tc };
    write(TC_KEY, this.tc);
    const chess960 = setup.chess960 === true;
    const start = chess960 ? (setup.startFen ?? chess960Fen(Math.floor(Math.random() * 960))) : START_FEN;
    this.chess = new Chess(start, { chess960 });
    this.credits = [];
    this.result = null;
    this.review = null;
    this.frames = null;
    this.warned = [false, false];
    this.clock = this.makeClock(this.tc, null);
    this.hasGame = true;
    this.bottom = this.barsBottom = this.desiredBottom();
    this.flipped = this.desiredFlipped();
    this.closeAll();
    this.renderAll(false);
    this.save();
    this.updateAwake();
  }

  private userMove(from: number, to: number, promotion: PieceType | undefined, animate: boolean): void {
    if (!this.isLive()) return;
    const side = sideOf(this.chess.turn());
    if (this.clock.timed && this.clock.active === side && this.clock.time(side) <= 0) {
      this.flag(side);
      return;
    }
    const move = this.chess.move(from, to, promotion);
    if (!move) {
      this.renderBoard(false);
      return;
    }
    if (this.clock.timed) {
      if (this.chess.history().length === 1) {
        // White's first move is free; it starts Black's clock.
        this.clock.run(1);
        this.credits.push(false);
      } else {
        this.clock.press(side, true);
        this.credits.push(this.tc.increment > 0);
      }
    } else this.credits.push(false);
    this.afterMove(move, animate);
  }

  private afterMove(move: Move, animate: boolean): void {
    const status = this.chess.status();
    this.play(this.soundFor(move));
    if (this.settings.haptics) platform.vibrate(move.captured ? 'medium' : 'light');
    if (status.over) {
      this.renderAll(animate);
      this.finish(status.reason === 'checkmate' ? { winner: status.winner, reason: 'checkmate' } : { winner: null, reason: status.reason });
      return;
    }
    this.renderAll(animate);
    this.save();
    this.scheduleTurn(animate);
    this.updateAwake();
  }

  private soundFor(move: Move): SoundName {
    if (this.chess.inCheck()) return 'check';
    if (move.flags & (FLAG_CASTLE_K | FLAG_CASTLE_Q)) return 'castle';
    return move.captured ? 'capture' : 'move';
  }

  private undo(): void {
    if (!this.isLive() || this.chess.history().length === 0) return;
    const move = this.chess.undo();
    if (!move) return;
    const credited = this.credits.pop() ?? false;
    if (this.clock.timed) {
      if (this.chess.history().length === 0) {
        this.clock.stop();
        this.clock = this.makeClock(this.tc, null);
      } else this.clock.unpress(sideOf(move.color), credited);
    }
    this.play('move');
    this.renderAll(true);
    this.save();
    this.scheduleTurn(true);
    this.updateAwake();
  }

  private flag(side: Side): void {
    if (this.result) return;
    const loser: Color = side === 0 ? 'w' : 'b';
    const winner = other(loser);
    this.finish(this.chess.cannotMate(winner) ? { winner: null, reason: 'timeout', flagged: loser } : { winner, reason: 'timeout' });
  }

  private finish(result: Result): void {
    if (this.result) return;
    this.result = result;
    this.clock.stop();
    clearTimeout(this.rotateTimer);
    this.board.reset();
    window.setTimeout(() => this.play('end'), 170);
    this.renderAll(false);
    this.save();
    this.updateAwake();
    this.resultTimer = window.setTimeout(() => this.showResult(), 520);
  }

  private pause(): void {
    if (!this.clock.isTicking || this.result) return;
    this.clock.pause();
    this.board.reset();
    this.renderAll(false);
    this.save();
    this.updateAwake();
  }

  private resume(): void {
    if (!this.clock.isPaused) return;
    this.clock.resume();
    this.renderAll(false);
    this.updateAwake();
  }

  private isLive(): boolean {
    return this.hasGame && !this.result && this.review === null && !this.clock.isPaused;
  }

  private play(name: SoundName): void {
    this.sound.play(name);
  }

  /* ----------------------------------------------------------- orientation */

  private desiredBottom(): Color {
    if (this.settings.orientation !== 'rotate') return 'w';
    return this.chess.turn();
  }

  private desiredFlipped(): boolean {
    return this.settings.orientation === 'pieces' && this.chess.turn() === 'b';
  }

  private flipState(): PieceFlip {
    const o = this.settings.orientation;
    if (o === 'facing') return 'black';
    return o === 'pieces' && this.flipped ? 'all' : 'none';
  }

  /** After a move, turn the pieces (or the whole board) toward whoever moves next. */
  private scheduleTurn(afterAnimation: boolean): void {
    clearTimeout(this.rotateTimer);
    if (this.settings.orientation === 'pieces') {
      const want = this.desiredFlipped();
      if (want === this.flipped) return;
      this.rotateTimer = window.setTimeout(
        () => {
          if (this.result) return;
          this.flipped = want;
          this.board.set({ flip: this.flipState() }, true);
        },
        afterAnimation ? 160 : 60,
      );
      return;
    }
    const target = this.desiredBottom();
    if (target === this.bottom) {
      if (this.barsBottom !== target) {
        this.barsBottom = target;
        this.renderBars();
      }
      return;
    }
    this.rotateTimer = window.setTimeout(
      () => {
        if (this.result) return;
        this.bottom = target;
        void this.board.rotateTo(target, true).then(() => {
          if (this.bottom !== target) return;
          this.barsBottom = target;
          this.renderBars();
        });
      },
      afterAnimation ? 200 : 120,
    );
  }

  /* ------------------------------------------------------------- rendering */

  private renderAll(animate: boolean): void {
    this.renderBoard(animate);
    this.renderBars();
    this.renderToolbar();
    this.renderStatus();
    this.pausedEl.hidden = !(this.clock.isPaused && !this.result && this.hasGame);
  }

  private reviewFrames(): ReviewFrame[] {
    if (this.frames) return this.frames;
    const replay = new Chess(this.chess.startFen(), { chess960: this.chess.isChess960() });
    const frames: ReviewFrame[] = [{ pieces: replay.placement(), lastMove: null, check: -1, fen: replay.fen() }];
    for (const m of this.chess.history()) {
      replay.move(m.from, m.to, m.promotion);
      frames.push({ pieces: replay.placement(), lastMove: [m.from, m.to], check: replay.checkSquare(), fen: replay.fen() });
    }
    this.frames = frames;
    return frames;
  }

  private renderBoard(animate: boolean): void {
    const live = this.isLive();
    const frame = this.review !== null ? this.reviewFrames()[this.review] : null;
    const last = this.chess.lastMove();
    this.board.set(
      {
        pieces: frame ? frame.pieces : this.chess.placement(),
        orientation: this.analyzing ? 'w' : this.bottom,
        turn: this.chess.turn(),
        movable: live,
        dests: live ? this.chess.dests() : new Map(),
        lastMove: frame ? frame.lastMove : last ? [last.from, last.to] : null,
        check: frame ? frame.check : this.chess.checkSquare(),
        flip: this.analyzing ? 'none' : this.flipState(),
        showDests: this.settings.legalMoves,
        coordinates: this.settings.coordinates,
      },
      animate,
    );
  }

  private buildBar(root: HTMLElement): Bar {
    root.innerHTML =
      '<div class="player__id"><span class="player__name"><span class="player__dot"></span></span><span class="player__captures"></span></div><div class="clock" role="timer"></div>';
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    const name = q('.player__name');
    const label = document.createTextNode('');
    name.append(label);
    return { root, dot: q('.player__dot'), label, name, caps: q('.player__captures'), clock: q('.clock'), color: null };
  }

  private renderBars(): void {
    const plies = this.review ?? this.chess.history().length;
    const pieces = this.review !== null ? this.reviewFrames()[this.review].pieces : this.chess.placement();
    let balance = 0;
    for (const p of pieces) if (p) balance += p[0] === 'w' ? VALUES[p[1]] : -VALUES[p[1]];
    const taken: Record<Color, PieceType[]> = { w: [], b: [] };
    const history = this.chess.history();
    for (let i = 0; i < plies; i++) {
      const m = history[i];
      if (m.captured) taken[m.color].push(m.captured);
    }
    for (const [bar, color] of [
      [this.top, other(this.barsBottom)],
      [this.bottomBar, this.barsBottom],
    ] as const) {
      if (bar.color !== color) {
        bar.color = color;
        bar.dot.className = `player__dot is-${color}`;
        bar.label.data = colorName(color);
        bar.root.setAttribute('aria-label', colorName(color));
      }
      const list = taken[color].slice().sort((a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b));
      const frag = document.createDocumentFragment();
      let prev = '';
      for (const t of list) {
        const s = document.createElement('span');
        s.className = `cap ${other(color)}${t}${prev && prev !== t ? ' is-group-start' : ''}`;
        frag.append(s);
        prev = t;
      }
      const adv = color === 'w' ? balance : -balance;
      if (adv > 0) {
        const a = document.createElement('span');
        a.className = 'player__adv';
        a.textContent = `+${adv}`;
        frag.append(a);
      }
      bar.caps.replaceChildren(frag);
      bar.caps.setAttribute('aria-label', list.length ? `Captured: ${list.length} pieces` : 'No captures');
    }
    // With the device lying between the players, Black's bar faces the far side.
    const o = this.settings.orientation;
    this.top.root.classList.toggle('is-flipped', o === 'facing' || o === 'pieces');
    this.renderClocks();
  }

  private renderClocks(): void {
    const turn = this.chess.turn();
    for (const bar of [this.top, this.bottomBar]) {
      const color = bar.color ?? 'w';
      const side = sideOf(color);
      const el = bar.clock;
      const toMove = this.hasGame && !this.result && turn === color;
      bar.root.classList.toggle('is-turn', toMove);
      if (!this.clock.timed) {
        el.classList.add('is-untimed');
        el.classList.remove('is-low', 'is-flagged');
        el.classList.toggle('is-active', toMove);
        if (el.textContent !== 'To move') el.textContent = 'To move';
        el.setAttribute('aria-label', toMove ? `${colorName(color)} to move` : '');
        continue;
      }
      el.classList.remove('is-untimed');
      const t = this.clock.time(side);
      const text = formatClock(t);
      if (el.textContent !== text) el.textContent = text;
      const flagged = this.result?.reason === 'timeout' && ('flagged' in this.result ? this.result.flagged === color : this.result.winner !== color);
      el.classList.toggle('is-active', toMove);
      el.classList.toggle('is-low', t < 10_000 && !flagged);
      el.classList.toggle('is-flagged', flagged);
      if (toMove && this.clock.isTicking && t < 10_000 && !this.warned[side] && this.tc.minutes >= 1) {
        this.warned[side] = true;
        this.play('low');
      }
    }
  }

  private renderToolbar(): void {
    const over = !!this.result;
    const btn = (a: string) => this.toolbar.querySelector(`[data-action="${a}"]`) as HTMLButtonElement;
    const plies = this.chess.history().length;
    btn('undo').hidden = over || !this.settings.showUndo;
    btn('undo').disabled = !this.isLive() || plies === 0;
    const pause = btn('pause');
    pause.hidden = over || !this.clock.timed;
    pause.disabled = !this.clock.isTicking && !this.clock.isPaused;
    const paused = this.clock.isPaused;
    pause.querySelector('use')?.setAttribute('href', paused ? '#i-play' : '#i-pause');
    (pause.querySelector('span') as HTMLElement).textContent = paused ? 'Resume' : 'Pause';
    btn('end').hidden = over;
    btn('end').disabled = !this.hasGame;
    btn('prev').hidden = !over;
    btn('next').hidden = !over;
    const analyze = btn('analyze');
    analyze.hidden = !over;
    analyze.setAttribute('aria-pressed', String(this.analyzing));
    const at = this.review ?? plies;
    btn('prev').disabled = at <= 0;
    btn('next').disabled = at >= plies;
  }

  /* ---------------------------------------------------------------- layout */

  private layout(): void {
    const cs = getComputedStyle(this.appEl);
    const w = this.appEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = this.appEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const landscape = w > h * 1.15 && w >= 560;
    const tools = 60;
    let board: number;
    let bar: number;
    let side = 0;
    if (!landscape) {
      const margin = w >= 600 ? 28 : 0;
      board = Math.floor(Math.min(w - margin * 2, h - tools - 2 * 52) / 8) * 8;
      const spare = h - tools - board;
      bar = Math.round(Math.min(80, Math.max(52, (spare / 2) * 0.6)));
    } else {
      side = Math.round(Math.min(380, Math.max(250, w * 0.3)));
      board = Math.floor(Math.min(h - 24, w - side - 28 - 32) / 8) * 8;
      bar = Math.round(Math.min(80, Math.max(56, board * 0.16)));
    }
    board = Math.max(160, board);
    const s = this.appEl.style;
    this.appEl.dataset.layout = landscape ? 'landscape' : 'portrait';
    s.setProperty('--board', `${board}px`);
    s.setProperty('--bar-h', `${bar}px`);
    s.setProperty('--side', `${side}px`);
    s.setProperty('--tools-h', `${tools}px`);
    s.setProperty('--clock-font', `${Math.round(bar * 0.46)}px`);
  }

  /* --------------------------------------------------------------- toolbar */

  private bindToolbar(): void {
    this.toolbar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!btn || btn.disabled) return;
      switch (btn.dataset.action) {
        case 'new':
          this.openNewGame();
          break;
        case 'undo':
          this.undo();
          break;
        case 'pause':
          if (this.clock.isPaused) this.resume();
          else this.pause();
          break;
        case 'end':
          this.open(this.sheetEnd);
          break;
        case 'prev':
          this.step(-1);
          break;
        case 'next':
          this.step(1);
          break;
        case 'analyze':
          if (this.analyzing) this.leaveAnalysis();
          else this.enterAnalysis();
          break;
        case 'settings':
          this.open(this.pageSettings);
          break;
      }
    });
    this.pausedEl.addEventListener('click', () => this.resume());
  }

  private step(delta: number): void {
    if (!this.result) return;
    const plies = this.chess.history().length;
    const at = Math.max(0, Math.min(plies, (this.review ?? plies) + delta));
    this.review = at === plies ? null : at;
    this.renderAll(true);
    if (delta !== 0) this.play('move');
    if (this.analyzing) this.queueAnalysis(140);
  }

  /* --------------------------------------------------------------- dialogs */

  private open(d: HTMLDialogElement): void {
    if (d.open) return;
    d.showModal();
    d.focus({ preventScroll: true });
  }

  private close(d: HTMLDialogElement): void {
    if (d.open) d.close();
  }

  private closeAll(): void {
    for (const d of [this.sheetNew, this.sheetEnd, this.dlgResult, this.pageSettings]) this.close(d);
  }

  /** Android back button: close the top-most layer. Returns false to let the app go to the background. */
  private onBack(): boolean {
    if (this.board.dismiss()) return true;
    if (this.analyzing && !document.querySelector('dialog[open]')) {
      this.leaveAnalysis();
      return true;
    }
    for (const d of [this.pageSettings, this.sheetEnd, this.dlgResult, this.sheetNew]) {
      if (!d.open) continue;
      if (d === this.sheetNew && !this.hasGame) return false;
      this.close(d);
      return true;
    }
    return false;
  }

  private bindDialogs(): void {
    for (const d of [this.sheetNew, this.sheetEnd, this.dlgResult, this.pageSettings]) {
      d.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-close]')) {
          this.close(d);
          return;
        }
        if (target === d && d !== this.pageSettings) {
          const r = d.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside && !(d === this.sheetNew && !this.hasGame)) this.close(d);
        }
      });
      d.addEventListener('cancel', (e) => {
        if (d === this.sheetNew && !this.hasGame) e.preventDefault();
      });
    }
    this.sheetEnd.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-end]');
      if (!btn || !this.hasGame || this.result) return;
      this.close(this.sheetEnd);
      const kind = btn.dataset.end;
      if (kind === 'resign-w') this.finish({ winner: 'b', reason: 'resign' });
      else if (kind === 'resign-b') this.finish({ winner: 'w', reason: 'resign' });
      else this.finish({ winner: null, reason: 'agreement' });
    });
    $('btn-rematch').addEventListener('click', () =>
      this.startGame(this.tc, { chess960: this.chess.isChess960(), startFen: this.chess.startFen() }),
    );
    $('btn-analyze').addEventListener('click', () => {
      this.close(this.dlgResult);
      this.enterAnalysis();
    });
    this.statusEl.addEventListener('click', () => this.showResult());
    $('btn-new').addEventListener('click', () => {
      this.close(this.dlgResult);
      this.openNewGame();
    });
    $('btn-pgn').addEventListener('click', () => {
      void platform.copyText(this.pgn()).then((ok) => this.toast(ok ? 'PGN copied to the clipboard' : 'Could not copy the PGN'));
    });
  }

  private openNewGame(): void {
    const inProgress = this.hasGame && !this.result && this.chess.history().length > 0;
    $('new-note').hidden = !inProgress;
    (this.sheetNew.querySelector('[data-close]') as HTMLElement).hidden = !this.hasGame;
    this.markLastTimeControl();
    this.open(this.sheetNew);
  }

  private describe(r: Result): { title: string; reason: string; score: string } {
    if (r.winner) {
      const loser = colorName(other(r.winner));
      const reason = r.reason === 'checkmate' ? 'Checkmate' : r.reason === 'resign' ? `${loser} resigned` : `${loser} ran out of time`;
      return { title: `${colorName(r.winner)} wins`, reason, score: r.winner === 'w' ? '1–0' : '0–1' };
    }
    const reasons = {
      stalemate: 'Stalemate',
      insufficient: 'Insufficient material',
      threefold: 'Threefold repetition',
      fifty: '50-move rule',
      agreement: 'Agreed by both players',
    };
    const reason =
      r.reason === 'timeout' ? `${colorName(r.flagged)} ran out of time, but ${colorName(other(r.flagged))} can't checkmate` : reasons[r.reason];
    return { title: 'Draw', reason, score: '½–½' };
  }

  private showResult(): void {
    clearTimeout(this.resultTimer);
    const r = this.result;
    if (!r) return;
    const { title, reason, score } = this.describe(r);
    $('result-title').textContent = title;
    $('result-reason').textContent = `${reason} · ${score}`;
    $('btn-rematch').textContent = `Rematch · ${this.chess.isChess960() ? 'Chess960 · ' : ''}${formatTimeControl(this.tc)}`;
    this.open(this.dlgResult);
  }

  /** One quiet line under the board once the game is over: the result, or which move is on display. */
  private renderStatus(): void {
    const r = this.result;
    const parts: (string | Node)[] = [];
    const strong = (text: string) => {
      const b = document.createElement('strong');
      b.textContent = text;
      return b;
    };
    if (r && this.review !== null) {
      const history = this.chess.history();
      const ply = this.review;
      parts.push(strong('Reviewing'));
      if (ply === 0) parts.push(` · starting position · 0 of ${history.length}`);
      else {
        const m = history[ply - 1];
        const num = Math.floor((ply - 1) / 2) + 1;
        parts.push(` · ${num}${m.color === 'w' ? '.' : '…'} ${m.san} · ${ply} of ${history.length}`);
      }
    } else if (r) {
      const { title, reason, score } = this.describe(r);
      parts.push(strong(title), ` · ${reason} · ${score}`);
    }
    if (parts.length) {
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('class', 'icon');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML = '<use href="#i-next"></use>';
      parts.push(chevron);
    }
    this.statusEl.replaceChildren(...parts);
    this.statusEl.hidden = !r;
    this.statusEl.setAttribute('aria-label', r ? `${this.statusEl.textContent ?? ''}. Show the result` : '');
  }

  /* -------------------------------------------------------------- analysis */

  private enterAnalysis(): void {
    if (!this.result || this.analyzing) return;
    this.analyzing = true;
    this.appEl.classList.add('is-analyzing');
    this.engine ??= new Engine(
      (update) => this.renderAnalysis(update),
      (status) => this.renderEngineStatus(status),
    );
    this.renderAll(false);
    this.queueAnalysis(0);
  }

  private leaveAnalysis(): void {
    if (!this.analyzing) return;
    this.analyzing = false;
    clearTimeout(this.analysisTimer);
    this.engine?.stop();
    this.board.setArrows([]);
    this.appEl.classList.remove('is-analyzing');
    this.renderAll(false);
  }

  /** Analyses the position on the board after a short pause, so quick stepping stays smooth. */
  private queueAnalysis(delay: number): void {
    clearTimeout(this.analysisTimer);
    this.board.setArrows([]);
    this.analysisTimer = window.setTimeout(() => this.runAnalysis(), delay);
  }

  private runAnalysis(): void {
    if (!this.analyzing || !this.engine) return;
    const ply = this.review ?? this.chess.history().length;
    const fen = this.reviewFrames()[ply].fen;
    const chess960 = this.chess.isChess960();
    const position = new Chess(fen, { chess960 });
    this.analysisFen = fen;
    this.sanCache.clear();
    const status = position.status();
    if (status.over && (status.reason === 'checkmate' || status.reason === 'stalemate')) {
      this.engine.stop();
      const mated = status.reason === 'checkmate';
      this.renderAnalysis({ lines: [], depth: 0, searching: false }, mated ? `Checkmate. ${colorName(other(position.turn()))} won.` : 'Stalemate.');
      if (mated) {
        this.engineEval.textContent = position.turn() === 'w' ? '0–1' : '1–0';
        this.gaugeWhite.style.width = position.turn() === 'w' ? '0%' : '100%';
      }
      return;
    }
    this.renderAnalysis({ lines: [], depth: 0, searching: true });
    void this.engine.analyze(fen, position.turn(), chess960);
  }

  private renderEngineStatus(status: EngineStatus): void {
    if (!this.analyzing) return;
    if (status === 'loading') this.renderAnalysis({ lines: [], depth: 0, searching: true }, 'Starting the engine…');
    if (status === 'error') this.renderAnalysis({ lines: [], depth: 0, searching: false }, "The engine couldn't start on this device.");
  }

  private renderAnalysis(update: EngineUpdate, note?: string): void {
    if (!this.analyzing) return;
    const best = update.lines[0];
    this.engineEval.textContent = best ? formatScore(best) : '…';
    this.gaugeWhite.style.width = `${(whiteShare(best) * 100).toFixed(1)}%`;
    this.engineMeta.textContent = update.depth ? `Stockfish 19 · depth ${update.depth}` : 'Stockfish 19';

    const items = update.lines.map((line) => {
      const li = document.createElement('li');
      li.className = 'engine-line';
      const score = document.createElement('span');
      score.className = `engine-score ${favoursWhite(line) ? 'is-white' : 'is-black'}`;
      score.textContent = formatScore(line);
      const moves = document.createElement('span');
      moves.className = 'engine-moves';
      this.renderPv(moves, line);
      li.append(score, moves);
      return li;
    });
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'engine-note';
      li.textContent = note ?? (update.searching ? 'Thinking…' : '');
      items.push(li);
    }
    this.engineLines.replaceChildren(...items);

    const arrows: Arrow[] = [];
    update.lines.forEach((line, i) => {
      const uci = line.pv[0];
      if (!uci) return;
      const from = parseSquare(uci.slice(0, 2));
      const to = parseSquare(uci.slice(2, 4));
      if (from >= 0 && to >= 0) arrows.push({ from, to, rank: (i + 1) as 1 | 2 | 3 });
    });
    this.board.setArrows(arrows);
  }

  /** Writes a line in SAN with move numbers ("23. Nf3 Nc6 24. O-O"), the first move in bold. */
  private renderPv(target: HTMLElement, line: EngineLine): void {
    const key = line.pv.slice(0, 12).join(' ');
    let text = this.sanCache.get(key);
    if (text === undefined) {
      const position = new Chess(this.analysisFen, { chess960: this.chess.isChess960() });
      let moveNo = Number(this.analysisFen.split(' ')[5]) || 1;
      const parts: string[] = [];
      for (const uci of line.pv.slice(0, 12)) {
        const turn = position.turn();
        const move = position.moveUci(uci);
        if (!move) break;
        if (turn === 'w') parts.push(`${moveNo}. ${move.san}`);
        else parts.push(parts.length === 0 ? `${moveNo}… ${move.san}` : move.san);
        if (turn === 'b') moveNo++;
      }
      text = parts.join(' ');
      this.sanCache.set(key, text);
    }
    const [first, ...rest] = text.split(' ');
    // Keep the move number with the first move: "23. Nf3" or "23… Nc6".
    const head = /^\d+(\.|…)$/.test(first) && rest.length ? `${first} ${rest.shift()}` : first;
    const b = document.createElement('b');
    b.textContent = head;
    target.replaceChildren(b, rest.length ? ` ${rest.join(' ')}` : '');
  }

  private pgn(): string {
    const r = this.result;
    const res = !r ? '*' : r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '1/2-1/2';
    const d = new Date();
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return this.chess.pgn({
      Event: 'Casual game',
      Site: 'Simple Chess',
      Date: date,
      Round: '-',
      White: 'White',
      Black: 'Black',
      Result: res,
      TimeControl: this.tc.minutes > 0 ? `${Math.round(this.tc.minutes * 60)}+${this.tc.increment}` : '-',
      Termination: r?.reason === 'timeout' ? 'Time forfeit' : r ? 'Normal' : 'Unterminated',
    });
  }

  private toast(text: string): void {
    clearTimeout(this.toastTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.add('is-on');
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('is-on'), 1800);
  }

  /* --------------------------------------------------------- time controls */

  private buildTimeControls(): void {
    const grid = $('tc-grid');
    for (const tc of PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tc';
      b.dataset.tc = `${tc.minutes}+${tc.increment}`;
      const time = document.createElement('span');
      time.className = tc.minutes ? 'tc__time' : 'tc__time tc__time--word';
      time.textContent = formatTimeControl(tc);
      const kind = document.createElement('span');
      kind.className = 'tc__kind';
      kind.textContent = speedName(tc);
      b.append(time, kind);
      b.addEventListener('click', () => this.startGame(tc));
      grid.append(b);
    }

    const toggle = $('custom-toggle');
    const panel = $('custom');
    const min = $('custom-min') as HTMLInputElement;
    const inc = $('custom-inc') as HTMLInputElement;
    min.max = String(MINUTE_STEPS.length - 1);
    inc.max = String(INCREMENT_STEPS.length - 1);
    const saved = read<TimeControl & { chess960?: boolean }>(CUSTOM_KEY);
    const random = $('custom-960') as HTMLInputElement;
    random.checked = saved?.chess960 === true;
    const start = isTimeControl(saved) && saved.minutes > 0 ? saved : { minutes: 5, increment: 3 };
    min.value = String(Math.max(0, MINUTE_STEPS.indexOf(start.minutes)));
    inc.value = String(Math.max(0, INCREMENT_STEPS.indexOf(start.increment)));
    const sync = () => {
      const m = MINUTE_STEPS[Number(min.value)];
      const i = INCREMENT_STEPS[Number(inc.value)];
      $('custom-min-out').textContent = `${minutesLabel(m)} min`;
      $('custom-inc-out').textContent = `${i} sec`;
      for (const r of [min, inc]) r.style.setProperty('--pct', `${(Number(r.value) / Number(r.max)) * 100}%`);
    };
    min.addEventListener('input', sync);
    inc.addEventListener('input', sync);
    sync();
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    $('custom-start').addEventListener('click', () => {
      const tc = { minutes: MINUTE_STEPS[Number(min.value)], increment: INCREMENT_STEPS[Number(inc.value)] };
      write(CUSTOM_KEY, { ...tc, chess960: random.checked });
      this.startGame(tc, { chess960: random.checked });
    });
  }

  private markLastTimeControl(): void {
    let matched = false;
    const chess960 = this.chess.isChess960();
    if (this.hasGame && chess960) ($('custom-960') as HTMLInputElement).checked = true;
    for (const b of document.querySelectorAll<HTMLElement>('#tc-grid .tc')) {
      const on = this.hasGame && !chess960 && b.dataset.tc === `${this.tc.minutes}+${this.tc.increment}`;
      b.classList.toggle('is-last', on);
      matched ||= on;
    }
    const custom = this.hasGame && !matched;
    $('custom-toggle').classList.toggle('is-last', custom);
    if (custom) $('custom-toggle').setAttribute('aria-label', `Custom, last used ${formatTimeControl(this.tc)}`);
    else $('custom-toggle').removeAttribute('aria-label');
    if (!PRESETS.some((p) => sameTc(p, this.tc)) && this.hasGame && this.tc.minutes > 0) {
      ($('custom-min') as HTMLInputElement).value = String(Math.max(0, MINUTE_STEPS.indexOf(this.tc.minutes)));
      ($('custom-inc') as HTMLInputElement).value = String(Math.max(0, INCREMENT_STEPS.indexOf(this.tc.increment)));
      ($('custom-min') as HTMLInputElement).dispatchEvent(new Event('input'));
    }
  }

  /* -------------------------------------------------------------- settings */

  private buildSettings(): void {
    const page = this.pageSettings;
    for (const r of page.querySelectorAll<HTMLInputElement>('input[name="orientation"]')) {
      r.checked = r.value === this.settings.orientation;
      r.addEventListener('change', () => {
        if (!r.checked) return;
        this.update({ orientation: r.value as Orientation });
      });
    }
    for (const sw of page.querySelectorAll<HTMLInputElement>('input[data-setting]')) {
      const key = sw.dataset.setting as keyof Settings;
      sw.checked = Boolean(this.settings[key]);
      sw.addEventListener('change', () => this.update({ [key]: sw.checked } as Partial<Settings>));
    }
    if (!platform.isNative && !('vibrate' in navigator)) $('row-haptics').hidden = true;
    const swatches = $('swatches');
    for (const t of THEMES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.dataset.theme = t.id;
      b.innerHTML = `<span class="swatch__board" style="--sw-light:${t.light};--sw-dark:${t.dark}"></span><span>${t.name}</span>`;
      b.addEventListener('click', () => this.update({ theme: t.id }));
      swatches.append(b);
    }
    $('app-version').textContent = __APP_VERSION__;
    const scroller = page.querySelector('.page__scroll') as HTMLElement;
    const head = page.querySelector('.page__head') as HTMLElement;
    scroller.addEventListener('scroll', () => head.classList.toggle('is-scrolled', scroller.scrollTop > 4), { passive: true });
  }

  private update(patch: Partial<Settings>): void {
    const prevOrientation = this.settings.orientation;
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    if (patch.sound) this.sound.unlock();
    if (this.settings.orientation !== prevOrientation) {
      clearTimeout(this.rotateTimer);
      this.bottom = this.barsBottom = this.desiredBottom();
      this.flipped = this.desiredFlipped();
    }
    this.applySettings();
  }

  private applySettings(): void {
    const s = this.settings;
    this.sound.enabled = s.sound;
    document.body.dataset.theme = s.theme;
    for (const b of document.querySelectorAll<HTMLElement>('#swatches .swatch')) b.setAttribute('aria-checked', String(b.dataset.theme === s.theme));
    this.renderAll(false);
  }

  /* ----------------------------------------------------------- persistence */

  private save(): void {
    if (!this.hasGame) return;
    const game: SavedGame = {
      v: 1,
      tc: this.tc,
      start: this.chess.isChess960() ? this.chess.startFen() : undefined,
      chess960: this.chess.isChess960() || undefined,
      moves: this.chess.history().map((m) => m.uci),
      credits: this.credits,
      clock: this.clock.snapshot(),
      result: this.result,
    };
    write(GAME_KEY, game);
  }

  private restore(): boolean {
    const g = read<SavedGame>(GAME_KEY);
    if (!g || g.v !== 1 || !isTimeControl(g.tc) || !Array.isArray(g.moves)) return false;
    let chess: Chess;
    try {
      chess = new Chess(g.chess960 && typeof g.start === 'string' ? g.start : START_FEN, { chess960: g.chess960 === true });
    } catch {
      return false;
    }
    for (const uci of g.moves) if (!chess.moveUci(uci)) return false;
    this.chess = chess;
    this.tc = g.tc;
    this.credits = Array.isArray(g.credits) ? g.credits.slice(0, g.moves.length) : [];
    this.result = g.result ?? null;
    const remaining: [number, number] | null =
      Array.isArray(g.clock) && g.clock.length === 2 && g.clock.every((n) => typeof n === 'number' && n >= 0) ? g.clock : null;
    this.clock = this.makeClock(this.tc, remaining);
    this.hasGame = true;
    if (this.clock.timed && !this.result && chess.history().length > 0) {
      this.clock.run(sideOf(chess.turn()));
      this.clock.pause();
    }
    this.warned = [this.clock.time(0) < 10_000, this.clock.time(1) < 10_000];
    this.bottom = this.barsBottom = this.desiredBottom();
    this.flipped = this.desiredFlipped();
    this.renderAll(false);
    if (this.result) this.openNewGame();
    return true;
  }

  private onVisibility(): void {
    if (document.hidden) {
      if (this.clock.isTicking) this.pause();
      this.engine?.stop();
      this.save();
    } else if (this.analyzing) this.queueAnalysis(0);
    this.updateAwake();
  }

  private updateAwake(): void {
    platform.setAwake(this.hasGame && !this.result && !this.clock.isPaused && !document.hidden);
  }
}
