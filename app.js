import { parseMidi } from './midi.js';
import { chartFromNotes, laneOf } from './lanes.js';
import { createAudio, generateDemoSong, bufferToWav } from './audio.js';
import { createHighway, fmtTime } from './highway.js';
import { createSheet } from './sheet.js';
import { createCoach } from './coach.js';
import { PROVIDER_LABEL, defaultConfig, listModels, chat } from './llm.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@12.0.0/lib/marked.esm.js';
import { buildGroove, GROOVE_GENRES } from './groove.js';

const audio = createAudio();
const canvas = document.getElementById('highway');
const highway = createHighway(canvas, {});
const sheet = createSheet(canvas);
const coach = createCoach();
let mode = localStorage.getItem('mode') || 'highway';
let chart = [];
let rawBeats = null;
let rate = +(localStorage.getItem('rate') || 100) / 100;

function scaleBeatsWall() {
  if (!rawBeats) return null;
  const out = new Float64Array(rawBeats.length);
  for (let i = 0; i < rawBeats.length; i++) out[i] = rawBeats[i] / rate;
  return out;
}

function invalidateChartTimes() {
  for (const n of chart) {
    delete n.tw;
    delete n.b;
  }
  sheet.setBeats(scaleBeatsWall());
}

function applyRate(percent) {
  percent = Math.max(25, Math.min(150, Math.round(percent) || 100));
  audio.setRate(percent / 100);
  rate = percent / 100;
  localStorage.setItem('rate', percent);
  invalidateChartTimes();
}

const el = {
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  score: document.getElementById('score'),
  combo: document.getElementById('combo'),
  time: document.getElementById('time-label'),
  play: document.getElementById('btn-play'),
  audioName: document.getElementById('audio-name'),
  midiName: document.getElementById('midi-name'),
  offset: document.getElementById('offset'),
  offsetVal: document.getElementById('offset-val'),
  device: document.getElementById('midi-device'),
  midiStatus: document.getElementById('midi-status'),
  demo: document.getElementById('demo-btn'),
  modeBtn: document.getElementById('btn-mode'),
  tutorialBtn: document.getElementById('btn-tutorial'),
  tempoNum: document.getElementById('tempo-num'),
  tempoRange: document.getElementById('tempo-range'),
};

function setMode(m) {
  mode = m;
  localStorage.setItem('mode', m);
  el.modeBtn.textContent = m === 'highway' ? '🎼 Sheet' : '🛣 Highway';
  highway.clearEffects();
  sheet.clearEffects();
}

let score = 0;
let combo = 0;
let scanIdx = 0;
let judgeWindow = 0.15;

function showLoading(text) {
  el.loadingText.textContent = text;
  el.loading.classList.remove('hidden');
}
function hideLoading() {
  el.loading.classList.add('hidden');
}

function setChart(rawNotes, name, beats) {
  chart = chartFromNotes(rawNotes);
  rawBeats = beats || null;
  sheet.setBeats(scaleBeatsWall());
  scanIdx = 0;
  score = 0;
  combo = 0;
  updateScore();
  highway.clearEffects();
  sheet.clearEffects();
  el.midiName.textContent = `${name} — ${chart.length} hits`;
}

async function loadAudioFile(file) {
  showLoading('Decoding audio…');
  try {
    await audio.loadFile(file);
    el.audioName.textContent = file.name;
  } catch (e) {
    alert('Gagal decode audio: ' + e.message);
  }
  hideLoading();
}

async function loadMidiFile(file) {
  showLoading('Parsing MIDI…');
  try {
    const parsed = parseMidi(await file.arrayBuffer());
    setChart(parsed.notes, file.name, parsed.beats);
    coach.setSong(file.name);
  } catch (e) {
    alert('Gagal parse MIDI: ' + e.message);
  }
  hideLoading();
}

