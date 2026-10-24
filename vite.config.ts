import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { serviceWorker } from './scripts/vite-sw-plugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative asset URLs so the same build works on any web path and inside the Android WebView.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    cssMinify: true,
    assetsInlineLimit: 8192,
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
  },
  plugins: [serviceWorker()],
  server: {
    // Reachable from a phone on the same Wi-Fi. A fixed port, because the "Simple Chess Dev"
    // Android build has this address baked in (see scripts/android-dev.mjs).
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 240_000,
  },
});
