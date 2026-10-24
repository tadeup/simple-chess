import { FILES, isLightSquare, type Color, type PieceId, type PieceType } from '../engine/chess';

/** Which pieces are drawn upside down: none, Black's (face to face), or all (facing the player to move). */
export type PieceFlip = 'none' | 'black' | 'all';

export interface BoardConfig {
  pieces: (PieceId | null)[];
  /** Colour shown at the bottom of the board. */
  orientation: Color;
  turn: Color;
  movable: boolean;
  dests: Map<number, number[]>;
  lastMove: readonly [number, number] | null;
  check: number;
  /** Pieces drawn upside down for the player across the table. */
  flip: PieceFlip;
  showDests: boolean;
  coordinates: boolean;
}

/** An analysis arrow; rank 1 is the engine's best move, drawn strongest. */
export interface Arrow {
  from: number;
  to: number;
  rank: 1 | 2 | 3;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface BoardHandlers {
  /** The user finished a move. `animate` is true for tap moves, false for drops. */
  move(from: number, to: number, promotion: PieceType | undefined, animate: boolean): void;
  isPromotion(from: number, to: number): boolean;
  autoQueen(): boolean;
  /** Called on every pointer down, inside the user gesture (used to unlock audio). */
  touch?(): void;
}

interface Drag {
  sq: number;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  touch: boolean;
  started: boolean;
  wasSelected: boolean;
  ghost: HTMLElement | null;
  over: number;
}

const MOVE_MS = 140;
const ROTATE_MS = 380;
const SPIN_MS = 260;
const PROMO_ORDER: PieceType[] = ['q', 'n', 'r', 'b'];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

export class Board {
  private readonly inner: HTMLElement;
  private readonly hlLayer: HTMLElement;
  private readonly coordLayer: HTMLElement;
  private readonly pieceLayer: HTMLElement;
  private readonly overEl: HTMLElement;
  private readonly overSquare: HTMLElement;
  private readonly arrowLayer: SVGSVGElement;
  private arrows: Arrow[] = [];
  private promoEl: HTMLElement | null = null;
  private promoDone: ((choice: PieceType | null) => void) | null = null;
  private els = new Map<number, HTMLElement>();
  private timers = new WeakMap<HTMLElement, number>();
  private cfg: BoardConfig;
  private selected = -1;
  private drag: Drag | null = null;
  private rect: DOMRect | null = null;
  private locked = false;
  private rotation: { target: Color; timer: number; resolve: () => void } | null = null;
  private spinTimer = 0;