async function startDemo() {
  showLoading('Generating demo…');
  try {
    const { buffer, chart: demoChart } = await generateDemoSong();
    await audio.setBlob(bufferToWav(buffer));
    el.audioName.textContent = 'demo-song (built-in)';
    const demoBeats = new Float64Array(Math.ceil(buffer.duration / 0.5));
    for (let k = 0; k < demoBeats.length; k++) demoBeats[k] = k * 0.5;
    setChart(demoChart, 'demo-chart', demoBeats);
  } catch (e) {
    alert('Demo gagal: ' + e.message);
  }
  hideLoading();
}

function hasAudio() {
  return audio.duration() > 0;
}

function togglePlay() {
  if (!audio.playing && !hasAudio()) {
    el.midiStatus.textContent = 'Load audio dulu, atau tekan Demo song';
    return;
  }
  if (audio.playing) {
    audio.pause();
    el.play.textContent = '▶ Play';
  } else {
    audio.play();
    el.play.textContent = '⏸ Pause';
  }
}

function updateScore() {
  el.score.textContent = 'SCORE ' + score;
  el.combo.textContent = 'COMBO ' + combo;
}

function visualTime() {
  return audio.currentTime() - (+el.offset.value) / 1000;
}

function markMisses(target) {
  while (scanIdx < chart.length && (chart[scanIdx].tw ?? chart[scanIdx].t) < target - judgeWindow) {
    const n = chart[scanIdx];
    if (!n.judged) {
      n.judged = 'miss';
      combo = 0;
      coach.onMiss(n.lane);
      updateScore();
    }
    scanIdx++;
  }
}

function judge(hitLane) {
  if (audio.playing) {
    const target = visualTime();
    let best = null;
    let bestDist = Infinity;
    for (let i = Math.max(0, scanIdx - 8); i < chart.length; i++) {
      const n = chart[i];
      const nt = n.tw ?? n.t;
      if (nt < target - 1.5) continue;
      if (nt > target + 1) break;
      if (n.judged || n.lane !== hitLane) continue;
      const d = Math.abs(nt - target);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (best && bestDist <= judgeWindow) {
      best.judged = 'hit';
      combo++;
      score += combo >= 8 ? 150 : 100;
      coach.onAttempt(hitLane, true, ((best.tw ?? best.t) - target) * 1000);
      highway.addHitFlash(hitLane);
      sheet.addHitFlash(hitLane);
    } else {
      combo = 0;
      coach.onGhost();
      highway.addFeedback('×', '#ff5252', canvas.clientWidth / 2);
      sheet.addFeedback('×', '#ff5252', 0);
    }
    markMisses(target);
    updateScore();
  } else {
    highway.addHitFlash(hitLane);
  }
}

const KEY_LANES = { j: 'kick', f: 'snare', d: 'hh', s: 'tom', l: 'crash', k: 'ride' };
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
    return;
  }
  if (e.key === 'ArrowRight') {
    audio.seek(audio.currentTime() + 2);
    return;
  }
  if (e.key === 'ArrowLeft') {
    audio.seek(audio.currentTime() - 2);
    return;
  }
  if (e.key.toLowerCase() === 'm') {
    setMode(mode === 'highway' ? 'sheet' : 'highway');
    return;
  }
  const laneId = KEY_LANES[e.key.toLowerCase()];
  if (laneId) judge(laneId);
});

function setupMidi() {
  if (!navigator.requestMIDIAccess) {
    el.midiStatus.textContent = 'Web MIDI tidak tersedia — pakai Chrome/Edge/Firefox';
    return;
  }
  navigator.requestMIDIAccess({ sysex: false }).then((access) => {
    const refresh = () => {
      el.device.innerHTML = '<option value="">— pilih kit —</option>';
      for (const input of access.inputs.values()) {
        const opt = document.createElement('option');
        opt.value = input.id;
        opt.textContent = input.name;
        el.device.appendChild(opt);
      }
    };
    refresh();
    access.onstatechange = refresh;
    el.device.onchange = () => {
      for (const input of access.inputs.values()) input.onmidimessage = null;
      if (!el.device.value) return;
      const input = access.inputs.get(el.device.value);
      if (!input) return;
      input.onmidimessage = (msg) => {
        const [status, note, vel] = msg.data;
        if (status >= 0xf0) return;
        if ((status & 0xf0) !== 0x90 || vel === 0) return;
        const lane = laneOf(note);
        if (lane) judge(lane);
      };
      el.midiStatus.textContent = '✓ ' + input.name;
    };
  }).catch(() => {
    el.midiStatus.textContent = 'MIDI access ditolak';
  });
}

