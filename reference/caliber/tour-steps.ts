import { firstName, type Person } from "@/lib/people";
import type { TourStep } from "./tour";
import { isId } from "@/lib/i18n";

const ROLE_JOB: Record<Person["role"], string> = {
  planner: "You decide. Every recommendation waits for your approval, then moves to the person who runs it.",
  procurement: "You buy. Orders and rush orders land here once the planner approves them.",
  warehouse: "You move stock. Approved transfers between duplicate parts land here, so a shortage can be covered without buying.",
  maintenance: "You look after your section. You see urgent parts on your equipment, and you check any unusual use.",
  finance: "You review money. Parts approved for disposal land here, and the What if page writes you a memo on the stocking plan.",
};

/** The first thing a new role needs to see on the board. */
function roleSteps(me: Person): TourStep[] {
  return [
    { title: `Welcome, ${firstName(me)}`, body: `You are signed in as ${me.title}. ${ROLE_JOB[me.role]}` },
    { target: "scope", title: "Only your work", body: "My work shows what belongs to you, so the board stays short. Everyone shows the whole plant." },
    { target: "card-step", title: "One press moves a task on", body: "The button always names the next step: Approve, Start, then Mark done. If a step belongs to someone else, the card says who it is waiting for." },
    { target: "role", title: "See it as someone else", body: "Pick any role here to see the same task from the other side, from planner to buyer to warehouse." },
  ];
}

const TODO_TOUR = (me: Person): TourStep[] => [
  { title: `Welcome to Sparekit, ${firstName(me)}`, body: `Sparekit tells a plant which spare parts to buy, move, reduce or drop, and when. You are signed in as ${me.title}. ${ROLE_JOB[me.role]}` },
  { target: "nav", title: "Six places to work", body: "Plant map shows if we are ready. Forecast shows what we will need. What if, Stock and To do are the three steps to decide and act. Data check shows what can be trusted." },
  { target: "scope", title: "Only your work", body: "My work shows what belongs to you, so the board stays short. Everyone shows the whole plant." },
  { target: "ask", title: "Ask the board in your own words", body: "Try \"critical compressor parts that are too late\". AI turns the sentence into filters." },
  { target: "codes", title: "Filter", body: "Narrow the board by criticality, action, urgency, section or equipment, such as pumps or flow control valves." },
  { target: "sap", title: "Back into SAP", body: "Download the new stock limits as a file SAP can read, plus purchase requests for the orders you approved." },
  { target: "role", title: "See it as someone else", body: "Pick any role here to see the same task from the other side." },
  { target: "assistant", title: "Ask anything, any time", body: "The assistant reads the engine's data and answers in English or Bahasa Indonesia." },
  { target: "card-step", title: "One press moves a task on", body: "The button always names the next step: Approve, Start, then Mark done. There is an Undo after each press, and dragging still works." },
  { target: "card", title: "Open a card to see why", body: "Every task carries its reason. Press this card to open it.", waitForClick: true },
  { target: "peek-why", title: "The reason, in plain words", body: "AI explains why the engine recommends this, what happens if nobody acts, and what to check first. Every number comes from the engine, not from the AI." },
  { target: "peek-actions", title: "The email is already written", body: "Press Email and a draft opens with your name, the right person and the right numbers. Read it, then send it through Gmail. The task moves on by itself. Press Tutorial in the sidebar to replay this guide." },
];

