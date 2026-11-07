import { useEffect, useMemo, useState } from "react";
import { analysis } from "../data/analysis";
import { CLAIMS, type Claim } from "../data/claims";
import { copy } from "../data/copy";
import { falseAlarmPerHour, LAM_F, SENS, simulate, twoTier } from "../sim/model";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

const windows = [5, 10, 15, 20, 30] as const;
const counts = [1, 2, 3, 4] as const;
const profiles = { Q1: 1.2, Median: 2.3, Q3: 4.1 } as const;
const defaults = { N: 2, T: 15, rate: 2.3, sens: SENS, falseRate: LAM_F, compliance: 0 };
type Controls = typeof defaults;
const presets = [
  { label: "Abstrak ≥3/10", N: 3, T: 10 },
  { label: "Proposal ≥2/15", N: 2, T: 15 },
  { label: "1 batuk saja", N: 1, T: 15 },
  { label: "Mode bising ≥3/15", N: 3, T: 15 },
];
const decimal = (value: number, digits = 2) => value.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value: number) => `${Math.round(value * 100)}%`;
const sameControls = (a: Controls, b: Controls) => (Object.keys(a) as (keyof Controls)[]).every((key) => a[key] === b[key]);

function calculate(input: Controls, n: number) {
  const { N, T, rate, sens, falseRate, compliance } = input;
  const key = `${N}_${T}` as keyof typeof analysis.grid;
  const baseline = sens === SENS && falseRate === LAM_F && compliance === 0;
  const profile = rate === 1.2 ? "Q1" : rate === 4.1 ? "Q3" : null;
  const profileKey = key === "3_10" || key === "2_15" || key === "2_10" ? key : null;
  const golden = baseline && rate === defaults.rate ? analysis.grid[key]
    : baseline && profile && profileKey ? analysis.profiles[profile][profileKey] : undefined;
  const exact = golden !== undefined;
  const triggers = golden ? [] : simulate({ N, TMin: T, ratePerH: rate, sens, n });
  const captured = triggers.filter((time): time is number => time !== null).sort((a, b) => a - b);
  const middle = Math.floor(captured.length / 2);
  return {
    N, T, exact, capture: golden?.capture ?? captured.length / n,
    source: rate === defaults.rate ? `grid.${key}` : `profiles.${profile ?? "personalisasi"}.${key}`,
    median: golden?.median_trigger ?? (captured.length ? (captured[middle] + captured[Math.floor((captured.length - 1) / 2)]) / 2 : null),
    falseAlarm: golden && "fa_room_h" in golden ? golden.fa_room_h : falseAlarmPerHour(falseRate, N, T),
  };
}

function calculateResults(input: Controls) {
  const selected = calculate(input, 20000);
  const profile = input.rate === 1.2 ? "Q1" : input.rate === 2.3 ? "Median" : input.rate === 4.1 ? "Q3" : null;
  const complianceKey = input.compliance === 0 ? "0.0" : input.compliance === 0.5 ? "0.5" : null;
  const goldenDose = input.sens === SENS && input.falseRate === LAM_F && profile
    ? input.N === 2 && input.T === 15 && complianceKey
      ? analysis.two_tier[profile][complianceKey].dose_red
      : (input.N === 3 || input.N === 2) && input.T === 10 && input.compliance === 0
        ? analysis.profiles[profile][input.N === 3 ? "3_10" : "2_10"].dose_red : undefined
    : undefined;
  const dose = goldenDose ?? twoTier({ rate: input.rate, sens: input.sens, c: input.compliance, N2: input.N, T2: input.T, n: 20000 }).dose_red;
  // ponytail: use a Web Worker only if this debounced recalculation exceeds 200 ms.
  const points = counts.flatMap((N) => windows.map((T) => calculate({ ...input, N, T }, 5000)));
  return { input, selected, dose, doseExact: goldenDose !== undefined, points };
}

function resultClaim(id: string, value: number, display: string, exact: boolean, source: string): Claim {
  return { id: `ambang-${id}`, nilai: value, tampil: display, status: "tersimulasi", sumber: `${exact ? "sesuai proposal · reference/analysis.json" : "tersimulasi di peramban · benih tetap"} · ${source}` };
}

