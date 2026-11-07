import { useEffect, useRef, useState } from "react";
import { CLAIMS } from "../data/claims";
import { copy } from "../data/copy";
import { decodePacket, encodePacket, toHex } from "../sim/packet";
import type { PacketTrace } from "../sim/types";
import { useSim } from "../store/sim-store";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

const EXAMPLE = encodePacket({ kind: "EVENT", nodeId: "A", seq: 3, tMs: 1000, levelDb: -9.26 });
const FIELDS = [
  { name: "versi, jenis", start: 0, size: 1, encoding: "4 bit versi + 4 bit jenis" },
  { name: "node_id", start: 1, size: 1, encoding: "uint8 · A=0, B=1, C=2, D=3, PAGER=4" },
  { name: "seq", start: 2, size: 2, encoding: "uint16 · little-endian" },
  { name: "t_ms", start: 4, size: 4, encoding: "uint32 · little-endian · milidetik" },
  { name: "level_db", start: 8, size: 2, encoding: "int16 · little-endian · dB × 100" },
  { name: "conf", start: 10, size: 1, encoding: "uint8 · contoh tetap, bukan akurasi" },
  { name: "status", start: 11, size: 1, encoding: "uint8 · normal=0, terbatas=1, baterai=2, galat=3" },
  { name: "cadangan", start: 12, size: 4, encoding: "4 byte · selalu nol" },
] as const;

