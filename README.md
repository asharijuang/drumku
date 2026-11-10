# Drum Play-Along (Guitar Hero drum, web version)

Dengerin lagu **full mix** (kayak MP3 biasa — drum tidak dimute) sambil **notes drum tampil** di highway 6-lane. Hit kit beneran (e-drum via Web MIDI) buat skor, atau keyboard fallback.

## Run

```bash
python3 -m http.server 8000
# buka http://localhost:8000 di Chrome/Edge (Firefox 108+ juga bisa)
```

Harus lewat `localhost` / HTTPS — Web MIDI & ES modules tidak jalan via `file://`.

## Cara pakai

1. **Demo song** — langsung tes tanpa file apa pun (audio + chart digenerate di browser).
2. Atau: **🎵 Audio** → pilih MP3/WAV lagu, **🥁 Drum .mid** → pilih file MIDI yang berisi track drum (channel 10).
3. **Space** = play/pause, **←/→** = seek ±2s.
4. Sync slider: geser sampai notes pas sama beat yang kedengeran.
5. Pilih kit di dropdown bawah → mainkan → skor jalan.

Keyboard fallback (buat tes tanpa hardware): `J` kick, `F` snare, `D` hi-hat, `S` toms, `K` ride, `L` crash.

## Fitur latihan

- **Tempo practice 25–150%**: isi angka atau geser slider di topbar. Pitch tetap (time-stretch), timing scoring & notes ikut menyesuaikan. Tempo tersimpan otomatis.
- **AI Coach**: klik `Coach` (kanan atas) buat panel ngobrol. Default: coach engine lokal yang analisa data kamu sungguhan (akurasi per lane, rata-rata timing telat/cepat, combo, pukulan di luar chart) — jalan tanpa internet.
- **LLM via Ollama (opsional)**: centang `LLM lokal` di bawah panel coach, app auto-detect Ollama di `http://localhost:11434` dan tampilkan daftar model. Kalau Ollama mati/gak bisa reach, otomatis fallback ke coach lokal. Cara install:
  ```powershell
  # di Windows
  ollama serve
  ollama pull llama3.1:8b
  ```
  Ollama default CORS sudah mengizinkan origin `localhost:*`, jadi gak perlu opsi tambahan. Keputusan desain: coach lokal tetap jadi fallback — app gak pernah mat gara-gara LLM.

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
- Semua 100% client-side, gak ada upload ke mana-mana.
