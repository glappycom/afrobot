import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/db.js';
import { postgresSetup } from '../src/pg-sql.js';
import { LEDGER_SCHEMA, SCHEMA } from '../src/db.js';
import { storeConfigFromEnv, TURSO_ENV, vercelBlockReason } from '../src/store-config.js';

test('the digest ledger is a separate database and stays append-only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afrobot-store-'));
  const recordsPath = path.join(dir, 'records.sqlite');
  const ledgerPath = path.join(dir, 'ledger.sqlite');
  const db = openDatabase(recordsPath, ledgerPath);
  try {
    assert.notEqual(db.records, db.ledger);
    const tables = db.records.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map((row) => row.name);
    assert.equal(tables.includes('digest_ledger'), false);
    assert.equal(tables.includes('events'), true);
    db.prepare(`INSERT INTO digest_ledger (snapshot_id, digest_sha256, created_at) VALUES (?, ?, ?)`).run('snap-1', 'abc', '2026-05-03T15:00:00.000Z');
    const row = db.ledger.prepare('SELECT digest_sha256 FROM digest_ledger WHERE snapshot_id = ?').get('snap-1');
    assert.equal(row.digest_sha256, 'abc');
    assert.throws(() => db.prepare(`UPDATE digest_ledger SET digest_sha256 = 'nope' WHERE snapshot_id = 'snap-1'`).run());
    assert.throws(() => db.prepare(`DELETE FROM digest_ledger WHERE snapshot_id = 'snap-1'`).run());
    assert.equal(db.ledger.prepare('SELECT digest_sha256 FROM digest_ledger WHERE snapshot_id = ?').get('snap-1').digest_sha256, 'abc');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Vercel stays blocked until both Turso databases are named', () => {
  assert.deepEqual(TURSO_ENV, [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'TURSO_LEDGER_URL',
    'TURSO_LEDGER_AUTH_TOKEN',
  ]);
  assert.equal(storeConfigFromEnv({}).driver, 'sqlite');
  assert.match(vercelBlockReason({ VERCEL: '1' }), /Turso/);
  assert.equal(vercelBlockReason({}), null);
  assert.throws(() => storeConfigFromEnv({ TURSO_DATABASE_URL: 'libsql://records.example' }));
  const ready = storeConfigFromEnv({
    TURSO_DATABASE_URL: 'libsql://records.example',
    TURSO_AUTH_TOKEN: 'token-records',
    TURSO_LEDGER_URL: 'libsql://ledger.example',
    TURSO_LEDGER_AUTH_TOKEN: 'token-ledger',
  });
  assert.equal(ready.driver, 'turso');
  assert.equal(ready.ledgerUrl, 'libsql://ledger.example');
  assert.equal(vercelBlockReason({ VERCEL: '1', ...{
    TURSO_DATABASE_URL: ready.databaseUrl,
    TURSO_AUTH_TOKEN: ready.authToken,
    TURSO_LEDGER_URL: ready.ledgerUrl,
    TURSO_LEDGER_AUTH_TOKEN: ready.ledgerAuthToken,
  } }), null);
  assert.equal(vercelBlockReason({ VERCEL: '1', DATABASE_URL: 'postgres://example' }), null);
  const setup = postgresSetup(SCHEMA, LEDGER_SCHEMA).join('\n');
  assert.equal(setup.includes('PRAGMA'), false);
  assert.match(setup, /digest_ledger/);
  assert.match(setup, /digest ledger is append-only/);
});
