# Product Requirements Document: SUAR Simulator

| | |
|---|---|
| Versi | 1.0, 7 November 2026 |
| Tim | IRIS Heisenberg, EMIC MR Days 2026 |
| Tenggat keras | Proposal semifinal, 7 November 2026 pukul 23.59 |
| Dokumen terkait | [TRD](TRD.md), [App Flow](APP_FLOW.md), [Design Brief](DESIGN_BRIEF.md), [Implementation Plan](IMPLEMENTATION_PLAN.md) |

## 1. Ringkasan

SUAR Simulator adalah prototipe perangkat lunak berbasis web yang memperagakan rancangan SUAR, yaitu sensor batuk per zona untuk ruang tunggu puskesmas. Juri membuka satu tautan tanpa login, mengeklik lantai ruang tunggu 3D, lalu melihat seluruh rantai rancangan: batuk, atribusi zona, sinyal dua tingkat, pager petugas, tombol ditangani, dan log yang hanya berisi metadata.

Simulator ini melengkapi proposal dan menjadi bahan awal booth final. Simulator ini bukan produk SUAR. Produk SUAR tetap alat fisik, sesuai limitasi guidebook bahwa produk harus tangible.

## 2. Masalah yang diselesaikan

1. Proposal setebal 18 halaman isi menjelaskan alur yang sebenarnya dinamis melalui gambar statis. Juri perlu waktu lama untuk membayangkannya.
2. Finalis lain mungkin hanya membawa sketsa. SUAR perlu pembeda yang terasa saat dicoba, tanpa mengklaim hasil uji yang belum ada.
3. Tim membutuhkan fondasi logika dan antarmuka yang dapat dipakai ulang pada booth final 4 sampai 5 Desember 2026.

## 3. Tujuan dan ukuran keberhasilan

| ID | Tujuan | Ukuran | Cara cek |
|---|---|---|---|
| S1 | Juri paham alur SUAR dengan cepat | Demo terpandu selesai dalam 60 sampai 90 detik | Uji stopwatch oleh tim |
| S2 | Akses tanpa hambatan | Tautan terbuka di jendela incognito tanpa login | Uji manual pasca-deploy |
| S3 | Angka konsisten dengan proposal | 0 selisih pada semua angka yang dikutip | `npm run check`, uji golden terhadap `analysis.json` |
| S4 | Jujur tentang status bukti | Setiap angka kinerja memiliki label status | Uji `claims` dan tinjauan visual |
| S5 | Tepat waktu | Fitur dibekukan pukul 21.00, tautan aktif pukul 21.15 | Jadwal pada Implementation Plan |

## 4. Pengguna

| Pengguna | Konteks | Yang dibutuhkan |
|---|---|---|
| Juri semifinal | Membaca PDF, mengeklik tautan atau memindai QR, waktu singkat | Cerita 60 detik, angka jelas, kejelasan bahwa ini simulasi |
| Juri final dan pengunjung booth | Layar di booth 2 x 2 m | Bisa dicoba sendiri, sejalan dengan rencana peragaan Gambar 29 proposal |
| Tim IRIS Heisenberg | Latihan pitching, pengembangan final | Skenario yang dapat diulang, tombol reset |

## 5. Prinsip produk

1. **Satu pertanyaan per halaman.** Judul halaman berupa pertanyaan, dan kalimat pertama menjawabnya dengan angka.
2. **Logika nyata, gambar sketsa.** Aturan rancangan benar-benar dijalankan. Tampilan 3D adalah sketsa dan disebut demikian.
3. **Label sebelum klaim.** Tidak ada angka kinerja tanpa status: terhitung, tersimulasi, target, dirancang, asumsi, atau ilustratif.
4. **Zona, bukan orang.** Tidak ada visual yang menunjuk individu, sesuai kriteria K2 proposal.
5. **Tanpa server, tanpa internet saat dipakai.** Sejalan dengan kriteria K5. Tidak ada AI cloud, analitik, mikrofon, atau penyimpanan data.

## 6. Kebutuhan fungsional

