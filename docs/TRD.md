# Technical Requirements Document: SUAR Simulator

Versi 1.2, 7 November 2026. Kebutuhan produk ada di [PRD](PRD.md), alur layar ada di [App Flow](APP_FLOW.md), tampilan ada di [Design Brief](DESIGN_BRIEF.md).

## 1. Arsitektur

Aplikasi berupa situs statis satu halaman. Tidak ada server, basis data, atau panggilan API.

```text
Browser
├─ UI React            halaman, panel, kontrol
├─ Store               useReducer + Context, memegang SimState
├─ src/sim (murni)     engine, atribusi, paket, model, tanpa React dan tanpa DOM
└─ src/three           pemandangan 3D, hanya membaca state dan mengirim aksi
```

Aturan ketergantungan: `src/sim` tidak mengimpor apa pun dari `src/ui`, `src/pages`, atau `src/three`. Hanya `src/sim` yang boleh memutuskan status zona.

### Dokumen skema backend

Tidak dibuat karena tidak ada backend. Next.js, SQLite, dan rute API milik Caliber tidak dipakai karena SUAR Simulator tidak memiliki data server. Kontrak data sisi klien ada pada subbab 4.

## 2. Tumpukan teknologi

Versi dengan tanda "Caliber" mengikuti `caliber-final/app/package.json`. Versi Vite dan Vitest diambil dari `npm view` pada 7 November 2026.

| Komponen | Versi | Alasan |
|---|---|---|
| Node dan npm | 22.19.0 dan 10.9.3 | Terpasang di mesin |
| Vite | ^8.3.6 | Keluaran statis |
| Vitest | ^5.1.0 | Uji engine |
| TypeScript | ^5 (Caliber) | Mode `strict` |
| React dan React DOM | 19.3.0 (Caliber) | Sama dengan contoh |
| Tailwind CSS | ^4 (Caliber) dengan `@tailwindcss/vite` | Token tema sama dengan Caliber |
| three | ^0.169.0 (Caliber) | Pipeline 3D Caliber dapat dipakai ulang |
| motion | ^14.9.0 (Caliber) | Transisi dan demo terpandu |
| recharts | ^3.10.1 (Caliber) | Grafik |
| lucide-react | ^1.67.0 (Caliber) | Ikon |
| clsx dan tailwind-merge | ^2.1.1 dan ^3.7.0 (Caliber) | Fungsi `cn` |
| @radix-ui/react-tooltip | ^1.4.1 (Caliber) | Keterangan yang dapat diakses |
| @fontsource-variable/plus-jakarta-sans | terbaru | Font merek tanpa panggilan ke Google Fonts |

Paket Caliber yang tidak dipakai: `next`, `better-sqlite3`, `nodemailer`, `server-only`, `@radix-ui/react-popover`.

## 3. Struktur folder

```text
Semifinal/simulator/
├─ docs/                 dokumen ini dan work-orders/
├─ reference/            salinan baca-saja, lihat subbab 13
├─ src/
│  ├─ main.tsx, App.tsx, routes.ts
│  ├─ styles.css
│  ├─ sim/               types.ts, engine.ts, attribution.ts, packet.ts, model.ts, scenario.ts + *.test.ts
│  ├─ data/              analysis.ts, claims.ts, copy.ts, bom.ts, gates.ts
│  ├─ store/             sim-store.tsx
│  ├─ three/             stage.ts, kit.ts, room.ts, device.ts, Scene3D.tsx, DeviceStage.tsx
│  ├─ ui/                shell.tsx, ui.tsx, tour.tsx, tour-steps.ts, claim-tag.tsx, pager.tsx, board.tsx, log-table.tsx, denah-2d.tsx
│  └─ pages/             ruang.tsx, alat.tsx, ambang.tsx, batas-audio.tsx, dasbor.tsx, bukti.tsx
├─ tests/guard.test.ts
└─ index.html, vite.config.ts, tsconfig.json, package.json, .gitignore
```

## 4. Kontrak data: `src/sim/types.ts`

File ini dibekukan pada tugas T00. Perubahan hanya boleh melalui Opus.

