// Builds "Simple Chess Dev": the Android app wired to the Vite dev server, so code changes show up
// on the phone instantly instead of after a reinstall. Install it once, then just run `npm run dev`.
//
// Usage: npm run dev:android                     (uses this PC's Wi-Fi address)
//        npm run dev:android -- --host 192.168.1.20 --port 5173
//
// The phone and the PC must be on the same network. With a phone connected over USB (USB debugging
// on), the app is installed and launched automatically; otherwise copy the printed APK to the phone.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function lanAddress() {
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|docker|WSL|Hyper-V|br-|veth|tailscale|zerotier/i.test(name)) continue;
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) found.push(a.address);
  }
  return (
    found.find((ip) => ip.startsWith('192.168.')) ??
    found.find((ip) => ip.startsWith('10.')) ??
    found.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ??
    found[0]
  );
}

// Only npx needs a shell on Windows (it is a .cmd); absolute paths like node.exe may contain spaces.
function run(command, commandArgs, label, shell = false) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell });
  if (result.status !== 0) {
    console.error(`\n${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

const host = option('host') ?? lanAddress();
const port = Number(option('port') ?? 5173);
if (!host) {
  console.error('No local network address found. Pass one with --host <ip>.');
  process.exit(1);
}
const url = `http://${host}:${port}`;

// 1. Make sure the native project has the current plugins and config.
run('npx', ['cap', 'sync', 'android'], 'Syncing the Android project', windows);

// 2. Point the dev build at the dev server (this folder only goes into the dev build).
const devAssets = join(root, 'android', 'app', 'src', 'devserver', 'assets');
const config = JSON.parse(readFileSync(join(root, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'), 'utf8'));
config.server = { ...(config.server ?? {}), url, cleartext: true, errorPath: 'dev-server-error.html' };
mkdirSync(join(devAssets, 'public'), { recursive: true });
writeFileSync(join(devAssets, 'capacitor.config.json'), `${JSON.stringify(config, null, 2)}\n`);
writeFileSync(
  join(devAssets, 'public', 'dev-server-error.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dev server not reachable</title>
<style>
  html, body { margin: 0; height: 100%; background: #1b1a18; color: #ece9e4; font: 16px/1.5 system-ui, Roboto, sans-serif; }
  main { min-height: 100%; display: grid; place-content: center; gap: 14px; padding: 24px; max-width: 420px; margin: 0 auto; }
  h1 { margin: 0; font-size: 21px; }
  p { margin: 0; color: #aaa49d; }
  code { color: #ece9e4; font-size: 15px; }
  button { margin-top: 8px; min-height: 50px; border: 0; border-radius: 12px; background: #d4a24c; color: #1c160c; font: 700 16px system-ui, Roboto, sans-serif; }
</style>
</head>
<body>
<main>
  <h1>Can't reach the dev server</h1>
  <p>This is the development build. It loads the game from <code>${url}</code>.</p>
  <p>On your PC, run <code>npm run dev</code> in the project folder. The phone needs to be on the same Wi-Fi, and Windows Firewall has to allow Node.js on private networks.</p>
  <button type="button" onclick="location.href='${url}'">Try again</button>
</main>
</body>
</html>
`,
);

// 3. Build the dev APK (debug-signed, installs next to the real app as "Simple Chess Dev").
run(process.execPath, [join(root, 'scripts', 'gradle.mjs'), 'assembleDevserver'], 'Building the dev APK');
const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'devserver', 'app-devserver.apk');

// 4. Install it if a phone is connected with USB debugging; otherwise explain how to install it.
function findAdb() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const candidates = [
    sdk && join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb'),
    windows && process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    !windows && join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
    !windows && join(homedir(), 'Android', 'Sdk', 'platform-tools', 'adb'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

const adb = findAdb();
const devices = adb
  ? spawnSync(adb, ['devices'], { encoding: 'utf8' })
      .stdout.split('\n')
      .filter((line) => /\tdevice\s*$/.test(line))
  : [];

if (devices.length > 0) {
  run(adb, ['install', '-r', apk], 'Installing on the connected phone');
  spawnSync(adb, ['shell', 'am', 'start', '-n', 'com.tadeupassos.simplechess.dev/com.tadeupassos.simplechess.MainActivity'], { stdio: 'ignore' });
  console.log('\nInstalled and launched "Simple Chess Dev".');
} else {
  console.log(`\nDev APK ready: ${apk}`);
  console.log('Copy it to the phone and install it once (it sits next to the real app as "Simple Chess Dev").');
}
console.log(`\nIt loads ${url}. Start the dev server with:  npm run dev`);
console.log('Rerun this command only if your PC gets a different address or you add a native plugin.');
