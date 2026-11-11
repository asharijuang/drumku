// Deterministic GM-drum groove generator. The AI picks {genre, bpm, bars};
// this builds accurate note timings so charts are always playable.
const GM = { kick: 36, snare: 38, hh: 42, crash: 49, ride: 51, tom1: 48, tom2: 45, tom3: 41 };

// Steps on a 16-step (16th-note) bar grid. 0=beat1, 4=beat2, 8=beat3, 12=beat4.
const PATTERNS = {
  rock:    { kick: [0, 8], snare: [4, 12], hh: [0, 2, 4, 6, 8, 10, 12, 14] },
  pop:     { kick: [0, 6, 8], snare: [4, 12], hh: [0, 2, 4, 6, 8, 10, 12, 14] },
  funk:    { kick: [0, 3, 10], snare: [4, 12], hh: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [7, 15] },
  ballad:  { kick: [0, 8], snare: [4, 12], hh: [0, 4, 8, 12] },
  dangdut: { kick: [0, 2, 6, 8, 10, 14], snare: [4, 12], hh: [0, 2, 4, 6, 8, 10, 12, 14] },
  shuffle: { kick: [0, 8], snare: [4, 12], ride: [0, 3, 4, 7, 8, 11, 12, 15] },
};

export const GROOVE_GENRES = Object.keys(PATTERNS);

export function buildGroove({ genre = 'rock', bpm = 90, bars = 8 } = {}) {
  const p = PATTERNS[genre] || PATTERNS.rock;
  bpm = Math.max(40, Math.min(220, Math.round(bpm) || 90));
  bars = Math.max(1, Math.min(32, Math.round(bars) || 8));
  const sixteenth = 60 / bpm / 4;
  const notes = [];
  const add = (step, barT, note, vel) => notes.push({ note, t: barT + step * sixteenth, vel });
  for (let b = 0; b < bars; b++) {
    const barT = 0.5 + b * 16 * sixteenth; // 0.5s lead-in
    (p.kick || []).forEach((s) => add(s, barT, GM.kick, 100));
    (p.snare || []).forEach((s) => add(s, barT, GM.snare, 100));
    (p.ghost || []).forEach((s) => add(s, barT, GM.snare, 45));
    (p.hh || []).forEach((s) => add(s, barT, GM.hh, 70));
    (p.ride || []).forEach((s) => add(s, barT, GM.ride, 75));
    if (b === 0) add(0, barT, GM.crash, 110);
    if (b === bars - 1) [GM.tom1, GM.tom1, GM.tom2, GM.tom3].forEach((n, i) => add(8 + i * 2, barT, n, 95));
  }
  notes.sort((a, b) => a.t - b.t);
  return notes;
}

// self-check: `node groove.js`
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('groove.js')) {
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  const n = buildGroove({ genre: 'rock', bpm: 120, bars: 4 });
  assert(n.length > 0, 'produces notes');
  assert(n.every((x, i) => i === 0 || x.t >= n[i - 1].t), 'sorted by time');
  assert(buildGroove({ genre: 'nonexistent' }).length > 0, 'falls back to rock');
  assert(buildGroove({ bpm: 9999, bars: 999 }).length > 0, 'clamps insane input');
  console.log('groove.js OK —', n.length, 'notes for 4 bars rock @120');
}
