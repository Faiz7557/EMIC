import { analysis2 } from "./analysis";
import { CLAIMS } from "./claims";

/** Proposal Bab V, tabel gerbang. Semua kriteria masih target, belum hasil uji. */
export const gates = [
  { id: "G1", title: "Komponen", uji: `≥500 batuk diputar di perangkat dan ≥${analysis2.g1_hours_for_claim} jam audio negatif disuntikkan`, kriteria: "Sensitivitas ≥90% dan batas bawah ≥85%; alarm palsu kejadian ≤1,03/jam; inferensi ≤100 ms; 0 byte audio keluar", bilaGagal: "Perbesar model atau data; turunkan klaim" },
  { id: "G2", title: "Integrasi", uji: "4 simpul dan pager, 24 jam, listrik dan radio diganggu", kriteria: "Pemicu sampai pager ≤10 detik; pengiriman ≥99%; pulih otomatis", bilaGagal: "Perbaiki protokol dan kirim ulang" },
  { id: "G3", title: "Ruang", uji: "Ruang simulasi, wawancara 8 sampai 12 informan", kriteria: "Zona benar tertandai ≥80%; alarm palsu Tingkat 2 ≤1/jam; pasang ≤15 menit; SUS ≥68", bilaGagal: "Kalibrasi ulang ambang, tata letak, kata-kata papan" },
  { id: "G4", title: "Pilot", uji: "1 ruang tunggu, 1 minggu senyap dan 2 minggu aktif, setelah izin dan persetujuan etik", kriteria: "Respons median ≤3 menit; proporsi pasien batuk bermasker naik dari baseline; tanpa keluhan privasi serius", bilaGagal: "Hentikan perluasan; tinjau alur" },
].map((gate) => ({ ...gate, status: "target" as const, sumber: "reference/proposal-content.py · Bab V · tabel gerbang" }));

/** Proposal Bab VI, tabel janji; belum ada baris berstatus terukur. */
export const promises = [
  { janji: "Batuk di ruang tunggu menjadi data", ukuran: "Sensitivitas ≥90% per kejadian", bukti: "Target dari literatur; belum diukur", status: "target" },
  { janji: "Petugas tahu tanpa terus mengamati", ukuran: "Pemicu sampai pager ≤10 detik", bukti: "Terhitung 1,73 detik; belum diukur", status: "terhitung" },
  { janji: "Tidak mengganggu dengan alarm palsu", ukuran: "≤1 per jam per ruang", bukti: `Tersimulasi ${CLAIMS.falseAlarmWithPause.tampil} per jam; belum diukur`, status: "tersimulasi" },
  { janji: "Zona yang tepat ditandai", ukuran: "≥80% zona benar tertandai", bukti: `Termodelkan ${CLAIMS.taggedZone.tampil}; belum diukur`, status: "tersimulasi" },
  { janji: "Percakapan tetap aman", ukuran: "0 byte audio keluar", bukti: "Dirancang; menunggu audit", status: "dirancang" },
  { janji: "Pengunjung lebih terlindung", ukuran: "Respons, masker, dosis relatif", bukti: `Termodelkan rata-rata ${CLAIMS.dosePopulationLow.tampil} sampai ${CLAIMS.dosePopulationHigh.tampil}; pilot menentukan`, status: "tersimulasi" },
  { janji: "Terjangkau untuk klinik kecil", ukuran: "≤Rp600 ribu per zona", bukti: "Terhitung ±Rp565 ribu; belum termasuk ongkos rakit", status: "terhitung" },
].map((promise) => ({ ...promise, sumber: "reference/proposal-content.py · Bab VI · tabel janji" }));

export const assumptions = [
  { id: "A1", title: "Kapan Tingkat 1 kembali Normal", isi: "15 menit setelah batuk terakhir tanpa batuk kedua", tindakLanjut: "Tim memastikan untuk final" },
  { id: "A2", title: "Batuk selama jeda Ditangani", isi: "Tercatat di log, tidak memicu sinyal, dan penghitung direset saat jeda selesai", tindakLanjut: "Tim memastikan untuk final" },
  { id: "A3", title: "Satu tombol pager saat beberapa zona aktif", isi: "Tombol menutup satu kelompok peringatan tertua. Dua zona dari satu batuk ambigu menjadi satu kelompok", tindakLanjut: "Tim memastikan untuk final" },
  { id: "A4", title: "Koordinator (Simpul A) mati", isi: "Simpul A tidak dapat dibuat luring di simulator, disertai catatan", tindakLanjut: "Perlu keputusan rancangan sebelum final" },
  { id: "A6", title: "Pengodean byte paket", isi: "Proposal hanya menetapkan ukuran medan. Simulator menetapkan urutan byte pada TRD", tindakLanjut: "Tim memakainya untuk firmware atau menggantinya" },
  { id: "A7", title: "Level 50 ms awal dan rata-rata dua batuk", isi: "Proposal menentukan zona Tingkat 2 dari rata-rata level 50 ms awal minimal dua batuk, dengan model gema. Simulator memakai medan bebas tanpa gema dan menentukan zona per batuk", tindakLanjut: `Berlaku bila firmware dibangun; angka ${CLAIMS.taggedZone.tampil} tetap dikutip dari proposal` },
].map((assumption) => ({ ...assumption, status: "asumsi" as const, sumber: "docs/PRD.md · §10" }));

export const GATES = gates;
