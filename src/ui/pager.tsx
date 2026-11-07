import { motion, useReducedMotion } from "motion/react";
import { BellRing, Circle } from "lucide-react";
import { copy } from "../data/copy";
import { ZONES, type SimState } from "../sim/types";
import { zoneAppearance } from "./denah-2d";
import { formatDuration } from "./log-table";

export function Pager({ state, onDone, disabled = false }: { state: SimState; onDone: () => void; disabled?: boolean }) {
  const reduced = useReducedMotion();
  const buzz = [...state.effects].reverse().find((effect) => effect.kind === "buzz");
  const waiting = state.pendingGroups.length > 0;
  const lastResponse = [...state.log].reverse().find((entry) => entry.kind === "DITANGANI");
  return <>
    <motion.section key={buzz ? `${buzz.id}:${buzz.tMs}` : "idle"} aria-label="Pager petugas"
      initial={false} animate={{ x: !reduced && waiting ? [0, -3, 3, -3, 3, -3, 3, 0] : 0 }} transition={{ duration: 0.36 }}
      style={{ padding: 20, borderRadius: 20, background: "var(--ink)", color: "white", boxShadow: waiting ? "0 0 0 3px var(--alert)" : undefined }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>SUAR · Pager petugas</h3>
      <p>{waiting ? <><BellRing size={16} aria-hidden="true" /> Pager bergetar · menunggu tindakan</> : "Tidak ada panggilan menunggu."}</p>
      <ul style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, listStyle: "none", padding: 0 }}>
        {ZONES.map((id) => {
          const zone = state.zones[id];
          const { label, Icon } = zoneAppearance(zone);
          const oldest = zone.tier === "menunggu" && zone.alertGroup === state.pendingGroups[0];
          return <li key={id} style={{ padding: 10, borderRadius: 7, background: "rgb(255 255 255 / .08)" }}>
            <motion.span animate={{ opacity: oldest && !reduced ? [1, 0.45, 1] : 1 }} transition={{ duration: 1.2, repeat: oldest && !reduced ? Infinity : 0 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: zone.nodeStatus !== "normal" ? "#d0d4db" : zone.tier === "menunggu" ? "var(--alert)" : "#a9e2d6" }}>
              <Circle size={12} fill="currentColor" aria-hidden="true" />Zona {id}
            </motion.span>
            <div style={{ fontSize: 12, marginTop: 4 }}><Icon size={13} aria-hidden="true" /> {label}</div>
            {oldest && <small>Kelompok tertua</small>}
          </li>;
        })}
      </ul>
      <button type="button" data-tour="pager-done" className="button" onClick={onDone} disabled={disabled || !waiting}
        style={{ width: "100%", background: "var(--accent-soft)", color: "var(--accent-ink)", minHeight: 48, opacity: disabled || !waiting ? 0.6 : 1 }}>Ditangani</button>
      <p style={{ fontSize: 12, margin: "12px 0 0" }}>Tombol menutup kelompok peringatan tertua.</p>
    </motion.section>
    {lastResponse?.responseMs !== null && lastResponse?.responseMs !== undefined && <p style={{ marginTop: 16 }}>Ditangani dalam {formatDuration(lastResponse.responseMs)}.</p>}
    {waiting && <ol style={{ paddingLeft: 20, marginTop: 20 }}>{copy.procedure.map((step) => <li key={step.title} style={{ marginBottom: 10 }}><strong>{step.title}</strong><br />{step.body}</li>)}</ol>}
  </>;
}
