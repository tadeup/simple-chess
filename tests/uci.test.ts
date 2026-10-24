import { describe, expect, it } from 'vitest';
import { favoursWhite, formatScore, parseInfo, whiteShare } from '../src/analysis/uci';

describe('UCI info parsing', () => {
  it('reads depth, multipv, score and pv, from White point of view', () => {
    const line =
      'info depth 18 seldepth 24 multipv 2 score cp 35 nodes 812345 nps 412000 hashfull 120 tbhits 0 time 1971 pv e2e4 e7e5 g1f3';
    expect(parseInfo(line, 'w')).toEqual({ multipv: 2, depth: 18, cp: 35, pv: ['e2e4', 'e7e5', 'g1f3'] });
    // The same report when Black is to move means White is worse.
    expect(parseInfo(line, 'b')?.cp).toBe(-35);
  });

  it('handles mate scores and WDL fields', () => {
    const black = parseInfo('info depth 30 multipv 1 score mate 3 wdl 1000 0 0 nodes 10 pv d8h4 g2g3 h4g3', 'b');
    expect(black?.mate).toBe(-3);
    expect(black?.pv[0]).toBe('d8h4');
    expect(parseInfo('info depth 30 score mate -2 pv e1e2', 'w')?.mate).toBe(-2);
  });

  it('ignores bound scores, strings and lines without a pv', () => {
    expect(parseInfo('info depth 12 multipv 1 score cp 80 lowerbound nodes 1000 pv e2e4', 'w')).toBeNull();
    expect(parseInfo('info depth 12 multipv 1 score cp 80 upperbound nodes 1000 pv e2e4', 'w')).toBeNull();
    expect(parseInfo('info string NNUE evaluation using nn-61e7af4bb97d.nnue enabled', 'w')).toBeNull();
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1', 'w')).toBeNull();
    expect(parseInfo('bestmove e2e4 ponder e7e5', 'w')).toBeNull();
    expect(parseInfo('info depth 0 score mate 0', 'w')).toBeNull();
  });

  it('formats scores and the gauge', () => {
    expect(formatScore({ multipv: 1, depth: 1, cp: 84, pv: [] })).toBe('+0.84');
    expect(formatScore({ multipv: 1, depth: 1, cp: -120, pv: [] })).toBe('−1.20');
    expect(formatScore({ multipv: 1, depth: 1, cp: 0, pv: [] })).toBe('0.00');
    expect(formatScore({ multipv: 1, depth: 1, mate: 3, pv: [] })).toBe('#3');
    expect(formatScore({ multipv: 1, depth: 1, mate: -2, pv: [] })).toBe('#−2');
    expect(favoursWhite({ multipv: 1, depth: 1, cp: -1, pv: [] })).toBe(false);
    expect(whiteShare(undefined)).toBe(0.5);
    expect(whiteShare({ multipv: 1, depth: 1, cp: 0, pv: [] })).toBeCloseTo(0.5);
    expect(whiteShare({ multipv: 1, depth: 1, cp: 300, pv: [] })).toBeGreaterThan(0.75);
    expect(whiteShare({ multipv: 1, depth: 1, mate: -1, pv: [] })).toBe(0);
  });
});
