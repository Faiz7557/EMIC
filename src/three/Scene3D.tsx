import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { ZONES } from "../sim/types";
import { Denah2D, floorPreview, useMediaQuery, ZoneLabels, zoneAppearance, type RoomViewProps } from "../ui/denah-2d";
import type { createRoomStage, RoomStage } from "./room";

export type Scene3DProps = RoomViewProps;

/** Loading the room also loads Three; the shell and 2D view can paint first. */
const LazyRoom = lazy(async () => {
  const room = await import("./room");
  return { default: (props: RoomViewProps & { onFailure: () => void }) => <RoomCanvas {...props} createStage={room.createRoomStage} /> };
});

function LoadingRoom() {
  return <div role="status" style={{ minHeight: 360, display: "grid", placeItems: "center", color: "var(--ink-3)" }}>Menyiapkan sketsa ruang…</div>;
}

class RoomBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function RoomCanvas(props: RoomViewProps & { createStage: typeof createRoomStage; onFailure: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const stage = useRef<RoomStage | null>(null);
  const latest = useRef(props); latest.current = props;
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<readonly [number, number] | null>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setHover(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  const viewProps = () => ({
    ...latest.current,
    onFloorClick: (x: number, y: number) => latest.current.onFloorClick(x, y),
    onFloorHover: (x: number, y: number) => { setHover([x, y]); latest.current.onFloorHover(x, y); },
  });
  useEffect(() => {
    if (!canvas.current || !labels.current) return;
    let active = true;
    try {
      stage.current = props.createStage(canvas.current, labels.current, viewProps(), {
        onReady: () => { if (active) setReady(true); },
        onError: () => { if (active) latest.current.onFailure(); },
        onHoverEnd: () => { if (active) setHover(null); },
      });
    } catch { latest.current.onFailure(); }
    return () => { active = false; stage.current?.dispose(); stage.current = null; };
    // Callbacks read the latest props; changing simulation state never rebuilds the scene.
  }, [props.createStage]);
  useEffect(() => { stage.current?.update(viewProps()); }, [props.zones, props.effects, props.packets]);
  return <figure style={{ margin: 0 }}>
    <div style={{ position: "relative", height: "clamp(360px, 44vw, 560px)", minWidth: 0 }}>
      <canvas ref={canvas} role="img" aria-label="Sketsa ruang tunggu 3D. Klik lantai untuk memperagakan batuk, geser untuk memutar kamera. Aksi batuk juga tersedia melalui tombol zona pada halaman."
        style={{ display: "block", width: "100%", height: "100%", touchAction: "pan-y" }} />
      {!ready && <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "var(--ink-3)" }}>Menyiapkan sketsa ruang…</div>}
      <div ref={labels} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", visibility: ready ? "visible" : "hidden" }}>
        {ZONES.map((zone) => {
          const { label, color, Icon } = zoneAppearance(props.zones[zone]);
          return <span key={zone} style={{ position: "absolute", left: 0, top: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 7, background: "var(--panel)", boxShadow: "var(--shadow-card)", color, whiteSpace: "nowrap", fontSize: 12 }}>
            <Icon size={14} />{zone} · {label}
          </span>;
        })}
      </div>
      {hover && <div role="tooltip" style={{ position: "absolute", bottom: 12, left: 12, right: 12, width: "fit-content", maxWidth: "calc(100% - 24px)", padding: "8px 12px", borderRadius: 7, background: "var(--panel)", color: "var(--ink-2)", boxShadow: "var(--shadow-float)", fontSize: 12, pointerEvents: "none" }}>
        {floorPreview(...hover)}<br />Klik untuk memperagakan batuk di sini
      </div>}
    </div>
    <figcaption style={{ padding: "0 16px 12px" }}>
      <ZoneLabels zones={props.zones} />
      <p style={{ margin: "8px 0", fontSize: 12, color: "var(--ink-3)" }}>Sketsa ruang 10 × 5 m. Simpul pada tinggi 2 m, digambar 2× agar terbaca. Arsir: ΔL &lt; 3 dB.</p>
      <button type="button" className="button button-quiet" onClick={() => stage.current?.resetCamera()}>Atur ulang kamera</button>
    </figcaption>
  </figure>;
}

export function Scene3D(props: Scene3DProps) {
  const narrow = useMediaQuery("(max-width: 767px)");
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  const [failed, setFailed] = useState(false);
  const show2d = narrow || failed || mode === "2d";
  return <section className="hall-mesh" aria-label="Ruang tunggu interaktif" style={{ minWidth: 0, overflow: "hidden", borderRadius: 12 }}>
    <div role="group" aria-label="Tampilan ruang" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px 0" }}>
      <button type="button" className={`button${show2d ? "" : " button-quiet"}`} aria-pressed={show2d} onClick={() => setMode("2d")}>2D</button>
      <button type="button" className={`button${show2d ? " button-quiet" : ""}`} aria-pressed={!show2d} disabled={narrow || failed} onClick={() => setMode("3d")}>3D</button>
    </div>
    {show2d ? <Denah2D {...props} /> : <RoomBoundary fallback={<Denah2D {...props} />} onFailure={() => setFailed(true)}>
      <Suspense fallback={<LoadingRoom />}><LazyRoom {...props} onFailure={() => setFailed(true)} /></Suspense>
    </RoomBoundary>}
  </section>;
}

export default Scene3D;
