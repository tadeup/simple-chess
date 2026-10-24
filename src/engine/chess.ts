/**
 * Compact chess rules engine on a 0x88 board.
 *
 * Squares exposed to the rest of the app are 0..63 (index = rank * 8 + file, a1 = 0, h8 = 63).
 * Internally the board is 0x88 (index = rank * 16 + file) so off-board tests are a single mask.
 */

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
/** Piece id used by the UI, e.g. "wk", "bp". */
export type PieceId = `${Color}${PieceType}`;

export interface Move {
  from: number;
  to: number;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  san: string;
  uci: string;
  flags: number;
}

export type DrawReason = 'stalemate' | 'insufficient' | 'threefold' | 'fifty';
export type Status =
  | { over: false }
  | { over: true; reason: 'checkmate'; winner: Color }
  | { over: true; reason: DrawReason };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FLAG_CAPTURE = 1;
export const FLAG_EP = 2;
export const FLAG_CASTLE_K = 4;
export const FLAG_CASTLE_Q = 8;
export const FLAG_DOUBLE = 16;
export const FLAG_PROMO = 32;

const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;
const BLACK = 8;

const KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_D = [17, 15, -17, -15];
const ROOK_D = [16, -16, 1, -1];
const KING_D = [17, 16, 15, 1, -1, -15, -16, -17];
const PROMO_ORDER = [QUEEN, ROOK, BISHOP, KNIGHT];

// Castling rights: bit (1 << index), index = colour * 2 + side (side 0 = king side, 1 = queen side).
const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

const TYPE_CHARS = ' pnbrqk';
const SAN_PIECE = '  NBRQK';
export const FILES = 'abcdefgh';
const PIECE_VALUE = [0, 1, 3, 3, 5, 9, 0];

interface IMove {
  from: number;
  /** For castling: the king's destination (g- or c-file). */
  to: number;
  piece: number;
  captured: number;
  promo: number;
  flags: number;
  /** For castling: the castling rook's square. */
  rook?: number;
}

interface Undo {
  move: IMove;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
}

const to88 = (sq: number) => ((sq >> 3) << 4) | (sq & 7);
const to64 = (sq: number) => ((sq >> 4) << 3) | (sq & 7);
const name88 = (sq: number) => FILES[sq & 7] + ((sq >> 4) + 1);

export function squareName(sq: number): string {
  return FILES[sq & 7] + ((sq >> 3) + 1);
}

export function parseSquare(name: string): number {
  if (name.length !== 2) return -1;
  const f = FILES.indexOf(name[0]);
  const r = name.charCodeAt(1) - 49;
  return f < 0 || r < 0 || r > 7 ? -1 : r * 8 + f;
}

/** Light squares are those where file + rank is odd (a1 is dark). */
export function isLightSquare(sq: number): boolean {
  return ((sq & 7) + (sq >> 3)) % 2 === 1;
}

/**
 * FEN of Chess960 starting position `n` (0..959) in the standard numbering, where 518 is the
 * classical setup. Castling rights are written Shredder-style, as rook files ("HAha").
 */
