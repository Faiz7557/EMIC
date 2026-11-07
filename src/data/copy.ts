/** Exact board/procedure copy transcribed from the local proposal figures.
 * Figure numbering in the docs differs; filenames below identify the source. */
export const copy = {
  slogan: "Suara tak disimpan. Suar dinyalakan.",
  footer: "Prototipe perangkat lunak untuk memperagakan rancangan. Produk SUAR adalah alat fisik.",
  mandatory: "Simulator ini memperagakan rancangan. Simulator ini tidak membuktikan bahwa alat mampu mendengar batuk.",
  emptyLog: "Belum ada kejadian. Klik lantai ruang tunggu.",
  emptyDashboard: "Belum ada kejadian. Coba batuk di Ruang tunggu.",
  board: {
    label: "PAPAN INFORMASI",
    title: "Ruang ini memakai SUAR. Suara tidak direkam.",
    body: "Alat hanya menghitung batuk per zona, agar petugas dapat menawarkan masker. Tidak mengenali siapa pun.",
    invitationTitle: "Lampu zona menyala lembut?",
    invitation: "Silakan ambil masker di dekat kursi Anda. Ini untuk melindungi semua orang, bukan menandai siapa pun.",
    sumber: "reference/figures/f15_antarmuka.png · papan informasi",
  },
  procedure: [
    { title: "Getar", body: "Lihat LED zona pada pager" },
    { title: "Masker", body: "Tawarkan ke seluruh zona, tanpa menunjuk orang" },
    { title: "Skrining", body: "Tanyakan gejala sesuai alur nasional" },
    { title: "Tombol", body: "Tekan ditangani; waktu tercatat" },
  ],
  procedureSource: "reference/figures/f27_pasang.png · kartu prosedur petugas saat Tingkat 2",
  audioNote: "Visual ini ilustratif. Simulator tidak memiliki audio dan tidak meminta izin mikrofon.",
  modelLimit: "Hasil simulasi, bukan hasil uji. Poisson mengabaikan batuk yang datang berkelompok.",
  privacy: "Hanya hitungan agregat per zona; tanpa audio, wajah, atau identitas.",
  concept: "Render konsep, bukan foto purwarupa.",
} as const;

export const COPY = copy;