Prioritas: P0 wajib ada saat freeze, P1 sangat diharapkan, P2 dipotong pertama jika waktu mepet.

### 6.1 Ruang tunggu (`#/`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | P0 | Ruang 10 x 5 x 3 m dengan 4 simpul zona A sampai D | Koordinat simpul sama persis dengan `analysis.py`: (1,25; 2,5), (3,75; 2,5), (6,25; 2,5), (8,75; 2,5), tinggi 2 m |
| FR-02 | P0 | Klik lantai berarti ada batuk di titik itu | Atribusi memakai model medan bebas. Hasil sama dengan 800 sel `attrib.cells` |
| FR-03 | P0 | Aturan ΔL < 3 dB menandai dua zona | Titik di area arsir menaikkan status dua zona |
| FR-04 | P0 | Sinyal dua tingkat | 1 batuk menjadi Tingkat 1. Minimal 2 batuk dalam 15 menit menjadi Tingkat 2. Batas tepat 15 menit 0 detik tetap memicu |
| FR-05 | P0 | Papan pengunjung | Pada Tingkat 1 muncul ajakan mengambil masker dengan teks dari Gambar 19 proposal |
| FR-06 | P0 | Pager petugas | Pada Tingkat 2 pager bergetar dan LED zona menyala. Tombol "ditangani" mencatat waktu respons |
| FR-07 | P0 | Eskalasi | Tanpa tombol selama 3 menit, pager bergetar lagi dan tercatat |
| FR-08 | P0 | Jeda setelah ditangani | Zona berstatus Ditangani selama 15 menit, lalu kembali Normal |
| FR-09 | P0 | Kontrol waktu | Kecepatan 1x dan 60x, tombol maju 1, 5, dan 15 menit, tombol reset |
| FR-10 | P0 | Alternatif tanpa mouse dan tanpa WebGL | Tombol "Batuk di Zona A sampai D" dan denah 2D memakai logika yang sama |
| FR-11 | P1 | Skenario pagi yang dapat diputar | Linimasa 09.15 dan 09.22 sesuai subbab 3.3 proposal, dengan cabang "petugas sibuk" |
| FR-12 | P1 | Uji gangguan | Percakapan tidak memicu apa pun. Bising membuat simpul berstatus Terbatas. Simpul B, C, atau D dapat dibuat luring |
| FR-13 | P1 | Ganti peran | Pengunjung melihat papan, petugas melihat pager, pengelola melihat ringkasan dasbor |

### 6.2 Simpul dan pager (`#/alat`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-20 | P1 | Simpul 3D dapat dibuka | Lima lapis sesuai Gambar 16: penutup, cincin WS2812, INMP441, ESP32-S3-DevKitC-1, casing belakang |
| FR-21 | P1 | Titik panas dengan detail komponen | Harga mengikuti Lampiran C, total Rp564.680 per simpul, Rp130.000 per pager, Rp2.388.720 per paket |
| FR-22 | P2 | Model pager | Ukuran 70 x 44 x 18 mm dengan 4 LED zona |

### 6.3 Uji ambang (`#/ambang`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-30 | P0 | Kontrol N dan T | N 1 sampai 4, T 5, 10, 15, 20, 30 menit, disertai preset "Abstrak ≥3/10" dan "Proposal ≥2/15" |
| FR-31 | P0 | Kontrol asumsi | Frekuensi batuk, sensitivitas, suara palsu per jam, dan kepatuhan masker |
| FR-32 | P0 | Keluaran | Tangkapan, median waktu pemicu, alarm palsu per jam per ruang, dan penurunan dosis relatif |
| FR-33 | P0 | Konsistensi | Parameter yang persis sama dengan proposal menampilkan nilai `analysis.json` beserta tanda "sesuai proposal" |
| FR-34 | P0 | Batas model selalu terlihat | Catatan Poisson dan status "hasil simulasi, bukan hasil uji" tidak dapat disembunyikan |

