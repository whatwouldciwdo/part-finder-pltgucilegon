# Tracker: Part Finder (PLTGU Cilegon)

Legenda: `[ ]` belum, `[~]` berjalan, `[x]` selesai

## Fase 0: Persiapan
- [x] Analisis PDF (158 halaman, scan, tanpa text layer)
- [x] Pilih stack (React+Vite PWA, FastAPI, PostgreSQL, Gemini OCR)
- [x] Buat `prd.md` dan `tracker.md`
- [x] Python, Node.js, Git terpasang
- [x] `pymupdf` terpasang
- [x] `pip install google-genai pillow python-dotenv`
- [x] Gemini API key (terbaca dari variabel user Windows)
- [x] `.gitignore`
- [x] Docker Desktop terpasang (WSL2)
- [ ] `cloudflared` terpasang (`winget install Cloudflare.cloudflared`)
- [x] Domain di Cloudflare siap; subdomain: part-finder.pltgucilegon.com
- [x] Katalog boleh dikirim ke Gemini
- [x] `git init`, commit awal, dan push ke GitHub (`whatwouldciwdo/part-finder-pltgucilegon`)

## Fase 1: Pipeline data (prototipe)
- [x] `pipeline/render.py` (158 halaman → data/pages)
- [x] Peta halaman PDF ↔ kode halaman (1-1, 2-2, ...) dipetakan otomatis lewat `assembly_page` saat ingest
- [x] `pipeline/extract.py` (model gemini-3.8-flash, retry 503)
- [x] Uji OCR Section 1 (akurasi cocok dengan verifikasi manual)
- [x] `pipeline/validate.py`
- [x] Sampel p12: 21/21 baris cocok (beda hanya simbol diameter)
- [x] Pakai endpoint OpenAI-compatible (Gemini free tier hanya 20 request/hari)

## Fase 2: Ingest penuh
- [x] Proses 158 halaman: 45 assembly, 2044 part (sesuai Table of Contents)
- [ ] Review dan koreksi manual
- [x] Skema database (`backend/schema.sql`) di PostgreSQL, database `part_finder`
- [x] `pipeline/ingest.py <katalog.json>` (45 assembly, 2042 part)

## Fase 3: Backend
- [x] FastAPI (`backend/main.py`): endpoint search (Part Name, ASSY DWG, DWG NO) + fuzzy trigram + normalisasi φ
- [x] Index `pg_trgm` (`backend/schema.sql`)
- [x] Endpoint filter (`/api/catalogs`, `/api/sections`), assembly (`/api/assemblies/{id}`), dan gambar halaman (`/api/pages/{page}`)
- [x] Uji performa dan verifikasi endpoint lewat Docker

## Fase 4: Frontend (PWA)
- [x] Scaffold React + Vite + TS (`web/`)
- [x] i18n ID/EN (`web/src/i18n.ts`)
- [x] Halaman pencarian dan hasil (tabel desktop + kartu mobile + tombol salin kode)
- [x] Viewer gambar (zoom/pan/pinch) dan banner KEY NO. (`web/src/components/PageViewerModal.tsx`)
- [x] Navigasi katalog Section → Assembly → Part (`web/src/components/AssemblyModal.tsx`)
- [x] Filter katalog dan section
- [x] Pembaruan UI FigCraft (desktop & mobile): alur Pilih Model → MODEL M701F → Table of Contents, sidebar desktop, grid 6 section, layout berdampingan gambar & part, serta rebuild container `web`
- [x] PWA manifest dan service worker (`manifest.webmanifest`, `sw.js`)
- [ ] Uji di HP (iOS Safari dan Android Chrome)

## Fase 5: Deploy
- [x] Docker Compose penuh (`docker-compose.yml`: `backend` + `web` Nginx) — port `3230` sesuai tunnel `part-finder.pltgucilegon.com`
- [ ] Migrasi ke server Ubuntu `10.8.140.80` dan sambungkan `cloudflared` ke `part-finder.pltgucilegon.com`
- [ ] Cloudflare Access (daftar pengguna)
- [ ] Uji akses dari luar jaringan kantor

## Fase 6: Setelah MVP
- [ ] Halaman review/koreksi OCR
- [ ] Tambah katalog kedua
- [x] Navigasi pohon Section → Assembly → Part

## Catatan dan keputusan
| Tanggal | Catatan |
|---|---|
| 2026-11-27 | Akses internal lewat Cloudflare Tunnel + Access, hosting di mesin kantor (opsi A) |
| 2026-11-27 | Tanpa App Store/native. Pakai PWA. Tanpa offline. |
| 2026-11-27 | Pencarian: Part Name, ASSY DWG NO & MARK, DWG NO & MARK |
| 2026-11-27 | OCR penuh selesai. Sisa isu: p154 duplikat halaman 1-4 (2/2) = p18; normalisasi simbol diameter; nilai '-' diperlakukan kosong |
| 2026-11-27 | DB: PostgreSQL 10.8.140.69, database baru part_finder. Kredensial di .env (DATABASE_URL). |
| 2026-11-27 | Deploy target: Docker di server Ubuntu 10.8.140.80 (sudah ada cloudflared). Uji lokal di laptop dulu sebelum migrasi. |
| 2026-11-27 | UI diperbarui ke desain FigCraft via Cline (Pilih Model → Table of Contents, responsif desktop/mobile) dan container `web` sudah di-rebuild di Docker lokal. |

