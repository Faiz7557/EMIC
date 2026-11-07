import { analysis, analysis2, LATENCY_TOTAL_MS } from "./analysis";
import { bomTotals } from "./bom";

export const CLAIM_STATUSES = ["terhitung", "tersimulasi", "target", "dirancang", "asumsi", "ilustratif"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  terhitung: "Terhitung", tersimulasi: "Tersimulasi", target: "Target",
  dirancang: "Dirancang", asumsi: "Asumsi", ilustratif: "Ilustratif",
};

export interface Claim {
  id: string;
  tampil: string;
  status: ClaimStatus;
  sumber: string;
  nilai: number;
  analysisPath?: readonly string[];
  analysisFile?: "analysis.json" | "analysis2.json";
  format?: "percent" | "decimal2";
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const decimal2 = (value: number) => value.toFixed(2).replace(".", ",");

/** PRD §8: exact values and display rounding are kept together with provenance.
 * Any signal includes the visitor invitation; it is not a pager capture rate. */
export const CLAIMS = {
  captureOld: {
    id: "capture-old", nilai: analysis.grid["3_10"].capture,
    tampil: percent(analysis.grid["3_10"].capture), status: "tersimulasi",
    sumber: "reference/analysis.json · grid.3_10.capture · pasien median, ambang ≥3/10",
    analysisPath: ["grid", "3_10", "capture"], format: "percent",
  },
  captureTier2: {
    id: "capture-tier2", nilai: analysis.grid["2_15"].capture,
    tampil: percent(analysis.grid["2_15"].capture), status: "tersimulasi",
    sumber: "reference/analysis.json · grid.2_15.capture · pasien median, ambang ≥2/15",
    analysisPath: ["grid", "2_15", "capture"], format: "percent",
  },
  anySignal: {
    id: "any-signal", nilai: analysis.two_tier.Median["0.0"].any_signal,
    tampil: percent(analysis.two_tier.Median["0.0"].any_signal), status: "tersimulasi",
    sumber: "reference/analysis.json · two_tier.Median.0.0.any_signal · termasuk Tingkat 1; tidak semua memanggil petugas",
    analysisPath: ["two_tier", "Median", "0.0", "any_signal"], format: "percent",
  },
  falseAlarmTier2: {
    id: "false-alarm-tier2", nilai: analysis.grid["2_15"].fa_room_h,
    tampil: decimal2(analysis.grid["2_15"].fa_room_h), status: "tersimulasi",
    sumber: "reference/analysis.json · grid.2_15.fa_room_h · orde pertama, tanpa jeda pemicu ulang · per jam per ruang",
    analysisPath: ["grid", "2_15", "fa_room_h"], format: "decimal2",
  },
  falseAlarmWithPause: {
    id: "false-alarm-with-pause", nilai: analysis2.alarm.sim[2],
    tampil: decimal2(analysis2.alarm.sim[2]), status: "tersimulasi",
    sumber: "reference/analysis2.json · alarm.sim[2] · ≥2/15, jeda pemicu ulang 15 menit, 1,03 suara palsu/jam/zona · per jam per ruang",
    analysisFile: "analysis2.json", analysisPath: ["alarm", "sim", "2"], format: "decimal2",
  },
  capturePopulation: {
    id: "capture-population", nilai: analysis2.pop["0.0"].capture,
    tampil: percent(analysis2.pop["0.0"].capture), status: "tersimulasi",
    sumber: "reference/analysis2.json · pop.0.0.capture · Tingkat 2 ≥2/15, seluruh sebaran pasien, waktu tunggu 60 menit",
    analysisFile: "analysis2.json", analysisPath: ["pop", "0.0", "capture"], format: "percent",
  },
  taggedZone: {
    id: "tagged-zone", nilai: analysis2.attrib_gap["1.5"].tagged,
    tampil: percent(analysis2.attrib_gap["1.5"].tagged), status: "tersimulasi",
    sumber: "reference/analysis2.json · attrib_gap.1.5.tagged · model gema, level 50 ms awal, rata-rata dua batuk, simpul gantung di garis tengah, ΔL < 1,5 dB · bukan hasil engine medan bebas",
    analysisFile: "analysis2.json", analysisPath: ["attrib_gap", "1.5", "tagged"], format: "percent",
  },
  dosePopulationLow: {
    id: "dose-population-low", nilai: analysis2.pop["0.0"].dose_red,
    tampil: percent(analysis2.pop["0.0"].dose_red), status: "tersimulasi",
    sumber: "reference/analysis2.json · pop.0.0.dose_red · seluruh sebaran pasien, kepatuhan ajakan Tingkat 1 0%",
    analysisFile: "analysis2.json", analysisPath: ["pop", "0.0", "dose_red"], format: "percent",
  },
  dosePopulationHigh: {
    id: "dose-population-high", nilai: analysis2.pop["0.5"].dose_red,
    tampil: percent(analysis2.pop["0.5"].dose_red), status: "tersimulasi",
    sumber: "reference/analysis2.json · pop.0.5.dose_red · seluruh sebaran pasien, kepatuhan ajakan Tingkat 1 50%",
    analysisFile: "analysis2.json", analysisPath: ["pop", "0.5", "dose_red"], format: "percent",
  },
  captureNoisy: {
    id: "capture-noisy", nilai: analysis2.pop_n3.capture,
    tampil: percent(analysis2.pop_n3.capture), status: "tersimulasi",
    sumber: "reference/analysis2.json · pop_n3.capture · mode bising ≥3/15, seluruh sebaran pasien, waktu tunggu 60 menit",
    analysisFile: "analysis2.json", analysisPath: ["pop_n3", "capture"], format: "percent",
  },
  falseAlarmNoisy: {
    id: "false-alarm-noisy", nilai: analysis2.alarm.sim3[2],
    tampil: decimal2(analysis2.alarm.sim3[2]), status: "tersimulasi",
    sumber: "reference/analysis2.json · alarm.sim3[2] · mode bising ≥3/15, jeda pemicu ulang 15 menit, 1,03 suara palsu/jam/zona · per jam per ruang",
    analysisFile: "analysis2.json", analysisPath: ["alarm", "sim3", "2"], format: "decimal2",
  },
  latency: {
    id: "latency", nilai: LATENCY_TOTAL_MS / 1000,
    tampil: `${decimal2(LATENCY_TOTAL_MS / 1000)} detik`, status: "terhitung",
    sumber: "reference/analysis.json · jumlah latency = 1.725 ms; PRD §8 · belum diukur",
  },
  nodeCost: {
    id: "node-cost", nilai: bomTotals.node, tampil: `Rp${Math.round(bomTotals.node / 1000)} ribu`, status: "terhitung",
    sumber: "reference/proposal-content.py · Lampiran C · Rp564.680 per simpul, belum termasuk ongkos rakit",
  },
  sensitivity: {
    id: "sensitivity", nilai: 0.9, tampil: "≥90%", status: "target",
    sumber: "PRD §8; proposal Bab V, uji komponen · sensitivitas kejadian batuk, belum diukur",
  },
  response: {
    id: "response", nilai: 3, tampil: "≤3 menit", status: "target",
    sumber: "PRD §8; proposal Bab V, uji sistem dan uji pilot · waktu respons petugas, belum diukur",
  },
  audioOut: {
    id: "audio-out", nilai: 0, tampil: "0 byte", status: "dirancang",
    sumber: "PRD §8; proposal Bab VI · audio keluar · dirancang; menunggu audit",
  },
  packetSize: {
    id: "packet-size", nilai: 16, tampil: "16 byte", status: "dirancang",
    sumber: "reference/proposal-content.py · Lampiran D · ukuran paket metadata rancangan",
  },
} as const satisfies Record<string, Claim>;

export type ClaimId = (typeof CLAIMS)[keyof typeof CLAIMS]["id"];
export const claims: readonly Claim[] = Object.values(CLAIMS);

export function getClaim(id: ClaimId): Claim {
  return claims.find((claim) => claim.id === id)!;
}
