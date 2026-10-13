import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const cli = fileURLToPath(new URL('../bin/ariadne.mjs', import.meta.url));
for (const flag of ['--version','--help']) {
 test(`CLI ${flag} exits cleanly`, () => {
  const result = spawnSync(process.execPath,[cli,flag],{encoding:'utf8', timeout:10000});
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.stdout.includes(flag==='--version'?'ariadne':'Usage:'));
 });
}
