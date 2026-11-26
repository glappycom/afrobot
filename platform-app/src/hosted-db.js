import { Worker } from 'node:worker_threads';
import { LEDGER_SCHEMA, SCHEMA } from './db.js';
import { bindPlaceholders, normalizeRow, postgresSetup } from './pg-sql.js';

const CAPACITY = 1_000_000;

function startWorker(connectionString) {
  const sab = new SharedArrayBuffer(8 + CAPACITY);
  const flag = new Int32Array(sab, 0, 1);
  const len = new Int32Array(sab, 4, 1);
  const bytes = new Uint8Array(sab, 8);
  Atomics.store(flag, 0, 3);
  const worker = new Worker(new URL('./hosted-worker.js', import.meta.url), {
    workerData: { sab, connectionString },
  });
  worker.unref();
  while (Atomics.load(flag, 0) === 3) Atomics.wait(flag, 0, 3, 20000);
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
    if (response.error) throw new Error(response.error);
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
  for (const statement of postgresSetup(SCHEMA, LEDGER_SCHEMA)) {
    client.exec(statement);
  }
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