export function chess960Fen(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 959) throw new Error(`Chess960 position out of range: ${n}`);
  const rank: string[] = new Array(8).fill('');
  let rest = n;
  rank[[1, 3, 5, 7][rest % 4]] = 'b';
  rest = Math.floor(rest / 4);
  rank[[0, 2, 4, 6][rest % 4]] = 'b';
  rest = Math.floor(rest / 4);
  const empty = () => rank.flatMap((p, i) => (p ? [] : [i]));
  rank[empty()[rest % 6]] = 'q';
  rest = Math.floor(rest / 6);
  const knights = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ][rest];
  const free = empty();
  for (const k of knights) rank[free[k]] = 'n';
  const [r1, k, r2] = empty();
  rank[r1] = 'r';
  rank[k] = 'k';
  rank[r2] = 'r';
  const black = rank.join('');
  const castling = `${FILES[r2].toUpperCase()}${FILES[r1].toUpperCase()}${FILES[r2]}${FILES[r1]}`;
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${black.toUpperCase()} w ${castling} - 0 1`;
}

function codeOf(ch: string): number {
  const lower = ch.toLowerCase();
  const t = TYPE_CHARS.indexOf(lower);
  if (t < 1) return -1;
  return ch === lower ? t | BLACK : t;
}

function typeOf(code: number): PieceType {
  return TYPE_CHARS[code & 7] as PieceType;
}

function colorOf(code: number): Color {
  return code & BLACK ? 'b' : 'w';
}

export class Chess {
  private b = new Int8Array(128);
  private side = 0;
  private castling = 0;
  private ep = -1;
  private halfmove = 0;
  private fullmove = 1;
  private kings = [-1, -1];
  private undos: Undo[] = [];
  private records: Move[] = [];
  private keys: string[] = [];
  private legalCache: IMove[] | null = null;
  private initialFen = START_FEN;
  private chess960 = false;
  /** Squares of the castling rooks, indexed like the castling bits (-1 when absent). */
  private castleRooks = [-1, -1, -1, -1];
  /** Rights kept when a piece leaves or lands on each square. */
  private castleMask = new Uint8Array(128).fill(15);

  constructor(fen: string = START_FEN, options: { chess960?: boolean } = {}) {
    this.load(fen, options.chess960 ?? false);
  }

  /* ------------------------------------------------------------------ setup */

  load(fen: string, chess960 = false): void {
    const parts = fen.trim().split(/\s+/);
    const rows = (parts[0] ?? '').split('/');
    if (rows.length !== 8) throw new Error(`Invalid FEN: ${fen}`);
    const b = new Int8Array(128);
    const kings = [-1, -1];
    for (let r = 0; r < 8; r++) {
      const rank = 7 - r;
      let file = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') {
          file += ch.charCodeAt(0) - 48;
          continue;
        }
        const code = codeOf(ch);
        if (code < 0 || file > 7) throw new Error(`Invalid FEN: ${fen}`);
        const sq = (rank << 4) | file;
        b[sq] = code;
        if ((code & 7) === KING) kings[code & BLACK ? 1 : 0] = sq;
        file++;
      }
      if (file !== 8) throw new Error(`Invalid FEN: ${fen}`);
    }
    if (kings[0] < 0 || kings[1] < 0) throw new Error(`Invalid FEN (missing king): ${fen}`);

    this.b = b;
    this.kings = kings;
    this.side = parts[1] === 'b' ? 1 : 0;
    this.chess960 = chess960;
    this.readCastling(parts[2] ?? '-');
    const ep = parts[3] && parts[3] !== '-' ? parseSquare(parts[3]) : -1;
    this.ep = ep >= 0 ? to88(ep) : -1;
    this.halfmove = Math.max(0, parseInt(parts[4] ?? '0', 10) || 0);
    this.fullmove = Math.max(1, parseInt(parts[5] ?? '1', 10) || 1);
    this.undos = [];
    this.records = [];
    this.legalCache = null;
    this.initialFen = fen.trim();
    this.keys = [this.positionKey()];
  }

  reset(): void {
    this.load(START_FEN);
  }

  /**
   * Castling field: K/Q/k/q mean the outermost rook on that side (X-FEN). File letters A-H / a-h
   * name the castling rook exactly (Shredder-FEN, needed for some Chess960 setups).
   */
  private readCastling(field: string): void {
    const b = this.b;
    this.castling = 0;
    this.castleRooks = [-1, -1, -1, -1];
    for (const ch of field) {
      if (ch === '-') continue;
      const white = ch !== ch.toLowerCase();
      const color = white ? 0 : 1;
      const rankBase = white ? 0x00 : 0x70;
      const rook = ROOK | (white ? 0 : BLACK);
      const king = this.kings[color];
      if ((king & 0x70) !== rankBase) continue;
      const kingFile = king & 7;
      const up = ch.toUpperCase();
      let file = -1;
      if (up === 'K') {
        for (let f = 7; f > kingFile; f--) {
          if (b[rankBase | f] === rook) {
            file = f;
            break;
          }
        }
      } else if (up === 'Q') {
        for (let f = 0; f < kingFile; f++) {
          if (b[rankBase | f] === rook) {
            file = f;
            break;
          }
        }
      } else if (up >= 'A' && up <= 'H') {
        file = up.charCodeAt(0) - 65;
        if (b[rankBase | file] !== rook || file === kingFile) file = -1;
      }
      if (file < 0) continue;
      const index = color * 2 + (file > kingFile ? 0 : 1);
      this.castleRooks[index] = rankBase | file;
      this.castling |= 1 << index;
    }
    this.castleMask = new Uint8Array(128).fill(15);
    for (let color = 0; color < 2; color++) {
      if (this.castling & (3 << (color * 2))) this.castleMask[this.kings[color]] &= ~(3 << (color * 2));
    }
    this.castleRooks.forEach((sq, index) => {
      if (sq >= 0) this.castleMask[sq] &= ~(1 << index);
    });
  }

  /* ---------------------------------------------------------------- queries */

  turn(): Color {
    return this.side ? 'b' : 'w';
  }

  isChess960(): boolean {
    return this.chess960;
  }

  /** The FEN the game started from. */
  startFen(): string {
    return this.initialFen;
  }

  get(sq: number): PieceId | null {
    const code = this.b[to88(sq)];
    return code ? (`${colorOf(code)}${typeOf(code)}` as PieceId) : null;
  }

  /** All 64 squares, a1..h8; null for empty squares. */
  placement(): (PieceId | null)[] {
    const out: (PieceId | null)[] = new Array(64);
    for (let sq = 0; sq < 64; sq++) out[sq] = this.get(sq);
    return out;
  }

  history(): readonly Move[] {
    return this.records;
  }

  lastMove(): Move | undefined {
    return this.records[this.records.length - 1];
  }

  inCheck(): boolean {
    return this.attacked(this.kings[this.side], this.side ^ 1);
  }

  /** Square (0..63) of the side-to-move's king when it is in check, otherwise -1. */
  checkSquare(): number {
    return this.inCheck() ? to64(this.kings[this.side]) : -1;
  }

  /** Legal destinations grouped by origin square (promotions collapse to one entry). */
  dests(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (const m of this.legal()) {
      const from = to64(m.from);
      const to = to64(this.target(m));
      let list = map.get(from);
      if (!list) map.set(from, (list = []));
      if (!list.includes(to)) list.push(to);
    }
    return map;
  }

  /** The square a player moves the piece onto: the rook's square when castling in Chess960. */
  private target(m: IMove): number {
    return this.chess960 && m.rook !== undefined ? m.rook : m.to;
  }

  isPromotion(from: number, to: number): boolean {
    const f = to88(from);
    const t = to88(to);
    return this.legal().some((m) => m.from === f && m.to === t && m.promo !== 0);
  }

  moves(): Move[] {
    const legal = this.legal();
    return legal.map((m) => this.record(m, legal));
  }

  status(): Status {
    const legal = this.legal();
    if (legal.length === 0) {
      return this.inCheck() ? { over: true, reason: 'checkmate', winner: this.side ? 'w' : 'b' } : { over: true, reason: 'stalemate' };
    }
    if (this.isInsufficientMaterial()) return { over: true, reason: 'insufficient' };
    if (this.halfmove >= 100) return { over: true, reason: 'fifty' };
    if (this.isThreefoldRepetition()) return { over: true, reason: 'threefold' };
    return { over: false };
  }

  isThreefoldRepetition(): boolean {
    const current = this.keys[this.keys.length - 1];
    let n = 0;
    for (const k of this.keys) if (k === current && ++n >= 3) return true;
    return false;
  }

  /** Neither side can ever mate: K v K, K+minor v K, or only same-coloured bishops. */
  isInsufficientMaterial(): boolean {
    let knights = 0;
    let bishops = 0;
    let bishopSquares = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const t = this.b[sq] & 7;
      if (!t || t === KING) continue;
      if (t === KNIGHT) knights++;
      else if (t === BISHOP) {
        bishops++;
        bishopSquares |= ((sq >> 4) + (sq & 7)) % 2 === 0 ? 1 : 2;
      } else return false;
    }
    if (knights + bishops <= 1) return true;
    return knights === 0 && bishopSquares !== 3;
  }

  /**
   * True when `color` cannot possibly checkmate, even with the opponent's help.
   * Used to score a flag fall as a draw (same rules as lichess).
   */
  cannotMate(color: Color): boolean {
    const own = color === 'b' ? BLACK : 0;
    let ownKnights = 0;
    let ownBishops = 0;
    let ownOther = 0;
    let oppKnightsOrPawns = 0;
    let oppNonQueen = 0;
    let bishopSquares = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const code = this.b[sq];
      const t = code & 7;
      if (!t || t === KING) continue;
      if (t === BISHOP) bishopSquares |= ((sq >> 4) + (sq & 7)) % 2 === 0 ? 1 : 2;
      if ((code & BLACK) === own) {
        if (t === KNIGHT) ownKnights++;
        else if (t === BISHOP) ownBishops++;
        else ownOther++;
      } else {
        if (t === KNIGHT || t === PAWN) oppKnightsOrPawns++;
        if (t !== QUEEN) oppNonQueen++;
      }
    }
    if (ownOther > 0) return false;
    if (ownKnights === 0 && ownBishops === 0) return true;
    if (ownBishops === 0) return ownKnights === 1 && oppNonQueen === 0;
    if (ownKnights === 0) return !(bishopSquares === 3 || oppKnightsOrPawns > 0);
    return false;
  }

  /** Material balance in pawns from White's point of view (P1 N3 B3 R5 Q9). */
  materialBalance(): number {
    let score = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const code = this.b[sq];
      if (code) score += code & BLACK ? -PIECE_VALUE[code & 7] : PIECE_VALUE[code & 7];
    }
    return score;
  }

  /* ---------------------------------------------------------------- actions */

  /** Plays a legal move; promotion defaults to a queen. Returns null when illegal. */
  move(from: number, to: number, promotion?: PieceType): Move | null {
    const f = to88(from);
    const t = to88(to);
    const promoCode = promotion ? TYPE_CHARS.indexOf(promotion) : QUEEN;
    const legal = this.legal();
    let found: IMove | undefined;
    for (const m of legal) {
      if (m.from === f && this.target(m) === t && (m.promo === 0 || (m.promo & 7) === promoCode)) {
        found = m;
        break;
      }
    }
    if (!found) return null;
    const rec = this.record(found, legal);
    this.make(found);
    this.records.push(rec);
    this.keys.push(this.positionKey());
    return rec;
  }

  /** Plays a move given in UCI notation ("e2e4", "e7e8q"). */
  moveUci(uci: string): Move | null {
    const from = parseSquare(uci.slice(0, 2));
    const to = parseSquare(uci.slice(2, 4));
    if (from < 0 || to < 0) return null;
    const p = uci[4] as PieceType | undefined;
    return this.move(from, to, p && 'qrbn'.includes(p) ? p : undefined);
  }

  undo(): Move | null {
    if (this.undos.length === 0 || this.records.length === 0) return null;
    this.unmake();
    this.keys.pop();
    return this.records.pop() ?? null;
  }

  /* ------------------------------------------------------------- notation */

  fen(): string {
    let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const code = this.b[(rank << 4) | file];
        if (!code) {
          empty++;
          continue;
        }
        if (empty) {
          s += empty;
          empty = 0;
        }
        const ch = TYPE_CHARS[code & 7];
        s += code & BLACK ? ch : ch.toUpperCase();
      }
      if (empty) s += empty;
      if (rank > 0) s += '/';
    }
    let c = '';
    if (this.chess960) {
      this.castleRooks.forEach((sq, index) => {
        if (sq >= 0 && this.castling & (1 << index)) c += index < 2 ? FILES[sq & 7].toUpperCase() : FILES[sq & 7];
      });
    } else {
      c = (this.castling & WK ? 'K' : '') + (this.castling & WQ ? 'Q' : '') + (this.castling & BK ? 'k' : '') + (this.castling & BQ ? 'q' : '');
    }
    const ep = this.epCapturable() ? name88(this.ep) : '-';
    return `${s} ${this.side ? 'b' : 'w'} ${c || '-'} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  pgn(headers: Record<string, string> = {}): string {
    const tags: Record<string, string> = { Event: '?', Site: '?', Date: '????.??.??', Round: '-', White: '?', Black: '?', Result: '*', ...headers };
    if (this.chess960) tags.Variant = 'Chess960';
    if (this.initialFen !== START_FEN || this.chess960) {
      tags.SetUp = '1';
      tags.FEN = this.initialFen;
    }
    const head = Object.entries(tags)
      .map(([k, v]) => `[${k} "${v.replace(/["\\]/g, '\\$&')}"]`)
      .join('\n');
    const startBlack = this.initialFen.split(/\s+/)[1] === 'b';
    let moveNo = parseInt(this.initialFen.split(/\s+/)[5] ?? '1', 10) || 1;
    const tokens: string[] = [];
    this.records.forEach((m, i) => {
      if (m.color === 'w') tokens.push(`${moveNo}.`);
      else if (i === 0 && startBlack) tokens.push(`${moveNo}...`);
      tokens.push(m.san);
      if (m.color === 'b') moveNo++;
    });
    tokens.push(tags.Result);
    const lines: string[] = [];
    let line = '';
    for (const tok of tokens) {
      if (line && line.length + tok.length + 1 > 80) {
        lines.push(line);
        line = tok;
      } else line = line ? `${line} ${tok}` : tok;
    }
    if (line) lines.push(line);
    return `${head}\n\n${lines.join('\n')}\n`;
  }

  /* ---------------------------------------------------------------- perft */

  perft(depth: number): number {
    if (depth === 0) return 1;
    const moves: IMove[] = [];
    this.genPseudo(moves);
    const us = this.side;
    let n = 0;
    for (const m of moves) {
      this.make(m);
      if (!this.attacked(this.kings[us], us ^ 1)) n += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return n;
  }

  /* ------------------------------------------------------------- internals */

  private record(m: IMove, legal: IMove[]): Move {
    const rec: Move = {
      from: to64(m.from),
      to: to64(m.to),
      color: colorOf(m.piece),
      piece: typeOf(m.piece),
      san: this.san(m, legal),
      uci: name88(m.from) + name88(this.target(m)) + (m.promo ? TYPE_CHARS[m.promo & 7] : ''),
      flags: m.flags,
    };
    if (m.captured) rec.captured = typeOf(m.captured);
    if (m.promo) rec.promotion = typeOf(m.promo);
    return rec;
  }

  private san(m: IMove, legal: IMove[]): string {
    let s: string;
    if (m.flags & FLAG_CASTLE_K) s = 'O-O';
    else if (m.flags & FLAG_CASTLE_Q) s = 'O-O-O';
    else {
      const t = m.piece & 7;
      const dest = name88(m.to);
      if (t === PAWN) {
        s = m.flags & FLAG_CAPTURE ? `${FILES[m.from & 7]}x${dest}` : dest;
        if (m.promo) s += `=${SAN_PIECE[m.promo & 7]}`;
      } else {
        s = SAN_PIECE[t];
        let ambiguous = false;
        let sameFile = false;
        let sameRank = false;
        for (const o of legal) {
          if (o.piece === m.piece && o.to === m.to && o.from !== m.from) {
            ambiguous = true;
            if ((o.from & 7) === (m.from & 7)) sameFile = true;
            if (o.from >> 4 === m.from >> 4) sameRank = true;
          }
        }
        if (ambiguous) {
          if (!sameFile) s += FILES[m.from & 7];
          else if (!sameRank) s += (m.from >> 4) + 1;
          else s += name88(m.from);
        }
        if (m.flags & FLAG_CAPTURE) s += 'x';
        s += dest;
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length === 0 ? '#' : '+';
    this.unmake();
    return s;
  }

  private legal(): IMove[] {
    if (this.legalCache) return this.legalCache;
    const pseudo: IMove[] = [];
    this.genPseudo(pseudo);
    const us = this.side;
    const out: IMove[] = [];
    for (const m of pseudo) {
      this.make(m);
      if (!this.attacked(this.kings[us], us ^ 1)) out.push(m);
      this.unmake();
    }
    this.legalCache = out;
    return out;
  }

  /** The en passant square only counts (FEN, repetition) when a legal capture onto it exists. */
  private epCapturable(): boolean {
    if (this.ep < 0) return false;
    for (const m of this.legal()) if (m.flags & FLAG_EP) return true;
    return false;
  }

  private positionKey(): string {
    let s = '';
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      s += String.fromCharCode(65 + this.b[sq]);
    }
    return `${s}${this.side}${this.castling}${this.epCapturable() ? this.ep : '-'}`;
  }

  private attacked(sq: number, by: number): boolean {
    const b = this.b;
    const c = by ? BLACK : 0;
    let s: number;
    if (by === 0) {
      s = sq - 15;
      if (!(s & 0x88) && b[s] === PAWN) return true;
      s = sq - 17;
      if (!(s & 0x88) && b[s] === PAWN) return true;
    } else {
      s = sq + 15;
      if (!(s & 0x88) && b[s] === (PAWN | BLACK)) return true;
      s = sq + 17;
      if (!(s & 0x88) && b[s] === (PAWN | BLACK)) return true;
    }
    const knight = KNIGHT | c;
    for (let i = 0; i < 8; i++) {
      s = sq + KNIGHT_D[i];
      if (!(s & 0x88) && b[s] === knight) return true;
    }
    const king = KING | c;
    for (let i = 0; i < 8; i++) {
      s = sq + KING_D[i];
      if (!(s & 0x88) && b[s] === king) return true;
    }
    const queen = QUEEN | c;
    const rook = ROOK | c;
    for (let i = 0; i < 4; i++) {
      const d = ROOK_D[i];
      s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
        s += d;
      }
    }
    const bishop = BISHOP | c;
    for (let i = 0; i < 4; i++) {
      const d = BISHOP_D[i];
      s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        s += d;
      }
    }
    return false;
  }

  private genPseudo(out: IMove[]): void {
    const b = this.b;
    const c = this.side ? BLACK : 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || (p & BLACK) !== c) continue;
      const t = p & 7;
      if (t === PAWN) this.genPawn(sq, p, out);
      else if (t === KNIGHT) this.genStep(sq, p, KNIGHT_D, out);
      else if (t === KING) {
        this.genStep(sq, p, KING_D, out);
        this.genCastle(sq, out);
      } else {
        if (t !== ROOK) this.genSlide(sq, p, BISHOP_D, out);
        if (t !== BISHOP) this.genSlide(sq, p, ROOK_D, out);
      }
    }
  }

  private genStep(sq: number, p: number, deltas: number[], out: IMove[]): void {
    const b = this.b;
    const c = p & BLACK;
    for (let i = 0; i < deltas.length; i++) {
      const to = sq + deltas[i];
      if (to & 0x88) continue;
      const q = b[to];
      if (!q) out.push({ from: sq, to, piece: p, captured: 0, promo: 0, flags: 0 });
      else if ((q & BLACK) !== c) out.push({ from: sq, to, piece: p, captured: q, promo: 0, flags: FLAG_CAPTURE });
    }
  }

  private genSlide(sq: number, p: number, deltas: number[], out: IMove[]): void {
    const b = this.b;
    const c = p & BLACK;
    for (let i = 0; i < deltas.length; i++) {
      const d = deltas[i];
      let to = sq + d;
      while (!(to & 0x88)) {
        const q = b[to];
        if (!q) out.push({ from: sq, to, piece: p, captured: 0, promo: 0, flags: 0 });
        else {
          if ((q & BLACK) !== c) out.push({ from: sq, to, piece: p, captured: q, promo: 0, flags: FLAG_CAPTURE });
          break;
        }
        to += d;
      }
    }
  }

  private genPawn(sq: number, p: number, out: IMove[]): void {
    const b = this.b;
    const black = this.side === 1;
    const c = p & BLACK;
    const fwd = black ? -16 : 16;
    const startRank = black ? 6 : 1;
    const promoRank = black ? 0 : 7;
    const one = sq + fwd;
    if (!(one & 0x88) && !b[one]) {
      if (one >> 4 === promoRank) this.pushPromos(sq, one, p, 0, 0, out);
      else {
        out.push({ from: sq, to: one, piece: p, captured: 0, promo: 0, flags: 0 });
        const two = one + fwd;
        if (sq >> 4 === startRank && !b[two]) out.push({ from: sq, to: two, piece: p, captured: 0, promo: 0, flags: FLAG_DOUBLE });
      }
    }
    for (let i = 0; i < 2; i++) {
      const to = sq + fwd + (i ? 1 : -1);
      if (to & 0x88) continue;
      const q = b[to];
      if (q) {
        if ((q & BLACK) !== c) {
          if (to >> 4 === promoRank) this.pushPromos(sq, to, p, q, FLAG_CAPTURE, out);
          else out.push({ from: sq, to, piece: p, captured: q, promo: 0, flags: FLAG_CAPTURE });
        }
      } else if (to === this.ep) {
        const victim = b[to - fwd];
        if (victim === (PAWN | (c ^ BLACK))) {
          out.push({ from: sq, to, piece: p, captured: victim, promo: 0, flags: FLAG_CAPTURE | FLAG_EP });
        }
      }
    }
  }

  private pushPromos(from: number, to: number, p: number, captured: number, flags: number, out: IMove[]): void {
    const c = p & BLACK;
    for (const t of PROMO_ORDER) out.push({ from, to, piece: p, captured, promo: t | c, flags: flags | FLAG_PROMO });
  }

  /**
   * Castling, standard and Chess960 alike: the king ends on the g- or c-file and the rook beside it
   * on the f- or d-file. Every square either piece crosses or lands on must be empty (apart from the
   * two of them), and the king may not start in, pass through or land on an attacked square. The
   * position after castling still goes through the normal legality check, which catches a rook that
   * was shielding the king's destination.
   */
  private genCastle(sq: number, out: IMove[]): void {
    const b = this.b;
    const us = this.side;
    const them = us ^ 1;
    const color = us ? BLACK : 0;
    const rankBase = us ? 0x70 : 0x00;
    for (let side = 0; side < 2; side++) {
      const index = us * 2 + side;
      if (!(this.castling & (1 << index))) continue;
      const rookFrom = this.castleRooks[index];
      if (rookFrom < 0 || b[rookFrom] !== (ROOK | color)) continue;
      const kingTo = rankBase | (side === 0 ? 6 : 2);
      const rookTo = rankBase | (side === 0 ? 5 : 3);
      const lo = Math.min(sq, kingTo, rookFrom, rookTo);
      const hi = Math.max(sq, kingTo, rookFrom, rookTo);
      let clear = true;
      for (let s = lo; s <= hi; s++) {
        if (s !== sq && s !== rookFrom && b[s]) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const step = kingTo > sq ? 1 : -1;
      let safe = true;
      for (let s = sq; ; s += step) {
        if (this.attacked(s, them)) {
          safe = false;
          break;
        }
        if (s === kingTo) break;
      }
      if (!safe) continue;
      out.push({
        from: sq,
        to: kingTo,
        piece: KING | color,
        captured: 0,
        promo: 0,
        flags: side === 0 ? FLAG_CASTLE_K : FLAG_CASTLE_Q,
        rook: rookFrom,
      });
    }
  }

  private make(m: IMove): void {
    const b = this.b;
    const us = this.side;
    this.undos.push({ move: m, castling: this.castling, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove });
    if (m.rook !== undefined) {
      // Castling: lift both pieces before placing them, since in Chess960 they can swap squares.
      const rookTo = (m.to & 0x70) | (m.flags & FLAG_CASTLE_K ? 5 : 3);
      const rook = b[m.rook];
      b[m.from] = 0;
      b[m.rook] = 0;
      b[m.to] = m.piece;
      b[rookTo] = rook;
    } else {
      b[m.to] = m.promo || m.piece;
      b[m.from] = 0;
      if (m.flags & FLAG_EP) b[us ? m.to + 16 : m.to - 16] = 0;
    }
    if ((m.piece & 7) === KING) this.kings[us] = m.to;
    this.castling &= this.castleMask[m.from] & this.castleMask[m.to];
    this.ep = m.flags & FLAG_DOUBLE ? (m.from + m.to) >> 1 : -1;
    this.halfmove = (m.piece & 7) === PAWN || m.captured ? 0 : this.halfmove + 1;
    if (us) this.fullmove++;
    this.side ^= 1;
    this.legalCache = null;
  }

  private unmake(): void {
    const u = this.undos.pop();
    if (!u) return;
    const m = u.move;
    const b = this.b;
    this.side ^= 1;
    const us = this.side;
    if (m.rook !== undefined) {
      const rookTo = (m.to & 0x70) | (m.flags & FLAG_CASTLE_K ? 5 : 3);
      const rook = b[rookTo];
      b[m.to] = 0;
      b[rookTo] = 0;
      b[m.from] = m.piece;
      b[m.rook] = rook;
    } else {
      b[m.from] = m.piece;
      if (m.flags & FLAG_EP) {
        b[m.to] = 0;
        b[us ? m.to + 16 : m.to - 16] = m.captured;
      } else b[m.to] = m.captured;
    }
    if ((m.piece & 7) === KING) this.kings[us] = m.from;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
    this.legalCache = null;
  }
}