el.play.onclick = togglePlay;
el.demo.onclick = startDemo;
el.modeBtn.onclick = () => setMode(mode === 'highway' ? 'sheet' : 'highway');
el.tutorialBtn.onclick = () => toggleTutorial();
el.device.onclick = () => setupMidi();

const coachPanel = document.getElementById('coach-panel');
const coachMsgs = document.getElementById('coach-msgs');
const coachInput = document.getElementById('coach-input');
const btnCoach = document.getElementById('btn-coach');
const btnCoachClose = document.getElementById('coach-close');
const btnCoachSend = document.getElementById('coach-send');
const tutorialPanel = document.getElementById('tutorial-panel');
const tutorialContent = document.getElementById('tutorial-content');
const tutorialHead = document.getElementById('tutorial-head');
const tutorialClose = document.getElementById('tutorial-close');

// Drag-to-resize width. side = which edge the handle sits on (faces the center).
function addResizer(panel, side) {
  const h = document.createElement('div');
  h.className = 'resizer resizer-' + side;
  panel.appendChild(h);
  h.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const sx = e.clientX, sw = panel.offsetWidth;
    const move = (ev) => {
      const d = side === 'left' ? sx - ev.clientX : ev.clientX - sx;
      panel.style.width = Math.max(240, Math.min(window.innerWidth - 40, sw + d)) + 'px';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
addResizer(coachPanel, 'right'); // docked left, grows right
addResizer(tutorialPanel, 'left'); // docked right, grows left

// Keep side panels below the (wrapping) topbar so its buttons stay clickable.
const topbarEl = document.getElementById('topbar');
const syncTopbar = () => document.documentElement.style.setProperty('--topbar-h', topbarEl.offsetHeight + 'px');
syncTopbar();
new ResizeObserver(syncTopbar).observe(topbarEl);

const llmStatus = document.getElementById('llm-status');

const settingsOverlay = document.getElementById('settings-overlay');
const elSettings = {
  close: document.getElementById('settings-close'),
  open: document.getElementById('btn-settings'),
  nav: document.getElementById('settings-nav'),
  provider: document.getElementById('set-provider'),
  tone: document.getElementById('set-tone'),
  insight: document.getElementById('set-insight'),
  autoSum: document.getElementById('set-autosum'),
  ollamaBase: document.getElementById('set-ollama-base'),
  ollamaModel: document.getElementById('set-ollama-model'),
  ollamaDetect: document.getElementById('btn-ollama-detect'),
  ollamaRow: document.getElementById('row-ollama'),
  bridgeRow: document.getElementById('row-bridge'),
  bridgeBase: document.getElementById('set-bridge-base'),
  model: document.getElementById('set-model'),
  bridgeStatus: document.getElementById('bridge-status'),
  bridgeCheck: document.getElementById('btn-bridge-check'),
  test: document.getElementById('btn-llm-test'),
  testResult: document.getElementById('llm-test-result'),
  audioTempo: document.getElementById('set-tempo'),
  audioSync: document.getElementById('set-sync'),
  audioVolume: document.getElementById('set-volume'),
  audioPage: document.getElementById('page-audio'),
};

let cfg = {};
try {
  cfg = { ...defaultConfig(), ...JSON.parse(localStorage.getItem('llmCfg') || '{}') };
} catch (e) {
  cfg = defaultConfig();
}
function saveCfg() {
  localStorage.setItem('llmCfg', JSON.stringify(cfg));
}

const settingsState = {
  tone: () => cfg.tone || 'motivator',
  insight: () => cfg.autoInsight !== false,
  autoSum: () => cfg.autoSummary !== false,
};

let llmHistory = [];

function providerActive() {
  return cfg.provider && cfg.provider !== 'local';
}

function updateLlmStatus(text) {
  llmStatus.textContent = text;
}

function refreshProviderStatus() {
  if (!providerActive()) {
    updateLlmStatus('Coach lokal (rule-based)');
    return;
  }
  const model = cfg.model && cfg.model !== '(default)' ? cfg.model : '';
  updateLlmStatus(`AI: ${PROVIDER_LABEL[cfg.provider]}${model ? ' — ' + model : ''}`);
}

async function ollamaDetect() {
  elSettings.ollamaModel.innerHTML = '<option value="">— memuat… —</option>';
  try {
    const models = await listModels({ provider: 'ollama', ollamaBase: cfg.ollamaBase || 'http://localhost:11434' });
    elSettings.ollamaModel.innerHTML = '<option value="">— pilih model —</option>';
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      elSettings.ollamaModel.appendChild(opt);
    }
    if (cfg.model && models.includes(cfg.model)) elSettings.ollamaModel.value = cfg.model;
    else if (models.length) {
      elSettings.ollamaModel.value = models[0];
      cfg.model = models[0];
      saveCfg();
    }
  } catch (e) {
    elSettings.ollamaModel.innerHTML = '<option value="">— tidak tersedia —</option>';
  }
}

async function bridgeCheck() {
  elSettings.bridgeStatus.textContent = 'mengecek…';
  let status;
  try {
    const res = await fetch((cfg.bridgeBase || 'http://127.0.0.1:3232') + '/status', { signal: AbortSignal.timeout(5000) });
    status = await res.json();
  } catch (e) {
    elSettings.bridgeStatus.textContent = '✕ Bridge mati — ' + (PROVIDER_LABEL[cfg.provider] || cfg.provider) + ' tidak bisa dipakai (coach lokal tetap jalan). Nyalakan: node bridge.js';
    return;
  }
  const parts = Object.keys(status).map((p) => p + (status[p] ? ' ✓' : ' ✕'));
  if (status[cfg.provider] === true) {
    elSettings.bridgeStatus.textContent = '✓ ' + (PROVIDER_LABEL[cfg.provider] || cfg.provider) + ' siap (' + parts.join(' · ') + ')';
  } else {
    const avail = Object.keys(status).filter((p) => status[p]);
    elSettings.bridgeStatus.textContent = '✕ ' + (PROVIDER_LABEL[cfg.provider] || cfg.provider) + ' tidak terpasang (' + parts.join(' · ') + ')' + (avail.length ? ' — bisa pakai: ' + avail.join(', ') : '') + '. Coach lokal tetap jalan.';
  }
}

async function testProvider() {
  elSettings.testResult.textContent = 'menguji…';
  try {
    if (!providerActive()) { elSettings.testResult.textContent = 'Provider lokal: selalu tersedia (rule-based).'; return; }
    const answer = await chat(cfg, [
      { role: 'system', content: 'Jawab dengan satu kata saja: pong.' },
      { role: 'user', content: 'ping' },
    ]);
    elSettings.testResult.textContent = '✓ ' + (answer || '(kosong)').slice(0, 60);
  } catch (e) {
    elSettings.testResult.textContent = '✕ ' + e.message;
  }
}

function applyProviderVisibility() {
  elSettings.ollamaRow.classList.toggle('hidden', cfg.provider !== 'ollama');
  elSettings.bridgeRow.classList.toggle('hidden', cfg.provider !== 'opencode' && cfg.provider !== 'claude' && cfg.provider !== 'codex');
}

function initSettings() {
  elSettings.provider.value = cfg.provider || 'local';
  elSettings.tone.value = settingsState.tone();
  elSettings.insight.checked = settingsState.insight();
  elSettings.autoSum.checked = settingsState.autoSum();
  elSettings.ollamaBase.value = cfg.ollamaBase || 'http://localhost:11434';
  elSettings.bridgeBase.value = cfg.bridgeBase || 'http://127.0.0.1:3232';
  elSettings.model.value = cfg.model === '(default)' ? '' : (cfg.model || '');
  elSettings.audioTempo.value = cfg.tempo || 100;
  elSettings.audioSync.value = cfg.sync || 0;
  elSettings.audioVolume.value = cfg.volume || 1;
  applyProviderVisibility();
  refreshProviderStatus();
}

elSettings.audioTempo.onchange = () => {
  const val = Math.max(25, Math.min(150, parseInt(elSettings.audioTempo.value) || 100));
  cfg.tempo = val;
  saveCfg();
  el.tempoNum.value = val;
  el.tempoRange.value = val;
  applyRate(val);
};

elSettings.audioSync.oninput = () => {
  const val = elSettings.audioSync.value;
  document.getElementById('set-sync-value').textContent = val + 'ms';
  cfg.sync = parseInt(val);
  saveCfg();
  el.offset.value = val;
  el.offsetVal.textContent = (val > 0 ? '+' : '') + val + 'ms';
};

elSettings.audioVolume.oninput = () => {
  const val = parseFloat(elSettings.audioVolume.value);
  cfg.volume = val;
  saveCfg();
  audio.setVolume(val);
  const pct = Math.round(val * 100) + '%';
  document.getElementById('set-volume-value').textContent = pct;
};

elSettings.open.onclick = () => { initSettings(); settingsOverlay.classList.remove('hidden'); };
elSettings.close.onclick = () => settingsOverlay.classList.add('hidden');
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden'); });
elSettings.nav.onclick = (e) => {
  const b = e.target.closest('button[data-page]');
  if (!b) return;
  elSettings.nav.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  document.getElementById('page-assistant').classList.toggle('hidden', b.dataset.page !== 'assistant');
  document.getElementById('page-provider').classList.toggle('hidden', b.dataset.page !== 'provider');
  document.getElementById('page-audio').classList.toggle('hidden', b.dataset.page !== 'audio');
};

elSettings.provider.onchange = () => {
  cfg.provider = elSettings.provider.value;
  cfg.model = '';
  if (cfg.provider === 'ollama') ollamaDetect();
  if (cfg.provider !== 'local') bridgeCheck();
  applyProviderVisibility();
  saveCfg();
  refreshProviderStatus();
};

document.getElementById('tutorial-close').onclick = () => tutorialPanel.classList.add('hidden');
elSettings.insight.onchange = () => { cfg.autoInsight = elSettings.insight.checked; saveCfg(); };
elSettings.autoSum.onchange = () => { cfg.autoSummary = elSettings.autoSum.checked; saveCfg(); };
elSettings.ollamaBase.onchange = () => { cfg.ollamaBase = elSettings.ollamaBase.value.trim() || 'http://localhost:11434'; saveCfg(); ollamaDetect(); };
elSettings.ollamaDetect.onclick = ollamaDetect;
elSettings.ollamaModel.onchange = () => { cfg.model = elSettings.ollamaModel.value; saveCfg(); refreshProviderStatus(); };
elSettings.bridgeBase.onchange = () => { cfg.bridgeBase = elSettings.bridgeBase.value.trim() || 'http://127.0.0.1:3232'; saveCfg(); };
elSettings.model.onchange = () => { cfg.model = elSettings.model.value.trim(); saveCfg(); refreshProviderStatus(); };
elSettings.bridgeCheck.onclick = bridgeCheck;
elSettings.test.onclick = testProvider;

document.getElementById('llm-open-settings').onclick = elSettings.open.onclick;

async function askLlm(text) {
  llmHistory.push({ role: 'user', content: text });
  if (llmHistory.length > 10) llmHistory = llmHistory.slice(-10);
  const tone = settingsState.tone();
  const toneText = {
    motivator: 'Gaya bicara: hangat, suportif, memotivasi.',
    blunt: 'Gaya bicara: blak-blakan, tanpa basa-basi, wajib kasih call-to-action.',
    technical: 'Gaya bicara: teknis dan analitis, pakai angka/milidetik bila relevan.',
  }[tone];
  const messages = [
    {
      role: 'system',
      content: 'Kamu coach drum pribadi dalam web app latihan drum ala Guitar Hero. Bahasa Indonesia. ' + toneText +
        ' Jawaban singkat (maksimal ~150 kata), langsung ke inti, TIDAK memakai markdown. Beri drill konkret. GM drum map: kick/snare/hi-hat/tom/crash/ride.',
    },
    {
      role: 'system',
      content: 'KAMU BISA MENGONTROL APP. Kalau user minta dibuatkan groove/latihan/notes/chart (mis. dari judul/genre lagu), JANGAN cuma menjelaskan — SELALU keluarkan satu blok perintah JSON di akhir jawaban, app akan langsung membuat not-nya:\n' +
        '```drum\n{"action":"generateGroove","genre":"rock","bpm":90,"bars":8,"title":"Judul Lagu"}\n```\n' +
        'genre harus salah satu: ' + GROOVE_GENRES.join(', ') + ' (tebak dari judul/feel lagu; default rock). Aksi lain: {"action":"setTempo","percent":80}, {"action":"play"}, {"action":"pause"}. Hanya satu blok drum per jawaban.',
    },
    { role: 'system', content: 'Status app: ' + platformState() },
    { role: 'system', content: 'Data performa user: ' + coach.contextSummary() },
    ...llmHistory,
  ];
  const answer = await chat(cfg, messages);
  llmHistory.push({ role: 'assistant', content: answer });
  return answer;
}

function platformState() {
  const parts = [
    'mode=' + mode,
    'status=' + (audio.playing ? 'main' : 'berhenti'),
    'tempo=' + Math.round(rate * 100) + '%',
    'lagu=' + (coach.currentSongTitle || coach.getSongInfo().title || '(belum ada)'),
    'notes_di_chart=' + chart.length,
  ];
  return parts.join(', ');
}

// Execute action blocks the AI emits. Returns { clean, notes } — clean text + confirmation lines.
function runDrumCommands(text) {
  const notes = [];
  const clean = text.replace(/```drum\s*([\s\S]*?)```/g, (_, body) => {
    try {
      const cmd = JSON.parse(body.trim());
      const msg = execDrumCommand(cmd);
      if (msg) notes.push(msg);
    } catch (e) {
      notes.push('(perintah app gagal diproses)');
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { clean, notes };
}

function execDrumCommand(cmd) {
  switch (cmd && cmd.action) {
    case 'generateGroove': {
      const raw = buildGroove({ genre: cmd.genre, bpm: cmd.bpm, bars: cmd.bars });
      const title = cmd.title || `${cmd.genre || 'rock'} ${cmd.bpm || 90}bpm`;
      setChart(raw, title);
      coach.setSong(title);
      if (mode === 'sheet') sheet.render(visualTime(), chart);
      else highway.render(visualTime(), chart, {});
      return `🥁 Groove "${title}" dibuat — ${raw.length} notes di highway. Tekan Play (Space) untuk mulai.`;
    }
    case 'setTempo': {
      const pct = Math.max(25, Math.min(150, Math.round(cmd.percent) || 100));
      applyRate(pct);
      el.tempoNum.value = pct; el.tempoRange.value = pct;
      return `⏱ Tempo diset ${pct}%.`;
    }
    case 'play': if (!audio.playing) togglePlay(); return '▶ Diputar.';
    case 'pause': if (audio.playing) togglePlay(); return '⏸ Dijeda.';
    default: return null;
  }
}

async function coachAsk(text) {
  coachSay(text, 'me');
  if (providerActive()) {
    const thinking = coachSay('…', 'ai', false);
    try {
      const answer = await askLlm(text);
      const { clean, notes } = runDrumCommands(answer);
      const shown = clean || '(oke)';
      thinking.textContent = shown;
      pushMsg('ai', shown);
      notes.forEach((n) => coachSay(n, 'ai'));
      coachMsgs.scrollTop = coachMsgs.scrollHeight;
      return;
    } catch (e) {
      thinking.textContent = '(' + PROVIDER_LABEL[cfg.provider] + ' gagal — ' + (e.message || 'tidak tersedia') + '. Cadangan ke coach lokal.)';
      coachMsgs.scrollTop = coachMsgs.scrollHeight;
    }
  }
  const answer = coach.reply(text);
  if (answer) coachSay(answer);
}

let coachOpen = false;
let tutorOpen = false;

function coachSay(text, who = 'ai', save = true) {
  const div = document.createElement('div');
  div.className = 'coach-msg ' + who;
  div.textContent = text;
  coachMsgs.appendChild(div);
  coachMsgs.scrollTop = coachMsgs.scrollHeight;
  if (save) pushMsg(who, text);
  return div;
}

// ---- Chat sessions (persisted to localStorage) ----
const SESS_KEY = 'coachSessions';
const coachSessionList = document.getElementById('coach-session-list');
let sessions = [];
let curSession = null;

function saveSessions() {
  try { localStorage.setItem(SESS_KEY, JSON.stringify(sessions)); } catch {}
}
function pushMsg(who, text) {
  if (!curSession) return;
  curSession.msgs.push({ who, text });
  if (curSession.title === 'Sesi baru' && who === 'me') {
    curSession.title = text.slice(0, 40);
    renderSessionList();
  }
  saveSessions();
}
function startSession() {
  curSession = { id: Date.now().toString(36), title: 'Sesi baru', created: Date.now(), msgs: [] };
  sessions.unshift(curSession);
  coachMsgs.innerHTML = '';
  llmHistory = [];
  coachSay(coach.greeting(), 'ai');
  saveSessions();
  renderSessionList();
  coachSessionList.classList.add('hidden');
}
function openSession(id) {
  curSession = sessions.find((s) => s.id === id) || sessions[0];
  coachMsgs.innerHTML = '';
  llmHistory = [];
  curSession.msgs.forEach((m) => {
    coachSay(m.text, m.who, false);
    llmHistory.push({ role: m.who === 'me' ? 'user' : 'assistant', content: m.text });
  });
  llmHistory = llmHistory.slice(-10);
  renderSessionList();
  coachSessionList.classList.add('hidden');
}
function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions();
  if (curSession && curSession.id === id) {
    if (sessions.length) openSession(sessions[0].id);
    else startSession();
  } else renderSessionList();
}
function renderSessionList() {
  coachSessionList.innerHTML = '';
  sessions.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'sess-row' + (curSession && s.id === curSession.id ? ' active' : '');
    const t = document.createElement('span');
    t.className = 'sess-title';
    t.textContent = s.title || 'Sesi baru';
    t.onclick = () => openSession(s.id);
    const del = document.createElement('button');
    del.className = 'sess-del';
    del.textContent = '✕';
    del.title = 'Hapus sesi';
    del.onclick = (e) => { e.stopPropagation(); deleteSession(s.id); };
    row.append(t, del);
    coachSessionList.appendChild(row);
  });
}

function toggleCoach(force) {
  coachOpen = force !== undefined ? force : !coachOpen;
  coachPanel.classList.toggle('hidden', !coachOpen);
  document.body.classList.toggle('coach-open', coachOpen);
  setTimeout(() => { highway.resize(); sheet.resize(); }, 50);
}

function toggleTutorial(force) {
  tutorOpen = force !== undefined ? force : !tutorOpen;
  tutorialPanel.classList.toggle('hidden', !tutorOpen);
  document.body.classList.toggle('tutor-open', tutorOpen);
  setTimeout(() => { highway.resize(); sheet.resize(); }, 50);
}

btnCoach.onclick = () => toggleCoach();
btnCoachClose.onclick = () => toggleCoach(false);
btnCoachSend.onclick = () => {
  const t = coachInput.value.trim();
  if (!t) return;
  coachInput.value = '';
  coachAsk(t);
};
coachInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnCoachSend.onclick();
});
document.querySelectorAll('#coach-chips button').forEach((b) => {
  b.onclick = () => coachAsk(b.dataset.q);
});

