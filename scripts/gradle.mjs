// Runs the Android Gradle wrapper on any OS: node scripts/gradle.mjs assembleRelease bundleRelease
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const androidDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'android');
const windows = process.platform === 'win32';
// Absolute path: cmd.exe may be configured not to search the current directory.
const wrapper = windows ? `"${join(androidDir, 'gradlew.bat')}"` : './gradlew';
const result = spawnSync(wrapper, process.argv.slice(2), {
  cwd: androidDir,
  stdio: 'inherit',
  shell: windows,
});
process.exit(result.status ?? 1);
