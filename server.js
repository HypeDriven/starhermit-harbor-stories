'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.opus': 'audio/ogg'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url || '/';
  if (urlPath.length > 1 && urlPath.charAt(urlPath.length - 1) === '/') urlPath += '';
  const p = decodeURIComponent(urlPath.split('?')[0]);

  // '/' -> index.html; otherwise serve the file directly.
  let filePath;
  if (p === '/index' || p === '/') {
    filePath = path.join(ROOT, 'index.html');
  } else {
    filePath = path.join(ROOT, p);
  }

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

module.exports = server;
