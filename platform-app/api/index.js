import { createApp } from '../src/server.js';
import { vercelBlockReason } from '../src/store-config.js';

let app;

export default function handler(req, res) {
  const blocked = vercelBlockReason(process.env);
  if (blocked) {
    res.statusCode = 503;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(blocked + '\n');
    return;
  }
  if (!app) app = createApp();
  return app.handle(req, res);
}
