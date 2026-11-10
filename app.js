import { parseMidi } from './midi.js';
import { chartFromNotes, laneOf } from './lanes.js';
import { createAudio, generateDemoSong } from './audio.js';
import { createHighway, fmtTime } from './highway.js';
import { createSheet } from './sheet.js';

const audio = createAudio();
const canvas = document.getElementById('highway');
const highway = createHighway(canvas, {});
const sheet = createSheet(canvas);
let mode = localStorage.getItem('mode') || 'highway';
let chart = [];

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
  sheet.setBeats(beats);
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
  } catch (e) {
    alert('Gagal parse MIDI: ' + e.message);
  }
  hideLoading();
}

async function startDemo() {
  showLoading('Generating demo…');
  try {
    const { buffer, chart: demoChart } = await generateDemoSong();
    audio.setBuffer(buffer);
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
  while (scanIdx < chart.length && chart[scanIdx].t < target - judgeWindow) {
    const n = chart[scanIdx];
    if (!n.judged) {
      n.judged = 'miss';
      combo = 0;
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
      if (n.t < target - 1.5) continue;
      if (n.t > target + 1) break;
      if (n.judged || n.lane !== hitLane) continue;
      const d = Math.abs(n.t - target);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (best && bestDist <= judgeWindow) {
      best.judged = 'hit';
      combo++;
      score += combo >= 8 ? 150 : 100;
      highway.addHitFlash(hitLane);
      sheet.addHitFlash(hitLane);
    } else {
      combo = 0;
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
el.device.onclick = () => setupMidi();
document.getElementById('btn-audio').onclick = () => document.getElementById('file-audio').click();
document.getElementById('btn-midi').onclick = () => document.getElementById('file-midi').click();
document.getElementById('file-audio').onchange = (e) => { if (e.target.files[0]) loadAudioFile(e.target.files[0]); };
document.getElementById('file-midi').onchange = (e) => { if (e.target.files[0]) loadMidiFile(e.target.files[0]); };

el.offset.oninput = () => {
  el.offsetVal.textContent = (el.offset.value > 0 ? '+' : '') + el.offset.value + 'ms';
};

setupMidi();
setMode(mode);

function loop() {
  if (mode === 'sheet') sheet.render(visualTime(), chart);
  else highway.render(visualTime(), chart, {});
  el.time.textContent = `${fmtTime(audio.currentTime())} / ${fmtTime(audio.duration())}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