```ts
export type ZoneId = "A" | "B" | "C" | "D";
export const ZONES: readonly ZoneId[] = ["A", "B", "C", "D"];

export type NodeStatus = "normal" | "terbatas" | "luring";
export type ZoneTier = "normal" | "tingkat1" | "menunggu" | "ditangani";
export type PacketKind = "SYNC" | "EVENT" | "ACK" | "ALERT" | "DONE" | "HEARTBEAT";
export type Endpoint = ZoneId | "PAGER" | "DASBOR";

export interface SimConfig {
  n2: number;          // 2
  t2Min: number;       // 15
  t1HoldMin: number;   // 15, asumsi A1
  rebuzzMin: number;   // 3
  pauseMin: number;    // 15
  mergeMs: number;     // 300
  ambiguousDb: number; // 1.5
  maxRangeM: number;   // 4
  startClockMin: number; // 540, artinya 09.00
}

export interface Attribution {
  primary: ZoneId;
  secondary: ZoneId | null; // terisi bila deltaDb < ambiguousDb
  deltaDb: number;
  levelsDb: Partial<Record<ZoneId, number>>; // relatif terhadap 1 m
}

export interface ZoneState {
  tier: ZoneTier;
  coughsMs: number[];      // waktu batuk dalam jendela aktif
  totalCoughs: number;
  lastCoughMs: number | null;
  alertGroup: number | null;
  alertAtMs: number | null;
  rebuzzCount: number;
  nextRebuzzMs: number | null;
  pauseUntilMs: number | null;
  nodeStatus: NodeStatus;
}

export interface PacketTrace {
  id: number;
  tMs: number;
  kind: PacketKind;
  from: Endpoint;
  to: Endpoint;
  bytes: Uint8Array; // tepat 16 byte
}

export type LogKind = "BATUK" | "TINGKAT1" | "TINGKAT2" | "ESKALASI" | "DITANGANI" | "NORMAL" | "STATUS_SIMPUL";

/** Hanya metadata. Tipe ini sengaja tidak memiliki medan audio. */
export interface LogEntry {
  id: number;
  tMs: number;
  kind: LogKind;
  zone: ZoneId;
  count: number;
  levelDb: number | null;
  status: NodeStatus;
  responseMs: number | null;
}

export interface SimEffect {
  id: number;
  tMs: number;
  kind: "ripple" | "speech" | "buzz";
  x?: number;
  y?: number;
  zones?: ZoneId[];
}

export interface SimState {
  cfg: SimConfig;
  nowMs: number;
  zones: Record<ZoneId, ZoneState>;
  packets: PacketTrace[];   // FIFO, maksimal 500
  log: LogEntry[];          // append-only selama sesi
  effects: SimEffect[];     // antrean animasi, maksimal 50
  pagerBuzzing: boolean;
  pendingGroups: number[];  // kelompok peringatan, tertua di depan
  seq: Record<ZoneId, number>;
  counters: { audioBytesOut: 0; eventPackets: number; speechIgnored: number; mergedCoughs: number; coughEvents: number; alertEvents: number };
  lastMerge: { tMs: number; group: number; zones: ZoneId[] } | null;
}

export type SimAction =
  | { type: "cough"; x: number; y: number }
  | { type: "coughZone"; zone: ZoneId }
  | { type: "speech"; zone: ZoneId }
  | { type: "pagerPress" }
  | { type: "tick"; dtMs: number }
  | { type: "setNode"; zone: ZoneId; status: NodeStatus }
  | { type: "reset" };
```

`src/sim/engine.ts` wajib mengekspor dua fungsi berikut:

```ts
export function createInitialState(cfg?: Partial<SimConfig>): SimState;
export function reduce(state: SimState, action: SimAction): SimState;
```

Catatan: `audioBytesOut` bertipe literal `0`. Nilainya memperagakan rancangan dan disandingkan dengan label status "Dirancang; menunggu audit".

## 5. Engine: `src/sim/engine.ts`

`reduce` adalah fungsi murni, tidak memakai `Date.now`, `Math.random`, atau DOM. Pembaruan bersifat imutabel.

### 5.1 Waktu

