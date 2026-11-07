# Design Brief: SUAR Simulator

Versi 1.0, 7 November 2026. Rujukan utama: aplikasi Sparekit di `Semifinal/caliber-final/app`, salinan baca-saja ada di `reference/caliber/`.

## 1. Arah

**Ruang yang bisa dicoba.** Halaman utama adalah ruang tunggu 3D, dan angka hidup di kartu besar yang lembut. Struktur, kepadatan, dan rasa interaksinya mengikuti Caliber. Warna, font, dan suara teksnya milik SUAR.

Tiga kesan yang harus tertinggal pada juri:

1. Saya bisa mencobanya sendiri dan langsung paham.
2. Tim ini tahu persis apa yang sudah dan belum terbukti.
3. Alat ini tidak merekam dan tidak menunjuk siapa pun.

## 2. Yang ditiru dan yang diubah dari Caliber

| Unsur | Caliber | SUAR |
|---|---|---|
| Kerangka | Sidebar tetap 248 px, dapat diperkecil ke 68 px | **Sama** |
| Navigasi | Dikelompokkan menurut pertanyaan | **Sama**, tiga kelompok pada subbab 5 |
| Kepala halaman | Judul pertanyaan 28 px, kalimat jawaban berangka | **Sama** |
| Kartu | Radius 20 px, garis halus, `shadow-card` | **Sama** |
| Chip status | Tinggi 22 px, ikon plus kata | **Sama** |
| Latar | Kertas hangat `#f5f4f1` | **Sama** |
| Panggung 3D | Studio tanpa sudut, render sesuai kebutuhan | **Sama**, objeknya ruang tunggu |
| Titik panas | Bulatan bernomor pada mesin | **Sama**, pada simpul terurai |
| Tombol "Open the machine" | Membuka mesin | **"Buka simpul"** |
| Replay dengan Play | Bukti pada data historis | **Skenario pagi**, disebut peragaan dan bukan bukti |
| What if | Penggeser asumsi | **Uji ambang** |
| Data check | Daftar masalah data | **Status bukti** |
| Demo terpandu | Layar redup dan bingkai target | **Sama**, enam langkah |
| Sudut kanan atas | Sakelar EN dan ID | **Lencana SIMULASI** |
| Sudut kanan bawah | Tombol Ask Sparekit | **Tidak ada.** Tombol Demo 1 menit pindah ke bilah atas agar tidak menutup panel |
| Sudut kiri bawah | Hitung mundur turnaround | **Kartu sesi:** jam simulasi, jumlah kejadian, audio keluar 0 byte |
| Peran | Pemilih akun | **Pemilih peran** di atas panel kanan Ruang tunggu |
| Warna aksen | Oranye mesin | **Teal SUAR** |
| Warna kontrol | Tinta hitam | **Navy SUAR** |
| Font | Geist | **Plus Jakarta Sans**, sesuai merek terkunci |
| Status merah | Dipakai untuk "act" | **Tidak dipakai.** FMEA proposal meminta warna netral agar zona tidak terstigma |
| Asisten AI, email, papan tugas, login | Ada | **Tidak ada** |

Nama "Sparekit" dan "Caliber" tidak boleh muncul di aplikasi.

## 3. Token

Ganti blok `:root` pada `reference/caliber/globals.css`. Nilai kontras berikut dihitung dengan rumus WCAG pada 7 November 2026.

```css
:root {
  --ground: #f5f4f1;
  --panel: #ffffff;
  --panel-2: #faf9f7;
  --rail: #e9e5de;
  --line: rgb(20 54 94 / 0.09);
  --line-2: rgb(20 54 94 / 0.16);

  --ink: #14365e;      /* navy merek */
  --ink-2: #3f5269;
  --ink-3: #5f6e82;
  --ink-4: #a3adb9;    /* hanya dekorasi, bukan teks yang harus dibaca */

  --accent: #1f8a8a;   /* teal merek, untuk isian dan ikon besar */
  --accent-ink: #156b6b;
  --accent-soft: #e6f3ef;

  --alert: #f5a524;    /* amber merek, hanya untuk Tingkat 2 dan eskalasi */
  --alert-ink: #855a00;
  --alert-soft: #fdf1da;

  --idle: #7d8088;
  --idle-ink: #55565b;
  --idle-soft: #efedea;

  --lime: #c8f25a;     /* hanya label di atas latar navy */
}
```

