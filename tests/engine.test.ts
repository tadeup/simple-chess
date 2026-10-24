import { describe, expect, it } from 'vitest';
import { Chess, parseSquare as sq, START_FEN } from '../src/engine/chess';

function play(c: Chess, ...ucis: string[]) {
  for (const u of ucis) {
    if (!c.moveUci(u)) throw new Error(`illegal move ${u} in ${c.fen()}`);
  }
}

describe('basics', () => {
  it('round-trips the start position', () => {
    const c = new Chess();
    expect(c.fen()).toBe(START_FEN);
    expect(c.turn()).toBe('w');
    expect(c.get(sq('e1'))).toBe('wk');
    expect(c.get(sq('d8'))).toBe('bq');
    expect(c.get(sq('e4'))).toBeNull();
  });

  it('rejects malformed FEN', () => {
    expect(() => new Chess('8/8/8 w - - 0 1')).toThrow();
    expect(() => new Chess('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
  });

  it('lists destinations per origin square', () => {
    const d = new Chess().dests();
    expect(d.get(sq('e2'))?.sort()).toEqual([sq('e3'), sq('e4')].sort());
    expect(d.get(sq('g1'))?.sort()).toEqual([sq('f3'), sq('h3')].sort());
    expect(d.has(sq('e1'))).toBe(false);
  });

  it('rejects illegal moves', () => {
    const c = new Chess();
    expect(c.move(sq('e2'), sq('e5'))).toBeNull();
    expect(c.move(sq('e7'), sq('e5'))).toBeNull();
    expect(c.fen()).toBe(START_FEN);
  });

  it('undo restores the exact previous position', () => {
    const c = new Chess();
    const fens = [c.fen()];
    for (const u of ['e2e4', 'd7d5', 'e4d5', 'g8f6', 'f1b5', 'c7c6', 'd5c6', 'd8d2', 'b1d2', 'b7c6', 'g1f3', 'e7e6', 'e1g1']) {
      play(c, u);
      fens.push(c.fen());
    }
    while (c.history().length) {
      fens.pop();
      c.undo();
      expect(c.fen()).toBe(fens[fens.length - 1]);
    }
    expect(c.undo()).toBeNull();
  });
});

describe('notation', () => {
  it('writes castling, captures, checks and mates', () => {
    const c = new Chess();
    play(c, 'f2f3', 'e7e5', 'g2g4');
    const mate = c.move(sq('d8'), sq('h4'));
    expect(mate?.san).toBe('Qh4#');
    const s = c.status();
    expect(s.over && s.reason === 'checkmate' && s.winner === 'b').toBe(true);
  });

  it('disambiguates by file, rank, and both', () => {
    const files = new Chess('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
    expect(files.move(sq('b1'), sq('d2'))?.san).toBe('Nbd2');
    const ranks = new Chess('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
    expect(ranks.move(sq('a1'), sq('a3'))?.san).toBe('R1a3');
    const rank = new Chess('4k3/8/8/8/8/Q1Q5/8/Q3K3 w - - 0 1');
    expect(rank.move(sq('a1'), sq('b2'))?.san).toBe('Q1b2');
    const both = new Chess('4k3/8/8/8/8/Q7/8/Q1Q1K3 w - - 0 1');
    expect(both.move(sq('a1'), sq('b2'))?.san).toBe('Qa1b2');
  });

  it('handles en passant and promotion', () => {
    const c = new Chess();
    play(c, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    expect(c.fen().split(' ')[3]).toBe('d6');
    expect(c.move(sq('e5'), sq('d6'))?.san).toBe('exd6');
    expect(c.get(sq('d5'))).toBeNull();

    const p = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(p.isPromotion(sq('a7'), sq('a8'))).toBe(true);
    const m = p.move(sq('a7'), sq('a8'), 'n');
    expect(m?.san).toBe('a8=N');
    expect(p.get(sq('a8'))).toBe('wn');
  });

  it('only records an en passant square when a capture is possible', () => {
    const c = new Chess();
    play(c, 'e2e4');
    expect(c.fen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  });

  it('exports PGN', () => {
    const c = new Chess();
    play(c, 'e2e4', 'e7e5', 'g1f3');
    const pgn = c.pgn({ Result: '*' });
    expect(pgn).toContain('[Result "*"]');
    expect(pgn.trim().endsWith('1. e4 e5 2. Nf3 *')).toBe(true);
  });
});

describe('game end', () => {
  it('detects stalemate', () => {
    const s = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status();
    expect(s.over && s.reason).toBe('stalemate');
  });

  it('detects insufficient material', () => {
    expect(new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1').isInsufficientMaterial()).toBe(true);
    expect(new Chess('8/8/8/4k3/8/8/8/4KN2 w - - 0 1').isInsufficientMaterial()).toBe(true);
    expect(new Chess('8/8/8/4k3/8/8/8/4KB2 w - - 0 1').isInsufficientMaterial()).toBe(true);
    // Same-coloured bishops (f5 and f1 are both light): dead position. Opposite colours (g5): not dead.
    expect(new Chess('8/8/8/4kb2/8/8/8/4KB2 w - - 0 1').isInsufficientMaterial()).toBe(true);
    expect(new Chess('8/8/8/4k1b1/8/8/8/4KB2 w - - 0 1').isInsufficientMaterial()).toBe(false);
    expect(new Chess('8/8/8/4kn2/8/8/8/4KN2 w - - 0 1').isInsufficientMaterial()).toBe(false);
    expect(new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1').isInsufficientMaterial()).toBe(false);
  });

  it('detects threefold repetition', () => {
    const c = new Chess();
    play(c, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1');
    expect(c.status().over).toBe(false);
    play(c, 'f6g8');
    const s = c.status();
    expect(s.over && s.reason).toBe('threefold');
  });

  it('detects the fifty-move rule, but mate takes precedence', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    play(c, 'a1a2');
    const s = c.status();
    expect(s.over && s.reason).toBe('fifty');

    const mate = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80');
    play(mate, 'a1a8');
    const m = mate.status();
    expect(m.over && m.reason).toBe('checkmate');
  });

  it('knows when a side can no longer mate (flag fall)', () => {
    expect(new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1').cannotMate('w')).toBe(true);
    // Lone knight vs bare king or king + queen cannot mate; vs a rook it can (helpmate).
    expect(new Chess('8/8/8/4k3/8/8/8/4KN2 w - - 0 1').cannotMate('w')).toBe(true);
    expect(new Chess('8/8/8/3qk3/8/8/8/4KN2 w - - 0 1').cannotMate('w')).toBe(true);
    expect(new Chess('8/8/8/3rk3/8/8/8/4KN2 w - - 0 1').cannotMate('w')).toBe(false);
    // Bishop vs pawn can mate; same-colour bishops cannot.
    expect(new Chess('8/8/8/4k3/4p3/8/8/4KB2 w - - 0 1').cannotMate('w')).toBe(false);
    expect(new Chess('8/8/8/4kb2/8/8/8/4KB2 w - - 0 1').cannotMate('w')).toBe(true);
    expect(new Chess('8/8/8/4k1b1/8/8/8/4KB2 w - - 0 1').cannotMate('w')).toBe(false);
    expect(new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1').cannotMate('w')).toBe(false);
    expect(new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1').cannotMate('b')).toBe(true);
  });

  it('computes material balance', () => {
    const c = new Chess();
    expect(c.materialBalance()).toBe(0);
    play(c, 'e2e4', 'd7d5', 'e4d5');
    expect(c.materialBalance()).toBe(1);
  });
});
