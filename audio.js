export function createAudio() {
  const el = new Audio();
  el.preservesPitch = true;
  let objectUrl = null;
  let onEndedCb = null;
  el.addEventListener('ended', () => {
    if (onEndedCb && el.crossedEnd !== true) onEndedCb();
  });

  function revoke() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    el.removeAttribute('src');
    el.load();
  }

  async function loadFile(file) {
    revoke();
    objectUrl = URL.createObjectURL(file);
    el.src = objectUrl;
    await waitForCanPlay();
  }

  async function setBlob(blob) {
    revoke();
    objectUrl = URL.createObjectURL(blob);
    el.src = objectUrl;
    await waitForCanPlay();
  }

  function waitForCanPlay() {
    return new Promise((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = (e) => { cleanup(); reject(new Error('Audio gagal load: ' + (e && e.message))); };
      const cleanup = () => {
        el.removeEventListener('canplay', ok);
        el.removeEventListener('error', bad);
      };
      el.addEventListener('canplay', ok);
      el.addEventListener('error', bad);
    });
  }

  function currentTime() {
    return isFinite(el.currentTime) ? el.currentTime : 0;
  }

  function duration() {
    return isFinite(el.duration) ? el.duration : 0;
  }

  function play() {
    el.play();
  }

  function pause() {
    el.pause();
  }

  function stop() {
    el.pause();
    el.currentTime = 0;
  }

  function seek(sec) {
    el.currentTime = Math.max(0, Math.min(sec, duration() - 0.05));
  }

  function setRate(r) {
    el.playbackRate = Math.max(0.25, Math.min(2, r));
  }

  function setVolume(v) {
    el.volume = Math.max(0, Math.min(1, v));
  }

  function getPlaying() { return !el.paused && !el.ended; }

  return {
    loadFile, setBlob, play, pause, stop, seek, setRate, setVolume,
    currentTime, duration,
    get playing() { return getPlaying(); },
    set onEnded(cb) { onEndedCb = cb; },
  };
}

export function bufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const dataSize = len * numCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);

  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF');
  dv.setUint32(4, 36 + dataSize, true);
  wstr(8, 'WAVE');
  wstr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true);
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * numCh * bytesPerSample, true);
  dv.setUint16(32, numCh * bytesPerSample, true);
  dv.setUint16(34, 16, true);
  wstr(36, 'data');
  dv.setUint32(40, dataSize, true);

  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = Math.max(-1, Math.min(1, chans[c][i]));
      dv.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// Render an arbitrary GM-note chart ([{note,t,vel}]) to an audio buffer so