- `nowMs` adalah waktu simulasi sejak pukul 09.00.
- Lapisan store mengirim `tick` dari `requestAnimationFrame` dengan `dtMs = deltaNyata x kecepatan`.
- Engine memecah `tick` menjadi langkah tetap paling lama 1.000 ms agar `SYNC`, `HEARTBEAT`, dan batas waktu tidak terlewat saat maju cepat.
- Tombol maju 15 menit mengirim satu `tick` berisi 900.000 ms. Hasilnya harus sama dengan 900 `tick` berisi 1.000 ms.

### 5.2 Mesin keadaan zona

Sumber: Gambar 17 proposal. Tingkat 2 adalah peralihan yang langsung masuk `menunggu`.

| Dari | Pemicu | Ke | Efek |
|---|---|---|---|
| normal | batuk ke-1 | tingkat1 | Log `TINGKAT1`, LED lembut, papan aktif |
| tingkat1 | batuk ke-2 dengan selisih ≤ `t2Min` | menunggu | Log `TINGKAT2`, paket `ALERT`, pager bergetar, `alertAtMs` terisi |
| tingkat1 | batuk ke-2 dengan selisih > `t2Min` | tingkat1 | Jendela dimulai ulang. Normalnya tidak terjadi karena `t1HoldMin` sudah lewat, tetap diuji |
| tingkat1 | `nowMs` > batuk terakhir + `t1HoldMin` (tegas lebih besar, agar batuk tepat pada menit ke-15 tetap memicu Tingkat 2) | normal | Log `NORMAL`, asumsi A1 |
| menunggu | `nowMs` ≥ `nextRebuzzMs` | menunggu | `rebuzzCount + 1`, log `ESKALASI`, pager bergetar, jadwal berikutnya +3 menit |
| menunggu | `pagerPress` pada kelompok tertua | ditangani | Log `DITANGANI` dengan `responseMs = now - alertAtMs`, paket `DONE`, `pauseUntilMs = now + pauseMin` |
| menunggu | batuk | menunggu | Log `BATUK`, tidak ada `ALERT` baru |
| ditangani | batuk | ditangani | Log `BATUK`, tidak ada sinyal, asumsi A2 |
| ditangani | `nowMs` ≥ `pauseUntilMs` | normal | Log `NORMAL`, jendela batuk dikosongkan |

Aturan pemicu mengikuti `first_trigger` pada `analysis.py`: `t[i] - t[i-N+1] <= T`, batas inklusif.

### 5.3 Batuk

1. Aksi `cough(x, y)` memanggil `attribute`. Aksi `coughZone` memakai koordinat tengah zona, yaitu titik yang tepat berada di simpul zona tersebut.
2. Simpul `terbatas` dan `luring` tidak melapor.
3. Tiap simpul berjarak ≤ `maxRangeM` mengirim `EVENT`, disusul `ACK` dari koordinator. Selisih waktu antarlaporan 20 ms sehingga masih berada dalam `mergeMs`.
4. Laporan disatukan menjadi satu kejadian. Dua batuk dalam `mergeMs` waktu simulasi dihitung satu bila zonanya beririsan. Batuk yang digabung tidak menambah paket EVENT dan menaikkan `mergedCoughs`. Batuk di zona yang tidak beririsan adalah kejadian terpisah.
5. Status diterapkan pada `primary`, dan pada `secondary` bila terisi.
6. Bila tidak ada simpul yang melapor, tidak ada perubahan status. Log `STATUS_SIMPUL` mencatat zona terdekat.

Peringatan Tingkat 2 yang lahir dari satu batuk pada dua zona berbagi `alertGroup`.

### 5.4 Pesan berkala

- `SYNC` dari koordinator ke tiap simpul setiap 10 detik.
- `HEARTBEAT` dari tiap simpul setiap 30 detik. Simpul luring berhenti mengirim dan tampil luring setelah 30 detik.
- Simpul A adalah koordinator dan tidak dapat dibuat luring. `setNode` untuk A dengan status `luring` diabaikan. Asumsi A4.

### 5.5 Skenario: `src/sim/scenario.ts`

Daftar aksi bertanda waktu yang dijalankan store. Tidak ada logika status di skenario.

