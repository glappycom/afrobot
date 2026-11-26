import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { IDS, PRIVATE_NOTE } from '../src/constants.js';
import { userById } from '../src/access.js';
import { openDatabase } from '../src/db.js';
import { createExport } from '../src/export-pack.js';
import { seedAll } from '../src/seed.js';

const packDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'platform', 'export-pack');

test('the committed redacted pack matches a fresh export', () => {
  const db = openDatabase(':memory:');
  seedAll(db, {});
  const pack = createExport(db, userById(db, 'user-auditor'), IDS.claimV2, IDS.exportAt);
  db.close();
  for (const [name, contents] of Object.entries(pack.files)) {
    const onDisk = fs.readFileSync(path.join(packDir, name), 'utf8');
    assert.equal(onDisk, contents, name);
  }
  const packed = JSON.stringify(pack);
  assert.equal(packed.includes(IDS.schoolTz), false);
  assert.equal(packed.includes('Lakeside'), false);
  assert.equal(packed.includes(PRIVATE_NOTE), false);
  assert.equal(packed.includes('other-learner-draft'), false);
  assert.match(pack.files['claim.json'], /"numerator": 5/);
  assert.match(pack.files['claim.json'], /"numerator": 6/);
  const check = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'validate-snapshot.mjs'),
    path.join(packDir, 'snapshots.json'),
  ], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});