/** Only packet bytes are needed; this inspector is independent of the pipeline. */
function PacketInspector({ packet }: { packet?: PacketTrace }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  const bytes = packet?.bytes ?? EXAMPLE;
  const decoded = decodePacket(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = [
    `Versi ${decoded.version} · ${decoded.kind} (jenis ${bytes[0] & 15})`,
    `${decoded.nodeId} (kode ${bytes[1]})`, String(decoded.seq), `${decoded.tMs} ms`,
    `${decoded.levelDb.toLocaleString("id-ID", { minimumFractionDigits: 2 })} dB (mentah ${view.getInt16(8, true)})`,
    `${decoded.conf} / 255 · nilai contoh`, `${decoded.status} (kode ${bytes[11]})`, String(view.getUint32(12, true)),
  ];
  return <Panel>
    <PanelHead title="Inspektur paket 16 byte" aside={<span className="muted">{packet ? `${packet.kind} · ${packet.from} → ${packet.to}` : "Contoh · belum ada paket sesi"}</span>} />
    <div className="panel-body audio-inspector">
      <div>
        <p id="audio-byte-help" className="muted">Offset dimulai dari 0. Arahkan kursor, fokuskan, atau tekan byte dan medan untuk melihat pasangannya.</p>
        <div className="audio-hex" aria-label="Paket heksadesimal" aria-describedby="audio-byte-help" onMouseLeave={() => setHovered(null)}>
          {toHex(bytes).split(" ").map((byte, offset) => {
            const field = FIELDS.findIndex(({ start, size }) => offset >= start && offset < start + size);
            return <button key={offset} type="button" className="audio-byte" data-active={active === field}
              aria-label={`Byte ${offset}: ${byte}, medan ${FIELDS[field].name}`} aria-pressed={selected === field}
              aria-controls={`audio-field-${field}`} onMouseEnter={() => setHovered(field)}
              onFocus={() => { setHovered(null); setSelected(field); }} onClick={() => setSelected(field)}>
              <span>{offset.toString().padStart(2, "0")}</span><strong>{byte}</strong>
            </button>;
          })}
        </div>
        <p className="audio-selection" aria-live="polite">Medan disorot: <strong>{FIELDS[active].name}</strong> · byte {FIELDS[active].start}–{FIELDS[active].start + FIELDS[active].size - 1}</p>
        <p className="muted">A6 · Urutan byte dan kode jenis adalah asumsi simulator menurut TRD §7. Tidak ada medan audio atau identitas.</p>
      </div>
      <div className="audio-fields" onMouseLeave={() => setHovered(null)}>
        <table>
          <caption>Medan terurai dari byte paket yang ditampilkan</caption>
          <thead><tr><th scope="col">Byte / medan</th><th scope="col">Nilai / pengodean</th></tr></thead>
          <tbody>{FIELDS.map((field, index) => <tr key={field.name} data-active={active === index} onMouseEnter={() => setHovered(index)}>
            <th scope="row"><button type="button" id={`audio-field-${index}`} aria-pressed={selected === index}
              onFocus={() => { setHovered(null); setSelected(index); }} onClick={() => setSelected(index)}>
              <span>{field.start}{field.size > 1 ? `–${field.start + field.size - 1}` : ""}</span> {field.name}
            </button></th>
            <td><strong>{values[index]}</strong><small>{field.encoding}</small></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </Panel>;
}

const STAGES = ["Mikrofon", "Buffer 1 detik", "Log-mel", "CNN", "Keputusan", "Batas audio", "Paket metadata"];
interface Trial { merged: boolean; input: "speech" | "cough"; events: number; generation: number; phase: number }

function SyntheticBuffer({ trial }: { trial: Trial | null }) {
  const shift = (trial?.generation ?? 0) * 0.5;
  // Deterministic display samples only, never captured sound or model input.
  const samples = Array.from({ length: 80 }, (_, index) => {
    const t = index / 80 + shift;
    const envelope = trial?.input === "cough" ? Math.exp(-(((index - 30) / 10) ** 2)) : 0.35;
    return Math.sin(t * 96) * Math.cos(t * 31) * envelope;
  });
  return <div className="audio-buffer">
    <svg viewBox="0 0 400 90" role="img" aria-label="Ilustrasi buffer dengan gelombang sintetis, bukan rekaman audio">
      <path d="M0 45H400" stroke="var(--line-2)" />
      <polyline points={samples.map((value, index) => `${index * 400 / 79},${45 - value * 38}`).join(" ")}
        fill="none" stroke="var(--accent-ink)" strokeWidth="2" />
    </svg>
    <p>Jendela {shift.toLocaleString("id-ID")}–{(shift + 1).toLocaleString("id-ID")} detik · geser 0,5 detik per percobaan</p>
    <p className="muted">Buffer rancangan: 32.000 byte di memori. Sampel pada gambar ini sintetis; jendela lama ditimpa.</p>
  </div>;
}

export default function BatasAudio() {
  const { state, dispatch, paused, setPaused } = useSim();
  const [packetId, setPacketId] = useState<number | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);
  const pendingTrial = useRef<{ counters: typeof state.counters; lastPacketId: number } | null>(null);
  const lastPacket = state.packets.at(-1);
  const packet = state.packets.find((item) => item.id === packetId) ?? lastPacket;
  const running = trial !== null && trial.phase < STAGES.length - 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setTrial((previous) => previous ? { ...previous, phase: previous.phase + 1 } : previous), 260);
    return () => window.clearTimeout(timer);
  }, [running, trial?.phase]);

  useEffect(() => {
    if (state.packets.length === 0 && state.counters.speechIgnored === 0) {
      pendingTrial.current = null;
      setTrial(null);
      setPacketId(null);
    }
  }, [state.packets.length, state.counters.speechIgnored]);

  useEffect(() => {
    const baseline = pendingTrial.current;
    if (!baseline) return;
    const events = state.counters.eventPackets - baseline.counters.eventPackets;
    const merged = state.counters.mergedCoughs > baseline.counters.mergedCoughs;
    if (events === 0 && !merged && state.counters.speechIgnored === baseline.counters.speechIgnored) return;
    pendingTrial.current = null;
    setTrial((previous) => previous ? { ...previous, events, merged } : previous);
    const event = state.packets.find((item) => item.kind === "EVENT" && item.id > baseline.lastPacketId);
    if (event) setPacketId(event.id);
  }, [state.counters.eventPackets, state.counters.mergedCoughs, state.counters.speechIgnored, state.packets]);

  function demonstrate(input: Trial["input"]) {
    const action = input === "speech" ? { type: "speech", zone: "A" } as const : { type: "cough", x: 0, y: 0 } as const;
    dispatch(action);
    pendingTrial.current = { counters: state.counters, lastPacketId: lastPacket?.id ?? 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTrial((previous) => ({ input, events: 0, merged: false,
      generation: (previous?.generation ?? 0) + 1, phase: reducedMotion ? STAGES.length - 1 : 0 }));
  }

  return <>
    <PageHead title="Apa yang keluar dari alat?" answer={<>Audio hidup di memori selama satu detik, lalu ditimpa. Yang keluar hanya paket <Em>{CLAIMS.packetSize.tampil}</Em> <ClaimTag claim={CLAIMS.packetSize} />. Rancangan ini menunggu audit.</>} />
    <Panel>
      <PanelHead title="Dari suara ke metadata" aside={<span className="claim-tag claim-ilustratif">Ilustratif</span>} />
      <div className="panel-body">
        <p className="page-note">{copy.audioNote}</p>
        <ol className="audio-pipeline" aria-label="Urutan pemrosesan ilustratif">
          {STAGES.map((stage, index) => <li key={stage} data-current={trial?.phase === index} data-boundary={index === 5}
            aria-current={trial?.phase === index ? "step" : undefined}>
            <span>{index + 1}</span><strong>{stage}</strong>
            <small>{index === 4 ? trial ? trial.input === "speech" ? "Bukan batuk" : "Batuk" : "Menunggu percobaan"
              : index === 5 ? "Audio ditimpa" : index === 6 ? trial ? `${trial.events} paket EVENT` : "Hanya metadata"
              : index === 0 ? "Tanpa input mikrofon" : index === 1 ? "Geser 0,5 detik" : "Ilustrasi, tanpa model"}</small>
          </li>)}
        </ol>
        <SyntheticBuffer trial={trial} />
        <div className="audio-actions">
          <button type="button" className="button button-quiet" disabled={running} onClick={() => demonstrate("speech")}>Percakapan</button>
          <button type="button" className="button" disabled={running || state.zones.A.nodeStatus !== "normal"} onClick={() => demonstrate("cough")}>Batuk</button>
          <span className="muted">Percobaan di sudut zona A · memakai sesi simulasi yang sama</span>
        </div>
        {state.zones.A.nodeStatus !== "normal" && <p className="page-note">Simpul A berstatus Terbatas. Pulihkan simpul melalui Ruang tunggu atau reset sesi untuk mencoba batuk.</p>}
        {paused && <p className="page-note">Jam simulasi sedang dijeda, sehingga batuk berulang di zona yang sama digabung. <button type="button" className="button button-quiet" onClick={() => setPaused(false)}>Lanjutkan jam</button></p>}
        <p className="audio-result" role="status">{trial
          ? trial.merged ? "Disatukan dengan batuk sebelumnya, tidak ada paket baru." : `${trial.input === "speech" ? "Percakapan: bukan batuk" : "Batuk"}. Tambahan ${trial.events} paket EVENT. ${running ? `Ilustrasi: ${STAGES[trial.phase]}.` : "Buffer lama ditimpa; hanya metadata yang keluar."}`
          : "Pilih Percakapan atau Batuk untuk membandingkan paket yang dihasilkan."}</p>
        <dl className="audio-counts">
          <div><dt>EVENT selama sesi</dt><dd>{state.counters.eventPackets}</dd></div>
          <div><dt>Percakapan diabaikan</dt><dd>{state.counters.speechIgnored}</dd></div>
          <div><dt>Audio keluar · dirancang</dt><dd>{state.counters.audioBytesOut} byte <ClaimTag claim={CLAIMS.audioOut} /></dd></div>
        </dl>
        <p className="page-note">Percakapan menambah 0 paket EVENT. Batuk pada titik ini mengirim satu EVENT dari simpul A, diikuti ACK, kecuali digabung dengan batuk sebelumnya dalam 300 ms waktu simulasi; sinyal Tingkat 2 juga dapat mengirim ALERT. Lalu lintas SYNC dan HEARTBEAT tetap berjalan. conf bernilai contoh 230, bukan hasil CNN.</p>
      </div>
    </Panel>
    <div className="audio-actions">
      <label htmlFor="audio-packet">Paket yang diperiksa</label>
      <select id="audio-packet" value={packetId !== null && state.packets.some((item) => item.id === packetId) ? packetId : "latest"}
        onChange={(event) => setPacketId(event.target.value === "latest" ? null : Number(event.target.value))}>
        <option value="latest">{lastPacket ? "Paket terakhir dari sesi" : "Contoh · sesi belum mengirim paket"}</option>
        {[...state.packets].reverse().map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.kind} · {item.from} → {item.to} · {Math.floor(item.tMs)} ms</option>)}
      </select>
    </div>
    <PacketInspector packet={packet} />
    <p className="page-note">{copy.audioNote}</p>
    <style>{`
      .audio-inspector { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 28px; }
      .audio-inspector p, .audio-pipeline small { font-size: 12px; }
      .audio-hex { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .audio-byte { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 60px; padding: 8px 4px; border-radius: 7px; background: var(--panel-2); color: var(--ink); font-family: var(--font-mono); }
      .audio-byte span { color: var(--ink-3); font-size: 11px; }
      .audio-byte strong { font-size: 17px; }
      .audio-byte[data-active="true"], .audio-fields tr[data-active="true"] { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent-ink); }
      .audio-selection { margin-top: 16px; }
      .audio-fields { min-width: 0; }
      .audio-fields table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
      .audio-fields caption { text-align: left; color: var(--ink-3); margin-bottom: 10px; }
      .audio-fields th, .audio-fields td { text-align: left; padding: 8px; vertical-align: top; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
      .audio-fields th:first-child { width: 38%; }
      .audio-fields th button { text-align: left; min-height: 44px; width: 100%; padding: 4px; border-radius: 7px; background: transparent; font-family: var(--font-mono); }
      .audio-fields th button span { display: block; font-weight: 400; color: var(--ink-3); }
      .audio-fields td strong { font-weight: 600; }
      .audio-fields small { display: block; margin-top: 4px; color: var(--ink-3); }
      .audio-pipeline { list-style: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; padding: 0; margin: 24px 0; }
      .audio-pipeline li { border-top: 2px solid var(--line-2); padding: 12px 6px; min-width: 0; }
      .audio-pipeline li[data-current="true"] { background: var(--accent-soft); border-top-color: var(--accent-ink); }
      .audio-pipeline li[data-boundary="true"] { border-top-style: dashed; border-top-color: var(--ink); }
      .audio-pipeline li > span { display: block; color: var(--ink-3); font-family: var(--font-mono); font-size: 12px; }
      .audio-pipeline strong, .audio-pipeline small { display: block; overflow-wrap: anywhere; }
      .audio-pipeline strong { margin: 6px 0; font-size: 13px; }
      .audio-pipeline small { color: var(--ink-3); }
      .audio-buffer { max-width: 650px; margin-bottom: 20px; }
      .audio-buffer svg { display: block; width: 100%; height: 90px; background: var(--panel-2); border-radius: 12px; }
      .audio-buffer p { font-size: 12px; margin: 8px 0 0; }
      .audio-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .audio-actions > .muted { font-size: 12px; }
      .audio-actions select { min-height: 44px; max-width: 100%; min-width: 0; padding: 8px; border: 1px solid var(--line-2); border-radius: 7px; background: var(--panel); }
      .audio-result { margin: 16px 0; min-height: 44px; }
      .audio-counts { display: flex; flex-wrap: wrap; gap: 16px 32px; margin: 0 0 20px; }
      .audio-counts dt { font-size: 12px; color: var(--ink-3); }
      .audio-counts dd { margin: 4px 0 0; font-weight: 600; }
      @media (max-width: 1100px) { .audio-inspector { grid-template-columns: minmax(0, 1fr); } .audio-pipeline { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      @media (max-width: 639px) { .audio-pipeline { grid-template-columns: repeat(2, minmax(0, 1fr)); } .audio-fields th, .audio-fields td { padding: 6px; } }
    `}</style>
  </>;
}