document.getElementById('coach-new').onclick = startSession;
document.getElementById('coach-sessions').onclick = () => {
  renderSessionList();
  coachSessionList.classList.toggle('hidden');
};

el.tutorialBtn.onclick = () => toggleTutorial();

el.tempoNum.onchange = () => {
  el.tempoRange.value = el.tempoNum.value;
  applyRate(+el.tempoNum.value);
  el.tempoNum.blur();
};
el.tempoRange.oninput = () => {
  el.tempoNum.value = el.tempoRange.value;
  applyRate(+el.tempoRange.value);
};

document.getElementById('btn-audio').onclick = () => document.getElementById('file-audio').click();
document.getElementById('btn-midi').onclick = () => document.getElementById('file-midi').click();
document.getElementById('file-audio').onchange = (e) => { if (e.target.files[0]) loadAudioFile(e.target.files[0]); };
document.getElementById('file-midi').onchange = (e) => { if (e.target.files[0]) loadMidiFile(e.target.files[0]); };

el.offset.oninput = () => {
  el.offsetVal.textContent = (el.offset.value > 0 ? '+' : '') + el.offset.value + 'ms';
};
el.offsetVal.textContent = '0ms';

let lastInsightAt = -1;
audio.onEnded = () => {
  el.play.textContent = '▶ Play';
  if (settingsState.autoSum()) coachSay(coach.summarizeOnEnd());
};

