import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const paths = ['server.js'];
for (const dir of ['src', 'tests', 'scripts'])
  for (const name of await readdir(dir)) if (name.endsWith('.js')) paths.push(join(dir, name));
let failures = 0;
for (const path of paths) {
  const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (r.status !== 0) {
    failures++;
    console.error(r.stderr);
  }
}
console.log(`${paths.length} JavaScript files checked; ${failures} syntax errors.`);
process.exitCode = failures ? 1 : 0;