| Pasangan | Kontras | Dipakai untuk |
|---|---|---|
| `--ink` pada `--ground` | 11,11 | Judul, teks utama |
| `--ink-3` pada `--ground` | 4,73 | Teks sekunder terkecil yang diizinkan |
| `--ink-3` pada `--panel` | 5,20 | Teks sekunder pada kartu |
| `--accent` pada `--panel` | 4,15 | **Tidak untuk teks kecil.** Pakai `--accent-ink` |
| `--accent-ink` pada `--panel` | 6,27 | Teks teal |
| `--accent-ink` pada `--accent-soft` | 5,51 | Chip teal |
| `--alert-ink` pada `--alert-soft` | 5,43 | Chip amber |
| `--ink` pada `--alert` | 5,99 | Teks di atas amber solid |
| `--idle-ink` pada `--idle-soft` | 6,27 | Chip abu-abu |
| `--lime` pada `--ink` | 9,48 | Label Papan Informasi |

Teks putih di atas amber dilarang.

**Bentuk:** kartu `rounded-[20px]`, panel dalam `rounded-[12px]`, chip dan tombol kecil `rounded-[7px]`, kelas `.squircle` dipertahankan.

**Bayangan:** `--shadow-card: 0 1px 2px rgb(20 54 94 / 0.04)`, `--shadow-float: 0 12px 32px -12px rgb(20 54 94 / 0.28)`.

**Latar panggung:** `.hall-mesh` menjadi gradien mint dan krem:

```css
.hall-mesh {
  background:
    radial-gradient(55% 90% at 92% 0, #cfe9e2 0, transparent 62%),
    radial-gradient(50% 90% at 4% 100%, #fbeed6 0, transparent 60%),
    #f4f2ed;
}
```

## 4. Tipografi

Font: `@fontsource-variable/plus-jakarta-sans`, dengan `font-feature-settings: "tnum" 1` untuk angka.

| Peran | Ukuran dan berat | Catatan |
|---|---|---|
| Judul halaman | 28 px, 600, tracking -0,02em | Selalu pertanyaan |
| Kalimat jawaban | 14 px, 400, tinggi baris 1,55 | Angka memakai komponen `Em` |
| Judul kartu | 15 px, 600 | |
| Angka besar | 28 sampai 40 px, 600 | Disertai `ClaimTag` |
| Isi | 14 px | |
| Kecil | 12 sampai 13 px | Warna minimal `--ink-3` |
| Chip | 11,5 px, 500 | |
| Byte paket dan jam | `--font-mono` | |

## 5. Kerangka

```text
+----------+---------------------------------------------------+
| SUAR     |                                    [SIMULASI]     |
| ........ |  Judul pertanyaan                                 |
| Apa yang |  Kalimat jawaban dengan angka       [Kamus][Reset]|
| terjadi? |                                                   |
|  Ruang   |  +-------------------------+ +----------------+   |
|  Dasbor  |  |                         | |                |   |
| Apa      |  |     isi halaman         | |     panel      |   |
| alatnya? |  |                         | |                |   |
|  Simpul  |  +-------------------------+ +----------------+   |
|  Audio   |                                                   |
| Bisakah  |  kartu angka  kartu angka  kartu angka            |
| dipercaya|                                                   |
|  Ambang  |                                                   |
|  Bukti   |  Prototipe perangkat lunak. Produk SUAR adalah    |
| ........ |  alat fisik.                                      |
| [sesi]   |                                  [Demo 1 menit]   |
+----------+---------------------------------------------------+
```

- Sidebar `w-[248px]`, mode kecil `w-[68px]`. Di bawah 768 px sidebar menjadi laci, dibuka dari tombol menu.
- Konten `max-w-[1480px] px-6`, dan `px-4` di bawah 640 px.
- Merek: kotak navy radius 9 pada viewBox 32, titik putih di tengah, dua busur suar putih di atasnya, busur terluar teal muda. Tanpa tulisan di dalam ikon.
- Slogan kecil di bawah logo: "Suara tak disimpan. Suar dinyalakan."

## 6. Status

Status selalu berupa warna, ikon, dan kata.

| Status | Kata | Warna | Ikon lucide | LED pada 3D |
|---|---|---|---|---|
| Normal | Normal | teal | `CircleCheck` | Teal redup |
| Tingkat 1 | Ajakan | teal lembut | `Megaphone` | Teal terang, berdenyut pelan |
| Tingkat 2, menunggu | Tindakan | amber | `Bell` | Amber penuh |
| Eskalasi | Eskalasi | amber | `BellRing` | Amber berkedip |
| Ditangani | Ditangani | teal | `HandHelping` | Teal stabil |
| Terbatas | Terbatas | abu-abu | `EarOff` | Abu-abu |
| Luring | Luring | abu-abu arsir | `WifiOff` | Mati |

