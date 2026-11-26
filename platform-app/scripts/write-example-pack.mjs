import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDS } from '../src/constants.js';
import { userById } from '../src/access.js';
import { openDatabase } from '../src/db.js';
import { createExport } from '../src/export-pack.js';
import { seedAll } from '../src/seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'docs', 'platform', 'export-pack');
const db = openDatabase(':memory:');
seedAll(db, {});
const auditor = userById(db, 'user-auditor');
const pack = createExport(db, auditor, IDS.claimV2, IDS.exportAt);
fs.mkdirSync(outDir, { recursive: true });
for (const [name, contents] of Object.entries(pack.files)) {
  fs.writeFileSync(path.join(outDir, name), contents);
}
db.close();
console.log(`wrote ${Object.keys(pack.files).length} files to ${outDir}`);
console.log(`current ${pack.manifest.calculation.current.label} ${pack.manifest.calculation.current.digest_sha256}`);
console.log(`superseded ${pack.manifest.calculation.superseded.label} ${pack.manifest.calculation.superseded.digest_sha256}`);
