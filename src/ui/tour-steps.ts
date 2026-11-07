import type { SimAction } from "../sim/types";

export interface TourStep {
  target?: string;
  title: string;
  body: string;
  action?: SimAction;
  advanceMs?: number;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { title: "Zona, bukan orang", body: "SUAR menandai zona, bukan orang. Coba alurnya dalam satu menit." },
  { target: "speech-c", title: "Percakapan di Zona C", body: "Percakapan di dekat Zona C. Perhatikan: tidak terjadi apa-apa.", action: { type: "speech", zone: "C" } },
  { target: "cough-c", title: "Batuk pertama", body: "Satu batuk. Lampu zona menyala lembut dan papan mengajak mengambil masker.", action: { type: "coughZone", zone: "C" } },
  { target: "cough-c", title: "Tujuh menit kemudian", body: "Tujuh menit kemudian, batuk kedua. Dua batuk dalam 15 menit memanggil petugas.", advanceMs: 7 * 60_000, action: { type: "coughZone", zone: "C" } },
  { target: "pager-done", title: "Petugas menangani", body: "Pager bergetar. Petugas menawarkan masker, lalu menekan tombol setelah 2 menit 40 detik.", advanceMs: 160_000, action: { type: "pagerPress" } },
  { target: "log", title: "Hanya metadata yang tercatat", body: "Hanya zona, waktu, level, dan status yang tercatat. Ini simulasi; uji nyatanya dijadwalkan pada empat tahap pengujian." },
];
