import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './catalog.mjs';
const port = Number(process.env.PORT ?? 8787), host = process.env.HOST ?? '127.0.0.1';
const base = path.join(root, 'repo');
http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(base, '.' + relative);
    if (!file.startsWith(base + path.sep)) { res.writeHead(404).end(); return; }
    const bytes = await readFile(file);
    const type = file.endsWith('.apk') ? 'application/vnd.android.package-archive' :
      (file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : 'text/plain') + '; charset=utf-8';
    res.writeHead(200, {'Content-Type': type, 'Content-Length': bytes.length,
      'Cache-Control': relative.startsWith('/packages/') ? 'public, max-age=31536000, immutable' : 'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404).end(); }
}).listen(port, host, () => console.log(`NodeLane 本地源：http://${host}:${port}/index.json`));