### 6.4 Batas audio (`#/batas-audio`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-40 | P0 | Inspektur paket | Paket 16 byte nyata dengan rincian medan sesuai Lampiran D, dalam tampilan hex dan terurai |
| FR-41 | P1 | Visual pipa | Buffer 1 detik, geser 0,5 detik, log-mel, CNN, keputusan, audio ditimpa. Berlabel ilustratif karena simulator tidak memiliki audio |
| FR-42 | P1 | Perbandingan | Percakapan menghasilkan 0 paket EVENT, batuk menghasilkan paket metadata |

### 6.5 Dasbor (`#/dasbor`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-50 | P1 | Dasbor pengelola | Status zona, beban batuk, median waktu respons, kejadian ditangani, dan log sesi. Bilah alamat menulis 192.168.4.1 sebagai tiruan dasbor lokal |
| FR-51 | P2 | Contoh sehari | Data Gambar 19 proposal, berlabel ilustratif |

### 6.6 Status bukti (`#/bukti`)

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-60 | P0 | Tabel janji | Enam baris Tabel janji proposal, status tidak lebih kuat daripada proposal |
| FR-61 | P0 | Empat gerbang | G1 sampai G4 dengan kriteria lulus dan status "belum dijalankan" |
| FR-62 | P0 | Daftar batas simulator | Tertulis jelas apa yang tidak dibuktikan simulator |

### 6.7 Lintas halaman

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-70 | P0 | Lencana "SIMULASI" permanen | Terlihat di setiap halaman dan setiap lebar layar |
| FR-71 | P1 | Demo terpandu | Enam langkah mengikuti alur Gambar 29 proposal, dapat dilewati, dapat diulang |
| FR-72 | P1 | Tautan demo | `#/?demo=1` langsung menawarkan demo terpandu, dipakai untuk tautan dan QR di proposal |
| FR-73 | P2 | Kamus istilah | Tingkat 1, Tingkat 2, ΔL, ESP-NOW, TinyML, dan simpul dalam bahasa sehari-hari |

## 7. Bukan cakupan

- Deteksi batuk sungguhan, model TinyML, atau input mikrofon.
- Klaim akurasi, sensitivitas terukur, atau penurunan kasus TBC.
- Login, backend, basis data, asisten AI, notifikasi email, aplikasi mobile native, atau ekspor data.
- Dua bahasa. Versi ini hanya berbahasa Indonesia.
- Pengganti prototipe fisik. Prototipe fisik tetap wajib pada tahap final.

## 8. Aturan kejujuran

Aturan ini mengikat semua layar dan salinan teks.

| Status | Arti | Contoh |
|---|---|---|
| Terhitung | Hasil perhitungan dari datasheet dan estimasi | Latensi 1,73 detik, biaya Rp565 ribu per zona |
| Tersimulasi | Hasil simulasi Monte Carlo atau rumus orde pertama | Tangkapan 43%, alarm palsu 0,94 per jam |
| Target | Sasaran rancangan yang belum diukur | Sensitivitas ≥90%, respons ≤3 menit |
| Dirancang | Sifat rancangan yang menunggu audit | 0 byte audio keluar |
| Asumsi | Keputusan simulator yang tidak dirinci proposal | Lihat subbab 10 |
| Ilustratif | Tampilan contoh tanpa nilai bukti | Spektrogram, data dasbor sehari |

Kalimat wajib di halaman Status bukti: "Simulator ini memperagakan rancangan. Simulator ini tidak membuktikan bahwa alat mampu mendengar batuk."

Tabel angka pembuka, semuanya untuk pasien median dan berstatus tersimulasi:

| Angka | Nilai | Sumber `analysis.json` |
|---|---|---|
| Tangkapan ambang lama ≥3/10 | 6,76%, tampil 7% | `grid.3_10.capture` |
| Tangkapan Tingkat 2 ≥2/15 | 43,37%, tampil 43% | `grid.2_15.capture` |
| Sinyal apa pun termasuk satu batuk | 87,42%, tampil 87% | `two_tier.Median.0.0.any_signal` |
| Alarm palsu Tingkat 2 per jam per ruang | 0,94 | `grid.2_15.fa_room_h` |

