import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLAIMS } from "../data/claims";
import { copy } from "../data/copy";
import { morningScenario } from "../sim/scenario";
import { ZONES, type NodeStatus } from "../sim/types";
import { useSim } from "../store/sim-store";
import { Board } from "../ui/board";
import { ClaimTag } from "../ui/claim-tag";
import { Denah2D, useMediaQuery, ZoneLabels } from "../ui/denah-2d";
import { formatDuration, formatSimTime, LogTable } from "../ui/log-table";
import { Pager } from "../ui/pager";
import { Chip, Em, PageHead, Panel, PanelHead } from "../ui/ui";

const Scene3D = lazy(() => import("../three/Scene3D"));
const noHover = () => {};
type Role = "petugas" | "pengunjung" | "pengelola";

export default function Ruang() {
  const { state, dispatch, speed, setSpeed, paused, setPaused, reset } = useSim();
  const narrow = useMediaQuery("(max-width: 767px)");
  const [role, setRole] = useState<Role>("petugas");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const scenarioRunning = useRef(running);
  scenarioRunning.current = running;
  const mergedCoughs = useRef(state.counters.mergedCoughs);
  const [scenarioMessage, setScenarioMessage] = useState("");
  const [notice, setNotice] = useState("");
  const floorClick = useCallback((x: number, y: number) => { if (!running) { setNotice(""); dispatch({ type: "cough", x, y }); } }, [dispatch, running]);
  const activeZones = ZONES.filter((zone) => ([...state.log].reverse().find((entry) => entry.zone === zone && entry.kind === "STATUS_SIMPUL")?.status ?? state.zones[zone].nodeStatus) === "normal");
  const viewProps = { zones: state.zones, effects: state.effects, packets: state.packets,
    attribution: { activeZones, ambiguousDb: state.cfg.ambiguousDb, maxRangeM: state.cfg.maxRangeM },
    onFloorClick: floorClick, onFloorHover: noHover };
  const stopScenario = () => {
    setRunning(false); setPaused(false); setSpeed(1);
    setScenarioMessage("Skenario dihentikan. Status terakhir tetap ada.");
  };
  const resetRoom = () => {
    setRunning(false); setScenarioMessage(""); setNotice(""); reset();
  };
  const playScenario = () => {
    reset(); setPaused(true); setSpeed(60); setRunning(true); setNotice("");
    setScenarioMessage("Skenario pagi berjalan pada 60×. Kontrol manual dikunci.");
  };

  useEffect(() => {
    if (!running) return;
    // Split clock advances at exact scenario event times; only the engine
    // decides status. The provider clock is paused during playback.
    if (!paused) { setRunning(false); setSpeed(1); setScenarioMessage(""); return; }
    const entries = morningScenario(busy);
    const end = entries[entries.length - 1].tMs + state.cfg.pauseMin * 60000;
    let cursor = 0;
    let next = 0;
    let previous: number | null = null;
    let frame = 0;
    const animate = (timestamp: number) => {
      if (document.hidden) { previous = null; frame = requestAnimationFrame(animate); return; }
      const target = Math.min(end, cursor + (previous === null ? 0 : (timestamp - previous) * 60));
      previous = timestamp;
      while (next < entries.length && entries[next].tMs <= target) {
        const entry = entries[next++];
        if (entry.tMs > cursor) dispatch({ type: "tick", dtMs: entry.tMs - cursor });
        cursor = entry.tMs;
        dispatch(entry.action);
      }
      if (target > cursor) dispatch({ type: "tick", dtMs: target - cursor });
      cursor = target;
      if (cursor >= end) {
        setRunning(false); setPaused(false); setSpeed(1);
        setScenarioMessage("Skenario selesai. Jeda 15 menit berakhir dan Zona C kembali Normal.");
      } else frame = requestAnimationFrame(animate);
    };
    const visibility = () => { previous = null; };
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibility); };
  }, [running, paused, busy, state.cfg.pauseMin, dispatch, setPaused, setSpeed]);
  useEffect(() => () => {
    if (scenarioRunning.current) { setSpeed(1); setPaused(false); }
  }, [setPaused, setSpeed]);

  useEffect(() => {
    if (state.counters.mergedCoughs > mergedCoughs.current) setNotice("Disatukan dengan batuk sebelumnya");
    mergedCoughs.current = state.counters.mergedCoughs;
  }, [state.counters.mergedCoughs]);

  useEffect(() => { if (!running && !state.log.length) setScenarioMessage(""); }, [running, state.log.length]);

  const last = state.log[state.log.length - 1];
  useEffect(() => {
    const effect = state.effects[state.effects.length - 1];
    if (last?.kind === "STATUS_SIMPUL" && effect?.kind === "ripple" && effect.tMs === last.tMs && effect.zones?.length === 0) {
      setNotice(`Batuk ini tidak terdengar: Simpul ${last.zone} ${last.status === "luring" ? "luring" : last.status === "terbatas" ? "terbatas" : "di luar jangkauan"}.`);
    }
    if (!state.log.length) setNotice("");
  }, [last, state.effects, state.log.length]);

  const responses = useMemo(() => {
    const byTime = new Map<string, number>();
    for (const entry of state.log) if (entry.kind === "DITANGANI" && entry.responseMs !== null) byTime.set(`${entry.tMs}:${entry.responseMs}`, entry.responseMs);
    return [...byTime.values()].sort((a, b) => a - b);
  }, [state.log]);
  const median = responses.length ? (responses[Math.floor((responses.length - 1) / 2)] + responses[Math.floor(responses.length / 2)]) / 2 : null;
  const latestResponse = [...state.log].reverse().find((entry) => entry.kind === "DITANGANI");
  const coughs = state.counters.coughEvents;
  const alerts = state.counters.alertEvents;
  const liveStatus = ZONES.map((id) => {
    const zone = state.zones[id];
    const tier = zone.tier === "menunggu" ? `Tingkat 2, ${zone.rebuzzCount ? "eskalasi" : "menunggu tindakan"}` : zone.tier === "tingkat1" ? "Tingkat 1, ajakan" : zone.tier === "ditangani" ? "Ditangani" : "Normal";
    return `Zona ${id}, ${tier}${zone.nodeStatus !== "normal" ? `, simpul ${zone.nodeStatus}` : ""}`;
  }).join(". ") + (state.pagerBuzzing ? ". Pager bergetar." : ".");

  return <>
    <PageHead title="Apa yang terjadi saat seseorang batuk?" answer={<>Ambang lama menangkap <Em>{CLAIMS.captureOld.tampil}</Em> <ClaimTag claim={CLAIMS.captureOld} /> pasien median. Dua tingkat memberi sinyal pada <Em>{CLAIMS.anySignal.tampil}</Em> <ClaimTag claim={CLAIMS.anySignal} /> dan memanggil petugas pada <Em>{CLAIMS.captureTier2.tampil}</Em> <ClaimTag claim={CLAIMS.captureTier2} />, dengan <Em>{CLAIMS.falseAlarmWithPause.tampil}</Em> <ClaimTag claim={CLAIMS.falseAlarmWithPause} /> alarm palsu per jam per ruang dengan jeda pemicu ulang 15 menit. Hasil simulasi, belum diukur.</>} actions={<button type="button" className="button button-quiet" onClick={resetRoom}>Reset ruang</button>} />
    <div aria-live="polite" aria-atomic="true" className="sr-only">{liveStatus} Percakapan diabaikan: {state.counters.speechIgnored}. {notice} {scenarioMessage}</div>
    <div className="room-time-controls" data-scenario-running={running} role="group" aria-label="Kontrol waktu dan skenario">
        <button type="button" className="button" onClick={running ? stopScenario : playScenario}>{running ? "Hentikan skenario" : "Putar skenario pagi"}</button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44 }}><input type="checkbox" checked={busy} disabled={running} onChange={(event) => setBusy(event.target.checked)} />Petugas sibuk</label>
        <time style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600 }}>{formatSimTime(state.nowMs, state.cfg.startClockMin)}</time>
        <fieldset disabled={running}>
          <legend className="sr-only">Waktu simulasi</legend>
          <button type="button" className="button button-quiet" aria-pressed={paused && !running} onClick={() => setPaused(!paused)}>{paused && !running ? "Lanjutkan jam" : "Jeda jam"}</button>
          {[1, 60].map((value) => <button key={value} type="button" className={`button${speed === value ? "" : " button-quiet"}`} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
          {[1, 5, 15].map((minutes) => <button key={minutes} type="button" className="button button-quiet" onClick={() => dispatch({ type: "tick", dtMs: minutes * 60000 })}>+{minutes} menit</button>)}
        </fieldset>
    </div>
    <div className="room-layout" style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 2fr) minmax(260px, 1fr)", gap: 24, alignItems: "start" }}>
      <Panel className="room-panel">
        <PanelHead title="Ruang tunggu" aside={<span className="muted">Klik lantai = batuk</span>} />
        <div className="panel-body" style={{ padding: 12 }}>
          <Suspense fallback={<Denah2D {...viewProps} />}><Scene3D {...viewProps} /></Suspense>
          <fieldset disabled={running} style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
            <legend className="sr-only">Peragakan suara</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ZONES.map((zone) => <button key={zone} type="button" className="button button-quiet" data-tour={zone === "C" ? "cough-c" : undefined} onClick={() => { setNotice(""); dispatch({ type: "coughZone", zone }); }}>Batuk di Zona {zone}</button>)}
              <button type="button" className="button button-quiet" data-tour="speech-c" onClick={() => dispatch({ type: "speech", zone: "C" })}>Percakapan di Zona C</button>
            </div>
          </fieldset>
          <p className="page-note" style={{ marginTop: 12 }}>Percakapan diabaikan: {state.counters.speechIgnored}. Tidak ada paket kejadian dari percakapan.</p>
          {notice && <p style={{ marginTop: 12 }}>{notice}</p>}
          <details style={{ marginTop: 16 }} onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.open = false; }}>
            <summary style={{ minHeight: 44, paddingBlock: 10 }}>Atur simpul</summary>
            <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">Status simpul</legend>
              {ZONES.map((zone) => {
                const requested = [...state.log].reverse().find((entry) => entry.zone === zone && entry.kind === "STATUS_SIMPUL")?.status ?? state.zones[zone].nodeStatus;
                return <label key={zone} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  Simpul {zone}<select value={requested} aria-describedby={zone === "A" ? "coordinator-note" : undefined} onChange={(event) => dispatch({ type: "setNode", zone, status: event.target.value as NodeStatus })} style={{ minHeight: 44, padding: 8, background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 7 }}>
                    <option value="normal">Normal</option><option value="terbatas">Bising · Terbatas</option><option value="luring" disabled={zone === "A"}>Luring</option>
                  </select>
                </label>;
              })}
            </fieldset>
            <p id="coordinator-note" className="page-note">Simpul A adalah koordinator dan tidak dapat dibuat luring (asumsi A4). Luring ditampilkan setelah 30 detik tanpa heartbeat.</p>
          </details>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Panel peran" />
        <div className="panel-body">
          <label style={{ display: "block", marginBottom: 20 }}>Peran
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} style={{ display: "block", width: "100%", minHeight: 44, marginTop: 8, borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--panel-2)", padding: 8 }}>
              <option value="pengunjung">Pengunjung</option><option value="petugas">Petugas</option><option value="pengelola">Pengelola</option>
            </select>
          </label>
          {role === "pengunjung" ? <Board zones={state.zones} /> : role === "petugas" ? <Pager state={state} onDone={() => dispatch({ type: "pagerPress" })} disabled={running} /> : <section aria-label="Ringkasan pengelola">
            <h3 style={{ fontSize: 15, marginTop: 0 }}>Status empat zona</h3><ZoneLabels zones={state.zones} />
            {ZONES.map((zone) => <p key={zone}>Zona {zone} <Chip status={state.zones[zone].tier} /> · {state.zones[zone].totalCoughs} batuk</p>)}
            <p>Respons terakhir: {latestResponse?.responseMs != null ? formatDuration(latestResponse.responseMs) : "Belum ada respons."}</p>
            <a href="#/dasbor">Buka Dasbor pengelola</a>
          </section>}
        </div>
      </Panel>
    </div>
    <p className="page-note">{scenarioMessage || "Peragaan: percakapan 09.05, batuk 09.15 dan 09.22, ditangani 09.24.40. Cabang sibuk: eskalasi 09.25, ditangani 09.26."}</p>
    <LogTable log={state.log} startClockMin={state.cfg.startClockMin} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 16 }}>
      {[
        { title: "Jumlah kejadian batuk", value: coughs, note: "Satu kejadian ambigu dihitung sekali." },
        { title: "Kejadian Tingkat 2", value: alerts, note: "Peringatan pada sesi ini." },
        { title: "Median respons sesi", value: median === null ? "Belum ada" : formatDuration(median), note: "Dari kelompok yang telah ditangani." },
      ].map((metric) => <Panel key={metric.title}><PanelHead title={metric.title} /><div className="panel-body"><p style={{ fontSize: 28, fontWeight: 600 }}>{metric.value}</p><ClaimTag claim={{ id: metric.title, nilai: typeof metric.value === "number" ? metric.value : median ?? 0, tampil: String(metric.value), status: "tersimulasi", sumber: "Sesi ini · metadata engine di peramban, bukan hasil uji alat" }} /><p className="page-note" style={{ marginTop: 12 }}>{metric.note}</p></div></Panel>)}
      <Panel><PanelHead title="Audio keluar" /><div className="panel-body"><p style={{ fontSize: 28, fontWeight: 600 }}>{state.counters.audioBytesOut} byte</p><ClaimTag claim={CLAIMS.audioOut} /><p className="page-note" style={{ marginTop: 12 }}>Dirancang; menunggu audit.</p></div></Panel>
    </div>
    <p className="page-note">{copy.privacy} {copy.audioNote}</p>
  </>;
}
