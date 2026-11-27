# PRD: Part Finder (PLTGU Cilegon)

## 1. Ringkasan
Aplikasi web (PWA) internal untuk mencari suku cadang dari katalog **GT Catalog Cilegon** (Mitsubishi M701F Gas Turbine Parts List). Sumber data berupa PDF hasil scan (158 halaman, tanpa text layer), jadi data harus diekstrak lewat OCR menjadi database terstruktur.

## 2. Tujuan
- Mencari part dengan cepat berdasarkan **Part Name**, **ASS'Y DWG NO & MARK**, dan **DWG NO & MARK**.
- Menampilkan lokasi part: section, assembly, halaman, dan gambar exploded dengan KEY NO.
- Mendukung penambahan katalog baru (unit lain selain M701F) tanpa mengubah kode.

## 3. Di luar cakupan (non-goals)
- Mode offline.
- Aplikasi native iOS/Android dan publikasi ke App Store/Play Store. Akses lewat PWA.
- Pemesanan, stok, atau harga.
- Login buatan sendiri. Autentikasi memakai Cloudflare Access.

## 4. Pengguna
Tim internal PLTGU Cilegon. Mereka mengakses dari laptop dan HP (iOS/Android) lewat browser.

## 5. Struktur data (dari Table of Contents)
Catalog â†’ Section (6) â†’ Assembly â†’ Part.

| Section | Nama | Assembly |
|---|---|---|
| 1 | Rotor Section | 1-1 s/d 1-4 |
| 2 | Inlet Casing Cylinder Section | 2-1 s/d 2-8 |
| 3 | Compressor Cylinder Section | 3-1 s/d 3-6 |
| 4 | Compressor-Combustor Cylinder Section | 4-1 s/d 4-8 |
| 5 | Turbine Cylinder Section | 5-1 s/d 5-11 |
| 6 | Exhaust Cylinder Section | 6-1 s/d 6-8 |

Kolom tabel part: `KEY NO. | PART NAME | ASS'Y DWG. NO. & MARK | DWG. NO. & MARK | Q'TY | REMARKS`.

Entitas: `catalog`, `section`, `assembly` (kode seperti `2-2`, judul, halaman tabel, halaman gambar), `part` (key_no, part_name, assy_dwg_no, dwg_no, qty, remarks).

## 6. Kebutuhan fungsional
| ID | Kebutuhan | Prioritas |
|---|---|---|
| F1 | Pipeline: render PDF â†’ OCR (Gemini Vision) â†’ JSON â†’ database | Must |
| F2 | Perintah ingest generik: `ingest <pdf> --name <katalog>` | Must |
| F3 | Pencarian dengan field Part Name, ASSY DWG NO, dan DWG NO, termasuk fuzzy dan partial match | Must |
| F4 | Hasil menampilkan section, assembly, halaman, dan Q'TY | Must |
| F5 | Viewer gambar halaman dengan zoom dan pan | Must |
| F6 | Sorot KEY NO. pada gambar exploded | Should |
| F7 | Filter berdasarkan katalog dan section | Should |
| F8 | UI dwibahasa Indonesia dan Inggris | Must |
| F9 | Halaman review/koreksi hasil OCR | Should |
| F10 | PWA (dapat dipasang di HP) | Must |
| F11 | Navigasi pohon Section â†’ Assembly â†’ Part | Could |

## 7. Kebutuhan non-fungsional
- Pencarian kurang dari 300 ms untuk puluhan ribu baris.
- Hanya dapat diakses lewat Cloudflare Access (email/OTP).
- Responsif untuk layar HP.
- Akurasi OCR: kode dwg/mark harus tervalidasi (format dan jumlah baris). Hasil diverifikasi manual pada sampel sebelum rilis.
- Rahasia (API key) tidak masuk Git.

## 8. Arsitektur
```
PDF â†’ pipeline (Python, PyMuPDF, Gemini) â†’ PostgreSQL + folder gambar WebP
Browser/PWA (React + Vite + TS) â†’ FastAPI â†’ PostgreSQL (pg_trgm + FTS)
Docker Compose (api + db + web) â†’ cloudflared â†’ domain Cloudflare + Access
```

| Layer | Teknologi |
|---|---|
| Frontend | React, Vite, TypeScript, PWA, i18n (ID/EN) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Docker) |
| OCR | Gemini Vision API |
| Deploy | Docker Compose di mesin kantor, `cloudflared`, Cloudflare Access |

## 9. Struktur folder (rencana)
```
part-finder-pltgucilegon/
â”œâ”€ pipeline/   # render, OCR, validasi, ingest
â”œâ”€ backend/    # FastAPI
â”œâ”€ web/        # React + Vite
â”œâ”€ data/       # gambar halaman, JSON hasil OCR (gitignore)
â”œâ”€ docker-compose.yml
â”œâ”€ .env        # GEMINI_API_KEY (gitignore)
â”œâ”€ prd.md
â””â”€ tracker.md
```

## 10. Risiko
| Risiko | Mitigasi |
|---|---|
| OCR salah baca kode (0/O, 1/I) | Validasi regex, prompt ketat, halaman review, uji sampel dulu |
| Katalog bersifat rahasia dan gambar dikirim ke Google | Konfirmasi kebijakan perusahaan. Alternatifnya OCR lokal (PaddleOCR). |
| Mesin kantor mati sehingga layanan tidak tersedia | UPS, auto-start Docker, dan monitoring sederhana |
| Format katalog baru berbeda | Prompt dan skema dikonfigurasi per katalog |
| Satu assembly meliputi banyak halaman | Pemetaan lewat kode halaman |

## 11. Kriteria sukses (MVP)
- Seluruh 158 halaman diproses, dengan akurasi sampel â‰¥ 98% pada kolom kode.
- Pengguna menemukan part dari 3 field pencarian dan membuka gambar halamannya.
- Dapat diakses lewat domain Cloudflare dari HP (iOS dan Android) dengan login Access.
- Katalog kedua bisa ditambahkan hanya dengan satu perintah ingest.

## 12. Pertanyaan terbuka
- Apakah katalog boleh dikirim ke layanan cloud (Gemini)?
- ~~Nama domain/subdomain~~: **part-finder.pltgucilegon.com** (terjawab)
- Spesifikasi mesin kantor yang menjadi host (selalu menyala?).
- Daftar pengguna Cloudflare Access (domain email atau daftar individu).

