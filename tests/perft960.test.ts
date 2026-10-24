import { describe, expect, it } from 'vitest';
import { Chess, chess960Fen, parseSquare as sq } from '../src/engine/chess';

// Reference counts computed by Stockfish 19 (UCI_Chess960) with scripts/chess960-oracle.mjs,
// which also cross-checks thousands of positions from random Chess960 games move by move.
const CASES: [name: string, fen: string, depth: number, nodes: number][] = [
  ['start #0', 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1', 4, 201143],
  ['start #1', 'bqnbnrkr/pppppppp/8/8/8/8/PPPPPPPP/BQNBNRKR w HFhf - 0 1', 4, 198393],
  ['start #2', 'bqnnrbkr/pppppppp/8/8/8/8/PPPPPPPP/BQNNRBKR w HEhe - 0 1', 4, 200096],
  ['start #3', 'bqnnrkrb/pppppppp/8/8/8/8/PPPPPPPP/BQNNRKRB w GEge - 0 1', 4, 235990],
  ['start #100', 'qbbnrnkr/pppppppp/8/8/8/8/PPPPPPPP/QBBNRNKR w HEhe - 0 1', 4, 201178],
  ['start #333', 'nrqbkrbn/pppppppp/8/8/8/8/PPPPPPPP/NRQBKRBN w FBfb - 0 1', 4, 136027],
  ['start #518 (classical)', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1', 4, 197281],
  ['start #600', 'rbqnbkrn/pppppppp/8/8/8/8/PPPPPPPP/RBQNBKRN w GAga - 0 1', 4, 200493],
  ['start #777', 'qrkbbnrn/pppppppp/8/8/8/8/PPPPPPPP/QRKBBNRN w GBgb - 0 1', 4, 164507],
  ['start #959', 'rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w CAca - 0 1', 4, 201143],
  ['bqnb1rkr', 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9', 4, 326672],
  ['2nnrbkr', '2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9', 4, 667366],
  ['b1q1rrkb', 'b1q1rrkb/pppppppp/3nn3/8/P7/1PPP4/4PPPP/BQNNRKRB w GE - 1 9', 4, 273318],
  ['qbbnnrkr', 'qbbnnrkr/2pp2pp/p7/1p2pp2/8/P3PP2/1PPP1KPP/QBBNNR1R w hf - 0 9', 4, 382958],
  ['1nbbnrkr', '1nbbnrkr/p1p1ppp1/3p4/1p3P1p/3Pq2P/8/PPP1P1P1/QNBBNRKR w HFhf - 0 9', 4, 1171749],
  ['rook shields the destination', '4k3/8/8/8/8/8/8/rR3K2 w B - 0 1', 4, 22885],
  ['king stays, rook moves', '4k3/8/8/8/8/8/8/6KR w H - 0 1', 4, 5571],
  ['king and rook swap', '4k3/8/8/8/8/8/8/5KR1 w G - 0 1', 4, 5689],
  ['queen-side swap', '4k3/8/8/8/8/8/8/2RK4 w C - 0 1', 4, 6173],
  ['king passes its own rook', '4k3/8/8/8/8/8/8/RK6 w A - 0 1', 4, 5549],
  ['inner rooks on both sides', '1r2k1r1/8/8/8/8/8/8/1R2K1R1 w BGbg - 0 1', 4, 272627],
  ['castling path attacked', '4k3/8/8/8/8/8/5r2/1R2K1R1 w BG - 0 1', 3, 7828],
];

describe('Chess960 perft (matches Stockfish)', () => {
  for (const [name, fen, depth, nodes] of CASES) {
    it(`${name} (depth ${depth})`, () => {
      expect(new Chess(fen, { chess960: true }).perft(depth)).toBe(nodes);
    });
  }
});

describe('Chess960 starting positions', () => {
  it('generates 960 distinct, valid setups, #518 being the classical one', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 960; n++) {
      const fen = chess960Fen(n);
      const rank = fen.split('/')[0];
      seen.add(rank);
      const bishops = [...rank].flatMap((p, i) => (p === 'b' ? [i] : []));
      expect(bishops.length).toBe(2);
      expect((bishops[0] + bishops[1]) % 2, `#${n} ${rank}`).toBe(1);
      const rooks = [...rank].flatMap((p, i) => (p === 'r' ? [i] : []));
      const king = rank.indexOf('k');
      expect(rooks[0] < king && king < rooks[1], `#${n} ${rank}`).toBe(true);
      expect(fen.split('/')[7].startsWith(rank.toUpperCase())).toBe(true);
      expect(new Chess(fen, { chess960: true }).moves().length).toBeGreaterThan(17);
    }
    expect(seen.size).toBe(960);
    expect(chess960Fen(518)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1');
    expect(() => chess960Fen(960)).toThrow();
  });

  it('round-trips Shredder-FEN castling rights', () => {
    const fen = 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9';
    expect(new Chess(fen, { chess960: true }).fen()).toBe(fen);
    // X-FEN letters (outermost rook) are understood too.
    expect(new Chess('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', { chess960: true }).fen()).toBe('4k3/8/8/8/8/8/8/R3K2R w HA - 0 1');
  });
});

describe('Chess960 castling', () => {
  it('castles by moving the king onto its own rook', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/5KR1 w G - 0 1', { chess960: true });
    expect(c.dests().get(sq('f1'))).toContain(sq('g1'));
    const m = c.move(sq('f1'), sq('g1'));
    expect(m?.san).toBe('O-O');
    expect(m?.uci).toBe('f1g1');
    expect(c.get(sq('g1'))).toBe('wk');
    expect(c.get(sq('f1'))).toBe('wr');
    c.undo();
    expect(c.fen()).toBe('4k3/8/8/8/8/8/8/5KR1 w G - 0 1');
  });

  it('lets the king stay put while the rook moves', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/6KR w H - 0 1', { chess960: true });
    const m = c.moveUci('g1h1');
    expect(m?.san).toBe('O-O');
    expect(c.get(sq('g1'))).toBe('wk');
    expect(c.get(sq('f1'))).toBe('wr');
    expect(c.get(sq('h1'))).toBeNull();
  });

  it('refuses to castle when the rook was shielding the king', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/rR3K2 w B - 0 1', { chess960: true });
    expect(c.moveUci('f1b1')).toBeNull();
  });

  it('keeps classical games on king-two-squares castling', () => {
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(c.dests().get(sq('e1'))).toContain(sq('g1'));
    expect(c.dests().get(sq('e1'))).not.toContain(sq('h1'));
    expect(c.move(sq('e1'), sq('g1'))?.uci).toBe('e1g1');
  });

  it('writes Chess960 PGN headers', () => {
    const c = new Chess(chess960Fen(0), { chess960: true });
    c.moveUci('g2g3');
    const pgn = c.pgn();
    expect(pgn).toContain('[Variant "Chess960"]');
    expect(pgn).toContain(`[FEN "${chess960Fen(0)}"]`);
    expect(pgn).toContain('[SetUp "1"]');
  });
});