const TOURS: Record<string, TourStep[]> = {
  "/": [
    { title: "Ready for the next turnaround?", body: "A turnaround is the plant's big planned shutdown, and it needs far more parts than normal months. This page asks: if the last turnaround happened again on the date you pick, which parts would we not have, after normal use until then?" },
    { target: "p-map", title: "The plant, by equipment", body: "Each marker reads like \"Furnaces 58 of 119 parts short\": furnaces used 119 different parts last turnaround, and 58 of them will not have enough stock by the next one. Press one to see them." },
    { target: "p-controls", title: "Test the plan", body: "Change the turnaround date or its size, and every count and order date recalculates." },
    { target: "p-shock", title: "What if suppliers slip?", body: "Add days to every delivery time and watch which parts fall past their last safe order day." },
    { target: "ai-overview", title: "AI overview", body: "Every main page has this button. It reads the page's numbers and tells you what matters first, for your role." },
  ],
  "/stock": [
    { title: "Where is money stuck, and where are we exposed?", body: "This page shows both problems side by side: parts we lack, and money sitting in parts we do not need." },
    { target: "s-flow", title: "The whole supply chain", body: "Read it left to right: who supplies us, what we suggest buying, what is on the shelf, and what the plant actually uses." },
    { target: "s-health", title: "Parts and money tell different stories", body: "Compare the two bars: a small share of parts can hold most of the money." },
    { target: "s-quad", title: "What to deal with first", body: "Critical parts with too little stock come first. Less critical parts with too much stock free up cash. Press a box to see those tasks." },
    { target: "s-tabs", title: "Go deeper", body: "Parts library browses every shelf by category. Slow and dead stock lists what is becoming obsolete." },
  ],
  "/forecast": [
    { title: "What will we need in the next 6 months?", body: "Most parts are used rarely and irregularly, so an average of past use says little. This page shows how the forecast handles that." },
    { target: "f-likely", title: "Who is likely to move", body: "The model estimates each part's chance of being used, including parts with no use on record." },
    { target: "f-score", title: "Tested on months it never saw", body: "Out of 100 pairs of parts, one used and one not, how often it picks the used one, against simpler methods." },
    { target: "f-replay", title: "The proof on real demand", body: "Actual use from March to September 2026, replayed against today's Min and Max and against our suggested stock limits." },
    { target: "f-patterns", title: "Six use patterns, one model", body: "The groups show how each part was used. The same model runs on all of them, and it leans on different signals when a part has little history." },
    { target: "f-months", title: "Shutdown work is planned separately", body: "Turnaround use is split from routine use, so the peak is planned as an event, not spread over every month." },
  ],
  "/what-if": [
    { title: "What if we keep more or less stock?", body: "More stock costs money to hold. Less stock risks shortages. This page finds the balance." },
    { target: "w-policy", title: "Pick a stocking plan", body: "Compare our recommended plan with the lowest-cost point and today's Min and Max, or pick your own budget." },
    { target: "w-sliders", title: "Change the assumptions", body: "Holding cost and the cost of a shortage day are assumptions, so you can test them. Slide them and watch the chart." },
    { target: "w-chart", title: "The yearly bill at every stock level", body: "Blue is holding cost, orange is shortage cost, the black line is the total. The green dot is the cheapest point, and it moves with your assumptions." },
    { target: "w-bill", title: "Today against your choice", body: "The same comparison in rupiah, with stock and availability alongside." },
    { target: "w-memo", title: "Send it to finance", body: "AI writes a short memo on the plan you picked, and you can email it from here." },
  ],
  "/replay": [
    { title: "Would it have worked?", body: "Real use from March to September 2026, played back against today's Min and Max, the best non-AI option and Sparekit." },
    { target: "r-time", title: "Drag through the months", body: "Press Play or drag the slider. The numbers and the chart build up month by month, so you can see when today's limits start to fail." },
    { target: "r-refresh", title: "The limits move every month", body: "Each month the model retrains on what has happened so far and sets new limits. Some go up, some go down." },
    { target: "r-part", title: "One part, month by month", body: "Find any part. The green band is its Min to Max: flat in SAP, moving with Sparekit. Red dots are requests the shelf could not fully serve." },
  ],
  "/check": [
    { title: "Can we trust these numbers?", body: "A recommendation is only as good as its data. This page shows what was wrong and how it was handled." },
    { target: "c-traps", title: "Problems found in the data", body: "Each problem, how much data it touched, and what was done about it." },
    { target: "c-trust", title: "A trust score for each part", body: "Parts whose records do not add up are flagged, so someone counts the shelf before acting." },
    { target: "c-assume", title: "Every assumption in the open", body: "Anything not in the data, such as the next turnaround date, is listed here." },
  ],
};

const GENERAL: TourStep[] = [
  { target: "nav", title: "Find your way around", body: "Plant map shows if we are ready. Forecast shows what we will need. What if, Stock and To do are the three steps to decide and act. Data check shows what can be trusted." },
  { target: "role", title: "Switch role", body: "Pick any role here to see the app as that person." },
  { target: "assistant", title: "Ask anything, any time", body: "The assistant reads the engine's data and answers in English or Bahasa Indonesia." },
];

/* ---------------------------------------------------------------- Bahasa Indonesia */

