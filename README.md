# Drum Play-Along (Guitar Hero drum, web version)

Dengerin lagu **full mix** (kayak MP3 biasa — drum tidak dimute) sambil **notes drum tampil** di highway 6-lane. Hit kit beneran (e-drum via Web MIDI) buat skor, atau keyboard fallback.

## Run

```bash
node start.js
# buka http://127.0.0.1:8000 di Chrome/Edge (Firefox 108+ juga bisa)
```

Launcher ini menjalankan server app dan bridge lokal sekaligus. Tekan `Ctrl+C` untuk menghentikan launcher dan bridge yang dimulainya; bridge yang sudah aktif sebelumnya tetap berjalan.

Harus lewat `localhost` / HTTPS — Web MIDI & ES modules tidak jalan via `file://`.

## Cara pakai

1. **Demo song** — langsung tes tanpa file apa pun (audio + chart digenerate di browser).
2. **🎵 Music** — cari lagu YouTube, tempel URL video, atau pilih audio lokal. Video YouTube tampil di mini player dan jam sheet mengikuti posisi player. Minta chord lewat Coach; baris bertimestamp akan disorot mengikuti video. Untuk latihan drum pada lagu, muat juga **🥁 Drum .mid** yang cocok.
3. **Space** = play/pause, **←/→** = seek ±2s.
4. Sync slider: geser sampai notes pas sama beat yang kedengeran.
5. Pilih kit di dropdown bawah → mainkan → skor jalan.

Keyboard fallback (buat tes tanpa hardware): `J` kick, `F` snare, `D` hi-hat, `S` toms, `K` ride, `L` crash.

## YouTube Music

Pencarian memakai YouTube Data API v3 melalui bridge lokal. Salin `.env.example` ke `.env`, isi `YOUTUBE_API_KEY`, lalu jalankan `node bridge.js` dari folder proyek. Buat key di Google Cloud dan batasi key ke YouTube Data API v3. Kuota default menyediakan 100 pencarian per hari; satu pencarian memakai satu kuota. URL YouTube dapat dibuka tanpa key. Player memakai embed resmi dan tidak mengekstrak audio. Chord yang dibuat AI adalah perkiraan berdasarkan konteks lagu, bukan transkripsi audio.

```sh
cp .env.example .env
# isi YOUTUBE_API_KEY di .env
node bridge.js
```

## Fitur latihan

- **Tempo practice 25–150%**: isi angka atau geser slider di topbar. Pitch tetap (time-stretch), timing scoring & notes ikut menyesuaikan. Tempo tersimpan otomatis.
- **AI Coach**: klik `Coach` (kanan atas) buat panel ngobrol. Default: coach engine lokal yang analisa data kamu sungguhan (akurasi per lane, rata-rata timing telat/cepat, combo, pukulan di luar chart) — jalan tanpa internet. ^1^
- **LLM via Ollama (opsional)**: centang `LLM lokal` di bawah panel coach, app auto-detect Ollama di `http://localhost:11434` dan tampilkan daftar model. Kalau Ollama mati/gak bisa reach, otomatis fallback ke coach lokal. Cara install:
- **Fitur coach baru**: Coach sekarang bisa melaporkan skor pukulan yang missed (terlalu cepat/slow), melacak lagu yang sudah diputar, dan memberikan statistik timing. Gunakan chip di panel coach: "analisa sesi", "tips timing", "lane terlemah", "saran tempo", "motivasi dong". ^2^
  ```powershell
  # di Windows
  ollama serve
  ollama pull llama3.1:8b
  ```
  Ollama default CORS sudah mengizinkan origin `localhost:*`, jadi gak perlu opsi tambahan. Keputusan desain: coach lokal tetap jadi fallback — app gak pernah mat gara-gara LLM.
- **Tutorial/Course**: klik `Tutorial` (di sebelah kanan Tombol Coach) buat buka panel tutorial. Panel ini bisa di-minimize/maximize. Terdiri dari 3 section: Dasar-dasar, Timing & Rhythm, dan Teknik Spesifik. Konten tutorial bisa di-update berkala dalam format Markdown. ^3^

## Dua mode tampilan

- **Highway** (`🛣`): 6 lane vertikal ala Guitar Hero — notes jatuh ke hit line.
- **Sheet** (`🎼`): not balok drum sungguhan — percussion clef, note-head warna per instrumen (bulat = drum, silang-x kecil = cymbal), open hi-hat ditandai `o`, barline + nomor bar, grid per ketukan, tempo ngikut tempo map file MIDI-nya. Layout 3 baris yang wrap otomatis, jadi lagu cepat tetap kebaca: baris tengah = posisi sekarang, atas = yang baru lewat, bawah = preview bar berikutnya.

Toggle pakai tombol di topbar atau shortcut **M**. Mode disimpan di localStorage.

## Dari mana drum .mid-nya?

- Chart komunitas Clone Hero (format `.mid` alight di `notes.mid`) — komunitas Enchor/CloneHero punya ribuan chart drum.
- Buat sendiri di DAW/REAPER: render drum di channel 10 (GM), match tempo sama lagunya.
- Roadmap: auto-drum-transcription dari audio (model ML) biar gak perlu .mid manual.

## GM drum note → lane

| Lane | MIDI notes |
|---|---|
| Kick | 35, 36 |
| Snare | 37, 38, 40 |
| Hi-hat (closed/open) | 42, 44, 46, 26 |
| Toms | 41, 43, 45, 47, 48, 50, 58 |
| Crash | 49, 52, 55, 57 |
| Ride | 51, 53, 59 |

## Catatan teknis

- Web MIDI: Chrome/Edge/Firefox desktop ✅, Safari/iOS ❌.
- Latency: Web MIDI hit umumnya responsif, tapi kalau skor kerasa "telat", atur Sync slider.
- Audio lokal tetap diproses di browser. Pencarian YouTube memakai bridge lokal dan YouTube Data API; audio/video YouTube diputar lewat embed resmi.

---

### Catatan Fitur Coach

^1^ Coach lokal sekarang mencakup:
- **Laporkan akurasi per lane** dan timing rata-rata (perfect/terlalu cepat/terlalu lambat)
- **Skor pukulan missed** dengan prosentase akurasi
- **Lagu yang diputar** dan riwayat session
- **Saran tempo** yang disesuaikan dengan performa

^2^ Chip di panel coach:
- `analisa sesi` — laporan lengkap sesi latihan
- `tips timing` — masukan tentang konsistensi timingmu
- `lane terlemah` — lane mana yang butuh latihan
- `saran tempo` — rekomendasi tempo berdasarkan akurasi
- `motivasi dong` — pesan semangat berdasarkan skor

^3^ Tutorial/Course: panel bisa di-toggle dengan tombol `Tutorial` di sebelah kanan Coach. Terdiri dari 3 section:
- `Dasar-dasar` — fundament kontrol tangan, rudiment, dan koordinasi tangan-kaki
- `Timing & Rhythm` — subdivision 16th notes & sextuplet, latihan dengan metronom
- `Teknik Spesifik` — rudiment dasar, hand-foot coordination, chops populer
Konten bisa di-update berkala dalam format Markdown dan ditumpuk di dalam panel tutorial.

^3^ LLM via Ollama/bridge (opional): kalau sudah dikonfigurasi, coach bisa memakai model lokal (Ollama) atau CLI (OpenCode/Claude/Codex) untuk response yang lebih canggih. Tetap ada fallback ke coach lokal kalau LLM gagal.
