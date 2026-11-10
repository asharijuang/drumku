export function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let buffer = null;
  let source = null;

  async function loadFile(file) {
    const buf = await file.arrayBuffer();
    buffer = await ctx.decodeAudioData(buf);
    stop();
    return buffer;
  }

  function setBuffer(buf) {
    stop();
    buffer = buf;
  }

  const state = {
    playing: false,
    offset: 0,
    startedAt: 0,
  };

  function currentTime() {
    if (!state.playing) return state.offset;
    return state.offset + (ctx.currentTime - state.startedAt);
  }

  function duration() {
    return buffer ? buffer.duration : 0;
  }

  function play(from = undefined) {
    if (!buffer) return;
    ctx.resume();
    const start = from === undefined ? state.offset : from;
    stop(false);
    state.offset = Math.max(0, Math.min(start, buffer.duration - 0.05));
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (!source || source.__manual) return;
      state.playing = false;
      state.offset = buffer.duration;
    };
    source.__manual = false;
    source.start(0, state.offset);
    state.startedAt = ctx.currentTime;
    state.playing = true;
  }

  function pause() {
    if (!state.playing) return;
    state.offset = currentTime();
    stop(false);
  }

  function stop(reset = true) {
    if (source) {
      source.__manual = true;
      try { source.stop(0); } catch (e) {}
      source.disconnect();
      source = null;
    }
    state.playing = false;
    if (reset) state.offset = 0;
  }

  function seek(sec) {
    const p = state.playing;
    stop(false);
    state.offset = Math.max(0, Math.min(sec, duration() - 0.05));
    if (p) play();
  }

  return { ctx, loadFile, setBuffer, play, pause, stop, seek, currentTime, duration, get playing() { return state.playing; } };
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
      chart.push({ t: t0, note: 49, vel: 95, force: 'crash' });
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
      chart.push({ t: t0, note: 49, vel: 100, force: 'crash' });
    }
  }

  const buffer = await oc.startRendering();
  return { buffer, chart };
}