  constructor(
    readonly el: HTMLElement,
    private readonly handlers: BoardHandlers,
  ) {
    this.cfg = {
      pieces: new Array(64).fill(null),
      orientation: 'w',
      turn: 'w',
      movable: false,
      dests: new Map(),
      lastMove: null,
      check: -1,
      flip: 'none',
      showDests: true,
      coordinates: true,
    };
    this.inner = div('board__inner');
    this.hlLayer = div('board__layer board__hl');
    this.coordLayer = div('board__layer board__coords');
    this.pieceLayer = div('board__layer board__pieces');
    this.overEl = div('drag-over');
    this.overSquare = div('hl hl--over-square');
    this.overSquare.hidden = true;
    this.arrowLayer = document.createElementNS(SVG_NS, 'svg');
    this.arrowLayer.setAttribute('class', 'board__arrows');
    this.arrowLayer.setAttribute('viewBox', '0 0 8 8');
    this.arrowLayer.setAttribute('aria-hidden', 'true');
    this.inner.append(this.hlLayer, this.coordLayer, this.overEl, this.overSquare, this.pieceLayer, this.arrowLayer);
    el.append(this.inner);

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onCancel(e));
    el.addEventListener('lostpointercapture', (e) => this.onCancel(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.setAttribute('aria-label', 'Chessboard');
    el.dataset.orientation = 'w';
    this.renderCoords();
  }

  get orientation(): Color {
    return this.cfg.orientation;
  }

  /** Updates the board. Pieces are diffed so only moved pieces animate. */
  set(next: Partial<BoardConfig>, animate = false): void {
    // An update during a rotation lands the rotation first so geometry stays consistent.
    if (this.rotation) this.finishRotation();
    const prev = this.cfg;
    this.cfg = { ...prev, ...next };
    const piecesChanged = next.pieces !== undefined && next.pieces !== prev.pieces;
    const turned = this.cfg.orientation !== prev.orientation;
    const flipped = this.cfg.flip !== prev.flip;
    if (piecesChanged || turned || !this.cfg.movable || this.cfg.turn !== prev.turn) {
      this.cancelDrag();
      this.closePromotion(null);
      this.selected = -1;
    }
    // Pieces turning to face the other player spin in place; squares and selection stay put.
    if (flipped && !turned && animate && !reducedMotion()) {
      this.el.classList.add('is-turning');
      clearTimeout(this.spinTimer);
      this.spinTimer = window.setTimeout(() => this.el.classList.remove('is-turning'), SPIN_MS + 40);
    }
    if (piecesChanged || turned || flipped) this.renderPieces(animate && !turned && !flipped && !reducedMotion(), turned || flipped);
    if (this.cfg.orientation !== prev.orientation || this.cfg.coordinates !== prev.coordinates) this.renderCoords();
    if (turned) this.renderArrows();
    this.el.dataset.orientation = this.cfg.orientation;
    this.renderHighlights();
  }

  /** Turns the board around to face `orientation`, animating the rotation when allowed. */
  rotateTo(orientation: Color, animate: boolean): Promise<void> {
    if (this.rotation) this.finishRotation();
    if (orientation === this.cfg.orientation) return Promise.resolve();
    if (!animate || reducedMotion()) {
      this.set({ orientation });
      return Promise.resolve();
    }
    this.locked = true;
    this.cancelDrag();
    this.closePromotion(null);
    this.selected = -1;
    this.renderHighlights();
    this.el.classList.add('is-rotating');
    for (const [sq, el] of this.els) {
      const [x, y] = this.xy(sq);
      const pending = this.timers.get(el);
      if (pending) clearTimeout(pending);
      el.classList.remove('is-moving');
      el.style.transform = `translate(${x * 100}%, ${y * 100}%) rotate(-180deg)`;
    }
    this.inner.style.rotate = '180deg';
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => this.finishRotation(), ROTATE_MS + 20);
      this.rotation = { target: orientation, timer, resolve };
    });
  }

  /** Swaps the half-turned board for the real flipped layout; both look identical. */
  private finishRotation(): void {
    const r = this.rotation;
    if (!r) return;
    this.rotation = null;
    clearTimeout(r.timer);
    this.el.classList.remove('is-rotating');
    this.inner.style.rotate = '';
    this.cfg = { ...this.cfg, orientation: r.target };
    this.el.dataset.orientation = r.target;
    for (const [sq, el] of this.els) this.place(el, sq, false);
    this.renderCoords();
    this.renderHighlights();
    this.renderArrows();
    this.locked = false;
    r.resolve();
  }

  /** Shows engine arrows (best move strongest); an empty list clears them. */
  setArrows(arrows: Arrow[]): void {
    const same =
      arrows.length === this.arrows.length && arrows.every((a, i) => a.from === this.arrows[i].from && a.to === this.arrows[i].to && a.rank === this.arrows[i].rank);
    if (same) return;
    this.arrows = arrows;
    this.renderArrows();
  }

  /** Closes the promotion picker if it is open (Android back button). Returns whether it was. */
  dismiss(): boolean {
    if (!this.promoEl) return false;
    this.closePromotion(null);
    return true;
  }

  /** Drops any selection, drag, or open promotion picker. */
  reset(): void {
    this.cancelDrag();
    this.closePromotion(null);
    this.selected = -1;
    this.renderHighlights();
  }

  /* ---------------------------------------------------------------- render */

  private xy(sq: number): [number, number] {
    const file = sq & 7;
    const rank = sq >> 3;
    return this.cfg.orientation === 'w' ? [file, 7 - rank] : [7 - file, rank];
  }

  private squareFromXY(x: number, y: number): number {
    return this.cfg.orientation === 'w' ? (7 - y) * 8 + x : y * 8 + (7 - x);
  }

  /** Rotation in degrees for a piece id ("wk", "bp", ...) under the current flip mode. */
  private flipOf(piece: string): number {
    const f = this.cfg.flip;
    return f === 'all' || (f === 'black' && piece[0] === 'b') ? 180 : 0;
  }

  private pieceTransform(sq: number, piece: string): string {
    const [x, y] = this.xy(sq);
    return `translate(${x * 100}%, ${y * 100}%) rotate(${this.flipOf(piece)}deg)`;
  }

  private place(el: HTMLElement, sq: number, animate: boolean): void {
    const transform = this.pieceTransform(sq, el.dataset.piece ?? '');
    const pending = this.timers.get(el);
    if (pending) clearTimeout(pending);
    if (animate) {
      el.classList.add('is-moving');
      el.style.transform = transform;
      this.timers.set(
        el,
        window.setTimeout(() => el.classList.remove('is-moving'), MOVE_MS + 40),
      );
    } else {
      el.classList.remove('is-moving');
      el.style.transform = transform;
    }
  }

  private createPiece(piece: PieceId): HTMLElement {
    const el = div(`piece ${piece}`);
    el.dataset.piece = piece;
    this.pieceLayer.append(el);
    return el;
  }

  private renderPieces(animate: boolean, geometry: boolean): void {
    const { pieces } = this.cfg;
    const old = new Map(this.els);
    const next = new Map<number, HTMLElement>();
    const missing: number[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = pieces[sq];
      if (!p) continue;
      const el = old.get(sq);
      if (el && el.dataset.piece === p) {
        next.set(sq, el);
        old.delete(sq);
        // A piece mid-drag keeps following the finger; its next move applies the new geometry.
        if (geometry && el !== this.drag?.el) this.place(el, sq, false);
      } else missing.push(sq);
    }
    const leftovers = [...old.entries()];
    for (const sq of missing) {
      const p = pieces[sq] as PieceId;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < leftovers.length; i++) {
        const [osq, el] = leftovers[i];
        if (el.dataset.piece !== p) continue;
        const d = Math.hypot((osq & 7) - (sq & 7), (osq >> 3) - (sq >> 3));
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (best >= 0) {
        const [, el] = leftovers.splice(best, 1)[0];
        next.set(sq, el);
        this.place(el, sq, animate);
      } else {
        const el = this.createPiece(p);
        this.place(el, sq, false);
        if (animate) el.classList.add('is-entering');
        next.set(sq, el);
      }
    }
    for (const [, el] of leftovers) {
      if (animate) {
        el.classList.add('is-fading');
        setTimeout(() => el.remove(), MOVE_MS + 40);
      } else el.remove();
    }
    this.els = next;
  }

  private renderHighlights(): void {
    const { lastMove, check, dests, showDests, pieces } = this.cfg;
    const frag = document.createDocumentFragment();
    const add = (sq: number, cls: string) => {
      const d = div(`hl ${cls}`);
      const [x, y] = this.xy(sq);
      d.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      frag.append(d);
    };
    if (lastMove) {
      add(lastMove[0], 'hl--last');
      add(lastMove[1], 'hl--last');
    }
    if (check >= 0) add(check, 'hl--check');
    if (this.selected >= 0) {
      add(this.selected, 'hl--selected');
      if (showDests) for (const to of dests.get(this.selected) ?? []) add(to, pieces[to] ? 'hl--capture' : 'hl--dest');
    }
    this.hlLayer.replaceChildren(frag);
  }

  private renderArrows(): void {
    const frag = document.createDocumentFragment();
    // Weaker lines first so the best move is drawn on top.
    for (const a of [...this.arrows].sort((x, y) => y.rank - x.rank)) {
      const [fx, fy] = this.xy(a.from);
      const [tx, ty] = this.xy(a.to);
      const x1 = fx + 0.5;
      const y1 = fy + 0.5;
      const x2 = tx + 0.5;
      const y2 = ty + 0.5;
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len === 0) continue;
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      const nx = -uy;
      const ny = ux;
      const best = a.rank === 1;
      const shaft = best ? 0.2 : 0.14;
      const headW = best ? 0.52 : 0.4;
      const headL = best ? 0.46 : 0.36;
      const sx = x2 - ux * headL;
      const sy = y2 - uy * headL;
      const pt = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`;
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute(
        'points',
        [
          pt(x1 + (nx * shaft) / 2, y1 + (ny * shaft) / 2),
          pt(sx + (nx * shaft) / 2, sy + (ny * shaft) / 2),
          pt(sx + (nx * headW) / 2, sy + (ny * headW) / 2),
          pt(x2, y2),
          pt(sx - (nx * headW) / 2, sy - (ny * headW) / 2),
          pt(sx - (nx * shaft) / 2, sy - (ny * shaft) / 2),
          pt(x1 - (nx * shaft) / 2, y1 - (ny * shaft) / 2),
        ].join(' '),
      );
      poly.setAttribute('class', `arrow arrow--${a.rank}`);
      frag.append(poly);
    }
    this.arrowLayer.replaceChildren(frag);
  }

  private renderCoords(): void {
    const frag = document.createDocumentFragment();
    if (this.cfg.coordinates) {
      for (let i = 0; i < 8; i++) {
        const fileSq = this.squareFromXY(i, 7);
        const f = div(`coord coord--file ${isLightSquare(fileSq) ? 'on-light' : 'on-dark'}`);
        f.textContent = FILES[fileSq & 7];
        f.style.transform = `translate(${i * 100}%, 700%)`;
        const rankSq = this.squareFromXY(0, i);
        const r = div(`coord coord--rank ${isLightSquare(rankSq) ? 'on-light' : 'on-dark'}`);
        r.textContent = String((rankSq >> 3) + 1);
        r.style.transform = `translate(0, ${i * 100}%)`;
        frag.append(f, r);
      }
    }
    this.coordLayer.replaceChildren(frag);
  }

  /* ----------------------------------------------------------------- input */

  private squareAt(clientX: number, clientY: number): number {
    const r = this.rect ?? this.el.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * 8);
    const y = Math.floor(((clientY - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return this.squareFromXY(x, y);
  }

  private isDest(from: number, to: number): boolean {
    return this.cfg.dests.get(from)?.includes(to) ?? false;
  }

  private select(sq: number): void {
    if (this.selected === sq) return;
    this.selected = sq;
    this.renderHighlights();
  }

  private onDown(e: PointerEvent): void {
    this.handlers.touch?.();
    if (this.promoEl && this.promoEl.contains(e.target as Node)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.drag || this.locked || !this.cfg.movable) return;
    this.rect = this.el.getBoundingClientRect();
    const sq = this.squareAt(e.clientX, e.clientY);
    if (sq < 0) return;
    e.preventDefault();

    if (this.selected >= 0 && this.selected !== sq && this.isDest(this.selected, sq)) {
      this.attempt(this.selected, sq, true);
      return;
    }
    const piece = this.cfg.pieces[sq];
    const el = this.els.get(sq);
    if (!piece || piece[0] !== this.cfg.turn || !el) {
      this.select(-1);
      return;
    }
    const wasSelected = this.selected === sq;
    this.select(sq);
    this.drag = {
      sq,
      el,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      touch: e.pointerType !== 'mouse',
      started: false,
      wasSelected,
      ghost: null,
      over: -1,
    };
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail if the pointer is already gone */
    }
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.started) {
      const threshold = d.touch ? 5 : 3;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < threshold) return;
      d.started = true;
      const pending = this.timers.get(d.el);
      if (pending) clearTimeout(pending);
      d.el.classList.remove('is-moving');
      d.el.classList.add('is-dragging');
      d.ghost = div(`piece ${d.el.dataset.piece} is-ghost`);
      d.ghost.style.transform = this.pieceTransform(d.sq, d.el.dataset.piece ?? '');
      this.pieceLayer.prepend(d.ghost);
    }
    this.positionDrag(d, e.clientX, e.clientY);
  }

  private positionDrag(d: Drag, clientX: number, clientY: number): void {
    const r = this.rect ?? this.el.getBoundingClientRect();
    const size = r.width / 8;
    // In the inner (possibly rotated) frame the board is never rotated while dragging.
    const flip = this.flipOf(d.el.dataset.piece ?? '');
    // On touch the piece lifts clear of the finger, toward the top of the screen as its owner sees it.
    const lift = d.touch ? size * 0.42 : 0;
    const px = clientX - r.left - size / 2;
    const py = clientY - r.top - size / 2 - (flip ? -lift : lift);
    const scale = d.touch ? 1.45 : 1.08;
    d.el.style.transform = `translate(${px}px, ${py}px) rotate(${flip}deg) scale(${scale})`;

    const over = this.squareAt(clientX, clientY);
    if (over === d.over) return;
    d.over = over;
    const legal = over >= 0 && over !== d.sq && this.isDest(d.sq, over);
    if (legal) {
      const [x, y] = this.xy(over);
      if (d.touch) {
        this.overEl.style.transform = `translate(${(x - 0.5) * 50}%, ${(y - 0.5) * 50}%)`;
        this.overEl.classList.add('is-on');
      } else {
        this.overSquare.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
        this.overSquare.hidden = false;
      }
    } else {
      this.overEl.classList.remove('is-on');
      this.overSquare.hidden = true;
    }
  }

  private endDragVisuals(d: Drag): void {
    d.el.classList.remove('is-dragging');
    d.ghost?.remove();
    d.ghost = null;
    this.overEl.classList.remove('is-on');
    this.overSquare.hidden = true;
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!d.started) {
      if (d.wasSelected) this.select(-1);
      return;
    }
    this.endDragVisuals(d);
    const to = this.squareAt(e.clientX, e.clientY);
    if (to >= 0 && to !== d.sq && this.isDest(d.sq, to)) {
      this.attempt(d.sq, to, false);
    } else {
      this.place(d.el, d.sq, true);
      if (to !== d.sq) this.select(-1);
    }
  }

  private onCancel(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.cancelDrag();
  }

  private cancelDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.started) {
      this.endDragVisuals(d);
      this.place(d.el, d.sq, false);
    }
  }

  private attempt(from: number, to: number, animate: boolean): void {
    if (!this.handlers.isPromotion(from, to) || this.handlers.autoQueen()) {
      this.selected = -1;
      this.handlers.move(from, to, this.handlers.isPromotion(from, to) ? 'q' : undefined, animate);
      return;
    }
    // Show the pawn on its promotion square while the player picks a piece.
    const pawn = this.els.get(from);
    if (pawn) this.place(pawn, to, animate);
    this.selected = -1;
    this.renderHighlights();
    this.openPromotion(to).then((choice) => {
      if (choice) this.handlers.move(from, to, choice, false);
      else if (pawn && this.els.get(from) === pawn) this.place(pawn, from, true);
    });
  }

  private openPromotion(to: number): Promise<PieceType | null> {
    this.closePromotion(null);
    const color = this.cfg.turn;
    const [x, y] = this.xy(to);
    const dir = y === 0 ? 1 : -1;
    const layer = div('promo');
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'Promote to');
    const names: Record<string, string> = { q: 'Queen', n: 'Knight', r: 'Rook', b: 'Bishop' };
    PROMO_ORDER.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo__opt';
      btn.dataset.piece = t;
      btn.setAttribute('aria-label', names[t]);
      btn.style.transform = `translate(${x * 100}%, ${(y + i * dir) * 100}%)`;
      const img = div(`promo__piece ${color}${t}`);
      if (this.flipOf(`${color}${t}`)) img.classList.add('is-flipped');
      btn.append(img);
      layer.append(btn);
    });
    // A choice needs a press that starts and ends inside the picker. The tap that opened it
    // would otherwise produce a click on the option that appeared under the finger.
    const optionAt = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('.promo__opt');
    let pressed: HTMLElement | 'backdrop' | null = null;
    layer.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      pressed = optionAt(ev) ?? 'backdrop';
    });
    layer.addEventListener('pointerup', (ev) => {
      ev.stopPropagation();
      const opt = optionAt(ev);
      if (opt && opt === pressed) this.closePromotion(opt.dataset.piece as PieceType);
      else if (!opt && pressed === 'backdrop') this.closePromotion(null);
      pressed = null;
    });
    layer.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const opt = optionAt(ev);
      // detail === 0 means keyboard activation (Enter or Space).
      if (ev.detail === 0 && opt) this.closePromotion(opt.dataset.piece as PieceType);
    });
    layer.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.closePromotion(null);
    });
    this.el.append(layer);
    this.promoEl = layer;
    (layer.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
    return new Promise((resolve) => {
      this.promoDone = resolve;
    });
  }

  private closePromotion(choice: PieceType | null): void {
    const done = this.promoDone;
    this.promoEl?.remove();
    this.promoEl = null;
    this.promoDone = null;
    done?.(choice);
  }
}
