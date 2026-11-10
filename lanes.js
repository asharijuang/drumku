export const LANES = [
  { id: 'kick', label: 'Kick', notes: [35, 36], color: '#ef5350', cymbal: false },
  { id: 'snare', label: 'Snare', notes: [37, 38, 40], color: '#4fc3f7', cymbal: false },
  { id: 'hh', label: 'HH', notes: [26, 42, 44, 46], color: '#ffd54f', cymbal: true },
  { id: 'tom', label: 'Toms', notes: [41, 43, 45, 47, 48, 50, 58], color: '#81c784', cymbal: false },
  { id: 'crash', label: 'Crash', notes: [52, 55, 57, 49], notesPriority: true, color: '#ff8a65', cymbal: true },
  { id: 'ride', label: 'Ride', notes: [53, 59, 51], notesPriority: true, color: '#b39ddb', cymbal: true },
];

const noteToLane = new Map();
for (const lane of LANES) {
  for (const n of lane.notes) {
    if (!noteToLane.has(n)) noteToLane.set(n, lane.id);
  }
}

export function laneOf(note) {
  return noteToLane.get(note) || null;
}

export function laneColorOf(noteOrLane) {
  if (noteOrLane === null || noteOrLane === undefined) return null;
  if (typeof noteOrLane === 'number') {
    const laneId = noteToLane.get(noteOrLane);
    return laneId ? laneById(laneId)?.color : null;
  }
  return laneById(noteOrLane)?.color || null;
}

export function laneById(id) {
  return LANES.find((l) => l.id === id);
}

export function chartFromNotes(rawNotes) {
  const notes = [];
  for (const n of rawNotes) {
    const lane = laneOf(n.note);
    if (!lane) continue;
    const l = laneById(lane);
    if (l.notesPriority && notes.length > 0) {
      const prev = notes[notes.length - 1];
      if (prev.t === n.t && l.notes.includes(prev.note)) {
        continue;
      }
    }
    notes.push({ t: n.t, note: n.note, vel: n.vel, lane });
  }
  notes.sort((a, b) => a.t - b.t);
  for (let i = notes.length - 1; i > 0; i--) {
    if (notes[i].t === notes[i - 1].t && notes[i].lane === notes[i - 1].lane) {
      notes.splice(i, 1);
    }
  }
  return notes;
}
