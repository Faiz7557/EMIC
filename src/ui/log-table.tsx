import { copy } from "../data/copy";
import type { LogEntry, LogKind } from "../sim/types";
import { Panel, PanelHead } from "./ui";

export function formatSimTime(tMs: number, startClockMin = 540) {
  const seconds = Math.floor(tMs / 1000) + startClockMin * 60;
  return [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)} menit ${seconds % 60} detik`;
}

const LABELS: Record<LogKind, string> = {
  BATUK: "Batuk", TINGKAT1: "Tingkat 1 · Ajakan", TINGKAT2: "Tingkat 2 · Tindakan",
  ESKALASI: "Eskalasi", DITANGANI: "Ditangani", NORMAL: "Normal", STATUS_SIMPUL: "Status simpul",
};

export function LogTable({ log, startClockMin = 540 }: { log: readonly LogEntry[]; startClockMin?: number }) {
  return <Panel tour="log">
    <PanelHead title="Log metadata" aside={<span className="muted">{log.length} baris</span>} />
    <div className="panel-body">
      <p className="page-note">Hanya metadata zona dan waktu. Level relatif terhadap sumber pada jarak 1 m.</p>
      {!log.length ? <p style={{ marginTop: 16 }}>{copy.emptyLog}</p> :
        <div tabIndex={0} role="region" aria-label="Tabel log metadata, dapat digulir" style={{ overflow: "auto", maxHeight: 360, marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <caption className="sr-only">Kejadian sesi, terbaru lebih dahulu</caption>
            <thead><tr>{["ID", "Waktu", "Zona", "Kejadian", "Hitungan", "Level (dB)", "Status simpul", "Respons"].map((label) => <th key={label} scope="col" style={{ padding: "10px 12px", whiteSpace: "nowrap", background: "var(--panel-2)" }}>{label}</th>)}</tr></thead>
            <tbody>{[...log].reverse().map((entry) => <tr key={entry.id}>
              {[entry.id, formatSimTime(entry.tMs, startClockMin), entry.zone, LABELS[entry.kind], entry.count,
                entry.levelDb === null ? "—" : entry.levelDb.toFixed(2).replace(".", ","),
                { normal: "Normal", terbatas: "Terbatas", luring: "Luring" }[entry.status],
                entry.responseMs === null ? "—" : formatDuration(entry.responseMs)].map((value, index) =>
                <td key={index} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
    </div>
  </Panel>;
}
