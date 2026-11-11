#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const HOST = process.env.APP_HOST || '0.0.0.0';
const PORT = Number(process.env.APP_PORT || 8000);
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3233);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

let bridge = null;
let stopping = false;

async function bridgeIsRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`, { signal: AbortSignal.timeout(900) });
    return response.ok;
  } catch { return false; }
}

function startBridge() {
  bridge = spawn(process.execPath, [path.join(ROOT, 'bridge.js')], {
    cwd: ROOT,
    env: { ...process.env, BRIDGE_PORT: String(BRIDGE_PORT) },
    stdio: 'inherit',
  });
  bridge.on('error', (error) => console.error('Bridge gagal dijalankan:', error.message));
  bridge.on('exit', (code) => {
    if (!stopping) console.error(`Bridge berhenti${code === null ? '' : ` (exit ${code})`}.`);
  });
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname);
  if (['/status', '/v1/chat'].includes(pathname) || pathname === '/youtube/search') {
    const upstream = http.request({
      hostname: '127.0.0.1', port: BRIDGE_PORT, path: req.url, method: req.method,
      headers: { 'content-type': req.headers['content-type'] || 'application/json' },
    }, (response) => {
      res.writeHead(response.statusCode || 502, { 'Content-Type': response.headers['content-type'] || 'application/json' });
      response.pipe(res);
    });
    upstream.on('error', (error) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Bridge tidak bisa dijangkau: ${error.message}` }));
    });
    req.pipe(upstream);
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, HOST, async () => {
  console.log(`Drum app: http://localhost:${PORT} (host 0.0.0.0:${PORT})`);
  if (await bridgeIsRunning()) console.log(`Bridge: memakai yang sudah aktif di http://127.0.0.1:${BRIDGE_PORT}`);
  else startBridge();
});

function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  if (bridge && !bridge.killed) bridge.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
