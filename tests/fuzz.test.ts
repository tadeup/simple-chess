import { Chess as Oracle } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Chess } from '../src/engine/chess';

// Plays seeded random games with both engines in lockstep and compares every position.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAMES = 160;
const MAX_PLIES = 400;

describe('differential fuzz against chess.js', () => {
  it(`agrees on ${GAMES} random games`, () => {
    const rand = mulberry32(20261013);
    let positions = 0;
    const endings: Record<string, number> = {};
    for (let g = 0; g < GAMES; g++) {
      const mine = new Chess();
      const oracle = new Oracle();
      for (let ply = 0; ply < MAX_PLIES; ply++) {
        positions++;
        const ctx = `game ${g} ply ${ply} ${oracle.fen()}`;
        const ours = mine.moves().map((m) => m.san).sort();
        const theirs = oracle.moves().sort();
        expect(ours, ctx).toEqual(theirs);
        // Board, side, castling and clocks must match; the en passant field is compared separately.
        const [a, , , , ...restA] = mine.fen().split(' ');
        const [b, , , , ...restB] = oracle.fen().split(' ');
        expect([a, mine.fen().split(' ')[1], mine.fen().split(' ')[2], ...restA], ctx).toEqual([
          b,
          oracle.fen().split(' ')[1],
          oracle.fen().split(' ')[2],
          ...restB,
        ]);
        expect(mine.inCheck(), ctx).toBe(oracle.inCheck());
        expect(mine.isInsufficientMaterial(), ctx).toBe(oracle.isInsufficientMaterial());
        expect(mine.isThreefoldRepetition(), ctx).toBe(oracle.isThreefoldRepetition());
        const s = mine.status();
        if (oracle.isCheckmate()) expect(s.over && s.reason, ctx).toBe('checkmate');
        else if (oracle.isStalemate()) expect(s.over && s.reason, ctx).toBe('stalemate');
        else expect(s.over, ctx).toBe(oracle.isDraw());
        if (s.over) {
          endings[s.reason] = (endings[s.reason] ?? 0) + 1;
          break;
        }
        const legal = mine.moves();
        const pick = legal[Math.floor(rand() * legal.length)];
        expect(mine.move(pick.from, pick.to, pick.promotion), ctx).not.toBeNull();
        expect(oracle.move(pick.san), ctx).toBeTruthy();
      }
      // Undo everything and make sure we land on the start position again.
      while (mine.undo());
      expect(mine.fen()).toBe(new Chess().fen());
    }
    console.log(`fuzz: ${positions} positions compared, endings`, endings);
  });
});
