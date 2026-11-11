import { laneColorOf, laneById } from './lanes.js';

const NOTE_POS = {
  35: { y: 1, head: 'fill', lane: 'kick' },
  36: { y: 1, head: 'fill', lane: 'kick' },
  37: { y: 5, head: 'fill', lane: 'snare' },
  38: { y: 5, head: 'fill', lane: 'snare' },
  40: { y: 5, head: 'fill', lane: 'snare' },
  42: { y: 8, head: 'x', lane: 'hh' },
  44: { y: 8, head: 'x', lane: 'hh' },
  46: { y: 8, head: 'x', open: true, lane: 'hh' },
  26: { y: 8, head: 'x', open: true, lane: 'hh' },
  48: { y: 7, head: 'fill', lane: 'tom' },
  50: { y: 7, head: 'fill', lane: 'tom' },
  45: { y: 6, head: 'fill', lane: 'tom' },
  47: { y: 6, head: 'fill', lane: 'tom' },
  41: { y: 3, head: 'fill', lane: 'tom' },
  43: { y: 3, head: 'fill', lane: 'tom' },
  58: { y: 3, head: 'fill', lane: 'tom' },
  49: { y: 11, head: 'x', lane: 'crash' },
  52: { y: 11, head: 'x', lane: 'crash' },
  55: { y: 11, head: 'x', lane: 'crash' },
  57: { y: 11, head: 'x', lane: 'crash' },
  51: { y: 9, head: 'x', lane: 'ride' },
  53: { y: 9, head: 'x', lane: 'ride' },
  59: { y: 10, head: 'x', lane: 'ride' },
};

const LANE_CUE_Y = { kick: 1, snare: 5, hh: 8, tom: 6, crash: 11, ride: 9 };

