import fs from 'node:fs';
import { canonicalString, sha256 } from '../src/canonical.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-snapshot.mjs snapshots.json');
  process.exit(2);
}

const snapshots = JSON.parse(fs.readFileSync(file, 'utf8'));
let failed = 0;
for (const snapshot of snapshots) {
  const stored = sha256(snapshot.canonical_json);
  const again = sha256(canonicalString(JSON.parse(snapshot.canonical_json)));
  if (stored !== snapshot.digest_sha256 || again !== snapshot.digest_sha256) {
    failed += 1;
    console.error(`digest mismatch for ${snapshot.subject_id} version ${snapshot.version}`);
  } else {
    console.log(`${snapshot.subject_id} version ${snapshot.version} ${snapshot.digest_sha256}`);
  }
}
if (failed) process.exit(1);
console.log(`ok: ${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'}`);
