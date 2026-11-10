const NOTE_POS = {
  35: { y: 1, head: 'fill' },
  36: { y: 1, head: 'fill' },
  37: { y: 5, head: 'fill' },
  38: { y: 5, head: 'fill' },
  40: { y: 5, head: 'fill' },
  42: { y: 8, head: 'x' },
  44: { y: 8, head: 'x' },
  46: { y: 8, head: 'x', open: true },
  26: { y: 8, head: 'x', open: true },
  48: { y: 7, head: 'fill' },
  50: { y: 7, head: 'fill' },
  45: { y: 6, head: 'fill' },
  47: { y: 6, head: 'fill' },
  41: { y: 3, head: 'fill' },
  43: { y: 3, head: 'fill' },
  58: { y: 3, head: 'fill' },
  49: { y: 11, head: 'x' },
  52: { y: 11, head: 'x' },
  55: { y: 11, head: 'x' },
  57: { y: 11, head: 'x' },
  51: { y: 9, head: 'x' },
  53: { y: 9, head: 'x' },
  59: { y: 10, head: 'x' },
};

const LANE_CUE_Y = { kick: 1, snare: 5, hh: 8, tom: 6, crash: 11, ride: 9 };
const PX_PER_BEAT = 80;

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

    const gap = Math.max(10, Math.min(15, h * 0.018));
    const staffCY = h * 0.46;
    const yFor = (idx) => staffCY + (8 - idx) * (gap / 2);
    const playX = Math.round(w * 0.26);
    const bNow = beatsAt(now);
    const xOfBeat = (b) => playX + (b - bNow) * PX_PER_BEAT;

    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = yFor(i * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.rect(0, 0, w, yFor(16) - gap / 2);
    ctx.rect(0, yFor(-2) + gap / 2, w, h - yFor(-2));
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
      ctx.moveTo(playX - 38 + dx, yFor(0) - gap * 1.3);
      ctx.lineTo(playX - 38 + dx, yFor(8) + gap * 1.3);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '700 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('4/4', playX - 20, yFor(4) + 4);

    if (beats && beats.length) {
      const bStart = bNow - playX / PX_PER_BEAT;
      const bEnd = bNow + (w - playX) / PX_PER_BEAT;
      for (let bar = Math.max(1, Math.ceil(bStart / 4)); bar * 4 <= bEnd + 4; bar++) {
        const x = xOfBeat(bar * 4);
        if (x < -10 || x > w + 10) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yFor(0));
        ctx.lineTo(x, yFor(8));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(bar, x, yFor(8) - gap * 1.1);
      }
    }

    let idx = 0;
    while (idx < chart.length) {
      const b = chart[idx].b ?? beatsAt(chart[idx].t);
      chart[idx].b = b;
      if (b * PX_PER_BEAT < (bNow * PX_PER_BEAT) - playX - 60) idx++;
      else break;
    }

    for (let i = idx; i < chart.length; i++) {
      const n = chart[i];
      if (n.b === undefined) n.b = beatsAt(n.t);
      const x = xOfBeat(n.b);
      if (x > w + 30) break;
      if (x < -30) continue;
      const pos = NOTE_POS[n.note];
      if (!pos) continue;
      const y = yFor(pos.y);

      const nearPlayhead = Math.abs(n.t - now) < 0.15 && !n.judged;
      ctx.save();
      ctx.translate(x, y);
      let fill = '#e8e8f0';
      let alpha = 1;
      if (n.judged === 'hit') {
        fill = '#7cff8f';
        alpha = 0.35;
      } else if (n.judged === 'miss') {
        fill = '#555';
        alpha = 0.5;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      if (pos.head === 'x') {
        const r = gap * 0.55;
        ctx.moveTo(-r, -r);
        ctx.lineTo(r, r);
        ctx.moveTo(r, -r);
        ctx.lineTo(-r, r);
        ctx.stroke();
      } else {
        ctx.ellipse(-gap * 0.28, 0, gap * 0.42, gap * 0.3, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pos.head === 'fill' && pos.y !== 1) {
        ctx.beginPath();
        ctx.moveTo(gap * 0.16, 0);
        ctx.lineTo(gap * 0.16, -gap * 3.2);
        ctx.stroke();
      } else if (pos.head === 'fill' && pos.y === 1) {
        ctx.beginPath();
        ctx.moveTo(gap * 0.16, 0);
        ctx.lineTo(gap * 0.16, gap * 3.2);
        ctx.stroke();
      }

      if (pos.open) {
        ctx.fillStyle = fill;
        ctx.font = '700 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('o', 0, -gap * 0.9);
      }
      ctx.restore();

      if (nearPlayhead) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x, y, gap * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.strokeStyle = '#7c6cff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(playX, yFor(-2));
    ctx.lineTo(playX, yFor(10));
    ctx.stroke();

    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const age = (performance.now() - f.t0) / 350;
      if (age > 1) {
        flashes.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = (1 - age) * 0.8;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(playX, yFor(LANE_CUE_Y[f.lane] ?? 5), gap * (0.8 + age), 0, Math.PI * 2);
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
      ctx.fillText(f.text, playX, staffCY - gap * 6 - age * 30);
      ctx.globalAlpha = 1;
    }
  }

  function addHitFlash(laneId) {
    flashes.push({ lane: laneId, t0: performance.now() });
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
