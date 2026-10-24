export interface TimeControl {
  /** Minutes per side; 0 means no clock. */
  minutes: number;
  /** Increment in seconds added after each move. */
  increment: number;
}

export type Side = 0 | 1;

/**
 * Two-sided chess clock driven by `performance.now()`.
 * It only wakes up when the displayed value changes (each second, or each tenth under 10 s).
 */
export class Clock {
  private rem: [number, number];
  private running: Side | -1 = -1;
  private since = 0;
  private paused = false;
  private timer: number | undefined;

  constructor(
    readonly tc: TimeControl,
    remaining: [number, number] | null,
    private readonly onTick: () => void,
    private readonly onFlag: (side: Side) => void,
  ) {
    const base = tc.minutes * 60_000;
    this.rem = remaining ? [remaining[0], remaining[1]] : [base, base];
  }

  get timed(): boolean {
    return this.tc.minutes > 0;
  }

  get active(): Side | -1 {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isTicking(): boolean {
    return this.timed && this.running !== -1 && !this.paused;
  }

  time(side: Side): number {
    let t = this.rem[side];
    if (side === this.running && !this.paused) t -= performance.now() - this.since;
    return Math.max(0, t);
  }

  snapshot(): [number, number] {
    return [this.time(0), this.time(1)];
  }

  /** Starts counting down for `side` (used for the first move and when resuming a game). */
  run(side: Side): void {
    if (!this.timed) return;
    this.commit();
    this.running = side;
    this.since = performance.now();
    this.schedule();
    this.onTick();
  }

  /** `side` completed a move: optionally credit the increment and start the opponent's clock. */
  press(side: Side, credit: boolean): void {
    if (!this.timed) return;
    this.commit();
    if (credit) this.rem[side] += this.tc.increment * 1000;
    this.running = (side ^ 1) as Side;
    this.since = performance.now();
    this.schedule();
    this.onTick();
  }

  /** Reverses a press after a takeback: removes the credited increment and hands the clock back. */
  unpress(side: Side, credited: boolean): void {
    if (!this.timed) return;
    this.commit();
    if (credited) this.rem[side] = Math.max(1000, this.rem[side] - this.tc.increment * 1000);
    this.running = side;
    this.since = performance.now();
    this.schedule();
    this.onTick();
  }

  pause(): void {
    if (this.paused) return;
    this.commit();
    this.paused = true;
    clearTimeout(this.timer);
    this.onTick();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.since = performance.now();
    this.schedule();
    this.onTick();
  }

  stop(): void {
    this.commit();
    this.running = -1;
    clearTimeout(this.timer);
  }

  private commit(): void {
    const side = this.running;
    if (side !== -1 && !this.paused) {
      const now = performance.now();
      this.rem[side] = Math.max(0, this.rem[side] - (now - this.since));
      this.since = now;
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    const side = this.running;
    if (!this.timed || side === -1 || this.paused) return;
    const t = this.time(side);
    if (t <= 0) {
      this.stop();
      this.onTick();
      this.onFlag(side);
      return;
    }
    const step = t < 10_000 ? 100 : 1000;
    this.timer = window.setTimeout(
      () => {
        this.onTick();
        this.schedule();
      },
      (t % step) + 1,
    );
  }
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function formatClock(ms: number): string {
  if (ms >= 3_600_000) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  if (ms >= 10_000) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }
  const tenths = Math.floor(ms / 100);
  return `0:${pad(Math.floor(tenths / 10))}.${tenths % 10}`;
}

export function formatTimeControl(tc: TimeControl): string {
  if (tc.minutes <= 0) return 'No clock';
  const m = tc.minutes === 0.25 ? '¼' : tc.minutes === 0.5 ? '½' : tc.minutes === 0.75 ? '¾' : String(tc.minutes);
  return `${m} + ${tc.increment}`;
}

/** Lichess-style speed name, based on the estimated game duration (minutes * 60 + 40 * increment). */
export function speedName(tc: TimeControl): string {
  if (tc.minutes <= 0) return 'Casual';
  const estimate = tc.minutes * 60 + tc.increment * 40;
  if (estimate < 180) return 'Bullet';
  if (estimate < 480) return 'Blitz';
  if (estimate < 1500) return 'Rapid';
  return 'Classical';
}