`ClaimTag` menampilkan status bukti pada setiap angka, berupa chip kecil yang dapat disorot untuk melihat sumbernya.

| Bukti | Tampilan |
|---|---|
| Terhitung | Netral, ikon `Calculator` |
| Tersimulasi | Netral, ikon `Dices` |
| Target | Garis putus, ikon `Target` |
| Dirancang | Netral, ikon `PencilRuler` |
| Asumsi | Netral, ikon `CircleHelp` |
| Ilustratif | Arsir `.hatch`, ikon `Image` |

Semua chip bukti sengaja netral. Warna amber dan teal hanya untuk status alat.

Lencana SIMULASI: navy solid, teks putih 11,5 px, huruf kapital, ikon `FlaskConical`, posisi sticky di kanan atas dan tidak pernah tertutup.

## 7. Arah seni 3D

Rujukan rasa: `plant-scene.ts` dan `machine-stage.tsx`. Bahan dibuat dengan kode tanpa file GLB, memakai primitif `kit.ts`.

### Ruang tunggu

```text
                dinding belakang: papan informasi, jam
   +--------------------------------------------------------+
   |  [A]            [B]             [C]            [D]     |   gantungan
   |  o o o o        o o o o         o o o o        o o o o |   simpul 2 m
   |  ------- lantai berwarna zona dan arsir ΔL --------    |
   |  o o o o        o o o o         o o o o        o o o o |
   +--------------------------------------------------------+   + meja
                                                                  petugas
```

- Potongan rumah boneka: dua dinding dan tanpa atap. Kamera isometrik lembut, FOV 26, dapat diputar terbatas.
- Latar `0xeee9e3` dengan `studioFloor` sehingga lantai menyatu ke latar.
- Kursi pendek abu-abu terang, 8 kursi per zona, sesuai K2.
- Simpul adalah cakram putih Ø96 mm x 34 mm, digantung batang tipis dari rangka plafon. Skala visual boleh dibesarkan dua kali agar terbaca, dan keterangan menyatakan "sketsa".
- Penanda A sampai D melayang sebagai label DOM.
- Meja petugas dan dudukan masker di sisi kanan, di luar ruang 10 x 5 m, agar koordinat tetap bersih.

### Larangan untuk 3D

- Tidak ada sorotan pada kursi atau orang tertentu. Yang menyala hanya lantai zona dan simpul.
- Tidak ada warna merah, ikon biohazard, dan kata TBC pada ruang.
- Siluet orang, bila ada, adalah kapsul netral tanpa wajah dan tidak pernah berubah warna.
- Riak batuk berada di lantai, memudar dalam 900 ms, dan tidak meninggalkan penanda.

### Simpul terurai

Lima lapis mengikuti Gambar 16 proposal. Saat dibuka, lapisan terpisah vertikal dengan easing `--ease-out-expo` selama 600 ms, dan titik panas bernomor mengikuti lapisan. Keterangan tetap: "Render konsep, bukan foto purwarupa."

## 8. Tata letak per halaman

### Ruang tunggu

```text
Judul + kalimat angka                               [Reset]
[Putar skenario pagi] [Petugas sibuk]  09.15  [1x][60x][+1][+5][+15]
+------------------------------------------+ +----------------+
|                                          | | Peran          |
|              Ruang 3D                    | | Pengunjung     |
|                                          | | Petugas        |
|   [Klik lantai = batuk]                  | | Pengelola      |
|                                          | |                |
|                                          | | Pager atau     |
|                               [2D] [3D]  | | papan          |
+------------------------------------------+ +----------------+
[Batuk A][B][C][D] [Percakapan] [Atur simpul]
Log metadata                     Kartu: batuk, Tingkat 2, respons, 0 byte
```

Pada ponsel urutannya: judul, denah 2D, tombol batuk, pager atau papan, log.

**Pager di panel** memakai bentuk Gambar 16: badan navy, empat LED berlabel, tombol hijau-teal "ditangani". Saat bergetar, seluruh kartu bergoyang kecil dengan `motion`, dan aura amber tampil di tepi.

**Papan** memakai warna Gambar 19: panel navy dengan label lime "PAPAN INFORMASI", dan panel amber lembut untuk ajakan masker.

### Uji ambang