| Waktu | Aksi | Hasil |
|---|---|---|
| 09.05 | `speech` Zona C | Tidak ada apa-apa |
| 09.15 | `coughZone` C | Tingkat 1 |
| 09.22 | `coughZone` C | Tingkat 2, pager bergetar |
| 09.24.40 | `pagerPress` | Ditangani, respons 2 menit 40 detik |
| 09.39.40 | otomatis | Normal |

Cabang "petugas sibuk": `pagerPress` pindah ke 09.26.00, sehingga eskalasi terjadi pada 09.25.00 dan respons 4 menit.

## 6. Atribusi: `src/sim/attribution.ts`

Rumus mengikuti `analysis.py`. Koordinat dalam meter, titik asal di pojok kiri atas denah.

```ts
export const NODE_XY = { A: [1.25, 2.5], B: [3.75, 2.5], C: [6.25, 2.5], D: [8.75, 2.5] } as const;
const DZ2 = 0.8 ** 2; // simpul 2,0 m, sumber batuk 1,2 m
// r2[i] = (x - xi)^2 + (y - yi)^2 + DZ2
// Urutkan menurut (r2, indeks). deltaDb = 10 * log10(r2[1] / r2[0])
// levelDb[i] = -10 * log10(r2[i])
```

Saat ada simpul nonaktif, perhitungan hanya memakai simpul aktif. Bila `sqrt(r2 terdekat)` > `maxRangeM`, batuk tidak terdeteksi. `secondary` tidak disaring dengan jarak.

## 7. Paket: `src/sim/packet.ts`

Selalu `Uint8Array(16)`, little-endian. Ukuran medan mengikuti Lampiran D. Urutan byte dan kode jenis adalah asumsi A6.

| Offset | Ukuran | Medan | Pengodean |
|---|---|---|---|
| 0 | 1 | versi, jenis | `(1 << 4) | kind`, dengan SYNC=1, EVENT=2, ACK=3, ALERT=4, DONE=5, HEARTBEAT=6 |
| 1 | 1 | node_id | A=0, B=1, C=2, D=3, PAGER=4 |
| 2 | 2 | seq | uint16 |
| 4 | 4 | t_ms | uint32, waktu terselaraskan |
| 8 | 2 | level_db | int16, nilai dB x 100 |
| 10 | 1 | conf | uint8, nilai contoh tetap 230 karena simulator tidak menjalankan model |
| 11 | 1 | status | normal=0, terbatas=1, baterai=2, galat=3, luring tidak dikirim |
| 12 | 4 | cadangan | selalu 0 |

Fungsi yang wajib ada: `encodePacket`, `decodePacket`, `toHex`. Keduanya harus bolak-balik tanpa kehilangan data.

## 8. Model: `src/sim/model.ts`

Port baris per baris dari `reference/analysis.py`. Jangan menulis ulang rumus dari ingatan.

| Fungsi | Sumber Python | Jenis uji |
|---|---|---|
| `firstTrigger(times, N, T)` | `first_trigger` | Eksak |
| `falseAlarmPerHour(lamH, N, T, zones = 4)` | `false_alarm_per_hour` | Eksak terhadap `grid.*.fa_room_h`, toleransi 1e-9 |
| `doseFraction(trig, wait = 60, react = 5, maskEff = 0.56)` | `dose_fraction`, mengembalikan sisa dosis | `1 - doseFraction(t)` eksak terhadap `delay_curve` dan `best_case_dose_red` |
| `wrRisk(q, ach, minutes, V = 150, p = 0.48)` | `wr_risk` | Eksak terhadap `wr_q82_ach3`, yang disimpan dalam satuan per 100 orang |
| `simulate(opts)` | `simulate` | Monte Carlo, toleransi 1,5 poin persentase |
| `twoTier(opts)` | `two_tier` di dalam `main` | Monte Carlo, toleransi 1,5 poin persentase |

Parameter bawaan: `SENS = 0.904`, `LAM_F = 1.03`, frekuensi `1.2, 2.3, 4.1` per jam, `wait = 60`, `n = 20000`, `react = 5`, `eff = 0.56`.

