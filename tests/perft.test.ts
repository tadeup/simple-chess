import { describe, expect, it } from 'vitest';
import { Chess } from '../src/engine/chess';

// Reference counts from the Chess Programming Wiki and Peter Ellis Jones' perft suite.
const CASES: [name: string, fen: string, depth: number, nodes: number][] = [
  ['initial', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 5, 4865609],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 4, 4085603],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
  ['position 4 mirrored', 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', 4, 422333],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 4, 2103487],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', 4, 3894594],
  ['illegal ep #1', '3k4/3p4/8/K1P4r/8/8/8/8 b - - 0 1', 6, 1134888],
  ['illegal ep #2', '8/8/4k3/8/2p5/8/B2P2K1/8 w - - 0 1', 6, 1015133],
  ['ep capture checks opponent', '8/8/1k6/2b5/2pP4/8/5K2/8 b - d3 0 1', 6, 1440467],
  ['short castling gives check', '5k2/8/8/8/8/8/8/4K2R w K - 0 1', 6, 661072],
  ['long castling gives check', '3k4/8/8/8/8/8/8/R3K3 w Q - 0 1', 6, 803711],
  ['castle rights', 'r3k2r/1b4bq/8/8/8/8/7B/R3K2R w KQkq - 0 1', 4, 1274206],
  ['castling prevented', 'r3k2r/8/3Q4/8/8/5q2/8/R3K2R b KQkq - 0 1', 4, 1720476],
  ['promote out of check', '2K2r2/4P3/8/8/8/8/8/3k4 w - - 0 1', 6, 3821001],
  ['discovered check', '8/8/1P2K3/8/2n5/1q6/8/5k2 b - - 0 1', 5, 1004658],
  ['promote to give check', '4k3/1P6/8/8/8/8/K7/8 w - - 0 1', 6, 217342],
  ['under-promote to give check', '8/P1k5/K7/8/8/8/8/8 w - - 0 1', 6, 92683],
  ['self stalemate', 'K1k5/8/P7/8/8/8/8/8 w - - 0 1', 6, 2217],
  ['stalemate and checkmate #1', '8/k1P5/8/1K6/8/8/8/8 w - - 0 1', 7, 567584],
  ['stalemate and checkmate #2', '8/8/2k5/5q2/5n2/8/5K2/8 b - - 0 1', 4, 23527],
];

describe('perft', () => {
  for (const [name, fen, depth, nodes] of CASES) {
    it(`${name} (depth ${depth})`, () => {
      expect(new Chess(fen).perft(depth)).toBe(nodes);
    });
  }

  it('shallow depths of the initial position', () => {
    const c = new Chess();
    expect([1, 2, 3, 4].map((d) => c.perft(d))).toEqual([20, 400, 8902, 197281]);
  });
});
