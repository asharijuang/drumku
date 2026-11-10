export function parseMidi(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  let pos = 0;
  const u32 = () => { const v = dv.getUint32(pos); pos += 4; return v; };
  const u16 = () => { const v = dv.getUint16(pos); pos += 2; return v; };
  const str4 = () => { let s = ''; for (let i = 0; i < 4; i++) s += String.fromCharCode(dv.getUint8(pos++)); return s; };

  if (str4() !== 'MThd') throw new Error('Not a MIDI file (missing MThd)');
  const headerLen = u32();
  u16();
  const nTracks = u16();
  const division = u16();
  if (headerLen > 6) pos += headerLen - 6;

  let secondsPerTick;
  let ppq;
  if (division & 0x8000) {
    const fps = 256 - ((division >> 8) & 0xff);
    const tpf = division & 0xff;
    secondsPerTick = 1 / (fps * tpf);
    ppq = null;
  } else {
    ppq = division || 480;
  }

  const tempoEvents = [{ tick: 0, usPerQuarter: 500000 }];
  const noteEvents = [];
  const trackEnds = [];

  for (let t = 0; t < nTracks; t++) {
    if (pos >= dv.byteLength) break;
    let id = str4();
    let len = u32();
    while (id !== 'MTrk' && pos < dv.byteLength) {
      pos += len;
      id = str4();
      len = u32();
    }
    if (id !== 'MTrk') break;
    const end = pos + len;
    let tick = 0;
    let runningStatus = 0;

    while (pos < end) {
      let dt = 0;
      let b;
      do {
        b = dv.getUint8(pos++);
        dt = (dt << 7) | (b & 0x7f);
      } while (b & 0x80);
      tick += dt;

      let status = dv.getUint8(pos);
      if (status & 0x80) pos++;
      else status = runningStatus;
      runningStatus = status & 0xf0 ? status : runningStatus;

      if (status === 0xff) {
        const type = dv.getUint8(pos++);
        let mlen = 0;
        do {
          b = dv.getUint8(pos++);
          mlen = (mlen << 7) | (b & 0x7f);
        } while (b & 0x80);
        if (type === 0x51 && mlen === 3) {
          tempoEvents.push({ tick, usPerQuarter: (dv.getUint8(pos) << 16) | (dv.getUint8(pos + 1) << 8) | dv.getUint8(pos + 2) });
        }
        if (type === 0x2f) { trackEnds.push(tick); pos += mlen; continue; }
        pos += mlen;
      } else if (status === 0xf0 || status === 0xf7) {
        let slen = 0;
        do {
          b = dv.getUint8(pos++);
          slen = (slen << 7) | (b & 0x7f);
        } while (b & 0x80);
        pos += slen;
        runningStatus = 0;
      } else {
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        let n1 = dv.getUint8(pos++) & 0x7f;
        let n2 = 0;
        if (kind !== 0xc0 && kind !== 0xd0) n2 = dv.getUint8(pos++) & 0x7f;
        if (channel === 9) {
          if (kind === 0x90 && n2 > 0) {
            noteEvents.push({ tick, note: n1, vel: n2 });
          } else if (kind === 0x90 && n2 === 0) {
            noteEvents.push({ tick, note: n1, vel: 0 });
          } else if (kind === 0x80) {
            noteEvents.push({ tick, note: n1, vel: 0 });
          }
        }
      }
    }
    pos = end;
  }

  tempoEvents.sort((a, b) => a.tick - b.tick);
  noteEvents.sort((a, b) => a.tick - b.tick);

  const tickToSec = (tick) => {
    if (!ppq) return tick * secondsPerTick;
    let sec = 0;
    let lastTick = 0;
    let uspq = 500000;
    for (const te of tempoEvents) {
      if (te.tick >= tick) break;
      sec += (te.tick - lastTick) * uspq / ppq / 1e6;
      lastTick = te.tick;
      uspq = te.usPerQuarter;
    }
    sec += (tick - lastTick) * uspq / ppq / 1e6;
    return sec;
  };

  const notes = noteEvents
    .filter((n) => n.vel > 0)
    .map((n) => ({ t: tickToSec(n.tick), note: n.note, vel: n.vel }))
    .filter((n) => isFinite(n.t));

  let lengthSec = 0;
  const lastTick = Math.max(
    noteEvents.length ? tickToSec(noteEvents[noteEvents.length - 1].tick) : 0,
    trackEnds.length ? tickToSec(Math.max(...trackEnds)) : 0
  );
  lengthSec = lastTick;

  let beats = null;
  if (ppq) {
    let maxTick = 0;
    for (const n of noteEvents) maxTick = Math.max(maxTick, n.tick);
    for (const te of trackEnds) maxTick = Math.max(maxTick, te);
    const nQuarters = Math.ceil(maxTick / ppq) + 2;
    beats = new Float64Array(nQuarters);
    for (let k = 0; k < nQuarters; k++) beats[k] = tickToSec(k * ppq);
  }

  return { notes, lengthSec, beats };
}
