import { parseInfo, type EngineLine } from './uci';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EngineUpdate {
  /** Best lines first; up to three. */
  lines: EngineLine[];
  depth: number;
  searching: boolean;
}

// Stockfish 19, "lite single-threaded" WebAssembly build (see public/engine/SOURCE.txt).
const ENGINE_URL = './engine/stockfish-19-lite-single.js';
const LINES = 3;
const MAX_DEPTH = 22;
const MAX_MS = 20_000;
const FLUSH_MS = 120;

/**
 * Local Stockfish running in a Web Worker, spoken to over UCI.
 * Loaded on first use, so it never slows down app start.
 */
export class Engine {
  status: EngineStatus = 'idle';
  private worker: Worker | null = null;
  private booting: Promise<void> | null = null;
  private waiters: { token: string; resolve: () => void }[] = [];
  /** Bestmoves still owed by searches we abandoned; their output is ignored. */
  private stale = 0;
  private searching = false;
  private turn: 'w' | 'b' = 'w';
  /** Chess960 mode is set once at boot (the engine applies "position" before a queued "setoption"). */
  private chess960 = false;
  private lines = new Map<number, EngineLine>();
  private flushTimer = 0;
  private stopTimer = 0;

  constructor(
    private readonly onUpdate: (update: EngineUpdate) => void,
    private readonly onStatus: (status: EngineStatus) => void,
  ) {}

  /** Analyses a position, replacing any search in progress. */
  async analyze(fen: string, turn: 'w' | 'b', chess960 = false): Promise<void> {
    if (this.worker && chess960 !== this.chess960) this.terminate();
    this.chess960 = chess960;
    try {
      await this.boot();
    } catch {
      return;
    }
    if (!this.worker) return;
    if (this.searching) {
      this.post('stop');
      this.stale++;
    }
    clearTimeout(this.stopTimer);
    this.turn = turn;
    this.lines.clear();
    this.post(`position fen ${fen}`);
    this.post(`go depth ${MAX_DEPTH}`);
    this.searching = true;
    this.stopTimer = window.setTimeout(() => this.stop(), MAX_MS);
    this.flush();
  }

  /** Ends the current search; its last lines stay on screen. */
  stop(): void {
    clearTimeout(this.stopTimer);
    if (this.searching && this.worker) this.post('stop');
  }

  /** Frees the engine's memory. */
  terminate(): void {
    clearTimeout(this.stopTimer);
    clearTimeout(this.flushTimer);
    this.flushTimer = 0;
    this.worker?.terminate();
    this.worker = null;
    this.booting = null;
    this.waiters = [];
    this.searching = false;
    this.stale = 0;
    this.lines.clear();
    this.setStatus('idle');
  }

  private boot(): Promise<void> {
    if (this.booting) return this.booting;
    this.setStatus('loading');
    this.booting = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(ENGINE_URL);
      } catch (error) {
        this.setStatus('error');
        reject(error);
        return;
      }
      this.worker = worker;
      worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
      worker.onerror = (e) => {
        e.preventDefault();
        this.worker?.terminate();
        this.worker = null;
        this.setStatus('error');
        reject(new Error('Stockfish failed to load'));
      };
      this.waitFor('uciok')
        .then(() => {
          this.post(`setoption name UCI_Chess960 value ${this.chess960}`);
          this.post(`setoption name MultiPV value ${LINES}`);
          this.post('setoption name Hash value 32');
          this.post('isready');
          return this.waitFor('readyok');
        })
        .then(() => {
          this.setStatus('ready');
          resolve();
        });
      this.post('uci');
    });
    this.booting.catch(() => {
      this.booting = null;
    });
    return this.booting;
  }

  private setStatus(status: EngineStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.onStatus(status);
  }

  private post(command: string): void {
    this.worker?.postMessage(command);
  }

  private waitFor(token: string): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ token, resolve }));
  }

  private onLine(line: string): void {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      if (line.startsWith(this.waiters[i].token)) {
        this.waiters[i].resolve();
        this.waiters.splice(i, 1);
      }
    }
    if (line.startsWith('bestmove')) {
      if (this.stale > 0) {
        this.stale--;
        return;
      }
      this.searching = false;
      clearTimeout(this.stopTimer);
      this.flush();
      return;
    }
    if (this.stale > 0 || !this.searching) return;
    const info = parseInfo(line, this.turn);
    if (!info) return;
    this.lines.set(info.multipv, info);
    if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = 0;
        this.flush();
      }, FLUSH_MS);
    }
  }

  private flush(): void {
    const lines = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv).slice(0, LINES);
    this.onUpdate({ lines, depth: lines[0]?.depth ?? 0, searching: this.searching });
  }
}