const ROLE_JOB_ID: Record<Person["role"], string> = {
  planner: "Anda yang memutuskan. Setiap rekomendasi menunggu persetujuan Anda, lalu berpindah ke orang yang menjalankannya.",
  procurement: "Anda yang membeli. Pesanan dan pesanan percepatan masuk ke sini setelah disetujui perencana.",
  warehouse: "Anda yang memindahkan stok. Pemindahan antarsuku cadang kembar yang sudah disetujui masuk ke sini, sehingga kekurangan bisa ditutup tanpa membeli.",
  maintenance: "Anda menjaga bagian Anda sendiri. Anda melihat suku cadang mendesak pada peralatan Anda dan memeriksa pemakaian yang tidak biasa.",
  finance: "Anda meninjau sisi keuangan. Suku cadang yang disetujui untuk dihapus masuk ke sini, dan halaman Simulasi menuliskan memo tentang rencana stok untuk Anda.",
};

function roleStepsId(me: Person): TourStep[] {
  return [
    { title: `Selamat datang, ${firstName(me)}`, body: `Anda masuk sebagai ${me.title}. ${ROLE_JOB_ID[me.role]}` },
    { target: "scope", title: "Hanya pekerjaan Anda", body: "Pekerjaan saya menampilkan tugas milik Anda, sehingga papan tetap ringkas. Semua orang menampilkan seluruh kilang." },
    { target: "card-step", title: "Satu tekan untuk melanjutkan tugas", body: "Tombolnya selalu menyebut langkah berikutnya: Setujui, Mulai, lalu Tandai selesai. Jika langkahnya milik orang lain, kartu akan menyebutkan siapa yang ditunggu." },
    { target: "role", title: "Lihat dari sudut pandang orang lain", body: "Pilih peran mana pun di sini untuk melihat tugas yang sama dari sisi lain, mulai dari perencana, staf pengadaan, hingga gudang." },
  ];
}

const TODO_TOUR_ID = (me: Person): TourStep[] => [
  { title: `Selamat datang di Sparekit, ${firstName(me)}`, body: `Sparekit memberi tahu kilang suku cadang mana yang perlu dibeli, dipindahkan, dikurangi, atau dihapus, beserta waktunya. Anda masuk sebagai ${me.title}. ${ROLE_JOB_ID[me.role]}` },
  { target: "nav", title: "Enam tempat kerja", body: "Peta kilang menunjukkan apakah kita siap. Prakiraan menunjukkan apa yang akan kita butuhkan. Simulasi, Stok, dan Tugas adalah tiga langkah untuk memutuskan dan bertindak. Cek data menunjukkan apa yang bisa dipercaya." },
  { target: "scope", title: "Hanya pekerjaan Anda", body: "Pekerjaan saya menampilkan tugas milik Anda, sehingga papan tetap ringkas. Semua orang menampilkan seluruh kilang." },
  { target: "ask", title: "Tanyakan dengan kata-kata Anda sendiri", body: "Coba ketik \"suku cadang kompresor kritis yang terlambat\". AI akan mengubah kalimat itu menjadi filter." },
  { target: "codes", title: "Saring", body: "Persempit papan menurut kekritisan, tindakan, urgensi, bagian, atau peralatan, misalnya pompa atau katup kendali aliran." },
  { target: "sap", title: "Kembali ke SAP", body: "Unduh batas stok baru sebagai berkas yang bisa dibaca SAP, beserta permintaan pembelian untuk pesanan yang sudah Anda setujui." },
  { target: "role", title: "Lihat dari sudut pandang orang lain", body: "Pilih peran mana pun di sini untuk melihat tugas yang sama dari sisi lain." },
  { target: "assistant", title: "Tanyakan apa saja, kapan saja", body: "Asisten membaca data mesin hitung dan menjawab dalam bahasa Indonesia atau Inggris." },
  { target: "card-step", title: "Satu tekan untuk melanjutkan tugas", body: "Tombolnya selalu menyebut langkah berikutnya: Setujui, Mulai, lalu Tandai selesai. Setiap tekanan bisa diurungkan, dan kartu tetap bisa diseret." },
  { target: "card", title: "Buka kartu untuk melihat alasannya", body: "Setiap tugas disertai alasannya. Tekan kartu ini untuk membukanya.", waitForClick: true },
  { target: "peek-why", title: "Alasannya, dalam bahasa sederhana", body: "AI menjelaskan mengapa mesin hitung merekomendasikan tindakan ini, apa akibatnya jika tidak ada yang bertindak, dan apa yang perlu diperiksa lebih dulu. Semua angka berasal dari mesin hitung, bukan dari AI." },
  { target: "peek-actions", title: "Surelnya sudah ditulis", body: "Tekan Surel, lalu draf terbuka lengkap dengan nama Anda, penerima yang tepat, dan angka yang benar. Baca dulu, lalu kirim lewat Gmail. Tugasnya akan berpindah dengan sendirinya. Tekan Panduan di bilah samping untuk mengulang panduan ini." },
];

