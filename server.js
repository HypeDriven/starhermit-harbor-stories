// ES module: package.json declares "type": "module".
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.opus': 'audio/ogg'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';

  // Malformed percent-escapes must not throw out of the request handler.
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  // '/' -> index.html; otherwise serve the file directly.
  let filePath;
  if (p === '/index' || p === '/') {
    filePath = path.join(ROOT, 'index.html');
  } else if (p === '/favicon.ico') {
    filePath = path.join(ROOT, 'favicon.svg');
  } else {
    filePath = path.join(ROOT, p);
  }

  // Never serve anything outside the game directory ('..' traversal).
  const resolved = path.resolve(filePath);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  filePath = resolved;

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    // 404 with a body.
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });
});

server.listen(PORT, () => {
  console.log('Harbor Stories server listening on http://localhost:' + PORT);
});

export default server;