export function createSheet(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let w = 0;
  let h = 0;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  let beats = null;
  const flashes = [];
  const feedbacks = [];

  function setBeats(b) {
    beats = Array.from(b || []);
  }

  function beatsAt(t) {
    if (!beats || beats.length < 2) return t;
    if (t <= beats[0]) return (t - beats[0]) / (beats[1] - beats[0]);
    if (t >= beats[beats.length - 1]) {
      const rate = (beats.length - 1 - beats[beats.length - 2]) / (beats[beats.length - 1] - beats[beats.length - 2]);
      return beats.length - 1 + (t - beats[beats.length - 1]) * rate;
    }
    let lo = 0;
    let hi = beats.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (beats[mid] <= t) lo = mid;
      else hi = mid;
    }
    const seg = beats[hi] - beats[lo] || 0.5;
    return lo + (t - beats[lo]) / seg;
  }

  function render(now, chart) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    const marginX = Math.min(48, Math.max(8, w * 0.06));
    const usableW = Math.max(1, w - marginX * 2);
    const barsPerRow = Math.min(4, Math.max(1, Math.floor(usableW / 180)));
    const beatsPerRow = barsPerRow * 4;
    const headerH = Math.min(112, Math.max(76, h * 0.12));
    const scoreH = Math.max(1, h - headerH);
    const rowCount = Math.min(8, Math.max(1, Math.floor(scoreH / 120)));
    const rowH = scoreH / rowCount;
    const gap = Math.max(6, Math.min(11, rowH * 0.10));
    const pxPerBeat = usableW / beatsPerRow;
    const bNow = beatsAt(now);
    const pageStart = Math.max(0, Math.floor(bNow / (beatsPerRow * rowCount)) * beatsPerRow * rowCount);
    const activeRow = Math.min(rowCount - 1, Math.floor((bNow - pageStart) / beatsPerRow));
    const playX = marginX + Math.min(beatsPerRow, Math.max(0, (bNow - pageStart) % beatsPerRow)) * pxPerBeat;

    // Wrap the score to fit the available width and height.
    for (let row = 0; row < rowCount; row++) {
      const bandTop = headerH + row * rowH;
      const bandCY = bandTop + rowH * 0.56;
      const rowStartBeat = pageStart + row * beatsPerRow;
      const rowPlayX = Math.min(w - marginX, Math.max(marginX, marginX + ((bNow - rowStartBeat) / beatsPerRow) * usableW));
      const rowGap = gap;
      const yFor = (pitchIdx) => bandCY + (8 - pitchIdx) * (rowGap / 2);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, bandTop + 2, w, rowH - 4);
      ctx.clip();

      ctx.strokeStyle = '#45455a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = yFor(i * 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.rect(0, bandTop, w, yFor(16) - gap / 2 - bandTop);
      ctx.rect(0, yFor(-2) + gap / 2, w, bandTop + rowH - (yFor(-2) + gap / 2));
      ctx.fillStyle = '#0a0a12';
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        const y = yFor(i * 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#e8e8f0';
      ctx.lineWidth = 3;
      for (const dx of [0, 7]) {
        ctx.beginPath();
        ctx.moveTo(rowPlayX + 12 + dx, yFor(0) - gap * 1.3);
        ctx.lineTo(rowPlayX + 12 + dx, yFor(8) + gap * 1.3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('4/4', marginX + 26, yFor(4) + 4);

      for (let bar = 0; bar <= barsPerRow; bar++) {
        const x = marginX + bar * 4 * pxPerBeat;
        if (x < -20 || x > w + 20) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yFor(0));
        ctx.lineTo(x, yFor(8));
        ctx.stroke();
        const barNum = Math.floor(rowStartBeat / 4) + bar + 1;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '600 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(barNum, x, yFor(8) - gap * 1.1);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      for (let q = 0; q < beatsPerRow; q++) {
        const x = marginX + q * pxPerBeat;
        if (q % 4 === 0) continue;
        ctx.beginPath();
        ctx.moveTo(x, yFor(0));
        ctx.lineTo(x, yFor(8));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (let i2 = 0; i2 < chart.length; i2++) {
        const n = chart[i2];
        if (n.b === undefined) n.b = beatsAt(n.tw ?? n.t);
        const nRow = Math.floor((n.b - pageStart) / beatsPerRow);
        if (nRow < row) continue;
        if (nRow > row) break;
        const x = marginX + (n.b - rowStartBeat) * pxPerBeat;
        if (x > w + 30) break;
        if (x < -30) continue;
        const pos = NOTE_POS[n.note];
        if (!pos) continue;
        const y = yFor(pos.y);
        const color = laneColorOf(pos.lane);

        const nearPlayhead = Math.abs((n.tw ?? n.t) - now) < 0.15 && !n.judged;
        let fill = color;
        let alpha = 1;
        if (n.judged === 'hit') {
          fill = '#7cff8f';
          alpha = 0.3;
        } else if (n.judged === 'miss') {
          fill = '#555';
          alpha = 0.45;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.strokeStyle = fill;
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        if (pos.head === 'x') {
          const r = gap * 0.34;
          ctx.moveTo(-r, -r);
          ctx.lineTo(r, r);
          ctx.moveTo(r, -r);
          ctx.lineTo(-r, r);
          ctx.stroke();
        } else {
          ctx.ellipse(-gap * 0.2, 0, gap * 0.34, gap * 0.24, -0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        if (pos.head === 'fill') {
          ctx.beginPath();
          const dir = pos.y === 1 ? 1 : -1;
          ctx.moveTo(gap * 0.12, 0);
          ctx.lineTo(gap * 0.12, dir * gap * 2.9);
          ctx.stroke();
        }

        if (pos.open) {
          ctx.fillStyle = fill;
          ctx.font = '700 10px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('o', 0, -gap * 0.8);
        }
        ctx.restore();

        if (nearPlayhead) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(x, y, gap * 0.75, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
      if (row === activeRow) {
        ctx.strokeStyle = 'rgba(124,108,255,0.85)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(124,108,255,0.7)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(rowPlayX, bandTop + 5);
        ctx.lineTo(rowPlayX, bandTop + rowH - 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    const cueBandCY = headerH + activeRow * rowH + rowH * 0.56;
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const age = (performance.now() - f.t0) / 350;
      if (age > 1) {
        flashes.splice(i, 1);
        continue;
      }
      const pitchIdx = LANE_CUE_Y[f.lane] ?? 5;
      ctx.globalAlpha = (1 - age) * 0.9;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(playX, cueBandCY + (8 - pitchIdx) * (gap / 2), gap * (0.7 + age), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (let i = feedbacks.length - 1; i >= 0; i--) {
      const f = feedbacks[i];
      const age = (performance.now() - f.t0) / 500;
      if (age > 1) {
        feedbacks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - age;
      ctx.font = '800 26px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, playX, cueBandCY - gap * 5.5 - age * 30);
      ctx.globalAlpha = 1;
    }
  }

  function addHitFlash(laneId) {
    flashes.push({ lane: laneId, color: laneById(laneId)?.color || '#fff', t0: performance.now() });
  }
  function addFeedback(text, color, x) {
    feedbacks.push({ text, color, t0: performance.now() });
  }
  function clearEffects() {
    flashes.length = 0;
    feedbacks.length = 0;
  }

  return { render, resize, clearEffects, addHitFlash, addFeedback, setBeats };
}