// Tutorial: load sections from markdown files in /tutorial (see tutorial/manifest.json)
const tutorialNav = document.getElementById('tutorial-nav');
const tutorialText = document.getElementById('tutorial-text');

async function loadTutorialSection(file, btn) {
  tutorialNav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  try {
    const md = await fetch('tutorial/' + file).then((r) => r.text());
    tutorialText.innerHTML = marked.parse(md);
  } catch {
    tutorialText.textContent = 'Gagal memuat tutorial.';
  }
}

fetch('tutorial/manifest.json')
  .then((r) => r.json())
  .then((sections) => {
    sections.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = s.title;
      b.onclick = () => loadTutorialSection(s.file, b);
      tutorialNav.appendChild(b);
      if (i === 0) loadTutorialSection(s.file, b);
    });
  })
  .catch(() => { tutorialText.textContent = 'Manifest tutorial tidak ditemukan.'; });

el.play.textContent = '▶ Play';

setupMidi();
setMode(mode);
audio.setRate(rate);
audio.setVolume(cfg.volume !== undefined ? cfg.volume : 1);
el.tempoNum.value = Math.round(rate * 100);
el.tempoRange.value = Math.round(rate * 100);
try { sessions = JSON.parse(localStorage.getItem(SESS_KEY)) || []; } catch { sessions = []; }
if (sessions.length) openSession(sessions[0].id);
else startSession();

function coachPeriodic(now) {
  if (!audio.playing || !coachOpen || !settingsState.insight()) return;
  if (now > 30 && (lastInsightAt === -1 || now - lastInsightAt > 45) && coach.hasData()) {
    lastInsightAt = now;
    const acc = coach.accuracy();
    if (acc !== null && acc < 0.75) {
      coachSay('Insight dadakan: ' + coach.reply('lane terlemah'));
    }
  }
}

function loop() {
  if (mode === 'sheet') sheet.render(visualTime(), chart);
  else highway.render(visualTime(), chart, {});
  el.time.textContent = `${fmtTime(audio.currentTime())} / ${fmtTime(audio.duration())}`;
  coachPeriodic(audio.currentTime());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