Angka 87% tidak boleh ditulis seolah semua sinyal sampai ke petugas.

## 9. Kebutuhan nonfungsional

| ID | Kebutuhan | Ambang |
|---|---|---|
| NFR-1 | Dukungan peramban | Chrome dan Edge terbaru wajib, Firefox dan Safari terbaru diharapkan |
| NFR-2 | Lebar layar | 375 px sampai 1920 px tanpa geser horizontal halaman |
| NFR-3 | Kinerja muat | Konten pertama ≤3 detik pada laptop dan koneksi kantor. Total JS ≤1,2 MB setelah gzip |
| NFR-4 | Kinerja interaksi | Respons klik ≤100 ms. Penghitungan ulang ambang ≤200 ms |
| NFR-5 | Aksesibilitas | Kontras teks ≥4,5:1, status tidak hanya warna, seluruh aksi inti dapat dilakukan dengan keyboard, `prefers-reduced-motion` dihormati |
| NFR-6 | Privasi | Tanpa mikrofon, tanpa permintaan jaringan selain file statis, tanpa cookie, tanpa `localStorage` |
| NFR-7 | Ketahanan | Tanpa WebGL tetap dapat dipakai lewat denah 2D |
| NFR-8 | Determinisme | Masukan yang sama menghasilkan keluaran yang sama |

## 10. Celah rancangan yang ditemukan

Proposal tidak merinci hal berikut. Simulator memakai asumsi di bawah dan menampilkannya di halaman Status bukti.

| ID | Celah | Asumsi simulator | Tindak lanjut |
|---|---|---|---|
| A1 | Kapan Tingkat 1 kembali Normal | 15 menit setelah batuk terakhir tanpa batuk kedua | Tim memastikan untuk final |
| A2 | Batuk selama jeda Ditangani | Tercatat di log, tidak memicu sinyal, dan penghitung direset saat jeda selesai | Tim memastikan untuk final |
| A3 | Satu tombol pager saat beberapa zona aktif | Tombol menutup satu kelompok peringatan tertua. Dua zona dari satu batuk ambigu menjadi satu kelompok | Tim memastikan untuk final |
| A4 | Koordinator (Simpul A) mati | Simpul A tidak dapat dibuat luring di simulator, disertai catatan | Perlu keputusan rancangan sebelum final |
| A5 | Letak simpul | Model menaruh simpul di garis tengah ruang pada tinggi 2 m, sedangkan langkah pasang menulis "tempel". Simulator memakai penggantung plafon agar koordinat sama dengan model | **Tim perlu menyelaraskan saat final. Atribusi perlu dihitung ulang bila simpul ditempel di dinding** |
| A6 | Pengodean byte paket | Proposal hanya menetapkan ukuran medan. Simulator menetapkan urutan byte pada TRD | Tim memakainya untuk firmware atau menggantinya |

## 11. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Waktu habis | Proposal terlambat | Freeze 21.00. Simulator dapat dibatalkan tanpa memengaruhi proposal |
| Juri mengira angka simulator adalah hasil uji | Kredibilitas turun | Lencana SIMULASI, label status, kalimat wajib |
| Juri menilai tim mengganti produk ke software | Melanggar limitasi tangible | Halaman Simpul dan pager, teks pembuka menyebut alat fisik, Lampiran I menjelaskan peran simulator |
| WebGL gagal di perangkat juri | Halaman utama kosong | Denah 2D otomatis |
| Tautan butuh login hosting | Juri tidak dapat membuka | Uji incognito, proteksi hosting dimatikan |
| Penggunaan AI | Wajib dilaporkan | Laporan AI diperbarui dan tim meninjau isi sebelum kirim |

## 12. Sumber kebenaran

Bila dokumen ini berbeda dengan proposal, proposal yang berlaku: `Semifinal/paper/script/content.py` dan `analysis.json`. Perbedaan dicatat dan ditanyakan kepada tim, tidak diselesaikan diam-diam.
