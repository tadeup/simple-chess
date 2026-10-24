import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(dir: string, root = dir): string[] {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(listFiles(full, root));
    else out.push(relative(root, full).replace(/\\/g, '/'));
  }
  return out;
}

/**
 * Emits a tiny offline-first service worker that precaches every built file.
 * The cache name is derived from the content, so each release replaces the previous cache.
 */
export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'just-chess-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files: string[] = [];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        files.push(fileName);
        hash.update(fileName);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      for (const file of listFiles(publicDir)) {
        // The engine (about 2 MB) is cached the first time analysis opens instead of at install.
        if (file === 'sw.js' || file.startsWith('engine/')) continue;
        files.push(file);
        hash.update(file);
        hash.update(readFileSync(join(publicDir, file)));
      }
      const assets = ['./', ...files.filter((f) => f !== 'index.html').map((f) => `./${f}`), './index.html'];
      const version = hash.digest('hex').slice(0, 12);
      const source = `// Generated at build time. Offline-first cache for Simple Chess.
const CACHE = 'just-chess-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/engine/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