const TOURS_ID: Record<string, TourStep[]> = {
  "/": [
    { title: "Siapkah kita untuk turnaround berikutnya?", body: "Turnaround adalah penghentian besar kilang yang terencana, dan kebutuhan suku cadangnya jauh lebih banyak daripada bulan-bulan biasa. Halaman ini menjawab: jika turnaround sebelumnya terulang pada tanggal yang Anda pilih, suku cadang mana yang tidak akan cukup, setelah dikurangi pemakaian normal sampai saat itu?" },
    { target: "p-map", title: "Kilang, menurut peralatannya", body: "Setiap penanda dibaca seperti \"Tungku 58 dari 119 suku cadang kurang\": tungku memakai 119 jenis suku cadang pada turnaround sebelumnya, dan 58 di antaranya tidak akan cukup stoknya pada turnaround berikutnya. Tekan salah satunya untuk melihatnya." },
    { target: "p-controls", title: "Uji rencananya", body: "Ubah tanggal atau ukuran turnaround, dan setiap angka serta tanggal pemesanan akan dihitung ulang." },
    { target: "p-shock", title: "Bagaimana jika pemasok terlambat?", body: "Tambahkan hari pada setiap waktu kirim dan lihat suku cadang mana yang melewati batas aman pemesanannya." },
    { target: "ai-overview", title: "Ringkasan AI", body: "Setiap halaman utama memiliki tombol ini. Tombol ini membaca angka di halaman dan memberi tahu apa yang paling penting lebih dulu, sesuai peran Anda." },
  ],
  "/stock": [
    { title: "Di mana uang tertahan, dan di mana kita rawan?", body: "Halaman ini menampilkan dua masalah berdampingan: suku cadang yang kurang, dan uang yang mengendap di suku cadang yang tidak dibutuhkan." },
    { target: "s-flow", title: "Seluruh rantai pasok", body: "Baca dari kiri ke kanan: siapa pemasok kita, apa yang disarankan untuk dibeli, apa yang ada di rak, dan apa yang benar-benar dipakai kilang." },
    { target: "s-health", title: "Jumlah dan nilai bercerita berbeda", body: "Bandingkan kedua batang: sebagian kecil suku cadang bisa menahan sebagian besar uang." },
    { target: "s-quad", title: "Apa yang ditangani lebih dulu", body: "Suku cadang kritis yang stoknya terlalu sedikit didahulukan. Suku cadang kurang kritis yang stoknya berlebih bisa membebaskan dana. Tekan salah satu kotak untuk melihat tugasnya." },
    { target: "s-tabs", title: "Telusuri lebih dalam", body: "Pustaka suku cadang menampilkan setiap rak menurut kategori. Stok lambat dan stok mati mendaftar suku cadang yang mulai usang." },
  ],
  "/forecast": [
    { title: "Apa yang akan kita butuhkan dalam 6 bulan ke depan?", body: "Sebagian besar suku cadang jarang dan tidak teratur pemakaiannya, sehingga rata-rata pemakaian masa lalu tidak banyak membantu. Halaman ini menunjukkan cara prakiraan menanganinya." },
    { target: "f-likely", title: "Mana yang kemungkinan terpakai", body: "Model menaksir peluang setiap suku cadang untuk terpakai, termasuk suku cadang yang belum memiliki catatan pemakaian." },
    { target: "f-score", title: "Diuji pada bulan yang belum pernah dilihatnya", body: "Dari 100 pasangan suku cadang, satu terpakai dan satu tidak, seberapa sering model memilih yang terpakai, dibandingkan metode yang lebih sederhana." },
    { target: "f-replay", title: "Bukti pada pemakaian riil", body: "Pemakaian riil Maret sampai September 2026, diputar ulang dengan Min dan Max saat ini serta dengan batas stok yang kami sarankan." },
    { target: "f-patterns", title: "Enam pola pemakaian, satu model", body: "Kelompok ini menunjukkan cara tiap suku cadang dipakai. Model yang sama berjalan pada semuanya, dan sandarannya berbeda ketika riwayat suku cadang hanya sedikit." },
    { target: "f-months", title: "Pekerjaan turnaround direncanakan terpisah", body: "Pemakaian turnaround dipisahkan dari pemakaian rutin, sehingga puncaknya direncanakan sebagai satu kejadian, tidak disebar ke setiap bulan." },
  ],
  "/what-if": [
    { title: "Bagaimana jika stok kita tambah atau kurangi?", body: "Stok yang lebih banyak membutuhkan biaya penyimpanan. Stok yang lebih sedikit berisiko kekurangan. Halaman ini mencari titik keseimbangannya." },
    { target: "w-policy", title: "Pilih rencana stok", body: "Bandingkan rencana yang kami sarankan dengan titik biaya terendah dan Min serta Max saat ini, atau pilih anggaran Anda sendiri." },
    { target: "w-sliders", title: "Ubah asumsinya", body: "Biaya penyimpanan dan biaya satu hari kekurangan adalah asumsi, jadi Anda bisa mengujinya. Geser penggesernya dan perhatikan grafiknya." },
    { target: "w-chart", title: "Tagihan tahunan pada setiap tingkat stok", body: "Biru adalah biaya penyimpanan, oranye adalah biaya kekurangan, dan garis hitam adalah totalnya. Titik hijau adalah titik termurah, yang bergeser mengikuti asumsi Anda." },
    { target: "w-bill", title: "Saat ini dibandingkan pilihan Anda", body: "Perbandingan yang sama dalam rupiah, lengkap dengan stok dan ketersediaannya." },
    { target: "w-memo", title: "Kirim ke bagian keuangan", body: "AI menulis memo singkat tentang rencana yang Anda pilih, dan Anda bisa mengirimkannya lewat surel dari sini." },
  ],
  "/replay": [
    { title: "Apakah akan berhasil?", body: "Pemakaian riil Maret sampai September 2026, diputar ulang dengan Min dan Max saat ini, opsi non-AI terbaik, dan Sparekit." },
    { target: "r-time", title: "Geser sepanjang bulan", body: "Tekan Putar atau geser penggesernya. Angka dan grafik terbentuk bulan demi bulan, sehingga terlihat kapan batas saat ini mulai gagal." },
    { target: "r-refresh", title: "Batas stok bergerak setiap bulan", body: "Setiap bulan model dilatih ulang dengan kejadian sampai saat itu dan menetapkan batas baru. Ada yang naik, ada yang turun." },
    { target: "r-part", title: "Satu suku cadang, bulan demi bulan", body: "Cari suku cadang apa pun. Pita hijau adalah Min sampai Max: datar di SAP, bergerak dengan Sparekit. Titik merah adalah permintaan yang tidak terlayani penuh." },
  ],
  "/check": [
    { title: "Bisakah angka-angka ini dipercaya?", body: "Rekomendasi hanya sebaik datanya. Halaman ini menunjukkan apa yang salah dalam data dan bagaimana penanganannya." },
    { target: "c-traps", title: "Masalah yang ditemukan dalam data", body: "Setiap masalah, seberapa banyak data yang terdampak, dan apa yang dilakukan untuk mengatasinya." },
    { target: "c-trust", title: "Skor kepercayaan untuk setiap suku cadang", body: "Suku cadang yang catatannya tidak cocok diberi tanda, sehingga isi raknya dihitung dulu sebelum ada tindakan." },
    { target: "c-assume", title: "Semua asumsi dibuka", body: "Apa pun yang tidak ada dalam data, seperti tanggal turnaround berikutnya, dicantumkan di sini." },
  ],
};

