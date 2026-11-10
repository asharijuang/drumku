import { LANES, laneById } from './lanes.js';

export function createHighway(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let w = 0;
  let h = 0;

  const flash = [];
  const hits = [];
  const misses = [];

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  window.addEventListener('resize', resize);
  resize();

  const layout = () => {
    const laneAreaW = Math.min(w * 0.72, 720);
    const laneW = laneAreaW / LANES.length;
    const startX = (w - laneAreaW) / 2;
    const hitY = h * 0.86;
    return { laneAreaW, laneW, startX, hitY };
  };

  function gridColor(alpha) {
    return `rgba(255,255,255,${alpha})`;
  }

  function render(now, notes, opts2 = {}) {
    const { dangerWindow = 0.15 } = opts2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    const { laneAreaW, laneW, startX, hitY } = layout();
    const lookAhead = 2.6;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(startX, 0, laneAreaW, h, 18);
    ctx.clip();

    ctx.fillStyle = '#101020';
    ctx.fillRect(startX, 0, laneAreaW, h);

    for (let i = 0; i < LANES.length; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(startX + i * laneW, 0, laneW, h);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= LANES.length; i++) {
      ctx.beginPath();
      ctx.moveTo(startX + i * laneW, 0);
      ctx.lineTo(startX + i * laneW, h);
      ctx.stroke();
    }

    const tOf = (n) => n.tw ?? n.t;
    const t0 = now;
    const t1 = now + lookAhead;
    let idx = opts.lastIdx || 0;
    while (idx < notes.length && tOf(notes[idx]) < t0 - 1) idx++;
    if (opts.lastIdx !== idx) opts.lastIdx = idx;

    const judgeLine = now + (h - hitY) / h * lookAhead;

    for (let i = idx; i < notes.length; i++) {
      const n = notes[i];
      const nt = tOf(n);
      if (nt > t1) break;
      const lane = laneById(n.lane);
      if (!lane) continue;
      const visibleT = nt - judgeLine;
      if (visibleT < -0.4) continue;
      const y = hitY - (visibleT) / lookAhead * h;
      const x = startX + LANES.indexOf(lane) * laneW + laneW / 2;
      const r = Math.min(laneW * 0.32, 22);

      let alpha = 1;
      if (visibleT > lookAhead * 0.85) {
        alpha = 1 - (visibleT - lookAhead * 0.85) / (lookAhead * 0.15);
      }
      ctx.globalAlpha = Math.max(0, alpha);

      if (isdangered(n, judgeLine, dangerWindow)) {
        drawMarker(lane, x, y, r, n, true);
      } else if (n.judged === 'hit') {
        drawMarker(lane, x, y, r, n, false, 0.35);
        ctx.globalAlpha = Math.max(0, alpha) * 0.35;
        drawRing(x, y, r + 4, '#7cff8f', 2);
        ctx.globalAlpha = alpha;
      } else if (n.judged === 'miss') {
        drawMarker(lane, x, y, r, n, false, 0.25);
      } else {
        drawMarker(lane, x, y, r, n);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(startX, hitY - 2, laneAreaW, 3);
    ctx.strokeStyle = 'rgba(124,108,255,0.9)';
    ctx.lineWidth = 4;
    ctx.strokeRect(startX, hitY - 4, laneAreaW, 8);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 12px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < LANES.length; i++) {
      const x = startX + i * laneW + laneW / 2;
      const lane = LANES[i];
      ctx.fillStyle = lane.color + 'cc';
      ctx.fillText(lane.label.toUpperCase(), x, hitY + 34);
    }

    drawEffects({ hitY, laneW, startX });
    drawTextFeedback({ hitY, laneW, startX });
  }

  function isdangered(n, judgeLine, dangerWindow) {
    return Math.abs((n.tw ?? n.t) - judgeLine) < dangerWindow && !n.judged;
  }

  function drawMarker(lane, x, y, r, n, danger = false, alpha = 1) {
    ctx.globalAlpha = alpha * ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, alpha);
    const col = danger ? '#ffffff' : lane.color;
    ctx.save();
    if (lane.cymbal) {
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      if (danger) {
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.fill();
      } else if (alpha < 1) {
        ctx.globalAlpha *= alpha;
        ctx.fill();
      } else {
        ctx.fill();
      }
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (danger) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha *= 0.35;
        ctx.fill();
      } else if (alpha < 1) {
        ctx.globalAlpha *= alpha;
        ctx.fill();
      } else {
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRing(x, y, r, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawEffects({ hitY, laneW, startX }) {
    for (let i = flash.length - 1; i >= 0; i--) {
      const f = flash[i];
      const age = f.t0 - performance.now();
      if (age < -350) {
        flash.splice(i, 1);
        continue;
      }
      const k = 1 + age / -350;
      const alpha = Math.max(0, 1 - k);
      const lane = laneById(f.lane);
      if (!lane) continue;
      const x = startX + LANES.indexOf(lane) * laneW + laneW / 2;
      ctx.globalAlpha = alpha * 0.8;
      drawRing(x, hitY, 20 + k * 26, lane.color, 4);
      ctx.globalAlpha = 1;
    }
  }

  function drawTextFeedback({ hitY }) {
    for (let i = misses.length - 1; i >= 0; i--) {
      const f = misses[i];
      const age = (performance.now() - f.t0) / 500;
      if (age > 1) {
        misses.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - age;
      ctx.font = '800 26px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, hitY - 60 - age * 30);
      ctx.globalAlpha = 1;
    }
  }

  function addHitFlash(lane) {
    flash.push({ lane, t0: performance.now() });
  }

  function addFeedback(text, color, x) {
    misses.push({ text, color, t0: performance.now(), x });
  }

  function clearEffects() {
    flash.length = 0;
    misses.length = 0;
    opts.lastIdx = undefined;
  }

  return { render, resize, clearEffects, addHitFlash, addFeedback };
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
