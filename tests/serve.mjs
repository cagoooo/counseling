// 自動測試用的本機靜態伺服器
// Python 內建 http.server 的連線佇列只有 5，多個測試同時跑時會偶爾拒絕連線（ERR_CONNECTION_REFUSED），
// 造成 app.js 沒載入、按鈕按了沒反應的假失敗，所以改用 Node 版本（佇列 511）。
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || 5180);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(ROOT, `.${path}`);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(file).isFile()) throw new Error('not file');
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`test server on ${PORT}`));
