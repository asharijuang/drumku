#!/usr/bin/env node
const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Load local secrets without adding a dotenv runtime dependency.
try {
  for (const line of fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const PORT = process.env.BRIDGE_PORT || 3232;
const HOST = '127.0.0.1';
const CLI = { claude: 'claude', codex: 'codex', opencode: 'opencode' };
const MAX_BODY = 256 * 1024;
const NEUTRAL_CWD = path.join(os.tmpdir(), 'cli-bridge-cwd');
fs.mkdirSync(NEUTRAL_CWD, { recursive: true });

function has(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ['--version'], { timeout: 10000 }, (err, out) => resolve(!err && out.length < 1000));
  });
}

function flatten(messages) {
  const parts = [];
  let last = '';
  for (const m of messages) {
    if (m.role === 'system') parts.push('[SYSTEM]\n' + m.content);
    else if (m.role === 'assistant') parts.push('[ASSISTANT]\n' + m.content);
    else { parts.push('[USER]\n' + m.content); last = m.content; }
  }
  return { prompt: parts.join('\n\n'), last };
}

function runCli(provider, model, messages) {
  return new Promise((resolve, reject) => {
    const { prompt } = flatten(messages);
    const args = [];
    let cmd = CLI[provider];
    if (provider === 'claude') {
      args.push('-p', prompt);
      if (model) args.push('--model', model);
    } else if (provider === 'codex') {
      args.push('exec', '--skip-git-repo-check', prompt);
      if (model) args.push('-m', model);
    } else if (provider === 'opencode') {
      args.push('run', prompt);
      if (model) args.push('--model', model);
    } else {
      return reject(new Error('unknown provider: ' + provider));
    }
    const t0 = Date.now();
    execFile(cmd, args, {
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
      cwd: NEUTRAL_CWD,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' },
    }, (err, stdout, stderr) => {
      if (err && !stdout) {
        reject(new Error(`${provider} CLI gagal (${Math.round((Date.now() - t0) / 1000)}s): ${(stderr || err.message || '').toString().trim().slice(0, 400)}`));
      } else {
        resolve((stdout || '').toString().trim());
      }
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/status') {
    Promise.all(Object.keys(CLI).map(async (p) => [p, await has(CLI[p])])).then((list) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Object.fromEntries(list)));
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/youtube/search?')) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'YOUTUBE_API_KEY belum diatur di .env' }));
      return;
    }
    const query = new URL(req.url, `http://${HOST}:${PORT}`).searchParams.get('q') || '';
    if (!query.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Query pencarian kosong' }));
      return;
    }
    const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
    endpoint.search = new URLSearchParams({ key, part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '6', q: query.trim() });
    fetch(endpoint)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `YouTube API HTTP ${response.status}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      })
      .catch((error) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat') {
    let body = '';
    let tooBig = false;
    req.on('data', (c) => {
      body += c;
      if (body.length > MAX_BODY) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        const { provider, model, messages } = JSON.parse(body);
        if (!messages || !messages.length) throw new Error('empty messages');
        runCli(provider, model, messages)
          .then((text) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content: text }));
          })
          .catch((e) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Bridge jalan di http://${HOST}:${PORT}`);
  Object.keys(CLI).forEach(async (p) => console.log(p + ': ' + (await has(CLI[p]) ? 'OK' : 'tidak ada')));
});
