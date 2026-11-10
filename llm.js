export const PROVIDER_LABEL = {
  local: 'Coach lokal (rule-based)',
  ollama: 'Ollama',
  opencode: 'OpenCode',
  claude: 'Claude Code (OAuth)',
  codex: 'Codex (OpenAI)',
};

export function defaultConfig() {
  return {
    provider: 'local',
    ollamaBase: 'http://localhost:11434',
    bridgeBase: 'http://127.0.0.1:3232',
    model: '',
  };
}

async function fetchJson(url, opts = {}, timeout = 5000) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function listModels(cfg) {
  if (cfg.provider === 'ollama') {
    const json = await fetchJson(cfg.ollamaBase.replace(/\/$/, '') + '/api/tags');
    return (json.models || []).map((m) => m.name);
  }
  if (cfg.provider === 'local') return [];
  const status = await fetchJson(cfg.bridgeBase.replace(/\/$/, '') + '/status');
  if (status[cfg.provider] !== true) throw new Error('CLI ' + cfg.provider + ' tidak tersedia di bridge — jalankan: node bridge.js');
  return ['(default)'];
}

export async function chat(cfg, messages) {
  if (cfg.provider === 'local') throw new Error('local has no chat');
  if (cfg.provider === 'ollama') {
    const json = await fetchJson(cfg.ollamaBase.replace(/\/$/, '') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages, stream: false }),
    }, 90_000);
    return (json.message && json.message.content) || '';
  }
  const json = await fetchJson(cfg.bridgeBase.replace(/\/$/, '') + '/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: cfg.provider, model: cfg.model === '(default)' ? '' : cfg.model, messages }),
  }, 150_000);
  if (json.error) throw new Error(json.error);
  return json.content || '';
}