const GENERAL_ID: TourStep[] = [
  { target: "nav", title: "Kenali tata letaknya", body: "Peta kilang menunjukkan apakah kita siap. Prakiraan menunjukkan apa yang akan kita butuhkan. Simulasi, Stok, dan Tugas adalah tiga langkah untuk memutuskan dan bertindak. Cek data menunjukkan apa yang bisa dipercaya." },
  { target: "role", title: "Ganti peran", body: "Pilih peran mana pun di sini untuk melihat aplikasi sebagai orang tersebut." },
  { target: "assistant", title: "Tanyakan apa saja, kapan saja", body: "Asisten membaca data mesin hitung dan menjawab dalam bahasa Indonesia atau Inggris." },
];

/** Pages with their own guide. Anywhere else, the Tutorial button plays the general one. */
export function tourKey(path: string): string | null {
  if (path === "/todo" || TOURS[path]) return path;
  return null;
}

export function stepsFor(path: string, me: Person, firstTime: boolean): TourStep[] {
  const id = isId();
  if (path === "/todo") return firstTime ? (id ? TODO_TOUR_ID : TODO_TOUR)(me) : (id ? roleStepsId : roleSteps)(me);
  return (id ? TOURS_ID : TOURS)[path] ?? (id ? GENERAL_ID : GENERAL);
}
