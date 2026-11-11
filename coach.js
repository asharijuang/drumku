const LANE_NAMES = {
  kick: 'kick',
  snare: 'snare',
  hh: 'hi-hat',
  tom: 'tom',
  crash: 'crash',
  ride: 'ride',
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const TIMING_CLASS = {
  perfect: 'sempurna',
  fast: 'terlalu cepat',
  slow: 'terlalu lambat',
};

function classifyDelta(deltaMs) {
  const abs = Math.abs(deltaMs);
  if (abs <= 20) return TIMING_CLASS.perfect;
  if (deltaMs > 0) return TIMING_CLASS.fast;
  return TIMING_CLASS.slow;
}

export function createCoach() {
  let lanes = {};
  let maxCombo = 0;
  let combo = 0;
  let strays = 0;
  let songHistory = [];
  let currentSongTitle = '';
  let sessionStats = { hits: [], missedLanes: [], misses: [] };

  function reset() {
    lanes = {};
    maxCombo = 0;
    combo = 0;
    strays = 0;
    songHistory = [];
    currentSongTitle = '';
    sessionStats = { hits: [], missedLanes: [], misses: [] };
  }

  function laneStats(id) {
    if (!lanes[id]) lanes[id] = { hit: 0, miss: 0, deltas: [] };
    return lanes[id];
  }

  function onAttempt(id, ok, deltaMs) {
    const s = laneStats(id);
    if (ok) {
      s.hit++;
      s.deltas.push(deltaMs);
      if (s.deltas.length > 200) s.deltas.shift();
      combo++;
      if (combo > maxCombo) maxCombo = combo;
    } else {
      s.miss++;
      combo = 0;
    }
    recordAttempt({ id, ok, deltaMs });
  }

  function onMiss(id) {
    if (id) laneStats(id).miss++;
    combo = 0;
    recordMiss(id);
  }

  function onGhost() {
    strays++;
    combo = 0;
  }

  function recordAttempt(attempt) {
    if (!attempt.ok && attempt.deltaMs !== undefined) {
      const timing = classifyDelta(attempt.deltaMs);
      sessionStats.misses.push({ lane: attempt.id, timing });
    }
    if (attempt.ok) sessionStats.hits.push(attempt.id);
  }

  function recordMiss(id) {
    sessionStats.missedLanes.push(id);
    // Ensure lane stats exist, then track timing from deltas if available
    if (!lanes[id]) lanes[id] = { hit: 0, miss: 0, deltas: [] };
    const s = lanes[id];
    if (s && s.deltas.length > 0) {
      const lastDelta = s.deltas[s.deltas.length - 1];
      const timing = classifyDelta(lastDelta);
      sessionStats.misses.push({ lane: id, timing });
    }
  }

  function setSong(title) {
    currentSongTitle = title;
    songHistory.push({ title, timestamp: new Date().toISOString() });
    if (songHistory.length > 20) songHistory = songHistory.slice(-20);
  }

  function getSongInfo() {
    return { title: currentSongTitle, history: songHistory };
  }

  function totalAttempts() {
    let h = 0, m = 0;
    for (const id of Object.keys(lanes)) { h += lanes[id].hit; m += lanes[id].miss; }
    return { hit: h, miss: m };
  }

  function accuracy() {
    const { hit, miss } = totalAttempts();
    const t = hit + miss;
    return t === 0 ? null : hit / t;
  }

  function laneAccuracy(id) {
    const s = lanes[id];
    if (!s) return null;
    const t = s.hit + s.miss;
    return t < 3 ? null : s.hit / t;
  }

  function avgDelta(id) {
    const d = lanes[id] && lanes[id].deltas;
    if (!d || d.length < 3) return null;
    return d.reduce((a, b) => a + b, 0) / d.length;
  }

  function fmtDelta(ms) {
    const v = Math.round(Math.abs(ms));
    return ms > 0 ? `cepat ${v}ms` : `telat ${v}ms`;
  }

  function worstLane() {
    let worst = null;
    let worstAcc = 1;
    for (const id of Object.keys(lanes)) {
      const acc = laneAccuracy(id);
      if (acc !== null && acc < worstAcc) { worstAcc = acc; worst = id; }
    }
    return worst;
  }

  function laneTip(id) {
    const name = LANE_NAMES[id] || id;
    const tips = {
      kick: [
        'Kick yang stabil itu soal konsistensi heel-plant: tumit jangan mengambang. Latih pola 1-3 pelan-pelan dulu sebelum ngebut.',
        'Drill: 16 kick berturut-turut di tempo 60%, dengarkan apakah bunyi pedalnya konsisten atau ada yang " tengil".',
      ],
      snare: [
        'Snare sering tidak konsisten karena titik pukulnya geser — kadang dekat rim, kadang center. Pilih satu titik, ulang 16x pelan dengan velocity konsisten.',
        'Aim satu titik dulu. Kalau rebound sudah konsisten, baru naik tempo sedikit-demi-sedikit.',
      ],
      hh: [
        'Hi-hat paling rapuh soal konsistensi velocity. Hitung 1-2-3-4 dengan aksen di 1 dan 3, pastikan suara buka-tutupnya jelas.',
        'Untuk open-close hat, kaki menekan penuh saat open lalu lepas cepat saat close. Latih di pola 8th note pelan dulu.',
      ],
      tom: [
        'Fill tom rawan terburu-buru. Latih fill 4 ketukan terakhir birama di tempo 50%, hitung "3-e-and-a" biar gerakannya merata.',
        'Biar fill tidak asal, mainkan dalam satu gerakan tangan turun dari tom tinggi ke rendah, bukan empat pukulan terpisah.',
      ],
      crash: [
        'Crash biasanya di awal birama — ayunkan dari lengan, bukan cuma pergelangan, dan jangan gepeng pas di kail lagu.',
        'Latih: mainkan pola biasa, tiap masuk birama ke-5 pukul crash bareng kick. Timing yang konsisten > volume besar.',
      ],
      ride: [
        'Latih spacing antar ketukan yang seragam. Kalau terburu-buru, pattern "tick-tick" jadi tidak rapi.',
        'Mainkan ride 8th note dengan aksen di bell, pergelangan tetap rileks supaya tidak capek.',
      ],
    };
    return pick(tips[id] || [`Fokuskan latihan di ${name} dengan tempo 50%, lalu naik 5% tiap kali kamu bisa 8x berturut tanpa miss.`]);
  }

  function analyzeSession() {
    const acc = accuracy();
    const { hit, miss } = totalAttempts();
    if (hit + miss < 8) return 'Data sesi masih sedikit. Main dulu minimal satu lagu (atau 30 detik), lalu tanya aku lagi.';

    const lines = [];
    lines.push(`Sesi ini: ${hit} hit vs ${miss} miss — akurasi ${Math.round(acc * 100)}%, combo terpanjang ${maxCombo}.`);

    const worst = worstLane();
    if (worst) {
      lines.push(`Lane terlemah: ${LANE_NAMES[worst]} (${Math.round(laneAccuracy(worst) * 100)}%).`);
      const d = avgDelta(worst);
      if (d !== null && Math.abs(d) > 25) {
        lines.push(`Di lane itu kamu rata-rata ${fmtDelta(d)}.`);
        lines.push(worst === 'kick' ? 'Coba pisahkan gerak kaki dari goyangan badan biar timingnya stabil.' : 'Turunkan tempo ke 75%, hitung pelan sebelum masuk frasa.');
      }
    } else {
      lines.push('Belum ada lane yang jelas terlemah — bagus, distribusimu merata.');
    }
    if (strays >= 6) lines.push(`Kamu juga ${strays}x memukul di luar notasinya. Wajar, tapi pastikan pola dasarnya mandiri dulu sebelum improvisasi.`);
    if (acc > 0.9 && maxCombo > 20) lines.push('Solid! Kalau sudah nyaman, naikkan tempo +10% dan sambung lagi — itu cara tercepat naik level.');
    return lines.join('\n');
  }

  function timingAdvice() {
    let deltas = [];
    for (const id of Object.keys(lanes)) deltas = deltas.concat(lanes[id].deltas);
    if (deltas.length < 5) return 'Aku belum punya cukup data timing. Main beberapa pass dulu, lalu tanya lagi.';
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const spread = Math.max(...deltas) - Math.min(...deltas);
    let out = `Rata-rata timing kamu ${fmtDelta(avg)} (variasi ${Math.round(spread)}ms).`;
    if (Math.abs(avg) < 20) out += ' Sudah di zona bagus — timing konsisten.';
    else out += avg > 0
      ? ' Kamu cenderung mendahului note. Dengarkan backbeat dulu, lalu ikut bersamanya — jangan mengantisipasi pukulan.'
      : ' Kamu sering nanggung di belakang. Coba pre-count di kepala ("1-2-3-4") sebelum masuk, biar kamu di beat, bukan ngejar beat.';
    if (spread > 90) out += ' Variasinya lebar — fokus konsistensi dulu, bukan kecepatan.';
    return out;
  }

  function weakestLaneAdvice() {
    const w = worstLane();
    if (!w) return 'Aku belum bisa menentukan lane terlemah — butuh beberapa pukulan lagi.';
    return `Lane terlemah kamu: ${LANE_NAMES[w]} (${Math.round(laneAccuracy(w) * 100)}%). ${laneTip(w)}`;
  }

  function motivasi() {
    const acc = accuracy();
    if (acc === null) return pick([
      'Belum mulai? Pasang tempo 80%, pilih lagu santai, dan biarkan groove bicara.',
      'Satu bar yang benar lebih berharga daripada 16 bar asal-asalan. Mulai dari satu bar.',
    ]);
    if (acc > 0.8) return pick([
      `Akurasi ${Math.round(acc * 100)}% — level pemain yang disegani. Naikkan tempo +5% dan pertahankan.`,
      'Kamu sudah di jalurnya. Skor bagus itu bonus; konsistensi itu target.',
    ]);
    if (acc > 0.5) return pick([
      `Akurasi ${Math.round(acc * 100)}% — sudah nempel. Turunkan tempo sedikit, targetkan pass yang tidak putus.`,
      'Yang bikin drummer bagus bukan tangan keras, tapi telinga yang jujur. Lanjut.',
    ]);
    return pick([
      'Skor di bawah 50%? Berarti masih banyak buah rendah yang bisa dipetik. Tempo 50%, satu lane satu lane.',
      'Mundur dulu untuk maju: main di 60% tempo sampai combo sehat 16 ketukan, baru naik.',
    ]);
  }

  function tempoAdvice() {
    const acc = accuracy();
    if (acc === null) return 'Mulailah di 75-80% tempo asli untuk membentuk muscle memory, lalu naik +5% tiap kali bisa 2 putaran tanpa error besar. Set angkanya di kontrol Tempo.';
    if (acc > 0.9) return 'Kamu efektif di tempo ini. Naikkan +10% dan jaga akurasi di atas 85%.';
    if (acc > 0.75) return 'Zona bagus. Coba +5%; kalau akurasi turun di bawah 75%, turunkan lagi — disiplin tangganya itu penting.';
    return 'Turun ke 60-70% tempo dulu. Akurasi dulu, kecepatan menyusul.';
  }

  function contextSummary() {
    const acc = accuracy();
    if (acc === null) return 'Belum ada data sesi.';
    const parts = [`akurasi ${Math.round(acc * 100)}%`, `combo terpanjang ${maxCombo}`, `pukulan di luar chart: ${strays}`];
    for (const id of Object.keys(lanes)) {
      const s = lanes[id];
      const t = s.hit + s.miss;
      if (t === 0) continue;
      let line = `${LANE_NAMES[id]}: ${s.hit}/${t} hit`;
      const d = avgDelta(id);
      if (d !== null) line += ` (rata-rata ${fmtDelta(d)})`;
      parts.push(line);
    }
    return parts.join('; ');
  }

  function greeting() {
    return 'Hai! Aku coach-mu. Mainkan lagu, dan aku analisa timing, akurasi, dan lane terlemahmu.\nTanya apa aja — atau klik chip di bawah.';
  }

  function summarizeOnEnd() {
    const acc = accuracy();
    if (acc === null) return 'Lagu kelar tapi aku belum menangkap pukulanmu — pastikan kit (atau keyboard fallback) terhubung, ya.';
    let head = `Sesi kelar. Akurasi ${Math.round(acc * 100)}%, combo terpanjang ${maxCombo}.`;
    if (acc > 0.85) head += ' Keren — siap dinaikkan tempo.';
    else if (acc > 0.6) head += ' Bagus, tinggal bereskan lane terlemahmu.';
    else head += ' Tidak apa-apa — main ulang di tempo lebih pelan.';
    return head + '\n' + analyzeSession();
  }

  function reply(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t) return null;
    if (/(analisa|analisis|report|laporan|review|sesi|penilaian)/.test(t)) return analyzeSession();
    if (/(timing|telat|terlambat|cepat|ngebut|maju|mundur|late|early)/.test(t)) return timingAdvice();
    if (/(lane|lemah|terlemah|balans)/.test(t)) return weakestLaneAdvice();
    if (/(motivas|semangat|berat|pusing|capek|frustrasi|nyerah)/.test(t)) return motivasi();
    if (/(tempo|bpm|kecepatan|pelan|slow|faster|speed)/.test(t)) return tempoAdvice();
    if (/kick|pedal\b|bass drum/.test(t)) return laneTip('kick');
    if (/snare/.test(t)) return laneTip('snare');
    if (/hi-?hat|hat\b|kuning/.test(t)) return laneTip('hh');
    if (/tom|hijau/.test(t)) return laneTip('tom');
    if (/crash|cymbal|simbal|oranye/.test(t)) return laneTip('crash');
    if (/ride/.test(t)) return laneTip('ride');
    if (/\b(help|bantu|bisa apa|apa saja)\b/.test(t)) return 'Aku bisa: analisa sesi, tips timing, lane terlemah, saran tempo, dan teknik per-lane (kick/snare/hi-hat/tom/crash/ride).\nContoh: "analisa sesi" atau "gimana teknik kick".';
    if (/^(halo|hai|hi)\b/.test(t)) return pick(['Yoo. Mau analisa sesi terakhir, atau susun latihan biar naik level?', 'Hai! Ada yang bisa kubantu soal latihan drummu?']);
    return 'Aku paham soal: analisa sesi, tips timing, lane terlemah, saran tempo, atau teknik lane tertentu (kick/snare/hi-hat/tom/crash/ride).\nCoba tanya salah satunya.';
  }

  return { reset, onAttempt, onMiss, onGhost, reply, greeting, summarizeOnEnd, accuracy, contextSummary, combo: () => combo, maxCombo: () => maxCombo, hasData: () => { const { hit, miss } = totalAttempts(); return hit + miss >= 10; }, setSong, getSongInfo, songHistory, currentSongTitle, sessionStats, getTimingStats: () => {
    const misses = sessionStats.misses;
    const byTiming = { perfect: 0, fast: 0, slow: 0 };
    misses.forEach(m => { byTiming[m.timing] = (byTiming[m.timing] || 0) + 1; });
    // Also consider missed lanes that don't have delta timing
    const missedWithoutTiming = sessionStats.missedLanes.length - misses.length;
    return { 
      totalMisses: sessionStats.missedLanes.length, 
      byTiming: { ...byTiming, 'without-timing': missedWithoutTiming },
      total: misses.length + missedWithoutTiming 
    };
  }, scoreMissed: () => { const { hit, miss } = totalAttempts(); return { total: hit + miss, missed: miss, accuracy: miss > 0 ? Math.round(hit / (hit + miss) * 100) : 100 }; }, getSongInfo: () => ({ title: currentSongTitle, history: songHistory }) };
}