Generator acak memakai `mulberry32` dengan benih tetap `20261107`. Nilai JS tidak akan sama persis dengan NumPy, sehingga aturan tampilan berikut berlaku:

1. Bila parameter persis sama dengan proposal, tampilkan nilai `analysis.json` beserta tanda "sesuai proposal".
2. Selain itu, jalankan Monte Carlo di browser dan tampilkan label "tersimulasi di peramban".

Halaman ambang menjalankan `n = 20000` untuk titik terpilih dan `n = 5000` untuk 20 titik sebar, dengan debounce 150 ms. Tandai dengan komentar `ponytail:` bahwa Web Worker baru diperlukan bila penghitungan ulang melewati 200 ms.

## 9. Data statis

| File | Isi | Sumber |
|---|---|---|
| `src/data/analysis.ts` | Subset `grid`, `profiles`, `two_tier`, `delay_curve`, `latency`, `ram`, `attrib.amb_pct`, `attrib.max_range`, `kit_hw` | `reference/analysis.json`. `attrib.cells` diimpor hanya oleh uji dan denah |
| `src/data/bom.ts` | Daftar komponen | Lampiran C |
| `src/data/gates.ts` | G1 sampai G4 dan tabel janji | Bab V dan VI proposal |
| `src/data/claims.ts` | Setiap angka yang tampil: `{id, tampil, status, sumber}` | Dokumen PRD subbab 8 |
| `src/data/copy.ts` | Teks papan, kartu prosedur, kalimat wajib | Gambar 19 dan 20 proposal |

`attrib.cells` berukuran 800 baris. Bentuk tiap baris: `[x, y, indeksTerdekat, indeksKedua, deltaDb]`.

## 10. 3D

Pakai ulang `reference/caliber/three/stage.ts` dan bagian `kit.ts` yang diperlukan: `createPipeline`, `studioLights`, `studioFloor`, `rbox`, `lathe`, `barrel`, `add`, `makeMats`.

- **Render sesuai kebutuhan.** Bingkai digambar saat ada perubahan. Ambient occlusion dimatikan saat bergerak, `devicePixelRatio` maksimal 1,5.
- **Koordinat.** `threeX = x - 5`, `threeZ = y - 2.5`, sumbu Y ke atas, 1 unit sama dengan 1 meter.
- **Klik lantai.** Raycast ke bidang lantai, ubah ke koordinat meter, kirim `cough`. Gerakan lebih dari 5 px dianggap geser kamera.
- **Hover.** Hitung `attribute` dan tampilkan zona serta ΔL pada tooltip DOM.
- **Tekstur lantai.** Canvas 2048 px digambar dari `attrib.cells`: warna zona dan arsir ΔL < 1,5 dB, memakai pendekatan `groundTexture` pada `plant-scene.ts`.
- **Efek.** Baca `state.effects` dan `state.packets` untuk riak batuk dan titik paket. Efek tidak mengubah status.
- **Label.** Elemen DOM mengikuti proyeksi titik jangkar, memakai pendekatan `machine-stage.tsx`.
- **Pemuatan.** `Scene3D` dimuat dengan `React.lazy`. Kerangka halaman tampil lebih dahulu.
- **Fallback.** Bila pembuatan renderer gagal, atau lebar di bawah 768 px, tampilkan `denah-2d.tsx`. Pengguna dapat berpindah manual antara 3D dan 2D.
- **Pembersihan.** Geometri, material, renderer, dan pendengar event dilepas saat komponen dilepas.

## 11. Rute

Hash routing dengan hook kecil tanpa dependensi tambahan, sehingga muat ulang berfungsi di hosting statis apa pun.

| Hash | Halaman |
|---|---|
| `#/` | Ruang tunggu. `?demo=1` menawarkan demo terpandu |
| `#/dasbor` | Dasbor pengelola |
| `#/alat` | Simpul dan pager |
| `#/batas-audio` | Batas audio |
| `#/ambang` | Uji ambang |
| `#/bukti` | Status bukti |

Hash tidak dikenal kembali ke `#/`. Store berada di atas router, sehingga status simulasi bertahan saat berpindah halaman dan hilang saat muat ulang.

