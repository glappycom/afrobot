import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start } from '../src/server.js';

export async function demo(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afrobot-evidence-'));
  const running = await start({
    dbPath: ':memory:',
    filesDir: path.join(dir, 'files'),
    port: 0,
    story: options.story !== false,
    demoSeed: options.demoSeed !== false,
    now: options.now,
  });
  return {
    ...running,
    dir,
    async stop() {
      running.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function login(base, username, password) {
  const response = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  const parts = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie') || ''];
  const cookie = parts.filter(Boolean).map((item) => item.split(';')[0]).join('; ');
  return { cookie, csrf: body.csrf, status: response.status, body };
}

export function api(base, session, method, urlPath, payload) {
  return fetch(`${base}${urlPath}`, {
    method,
    headers: {
      cookie: session.cookie,
      accept: 'application/json',
      'x-csrf-token': session.csrf,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: 'manual',
  });
}

export async function page(base, session, urlPath) {
  const response = await fetch(`${base}${urlPath}`, { headers: { cookie: session.cookie } });
  return { status: response.status, text: await response.text() };
}
