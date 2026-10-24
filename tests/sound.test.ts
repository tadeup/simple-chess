import { describe, expect, it } from 'vitest';
import { synthesize } from '../src/ui/sound';

// Minimal stand-in for AudioBuffer: samples live in a plain Float32Array.
function fakeBuffer(length: number, sampleRate: number): AudioBuffer {
  const data = new Float32Array(length);
  return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data } as unknown as AudioBuffer;
}

describe('synthesised sounds', () => {
  for (const rate of [44100, 48000]) {
    it(`are clean at ${rate} Hz`, () => {
      const sounds = synthesize(rate, fakeBuffer);
      expect([...sounds.keys()].sort()).toEqual(['capture', 'castle', 'check', 'end', 'low', 'move']);
      for (const [name, buffer] of sounds) {
        const x = buffer.getChannelData(0);
        let peak = 0;
        let peakAt = 0;
        for (let i = 0; i < x.length; i++) {
          expect(Number.isFinite(x[i]), `${name} sample ${i}`).toBe(true);
          if (Math.abs(x[i]) > peak) {
            peak = Math.abs(x[i]);
            peakAt = i;
          }
        }
        const rms = (from: number, to: number) => {
          from = Math.max(0, Math.floor(from));
          to = Math.min(x.length, Math.floor(to));
          let s = 0;
          for (let i = from; i < to; i++) s += x[i] * x[i];
          return Math.sqrt(s / Math.max(1, to - from));
        };
        const ms = rate / 1000;
        let loudest = 0;
        for (let at = 0; at + 30 * ms <= x.length; at += 5 * ms) loudest = Math.max(loudest, rms(at, at + 30 * ms));
        expect(peak, `${name} peak`).toBeLessThanOrEqual(0.91);
        expect(peak, `${name} peak`).toBeGreaterThan(0.45);
        // Percussive sounds hit within the first few milliseconds; nothing starts with a click.
        if (name !== 'end' && name !== 'low') expect(peakAt / ms, `${name} attack`).toBeLessThan(8);
        expect(Math.abs(x[0]), `${name} first sample`).toBeLessThan(0.05);
        // Tails decay to silence: the last 5 ms are far quieter than the body.
        expect(rms(x.length - 5 * ms, x.length), `${name} tail`).toBeLessThan(loudest * 0.05);
      }
    });
  }
});