## 12. Keamanan dan privasi

- Tidak ada `getUserMedia`, `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, atau `document.cookie` di `src/`.
- Tidak ada `Math.random` atau `Date.now` di `src/sim/`.
- `index.html` memuat CSP: `default-src 'self'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'`.
- Tidak ada `dangerouslySetInnerHTML`, karena tidak ada masukan teks dari pengguna.
- Tidak ada rahasia, kunci API, atau variabel lingkungan.

## 13. Folder `reference/`

Disalin oleh T00 dan tidak boleh diubah. Tujuannya agar builder Codex tidak bergantung pada file di luar checkout.

| Salinan | Asal |
|---|---|
| `reference/analysis.py`, `analysis.json` | `Semifinal/paper/script/` |
| `reference/proposal-content.py`, `proposal-lampiran2.py`, `analysis2.json` | `Semifinal/paper/script/` |
| `reference/figures/f07, f08, f09, f10, f12, f13, f15, f17, f26, f27, f29` | `Semifinal/paper/script/figures/` |
| `reference/caliber/globals.css`, `ui.tsx`, `tour.tsx`, `tour-steps.ts`, `machine-stage.tsx`, `replay-view.tsx`, `shell.tsx` | `Semifinal/caliber-final/app/` |
| `reference/caliber/three/stage.ts`, `kit.ts`, `plant-scene.ts` | `Semifinal/caliber-final/app/components/three/` |

## 14. Kualitas dan pengujian

Perintah pembuktian tunggal:

```bash
npm run check
```

Skripnya: `tsc --noEmit && vitest run && vite build`.

| Uji | Isi minimum |
|---|---|
| `attribution.test.ts` | Seluruh 800 sel sama dengan `attrib.cells`. Dengan ambang 3 dB persentase ambigu sama dengan 36,0, angka peta medan bebas pada proposal. Ambang bawaan 1,5 dB. Jarak maksimal 2,907 m |
| `engine.test.ts` | Skenario 09.15, 09.22, 09.24.40. Batas tepat 15 menit memicu, 15 menit 1 detik tidak. Eskalasi tepat 3 menit. Jeda 15 menit. Satu batuk ambigu menaikkan dua zona dan satu kelompok peringatan. Dua batuk dalam 300 ms dihitung satu. Maju 900.000 ms sama dengan 900 kali 1.000 ms. Simpul luring tidak melapor. Simpul A tidak dapat luring |
| `packet.test.ts` | Panjang tepat 16. Bolak-balik `encode` dan `decode`. Hex bentuk tetap. Cadangan bernilai 0 |
| `model.test.ts` | Seluruh golden pada subbab 8. Benih sama menghasilkan keluaran sama |
| `tests/guard.test.ts` | Pindai `src/` untuk API terlarang pada subbab 12. Setiap `Claim` memiliki status dan sumber |

Uji tidak boleh dilonggarkan untuk meloloskan implementasi. Golden hanya boleh diganti bila `analysis.json` berubah.

## 15. Build dan deploy

- `vite.config.ts` memakai `base: "./"`, sehingga berfungsi di subpath.
- `three` dipisah ke chunk tersendiri melalui `build.rollupOptions.output.manualChunks`, atau opsi setara pada Vite 8.
- Target hosting utama Vercel karena sudah dipakai Caliber, dengan GitHub Pages sebagai cadangan. Publikasi membutuhkan persetujuan tim dan akun tim.
- Setelah deploy: buka di jendela incognito, pastikan tanpa halaman login hosting, dan buka di ponsel melalui QR.

## 16. Batasan yang disengaja

| Keputusan | Batas | Kapan ditingkatkan |
|---|---|---|
| Satu ruang dengan 4 simpul | Tidak ada editor denah | Bila final butuh denah puskesmas nyata |
| Model medan bebas | Proposal memodelkan gema, simulator tidak (A7) | Setelah pengukuran G3 |
| Status hilang saat muat ulang | Tidak ada simpanan sesi | Tidak perlu untuk demo |
| Monte Carlo di utas utama | Dapat tersendat pada perangkat sangat lemah | Pindah ke Web Worker bila >200 ms |
