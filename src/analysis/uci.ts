/** One principal variation reported by the engine. */
export interface EngineLine {
  /** 1 for the best line, 2 and 3 for the alternatives. */
  multipv: number;
  depth: number;
  /** Evaluation in centipawns from White's point of view; absent when a mate is found. */
  cp?: number;
  /** Moves until mate from White's point of view: positive means White mates. */
  mate?: number;
  /** The line in UCI notation (e2e4, e7e8q). */
  pv: string[];
}

/**
 * Parses a UCI "info" line into a scored line, converting the score to White's point of view.
 * Returns null for lines without a score and PV, and for bound-only scores, which make the
 * evaluation flicker while the engine narrows its search window.
 */
export function parseInfo(line: string, turn: 'w' | 'b'): EngineLine | null {
  if (!line.startsWith('info ')) return null;
  const t = line.trim().split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let cp: number | undefined;
  let mate: number | undefined;
  let pv: string[] | null = null;
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'string':
        return null;
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const value = Number(t[++i]);
        if (kind === 'cp') cp = value;
        else if (kind === 'mate') mate = value;
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        break;
      }
      case 'wdl':
        i += 3;
        break;
      case 'pv':
        pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  if (!pv || pv.length === 0 || (cp === undefined && mate === undefined)) return null;
  const sign = turn === 'w' ? 1 : -1;
  const out: EngineLine = { multipv, depth, pv };
  if (mate !== undefined) out.mate = mate * sign;
  else if (cp !== undefined) out.cp = cp * sign;
  return out;
}

/** "+0.84", "−1.20", "0.00", "#3" (White mates), "#−2" (Black mates). */
export function formatScore(line: EngineLine): string {
  if (line.mate !== undefined) return line.mate > 0 ? `#${line.mate}` : `#−${-line.mate}`;
  const v = (line.cp ?? 0) / 100;
  if (Math.abs(v) < 0.005) return '0.00';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
}

/** Whether the line favours White (used to colour the score). */
export function favoursWhite(line: EngineLine): boolean {
  return line.mate !== undefined ? line.mate > 0 : (line.cp ?? 0) >= 0;
}

/** White's share of the evaluation gauge, 0..1, using lichess's winning-chances curve. */
export function whiteShare(line: EngineLine | undefined): number {
  if (!line) return 0.5;
  if (line.mate !== undefined) return line.mate > 0 ? 1 : 0;
  const chances = 2 / (1 + Math.exp(-0.00368208 * (line.cp ?? 0))) - 1;
  return 0.5 + chances / 2;
}
