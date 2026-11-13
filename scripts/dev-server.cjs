'use strict';

// Development only. Production remains ordinary static HTML/CSS/JavaScript.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5500);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon'
};
const server = http.createServer(async (req, res) => {
  const send = (status, type, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(405, 'text/plain', 'Method not allowed', { Allow: 'GET, HEAD' }); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname.replace(/^\/+/, '');
    if (relative.split(/[\\/]/).some(part => part.startsWith('.')) || /[\\:\0]/.test(relative)) {
      send(403, 'text/plain', 'Forbidden'); return;
    }
    let file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== root) {
      send(403, 'text/plain', 'Forbidden'); return;
    }
    // Local pages must not send development records to the team's Supabase.
    // The tracked production config is not modified.
    if (relative === 'js/db-config.js') {
      send(200, types['.js'], "window.SG = window.SG || {}; window.SG.DB_CONFIG = {};\n"); return;
    }
    const stat = await fs.promises.stat(file);
    if (stat.isDirectory()) {
      if (!pathname.endsWith('/')) {
        const query = new URL(req.url, 'http://localhost').search;
        send(302, 'text/plain', '', { Location: pathname + '/' + query }); return;
      }
      file = path.join(file, 'index.html');
    }
    const type = types[path.extname(file).toLowerCase()];
    if (!type) { send(403, 'text/plain', 'Unsupported asset'); return; }
    send(200, type, await fs.promises.readFile(file));
  } catch (error) {
    send(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400, 'text/plain', 'Asset unavailable');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Set PORT to another port and retry.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Malssi: http://127.0.0.1:${port}/`);
  console.log(`Word writing: http://127.0.0.1:${port}/writing-word/`);
  console.log('Local development: Supabase sync disabled; browser storage still works. Ctrl+C to stop.');
});
