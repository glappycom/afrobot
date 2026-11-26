import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { LEDGER_SCHEMA, POSTGRES_WORK_SQL, SCHEMA } from './db.js';
import { bindPlaceholders, normalizeRow, postgresSetup } from './pg-sql.js';

function redact(message) {
  return String(message || 'database error').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

function workerFile() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, 'hosted-worker.js'),
    path.join(process.cwd(), 'src', 'hosted-worker.js'),
    path.join(process.cwd(), 'hosted-worker.js'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('The hosted database worker is missing from this deployment.');
  return found;
}

const CAPACITY = 1_000_000;

function startWorker(connectionString) {
  const sab = new SharedArrayBuffer(8 + CAPACITY);
  const flag = new Int32Array(sab, 0, 1);
  const len = new Int32Array(sab, 4, 1);
  const bytes = new Uint8Array(sab, 8);
  Atomics.store(flag, 0, 3);
  const worker = new Worker(workerFile(), {
    workerData: { sab, connectionString },
  });
  worker.unref();
  while (Atomics.load(flag, 0) === 3) Atomics.wait(flag, 0, 3, 20000);
  if (Atomics.load(flag, 0) === 4) {
    const detail = len[0] ? redact(Buffer.from(bytes.subarray(0, len[0])).toString()) : 'The hosted database did not connect.';
    throw new Error(detail);
  }
  if (Atomics.load(flag, 0) !== 0) throw new Error('The hosted database did not connect.');

  function call(sql, params = []) {
    const request = Buffer.from(JSON.stringify({ sql: bindPlaceholders(sql), params: params.map((value) => (value === undefined ? null : value)) }));
    if (request.length > bytes.length) throw new Error('That query is too large for this preview.');
    bytes.set(request);
    len[0] = request.length;
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0);
    let waits = 0;
    while (Atomics.load(flag, 0) !== 2) {
      Atomics.wait(flag, 0, 1, 20000);
      waits += 1;
      if (waits > 3) throw new Error('The hosted database did not answer.');
    }
    const response = JSON.parse(Buffer.from(bytes.subarray(0, len[0])).toString());
    Atomics.store(flag, 0, 0);
    if (response.error) throw new Error(redact(response.error));
    return response;
  }

  return {
    exec(sql) {
      call(sql, []);
    },
    prepare(sql) {
      return {
        all(...params) {
          return call(sql, params).rows.map(normalizeRow);
        },
        get(...params) {
          return normalizeRow(call(sql, params).rows[0]);
        },
        run(...params) {
          return { changes: call(sql, params).rowCount };
        },
      };
    },
    close() {
      worker.terminate();
    },
  };
}

export function openHostedDatabase(connectionString) {
  const client = startWorker(connectionString);
  client.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  const version = client.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  if (!version?.version) {
    for (const statement of postgresSetup(SCHEMA, LEDGER_SCHEMA)) client.exec(statement);
    client.exec('INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING');
  }
  client.exec('ALTER TABLE claims ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  client.exec('CREATE UNIQUE INDEX IF NOT EXISTS claims_idempotency_key ON claims (idempotency_key)');
  for (const statement of POSTGRES_WORK_SQL) client.exec(statement);
  client.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
    subject TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    locked_until TEXT,
    updated_at TEXT NOT NULL
  )`);
  return {
    records: client,
    ledger: client,
    driver: 'neon',
    prepare(sql) {
      return client.prepare(sql);
    },
    exec(sql) {
      return client.exec(sql);
    },
    close() {
      client.close();
    },
  };
}