export default function Ambang() {
  const [controls, setControls] = useState<Controls>(defaults);
  const initial = useMemo(() => calculateResults(defaults), []);
  const [results, setResults] = useState(initial);
  const pending = !sameControls(controls, results.input);
  useEffect(() => {
    if (sameControls(controls, results.input)) return;
    const timeout = window.setTimeout(() => setResults(calculateResults(controls)), 150);
    return () => window.clearTimeout(timeout);
  }, [controls, results.input]);

  const { selected, points } = results;
  const profileName = Object.entries(profiles).find(([, rate]) => rate === results.input.rate)?.[0];
  const provenance = selected.exact ? "sesuai proposal" : "tersimulasi di peramban";
  const captureClaim = resultClaim("capture", selected.capture, percent(selected.capture), selected.exact, selected.exact ? `${selected.source}.capture · tangkapan ambang dalam 60 menit` : "simulate · 20.000 sesi · tangkapan ambang dalam 60 menit");
  const medianDisplay = selected.median === null ? "Tidak terpicu" : `${decimal(selected.median, 1)} menit`;
  const metrics = [
    { label: "Tangkapan ambang", display: captureClaim.tampil, claim: captureClaim, note: selected.N === 1 ? "Termasuk ajakan Tingkat 1; tidak semua sinyal memanggil petugas." : "Sesi yang mencapai ambang pemicu selama 60 menit." },
    { label: "Median waktu pemicu", display: medianDisplay, claim: resultClaim("median", selected.median ?? 0, medianDisplay, selected.exact, selected.exact ? `${selected.source}.median_trigger · hanya sesi yang terpicu` : "simulate · 20.000 sesi · hanya sesi yang terpicu"), note: "Dihitung hanya dari sesi yang mencapai ambang." },
    { label: "Alarm palsu / jam / ruang · orde pertama", display: decimal(selected.falseAlarm), claim: resultClaim("false-alarm", selected.falseAlarm, decimal(selected.falseAlarm), selected.exact, `falseAlarmPerHour · empat zona · orde pertama tanpa jeda pemicu ulang`), note: selected.falseAlarm > 1 ? "Melewati batas ≤1 alarm palsu per jam per ruang." : "Dalam batas ≤1 alarm palsu per jam per ruang." },
    { label: "Penurunan dosis relatif", display: percent(results.dose), claim: resultClaim("dose", results.dose, percent(results.dose), results.doseExact, results.doseExact ? (selected.T === 10 ? `profiles.${profileName}.${selected.N}_10.dose_red` : `two_tier · frekuensi ${results.input.rate} · kepatuhan ${results.input.compliance}`) : "twoTier · 20.000 sesi"), note: `${results.doseExact ? "sesuai proposal" : "tersimulasi di peramban"} · relatif terhadap tanpa tindakan, bukan penurunan kasus penyakit.` },
  ];
  const xMax = Math.max(5, ...points.map((point) => point.falseAlarm), selected.falseAlarm);
  const x = (value: number) => 58 + value / xMax * 494;
  const y = (value: number) => 282 - value * 240;
  function update(key: keyof Controls, value: number) {
    setControls((previous) => ({ ...previous, [key]: value }));
  }

  return <>
    <PageHead title="Kenapa dua tingkat?" answer={<>
      Ambang ≥{selected.N}/{selected.T} menangkap <Em>{captureClaim.tampil}</Em> sesi pasien profil {profileName} dalam model tunggu 60 menit. <ClaimTag claim={captureClaim} /> <span>{provenance}</span>
    </>} />
    <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel>
        <PanelHead title="Atur ambang" />
        <div className="panel-body flex flex-col gap-5">
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-2 font-semibold">Preset proposal</legend>
            {presets.map((preset) => <button key={preset.label} type="button"
              className={`button ${sameControls(controls, { ...defaults, N: preset.N, T: preset.T }) ? "" : "button-quiet"}`}
              aria-pressed={sameControls(controls, { ...defaults, N: preset.N, T: preset.T })}
              onClick={() => setControls({ ...defaults, N: preset.N, T: preset.T })}>{preset.label}</button>)}
            <p className="page-note">Mode bising menaikkan ambang untuk ruang yang melewati batas alarm. Kartu seluruh sebaran pasien di bawah memuat hasil populasi proposal.</p>
          </fieldset>
          <label className="flex flex-col gap-2" htmlFor="ambang-n">Jumlah batuk (N)
            <select id="ambang-n" className="min-h-11 rounded-lg border border-line-2 bg-panel px-3" value={controls.N} onChange={(event) => update("N", Number(event.target.value))}>
              {counts.map((N) => <option key={N} value={N}>{N} batuk</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2" htmlFor="ambang-t">Jendela waktu (T)
            <select id="ambang-t" className="min-h-11 rounded-lg border border-line-2 bg-panel px-3" value={controls.T} onChange={(event) => update("T", Number(event.target.value))}>
              {windows.map((T) => <option key={T} value={T}>{T} menit</option>)}
            </select>
          </label>
          <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
            <legend className="mb-3 font-semibold">Asumsi model</legend>
            <label className="flex flex-col gap-2" htmlFor="ambang-rate">Frekuensi batuk
              <select id="ambang-rate" className="min-h-11 rounded-lg border border-line-2 bg-panel px-3" value={controls.rate} onChange={(event) => update("rate", Number(event.target.value))}>
                {Object.entries(profiles).map(([name, rate]) => <option key={name} value={rate}>{name} · {decimal(rate, 1)} batuk/jam</option>)}
              </select>
            </label>
            <label className="flex flex-col" htmlFor="ambang-sens">Sensitivitas: {decimal(controls.sens * 100, 1)}%
              <input id="ambang-sens" className="min-h-11 w-full accent-accent-ink" type="range" min="0" max="100" step="0.1" value={controls.sens * 100} onChange={(event) => update("sens", Number((Number(event.target.value) / 100).toFixed(3)))} />
            </label>
            <label className="flex flex-col" htmlFor="ambang-false">Suara palsu: {decimal(controls.falseRate)} / jam / zona
              <input id="ambang-false" className="min-h-11 w-full accent-accent-ink" type="range" min="0" max="3" step="0.01" value={controls.falseRate} onChange={(event) => update("falseRate", Number(event.target.value))} />
            </label>
            <label className="flex flex-col" htmlFor="ambang-mask">Kepatuhan masker: {percent(controls.compliance)}
              <input id="ambang-mask" className="min-h-11 w-full accent-accent-ink" type="range" min="0" max="100" step="1" value={controls.compliance * 100} onChange={(event) => update("compliance", Number(event.target.value) / 100)} />
            </label>
          </fieldset>
          <p className="page-note">Waktu tunggu 60 menit, respons petugas 5 menit, efektivitas masker 56%. Sensitivitas adalah asumsi, belum diukur pada alat.</p>
          <button type="button" className="button button-quiet" onClick={() => setControls({ ...defaults })}>Kembalikan nilai bawaan</button>
        </div>
      </Panel>
      <div className="flex min-w-0 flex-col gap-6" aria-busy={pending}>
        <Panel>
          <PanelHead title="Tangkapan dan alarm palsu" />
          <figure className="panel-body m-0">
            <p role="status" className="text-sm text-ink-2">{pending ? "Menghitung… Hasil sebelumnya masih ditampilkan." : provenance}</p>
            <svg className="block h-auto w-full" viewBox="0 0 580 345" role="img" aria-labelledby="ambang-chart-title ambang-chart-description">
              <title id="ambang-chart-title">Tangkapan dibanding alarm palsu</title>
              <desc id="ambang-chart-description">Area mint menunjukkan batas paling banyak satu alarm palsu per jam per ruang. Lingkaran besar adalah ambang terpilih. Nilai setiap ambang tersedia pada tabel di bawah grafik.</desc>
              <rect x={x(0)} y={y(1)} width={x(1) - x(0)} height="240" fill="var(--accent-soft)" />
              {[0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}>
                <line x1={x(0)} x2={x(xMax)} y1={y(value)} y2={y(value)} stroke="var(--line-2)" />
                <text x="48" y={y(value) + 4} textAnchor="end" fontSize="12" fill="var(--ink-2)">{percent(value)}</text>
              </g>)}
              <line x1={x(1)} x2={x(1)} y1={y(0)} y2={y(1)} stroke="var(--accent-ink)" strokeDasharray="4 4" />
              {[0, 1, xMax / 2, xMax].map((value) => <text key={value} x={x(value)} y="305" textAnchor="middle" fontSize="12" fill="var(--ink-2)">{decimal(value, 1)}</text>)}
              <text x="58" y="22" fontSize="13" fill="var(--ink)">Tangkapan ambang</text>
              <text x="305" y="334" textAnchor="middle" fontSize="13" fill="var(--ink)">Alarm palsu / jam / ruang</text>
              {points.map((point) => <circle key={`${point.N}_${point.T}`} cx={x(point.falseAlarm)} cy={y(point.capture)} r="4" fill="var(--ink-3)">
                <title>≥{point.N}/{point.T}: {percent(point.capture)}, {decimal(point.falseAlarm)} alarm/jam · {point.exact ? "sesuai proposal" : "tersimulasi di peramban"}</title>
              </circle>)}
              <circle cx={x(selected.falseAlarm)} cy={y(selected.capture)} r="9" fill="var(--accent-ink)" stroke="var(--panel)" strokeWidth="3" />
            </svg>
            <figcaption className="page-note">Titik terpilih: ≥{selected.N}/{selected.T}, profil {profileName}, {provenance}. Alarm dihitung dengan rumus orde pertama tanpa jeda pemicu ulang. Area mint: ≤1 alarm/jam/ruang. Di peramban: 20.000 sesi untuk hasil terpilih dan 5.000 sesi per titik sebar, dengan benih tetap. Status tiap titik ada pada tabel.</figcaption>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-3">Lihat nilai 20 ambang</summary>
              <table className="w-full text-left text-xs">
                <caption className="pb-3 text-left">Tangkapan dan alarm palsu untuk asumsi yang sama. Status sumber dicantumkan per ambang.</caption>
                <thead><tr><th scope="col">Ambang</th><th scope="col">Tangkapan</th><th scope="col">Alarm/jam/ruang</th></tr></thead>
                <tbody>{points.map((point) => <tr key={`${point.N}_${point.T}`} className="border-t border-line">
                  <th scope="row" className="py-2">≥{point.N}/{point.T}<span className="block font-normal text-ink-3">{point.exact ? "sesuai proposal" : "tersimulasi di peramban"}</span></th><td>{percent(point.capture)}</td><td>{decimal(point.falseAlarm)}</td>
                </tr>)}</tbody>
              </table>
            </details>
          </figure>
        </Panel>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2" aria-live="polite" aria-atomic="true">
          {metrics.map((metric) => <Panel key={metric.label}>
            <div className="panel-body">
              <h2 className="m-0 text-sm font-medium text-ink-2">{metric.label}</h2>
              <p className="my-3 text-2xl font-semibold">{metric.display}</p>
              <ClaimTag claim={metric.claim} />
              <p className="page-note mt-3">{metric.note}</p>
            </div>
          </Panel>)}
        </div>
        <Panel>
          <PanelHead title="Seluruh sebaran pasien" />
          <div className="panel-body space-y-4">
            <p className="page-note">Rujukan tetap dari proposal untuk waktu tunggu 60 menit dan sensitivitas 90,4%. Angka populasi ini tidak dihitung ulang oleh kontrol profil pasien di atas.</p>
            <p>Ambang ≥2/15 menangkap <Em>{CLAIMS.capturePopulation.tampil}</Em> pada seluruh sebaran pasien. <ClaimTag claim={CLAIMS.capturePopulation} /></p>
            <p>Penurunan dosis relatif rata-rata <Em>{CLAIMS.dosePopulationLow.tampil} sampai {CLAIMS.dosePopulationHigh.tampil}</Em>, dengan kepatuhan ajakan Tingkat 1 dari 0% sampai 50%. <ClaimTag claim={CLAIMS.dosePopulationLow} /> <ClaimTag claim={CLAIMS.dosePopulationHigh} /> Ini bukan penurunan kasus penyakit.</p>
            <p>Mode bising ≥3/15: tangkapan populasi <Em>{CLAIMS.captureNoisy.tampil}</Em> <ClaimTag claim={CLAIMS.captureNoisy} /> dan <Em>{CLAIMS.falseAlarmNoisy.tampil}</Em> alarm palsu per jam per ruang dengan jeda pemicu ulang 15 menit. <ClaimTag claim={CLAIMS.falseAlarmNoisy} /></p>
            <p className="page-note">Untuk ≥2/15 dan 1,03 suara palsu per jam per zona, <Em>{CLAIMS.falseAlarmTier2.tampil}</Em> adalah estimasi orde pertama tanpa jeda pemicu ulang <ClaimTag claim={CLAIMS.falseAlarmTier2} />; <Em>{CLAIMS.falseAlarmWithPause.tampil}</Em> memakai jeda pemicu ulang 15 menit. <ClaimTag claim={CLAIMS.falseAlarmWithPause} /></p>
          </div>
        </Panel>
      </div>
    </div>
    <p className="page-note">{copy.modelLimit} Kepatuhan mengubah penurunan dosis, bukan deteksi batuk. Satu batuk dapat memicu ajakan Tingkat 1; angka 87% bukan tangkapan pager. Waktu respons dan efektivitas masker adalah asumsi tetap.</p>
  </>;
}