// AI-generated grooves are actually playable. Reuses simple synth voices.
export async function renderNotes(rawNotes) {
  const sr = 44100;
  const last = rawNotes.reduce((m, n) => Math.max(m, n.t), 0);
  const dur = last + 1.2;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const noise = (seconds) => {
    const b = oc.createBuffer(1, Math.ceil(seconds * sr), sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  const kick = (t, v) => {
    const o = oc.createOscillator(), g = oc.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(oc.destination); o.start(t); o.stop(t + 0.32);
  };
  const snare = (t, v) => {
    const n = oc.createBufferSource(); n.buffer = noise(0.22);
    const f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = oc.createGain(); g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(oc.destination); n.start(t);
  };
  const hat = (t, v, open) => {
    const n = oc.createBufferSource(); n.buffer = noise(open ? 0.3 : 0.06);
    const f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = open ? 6000 : 7000;
    const g = oc.createGain(); g.gain.setValueAtTime((open ? 0.22 : 0.18) * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.05));
    n.connect(f).connect(g).connect(oc.destination); n.start(t);
  };
  const cymbal = (t, v, seconds) => {
    const n = oc.createBufferSource(); n.buffer = noise(seconds);
    const f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
    const g = oc.createGain(); g.gain.setValueAtTime(0.28 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    n.connect(f).connect(g).connect(oc.destination); n.start(t);
  };
  const TOM_FREQ = { 48: 300, 50: 280, 47: 240, 45: 190, 43: 160, 41: 150, 58: 200 };
  const tom = (t, v, note) => {
    const freq = TOM_FREQ[note] || 200;
    const o = oc.createOscillator(), g = oc.createGain();
    o.frequency.setValueAtTime(freq * 1.3, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.15);
    g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(oc.destination); o.start(t); o.stop(t + 0.27);
  };
  for (const n of rawNotes) {
    const v = Math.max(0.2, Math.min(1.2, (n.vel || 100) / 100));
    const note = n.note, t = n.t;
    if (note === 36 || note === 35) kick(t, v);
    else if (note === 38 || note === 37 || note === 40) snare(t, v);
    else if (note === 46) hat(t, v, true);
    else if (note === 42 || note === 44 || note === 26) hat(t, v, false);
    else if (note === 49 || note === 52 || note === 55 || note === 57) cymbal(t, v, 1.2);
    else if (note === 51 || note === 53 || note === 59) cymbal(t, v, 0.5);
    else tom(t, v, note); // remaining = toms
  }
  return oc.startRendering();
}

export async function generateDemoSong() {
  const bpm = 120;
  const bar = 2;
  const bars = 16;
  const dur = bar * bars;
  const sr = 44100;
  const oc = new OfflineAudioContext(2, dur * sr, sr);

  function noiseBuffer(seconds) {
    const b = oc.createBuffer(1, seconds * sr, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function kick(t) {
    const o = oc.createOscillator();
    const g = oc.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + 0.32);
  }

  function snare(t) {
    const n = oc.createBufferSource();
    n.buffer = noiseBuffer(0.22);
    const f = oc.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(oc.destination);
    n.start(t);
    const o = oc.createOscillator();
    const g2 = oc.createGain();
    o.frequency.value = 190;
    g2.gain.setValueAtTime(0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2).connect(oc.destination);
    o.start(t);
    o.stop(t + 0.12);
  }

  function hat(t) {
    const n = oc.createBufferSource();
    n.buffer = noiseBuffer(0.06);
    const f = oc.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f).connect(g).connect(oc.destination);
    n.start(t);
  }

  function openHat(t) {
    const n = oc.createBufferSource();
    n.buffer = noiseBuffer(0.3);
    const f = oc.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(f).connect(g).connect(oc.destination);
    n.start(t);
  }

  function cymbal(t, seconds, gain) {
    const n = oc.createBufferSource();
    n.buffer = noiseBuffer(seconds);
    const f = oc.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4500;
    const g = oc.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    n.connect(f).connect(g).connect(oc.destination);
    n.start(t);
  }

  function tom(t, freq) {
    const o = oc.createOscillator();
    const g = oc.createGain();
    o.frequency.setValueAtTime(freq * 1.3, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.15);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + 0.27);
  }

  function chord(t, freqs, seconds) {
    for (const fq of freqs) {
      const o = oc.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fq;
      const f = oc.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g = oc.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      o.connect(f).connect(g).connect(oc.destination);
      o.start(t);
      o.stop(t + seconds + 0.05);
    }
  }

  function bass(t, fq, seconds) {
    const o = oc.createOscillator();
    o.type = 'triangle';
    o.frequency.value = fq / 2;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.setValueAtTime(0.18, t + seconds * 0.7);
    g.gain.linearRampToValueAtTime(0.0, t + seconds);
    o.connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + seconds + 0.05);
  }

  const prog = [
    { chord: [220, 261.6, 329.6], bass: 110 },
    { chord: [174.6, 220, 261.6], bass: 87.3 },
    { chord: [130.8, 164.8, 196], bass: 65.4 },
    { chord: [196, 246.9, 293.7], bass: 98 },
  ];

  const chart = [];

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const p = prog[b % 4];
    chord(t0, p.chord, 0.9);
    chord(t0 + 1, p.chord, 0.9);
    for (let e = 0; e < 4; e++) bass(t0 + e * 0.5, p.bass, 0.45);

    kick(t0);
    kick(t0 + 1.5);
    chart.push({ t: t0, note: 36, vel: 100 });
    chart.push({ t: t0 + 1.5, note: 36, vel: 90 });

    snare(t0 + 0.5);
    snare(t0 + 1.5);
    chart.push({ t: t0 + 0.5, note: 38, vel: 100 });
    chart.push({ t: t0 + 1.5, note: 38, vel: 100 });

    for (let e = 0; e < 4; e++) {
      hat(t0 + e * 0.5);
      chart.push({ t: t0 + e * 0.5, note: 42, vel: 70 });
    }

    if (b % 4 === 0) {
      cymbal(t0, 1.2, 0.28);
      chart.push({ t: t0, note: 49, vel: 95 });
    } else if (b % 2 === 1) {
      openHat(t0 + 1.5);
      for (let i = chart.length - 1; i >= 0; i--) {
        if (chart[i].t === t0 + 1.5 && chart[i].note === 42) {
          chart.splice(i, 1);
          break;
        }
      }
      chart.push({ t: t0 + 1.5, note: 46, vel: 80 });
      chart.sort((x, y) => x.t - y.t);
    }

    if (b === bars - 2) {
      const toms = [48, 47, 45, 43];
      for (let i = 0; i < 4; i++) {
        const t = t0 + 1.5 + i * 0.125;
        tom(t, toms[i] === 48 ? 300 : toms[i] === 47 ? 240 : toms[i] === 45 ? 190 : 150);
        chart.push({ t, note: toms[i], vel: 90 });
      }
      chart.sort((x, y) => x.t - y.t);
    }
    if (b === bars - 1) {
      cymbal(t0, 1.6, 0.3);
      chart.push({ t: t0, note: 49, vel: 100 });
    }
  }

  const buffer = await oc.startRendering();
  return { buffer, chart };
}
