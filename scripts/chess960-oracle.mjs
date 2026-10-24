// Cross-checks the Chess960 move generator against Stockfish (the engine bundled in public/engine).
// Usage: node scripts/chess960-oracle.mjs [games]    (Node 23.6+ runs the TypeScript engine directly)
//
// 1. Plays seeded random games from random Chess960 starts and, at every position, compares our
//    legal moves (UCI, king-onto-rook castling) with Stockfish's `go perft 1`, plus perft 3 every
//    few plies.
// 2. Prints perft totals for a fixed set of positions, used as fixtures in tests/perft960.test.ts.
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess, chess960Fen } from '../src/engine/chess.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const games = Number(process.argv[2] ?? 60);

// The engine script is CommonJS, but this package is "type": "module": run a .cjs copy (with its .wasm).
const engineDir = mkdtempSync(join(tmpdir(), 'just-chess-sf-'));
copyFileSync(join(root, 'public', 'engine', 'stockfish-19-lite-single.js'), join(engineDir, 'stockfish-19-lite-single.cjs'));
copyFileSync(join(root, 'public', 'engine', 'stockfish-19-lite-single.wasm'), join(engineDir, 'stockfish-19-lite-single.wasm'));
const sf = spawn(process.execPath, [join(engineDir, 'stockfish-19-lite-single.cjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
let waiting = null;
sf.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    waiting?.(line);
  }
});
const send = (cmd) => sf.stdin.write(`${cmd}\n`);
const until = (test, collect) =>
  new Promise((resolve) => {
    waiting = (line) => {
      collect?.(line);
      if (test(line)) {
        waiting = null;
        resolve(line);
      }
    };
  });

async function perft(fen, depth) {
  const divide = new Map();
  send(`position fen ${fen}`);
  send(`go perft ${depth}`);
  const last = await until(
    (l) => l.startsWith('Nodes searched'),
    (l) => {
      const m = /^([a-h][1-8][a-h][1-8][qrbn]?): (\d+)$/.exec(l);
      if (m) divide.set(m[1], Number(m[2]));
    },
  );
  return { nodes: Number(last.split(':')[1]), divide };
}

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

send('uci');
await until((l) => l === 'uciok');
send('setoption name UCI_Chess960 value true');
send('isready');
await until((l) => l === 'readyok');

// ---- 1. random games
const rand = rng(960);
let positions = 0;
let deep = 0;
let castles = 0;
let failures = 0;
for (let g = 0; g < games && failures < 5; g++) {
  const sp = Math.floor(rand() * 960);
  const chess = new Chess(chess960Fen(sp), { chess960: true });
  for (let ply = 0; ply < 120 && failures < 5; ply++) {
    const fen = chess.fen();
    const ours = chess.moves();
    const theirs = await perft(fen, 1);
    positions++;
    const a = ours.map((m) => m.uci).sort();
    const b = [...theirs.divide.keys()].sort();
    if (a.join(' ') !== b.join(' ')) {
      failures++;
      console.log(`MISMATCH SP ${sp} ply ${ply} ${fen}\n  ours:      ${a.join(' ')}\n  stockfish: ${b.join(' ')}`);
      break;
    }
    if (ply % 7 === 3) {
      const ref = await perft(fen, 3);
      const mine = chess.perft(3);
      deep++;
      if (ref.nodes !== mine) {
        failures++;
        console.log(`PERFT 3 MISMATCH SP ${sp} ply ${ply} ${fen}: ours ${mine}, stockfish ${ref.nodes}`);
      }
    }
    if (!ours.length) break;
    castles += ours.filter((m) => m.san.startsWith('O-O')).length;
    const pick = ours[Math.floor(rand() * ours.length)];
    chess.move(pick.from, pick.to, pick.promotion);
  }
}
console.log(`random games: ${positions} positions compared, ${deep} perft-3 checks, ${castles} castling moves seen, ${failures} failures`);

// ---- 2. fixtures
const fixtures = [
  ...[0, 1, 2, 3, 100, 333, 518, 600, 777, 959].map((n) => [`start #${n}`, chess960Fen(n), 4]),
  ['bqnb1rkr fixture', 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9', 4],
  ['2nnrbkr fixture', '2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9', 4],
  ['b1q1rrkb fixture', 'b1q1rrkb/pppppppp/3nn3/8/P7/1PPP4/4PPPP/BQNNRKRB w GE - 1 9', 4],
  ['qbbnnrkr fixture', 'qbbnnrkr/2pp2pp/p7/1p2pp2/8/P3PP2/1PPP1KPP/QBBNNR1R w hf - 0 9', 4],
  ['1nbbnrkr fixture', '1nbbnrkr/p1p1ppp1/3p4/1p3P1p/3Pq2P/8/PPP1P1P1/QNBBNRKR w HFhf - 0 9', 4],
  ['rook shields the destination', '4k3/8/8/8/8/8/8/rR3K2 w B - 0 1', 4],
  ['king stays, rook moves', '4k3/8/8/8/8/8/8/6KR w H - 0 1', 4],
  ['king and rook swap', '4k3/8/8/8/8/8/8/5KR1 w G - 0 1', 4],
  ['queen-side swap', '4k3/8/8/8/8/8/8/2RK4 w C - 0 1', 4],
  ['king passes its own rook', '4k3/8/8/8/8/8/8/RK6 w A - 0 1', 4],
  ['inner rooks both sides', '1r2k1r1/8/8/8/8/8/8/1R2K1R1 w BGbg - 0 1', 4],
  ['castling path attacked', '4k3/8/8/8/8/8/5r2/1R2K1R1 w BG - 0 1', 3],
];
const out = [];
for (const [name, fen, depth] of fixtures) {
  const ref = await perft(fen, depth);
  const mine = new Chess(fen, { chess960: true }).perft(depth);
  out.push({ name, fen, depth, nodes: ref.nodes, ours: mine });
  console.log(`${mine === ref.nodes ? 'ok  ' : 'FAIL'} ${name}: stockfish ${ref.nodes}, ours ${mine}`);
}
console.log(JSON.stringify(out.map(({ name, fen, depth, nodes }) => [name, fen, depth, nodes])));
send('quit');
sf.kill();
