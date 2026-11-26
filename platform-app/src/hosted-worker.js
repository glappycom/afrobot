import { parentPort, workerData } from 'node:worker_threads';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const flag = new Int32Array(workerData.sab, 0, 1);
const len = new Int32Array(workerData.sab, 4, 1);
const bytes = new Uint8Array(workerData.sab, 8);

function readRequest() {
  return JSON.parse(Buffer.from(bytes.subarray(0, len[0])).toString());
}

function writeResponse(payload) {
  const raw = Buffer.from(JSON.stringify(payload));
  if (raw.length > bytes.length) {
    const error = Buffer.from(JSON.stringify({ error: 'The database reply was too large for this preview.' }));
    bytes.set(error);
    len[0] = error.length;
    return;
  }
  bytes.set(raw);
  len[0] = raw.length;
}

const pool = new Pool({ connectionString: workerData.connectionString });
const client = await pool.connect();

Atomics.store(flag, 0, 0);
Atomics.notify(flag, 0);

while (true) {
  while (Atomics.load(flag, 0) !== 1) Atomics.wait(flag, 0, 0);
  let response;
  try {
    const request = readRequest();
    const result = await client.query(request.sql, request.params);
    response = { rows: result.rows, rowCount: result.rowCount };
  } catch (error) {
    response = { error: error.message };
  }
  writeResponse(response);
  Atomics.store(flag, 0, 2);
  Atomics.notify(flag, 0);
}
