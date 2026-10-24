/**
 * Procedurally synthesised board sounds (no audio files to load or decode).
 *
 * Each sound is rendered once into an AudioBuffer using modal synthesis: a few damped
 * resonances with a slight downward pitch glide (the "knock" of wood on wood) plus a very
 * short high-passed noise transient for the contact click. Playback is then just a buffer
 * source, which keeps latency minimal on Android.
 */

export type SoundName = 'move' | 'capture' | 'castle' | 'check' | 'end' | 'low';

interface Mode {
  f: number;
  a: number;
  /** Decay time constant in seconds. */
  d: number;
}

interface Hit {
  at: number;
  gain: number;
  pitch: number;
  modes: Mode[];
  noise: number;
  noiseDecay: number;
  /** Strength of the initial pitch glide. */
  glide: number;
  attack: number;
}

const WOOD: Mode[] = [
  { f: 190, a: 0.5, d: 0.038 },
  { f: 560, a: 0.42, d: 0.026 },
  { f: 1240, a: 0.9, d: 0.015 },
  { f: 2650, a: 0.36, d: 0.0075 },
  { f: 4400, a: 0.16, d: 0.0038 },
];

const WOOD_SHARP: Mode[] = [
  { f: 235, a: 0.45, d: 0.032 },
  { f: 720, a: 0.5, d: 0.022 },
  { f: 1620, a: 1, d: 0.0125 },
  { f: 3350, a: 0.5, d: 0.0065 },
  { f: 5600, a: 0.22, d: 0.0032 },
];

const BELL: Mode[] = [
  { f: 1568, a: 0.55, d: 0.16 },
  { f: 3136, a: 0.12, d: 0.07 },
  { f: 4327, a: 0.06, d: 0.035 },
];

/** Short, bright ping for the low-time warning (E6). */
const PING: Mode[] = [
  { f: 1318.5, a: 1, d: 0.055 },
  { f: 2637, a: 0.15, d: 0.03 },
  { f: 3968.7, a: 0.05, d: 0.015 },
];

function hit(at: number, gain: number, pitch: number, modes: Mode[], noise = 0.34): Hit {
  return { at, gain, pitch, modes, noise, noiseDecay: 0.0023, glide: 0.05, attack: 0.0006 };
}

function tone(at: number, gain: number, pitch: number, modes: Mode[], attack = 0.004): Hit {
  return { at, gain, pitch, modes, noise: 0, noiseDecay: 0.001, glide: 0, attack };
}

export type BufferFactory = (length: number, sampleRate: number) => AudioBuffer;

function render(make: BufferFactory, sr: number, duration: number, level: number, hits: Hit[]): AudioBuffer {
  const n = Math.ceil(duration * sr);
  const buffer = make(n, sr);
  const out = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  const noise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const twoPi = Math.PI * 2;

  for (const h of hits) {
    const start = Math.floor(h.at * sr);
    for (const m of h.modes) {
      let phase = 0;
      for (let i = 0; start + i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t / m.d);
        if (env < 1e-4) break;
        const f = m.f * h.pitch * (1 + h.glide * Math.exp(-t / 0.006));
        phase += (twoPi * f) / sr;
        const attack = t < h.attack ? 0.5 - 0.5 * Math.cos((Math.PI * t) / h.attack) : 1;
        out[start + i] += h.gain * m.a * env * attack * Math.sin(phase);
      }
    }
    if (h.noise > 0) {
      // One-pole high-pass (~1.8 kHz) so the click stays crisp rather than hissy.
      const rc = 1 / (twoPi * 1800);
      const alpha = rc / (rc + 1 / sr);
      let prevIn = 0;
      let prevOut = 0;
      for (let i = 0; start + i < n; i++) {
        const env = Math.exp(-i / sr / h.noiseDecay);
        if (env < 1e-4) break;
        const x = noise() * env;
        const y = alpha * (prevOut + x - prevIn);
        prevIn = x;
        prevOut = y;
        out[start + i] += h.gain * h.noise * y;
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? level / peak : 0;
  const fadeIn = Math.max(1, Math.floor(sr * 0.0003));
  const fadeOut = Math.min(n, Math.floor(sr * Math.max(0.006, duration * 0.05)));
  for (let i = 0; i < n; i++) {
    out[i] *= k;
    if (i < fadeIn) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn);
    if (i >= n - fadeOut) out[i] *= (n - i) / fadeOut;
  }
  return buffer;
}

export function synthesize(sr: number, make: BufferFactory): Map<SoundName, AudioBuffer> {
  const chime: Mode[] = [
    { f: 1, a: 1, d: 0.42 },
    { f: 2, a: 0.16, d: 0.22 },
    { f: 3.01, a: 0.06, d: 0.12 },
    { f: 4.2, a: 0.035, d: 0.08 },
  ];
  const note = (hz: number) => chime.map((m) => ({ ...m, f: m.f * hz }));
  return new Map<SoundName, AudioBuffer>([
    ['move', render(make, sr, 0.18, 0.78, [hit(0, 1, 1, WOOD)])],
    ['capture', render(make, sr, 0.22, 0.9, [hit(0, 1, 1, WOOD_SHARP, 0.5), hit(0.024, 0.5, 0.93, WOOD_SHARP, 0.3)])],
    ['castle', render(make, sr, 0.28, 0.8, [hit(0, 1, 1, WOOD), hit(0.088, 0.85, 0.92, WOOD)])],
    ['check', render(make, sr, 0.36, 0.82, [hit(0, 1, 1, WOOD_SHARP, 0.42), tone(0.03, 0.42, 1, BELL, 0.003)])],
    ['end', render(make, sr, 1.6, 0.6, [tone(0, 0.9, 1, note(783.99)), tone(0.15, 1, 1, note(1046.5))])],
    ['low', render(make, sr, 0.3, 0.5, [tone(0, 1, 1, PING, 0.002)])],
  ]);
}

const RATE = 48000;

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private buffers: Map<SoundName, AudioBuffer> | null = null;

  constructor() {
    // Render the sounds while the app is idle so the first tap never pays for the synthesis.
    // AudioBuffers don't need a context, and one rendered at 48 kHz plays fine at any device rate.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(() => this.prepare());
    else window.setTimeout(() => this.prepare(), 200);
  }

  private prepare(): void {
    if (this.buffers) return;
    try {
      this.buffers = synthesize(RATE, (length, sampleRate) => new AudioBuffer({ length, sampleRate, numberOfChannels: 1 }));
    } catch {
      this.buffers = null;
    }
  }

  /** Must run inside a user gesture the first time (Android autoplay policy). */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.9;
        this.out.connect(this.ctx.destination);
      }
      if (this.ctx.state !== 'running') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ctx || !this.out) return;
    this.prepare();
    const buffer = this.buffers?.get(name);
    if (!buffer) return;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    // A touch of natural variation so repeated moves never sound machine-identical.
    if (name !== 'end') src.playbackRate.value = 0.965 + Math.random() * 0.07;
    src.connect(this.out);
    src.start();
  }
}
