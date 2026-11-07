import { useMemo, useState } from "react";
import exampleFigure from "../../reference/figures/f15_antarmuka.png";
import { copy } from "../data/copy";
import { ZONES, type LogKind } from "../sim/types";
import { useSim } from "../store/sim-store";
import { ClaimTag } from "../ui/claim-tag";
import { Chip, PageHead, Panel, PanelHead } from "../ui/ui";

const logLabels: Record<LogKind, string> = {
  BATUK: "Batuk", TINGKAT1: "Tingkat 1 · Ajakan", TINGKAT2: "Tingkat 2 · Tindakan",
  ESKALASI: "Eskalasi", DITANGANI: "Ditangani", NORMAL: "Kembali normal", STATUS_SIMPUL: "Status simpul",
};

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`;
}

function clock(elapsedMs: number, startMin: number, seconds = false) {
  const total = Math.floor((elapsedMs + startMin * 60000) / 1000);
  const day = Math.floor(total / 86400);
  return `${day ? `Hari ${day + 1} · ` : ""}${String(Math.floor(total / 3600) % 24).padStart(2, "0")}.${String(Math.floor(total / 60) % 60).padStart(2, "0")}${seconds ? `.${String(total % 60).padStart(2, "0")}` : ""}`;
}

export default function Dasbor() {
  const { state } = useSim();
  const [source, setSource] = useState<"session" | "example">("session");
  const summary = useMemo(() => {
    const counts = Object.fromEntries(ZONES.map((zone) => [zone, 0])) as Record<(typeof ZONES)[number], number>;
    const hours = new Map<number, typeof counts>();
    const responses: number[] = [];
    let alerts = 0;
    let handled = 0;
    for (const entry of state.log) {
      if (entry.kind === "BATUK") {
        counts[entry.zone]++;
        const hour = Math.floor((entry.tMs + state.cfg.startClockMin * 60000) / 3600000);
        const bucket = hours.get(hour) ?? { A: 0, B: 0, C: 0, D: 0 };
        bucket[entry.zone]++;
        hours.set(hour, bucket);
      }
      if (entry.kind === "TINGKAT2") alerts++;
      if (entry.kind === "DITANGANI") {
        handled++;
        if (entry.responseMs !== null) responses.push(entry.responseMs);
      }
    }
    responses.sort((a, b) => a - b);
    const middle = Math.floor(responses.length / 2);
    const median = responses.length === 0 ? null : responses.length % 2 ? responses[middle] : (responses[middle - 1] + responses[middle]) / 2;
    return { counts, hours: [...hours].sort(([a], [b]) => a - b), alerts, handled, median };
  }, [state.log, state.cfg.startClockMin]);
  const illustrative = source === "example";
  const sessionClaim = { id: "dasbor-session", tampil: "Hitungan dan waktu dari log sesi simulator", status: "tersimulasi" as const, sumber: "Log sesi engine · metadata per zona, bukan pengukuran alat fisik", nilai: state.log.length };
  const exampleClaim = { id: "dasbor-example", tampil: "Median respons 2 mnt 40 dtk; 7 dari 8 kejadian ditangani", status: "ilustratif" as const, sumber: "reference/figures/f15_antarmuka.png · Gambar antarmuka proposal", nilai: 160 };

  return <>
    <PageHead title="Apa yang dilihat pengelola?" answer="Empat zona diringkas melalui status, beban batuk, dan waktu respons petugas." />
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="mb-2 font-medium">Sumber data</legend>
      {([["session", "Sesi ini"], ["example", "Contoh sehari"]] as const).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[7px] border border-line-2 bg-panel px-4">
        <input type="radio" name="dashboard-source" value={value} checked={source === value} onChange={() => setSource(value)} />{label}
      </label>)}
    </fieldset>
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-[20px] bg-ink p-5 text-white">
        <strong>SUAR · Dasbor ruang tunggu</strong>
        <span className="text-sm">192.168.4.1 · tanpa internet (tiruan)</span>
      </div>
      <PanelHead title={illustrative ? "Contoh sehari" : "Sesi ini"} aside={<ClaimTag claim={illustrative ? exampleClaim : sessionClaim} />} />
      {!illustrative && state.log.length === 0 ? <div className="panel-body stub-body">
        <p>{copy.emptyDashboard}</p><a href="#/">Buka Ruang tunggu</a>
      </div> : illustrative ? <div className="panel-body">
        <p>Ilustratif — contoh antarmuka dari proposal, bukan data sesi atau hasil uji perangkat.</p>
        <figure className="m-0">
          <img src={exampleFigure} className="h-auto w-full" alt="Contoh proposal: Zona A dan B Normal, Zona C Tindakan, Zona D Terbatas. Grafik beban batuk pukul 7 sampai 16 memuncak pukul 11. Median respons 2 menit 40 detik; 7 dari 8 kejadian ditangani. Di sampingnya terdapat papan informasi pengunjung." />
          <figcaption className="mt-3 text-sm text-ink-3">Gambar antarmuka proposal (salinan lokal f15_antarmuka.png). Angka ilustratif: median respons 2 mnt 40 dtk, kejadian ditangani 7 dari 8. Grafik asli tidak mencantumkan nilai numerik tiap batang.</figcaption>
        </figure>
      </div> : <div className="panel-body space-y-6">
        <p className="muted">Jam simulasi: {clock(state.nowMs, state.cfg.startClockMin, true)}. Ringkasan dihitung dari log sejak reset.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ZONES.map((zone) => <div key={zone} className="rounded-[12px] bg-panel-2 p-4">
            <h3 className="mb-3 mt-0 text-sm font-semibold">Zona {zone}</h3>
            <div className="flex flex-wrap gap-2"><Chip status={state.zones[zone].tier} />{state.zones[zone].nodeStatus !== "normal" && <Chip status={state.zones[zone].nodeStatus} />}</div>
            <p className="mb-0 mt-3">{summary.counts[zone]} catatan batuk</p>
          </div>)}
        </div>
        <dl className="m-0 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-ink-3">Median waktu respons per zona</dt><dd className="m-0 mt-1 text-2xl font-semibold">{summary.median === null ? "Belum ada respons" : duration(summary.median)}</dd></div>
          <div><dt className="text-ink-3">Kejadian ditangani per zona</dt><dd className="m-0 mt-1 text-2xl font-semibold">{summary.handled} dari {summary.alerts} peringatan Tingkat 2</dd></div>
        </dl>
        <p className="page-note">Hitungan memakai catatan per zona. Satu batuk ambigu dapat tercatat pada dua zona; respons keduanya ikut dihitung. Waktu respons memakai jam simulasi.</p>
        <div>
          <h3 className="mt-0 text-sm font-semibold">Beban batuk per jam dan zona</h3>
          {summary.hours.length === 0 ? <p className="muted">Belum ada batuk tercatat.</p> : <div className="overflow-x-auto" role="region" aria-label="Beban batuk per jam" tabIndex={0}>
            <table className="w-full min-w-[360px] text-left">
              <caption className="sr-only">Jumlah catatan batuk per jam, hanya jam dengan batuk tercatat</caption>
              <thead><tr><th scope="col" className="p-2">Jam</th>{ZONES.map((zone) => <th scope="col" key={zone} className="p-2">Zona {zone}</th>)}<th scope="col" className="p-2">Total</th></tr></thead>
              <tbody>{summary.hours.map(([hour, counts]) => <tr key={hour} className="border-t border-line">
                <th scope="row" className="p-2 font-medium">{clock(hour * 3600000 - state.cfg.startClockMin * 60000, state.cfg.startClockMin)}</th>
                {ZONES.map((zone) => <td key={zone} className="p-2">{counts[zone]}</td>)}<td className="p-2">{ZONES.reduce((sum, zone) => sum + counts[zone], 0)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </div>
      </div>}
    </Panel>
    {!illustrative && state.log.length > 0 && <Panel>
      <PanelHead title="Log sesi · metadata per zona" />
      <div className="panel-body">
        <div className="max-h-[440px] overflow-auto" role="region" aria-label="Log sesi" tabIndex={0}>
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Seluruh catatan sesi dari yang pertama sampai terakhir, tanpa audio atau identitas</caption>
            <thead><tr>{["Waktu", "Zona", "Kejadian", "Hitungan jendela", "Level relatif", "Simpul", "Respons"].map((title) => <th scope="col" key={title} className="p-2 align-top">{title}</th>)}</tr></thead>
            <tbody>{state.log.map((entry) => <tr key={entry.id} className="border-t border-line">
              <td className="whitespace-nowrap p-2 font-mono">{clock(entry.tMs, state.cfg.startClockMin, true)}</td><td className="p-2">{entry.zone}</td><td className="p-2">{logLabels[entry.kind]}</td><td className="p-2">{entry.count}</td>
              <td className="p-2">{entry.levelDb === null ? "—" : `${entry.levelDb.toFixed(1).replace(".", ",")} dB`}</td><td className="p-2"><Chip status={entry.status} /></td><td className="whitespace-nowrap p-2">{entry.responseMs === null ? "—" : duration(entry.responseMs)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </Panel>}
    <p className="page-note">{copy.privacy}</p>
  </>;
}