```text
Judul + kalimat angka yang berubah
+-----------------+ +------------------------------------------+
| Preset          | | Grafik sebar: alarm palsu vs tangkapan   |
| N, T            | | Area ≤1 alarm per jam diberi warna mint  |
| Asumsi          | | Titik terpilih besar, dan 20 titik lain  |
| [Kembalikan]    | |                                          |
+-----------------+ +------------------------------------------+
Kartu: tangkapan  median pemicu  alarm palsu  penurunan dosis
Catatan batas model
```

### Batas audio

```text
Judul + kalimat
Pipa: Mikrofon > Buffer 1 s > Log-mel > CNN > Keputusan > [BATAS AUDIO] > Paket
[Percakapan] [Batuk]
+----------------------------+ +-------------------------------+
| Hex 16 byte                | | Tabel medan                   |
| 12 02 03 00 ...            | | versi, node_id, seq, ...      |
+----------------------------+ +-------------------------------+
Audio: 32.000 byte di memori, ditimpa  |  Keluar: 16 byte metadata
```

### Dasbor

Mengikuti Gambar 19 proposal, disusun ulang dengan kartu gaya Caliber: bilah navy, empat kartu zona, grafik batang, dua kartu angka, dan catatan privasi.

### Simpul dan pager

Mengikuti pola halaman `Compressors` pada Caliber: panggung di kiri dengan tombol "Buka simpul" di bawah, panel kanan berisi harga dan daftar komponen.

### Status bukti

Satu kolom lebar. Tabel janji, kartu empat gerbang, legenda, daftar asumsi. Halaman paling tenang dan tanpa animasi.

## 9. Gerak

| Gerak | Nilai |
|---|---|
| Pindah halaman | Fade 180 ms, hanya opacity |
| Kartu demo | 220 ms, `cubic-bezier(0.23, 1, 0.32, 1)` |
| Riak batuk | 900 ms |
| Titik paket | 500 ms per lompatan |
| Getar pager | 3 goyangan, 120 ms per goyangan |
| Membuka simpul | 600 ms |

Dengan `prefers-reduced-motion`, semua gerak di atas dihilangkan, dan status berubah langsung.

## 10. Suara teks

- Bahasa Indonesia EYD V, semi-formal, kalimat pendek, tanpa em dash.
- Judul berupa pertanyaan. Kalimat pertama menjawab dengan angka.
- Pakai "zona", jangan "pasien" atau "orang TBC", saat membicarakan lampu.
- Pakai "ajakan" dan "menawarkan masker". Jangan "menegur" atau "menandai pasien".
- Pakai "terhitung", "tersimulasi", "target". Jangan "terbukti", "akurat", atau "menurunkan TBC".
- Teks papan dan kartu prosedur diambil apa adanya dari proposal melalui `src/data/copy.ts`.

| Situasi | Teks |
|---|---|
| Tooltip lantai | "Klik untuk memperagakan batuk di sini" |
| Keadaan kosong log | "Belum ada kejadian. Klik lantai ruang tunggu." |
| Respons tercatat | "Ditangani dalam 2 menit 40 detik" |
| Footer | "Prototipe perangkat lunak untuk memperagakan rancangan. Produk SUAR adalah alat fisik." |

## 11. Inventaris komponen

| Komponen | Sumber | Catatan |
|---|---|---|
| `Panel`, `PanelHead`, `PageHead`, `Em`, `Chip`, `Dot` | `reference/caliber/ui.tsx` | Sesuaikan status |
| `Shell` | `reference/caliber/shell.tsx` | Buang akun, pencarian, AI |
| `Tour` | `reference/caliber/tour.tsx` | Teks Indonesia |
| `createPipeline`, `studioLights`, `studioFloor` | `reference/caliber/three/stage.ts` | Pakai apa adanya |
| `ClaimTag`, `Pager`, `Board`, `LogTable`, `Denah2D`, `PacketInspector` | Baru | |
| `RangeGauge` | Tidak dipakai | Terlalu dekat dengan bahasa "skor" |

## 12. Kriteria tinjauan visual

Diperiksa Opus pada lebar 1920, 1366, 768, dan 375 px:

- [ ] Lencana SIMULASI terlihat di semua halaman.
- [ ] Amber hanya muncul untuk Tingkat 2 dan eskalasi.
- [ ] Tidak ada warna merah.
- [ ] Tidak ada teks terpotong atau geser horizontal.
- [ ] Setiap angka kinerja memiliki `ClaimTag`.
- [ ] Ruang 3D terbaca: empat zona, arsir, simpul.
- [ ] Pager dapat ditekan dengan satu jari di ponsel, target minimal 44 px.
- [ ] Tidak ada nama Sparekit, Caliber, atau istilah bahasa Inggris yang tidak perlu.
