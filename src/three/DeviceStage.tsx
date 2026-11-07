import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Layers, RotateCcw } from "lucide-react";
import { copy } from "../data/copy";
import type { createDeviceStage, DeviceKind, DevicePartId, DeviceStageHandle, DeviceView } from "./device";

export interface DevicePart { id: DevicePartId; label: string }
interface ViewProps extends DeviceView {
  parts: readonly DevicePart[];
  selected: DevicePartId | null;
  onSelect: (id: DevicePartId) => void;
}

const LazyCanvas = lazy(async () => {
  const module = await import("./device");
  return { default: (props: ViewProps & { reset: number; onFailure: () => void }) => <DeviceCanvas {...props} createStage={module.createDeviceStage} /> };
});

class DeviceBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function DeviceCanvas(props: ViewProps & { reset: number; onFailure: () => void; createStage: typeof createDeviceStage }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const stage = useRef<DeviceStageHandle | null>(null);
  const latest = useRef(props); latest.current = props;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canvas.current || !labels.current) return;
    let active = true;
    try {
      stage.current = props.createStage(canvas.current, labels.current, latest.current, {
        onReady: () => { if (active) setReady(true); },
        onError: () => { if (active) latest.current.onFailure(); },
      });
    } catch { latest.current.onFailure(); }
    return () => { active = false; stage.current?.dispose(); stage.current = null; };
  }, [props.createStage]);
  useEffect(() => { stage.current?.update(props); }, [props.kind, props.open]);
  useEffect(() => { stage.current?.resetCamera(); }, [props.reset]);
  return <div style={{ position: "relative", height: "clamp(380px, 42vw, 560px)" }}>
    <canvas ref={canvas} role="img" aria-label={props.kind === "simpul" ? "Render konsep simpul lima lapis. Geser untuk memutar kamera; pilih komponen lewat tombol bernomor atau daftar." : "Render konsep pager 70 × 44 × 18 mm dengan empat LED zona A sampai D. Geser untuk memutar kamera."}
      style={{ display: "block", width: "100%", height: "100%", touchAction: "pan-y" }} />
    {!ready && <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "var(--ink-3)" }}>Menyiapkan render konsep…</div>}
    <div ref={labels} style={{ position: "absolute", inset: 0, pointerEvents: "none", visibility: ready ? "visible" : "hidden" }}>
      {props.parts.map((part, index) => <button key={part.id} type="button" data-part={part.id} aria-pressed={props.selected === part.id}
        aria-label={`${index + 1}. ${part.label}. ${props.selected === part.id ? "Tutup" : "Lihat"} detail komponen`} aria-controls="device-part-detail"
        onClick={() => props.onSelect(part.id)} style={{ position: "absolute", left: 0, top: 0, width: 44, height: 44, pointerEvents: "auto", borderRadius: "50%", background: props.selected === part.id ? "var(--ink)" : "var(--panel)", color: props.selected === part.id ? "white" : "var(--ink)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-float)", fontWeight: 600 }}>
        {index + 1}
      </button>)}
    </div>
  </div>;
}

export function DeviceStage({ kind, parts, selected, onSelect }: Omit<ViewProps, "open">) {
  const [open, setOpen] = useState(false);
  const [reset, setReset] = useState(0);
  const [failed, setFailed] = useState(false);
  const [imageOnly, setImageOnly] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const showImage = failed || imageOnly;
  useEffect(() => { setOpen(false); }, [kind]);
  return <figure className="hall-mesh" style={{ margin: 0, borderRadius: 12, overflow: "hidden" }}>
    <div role="group" aria-label="Tampilan alat" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, padding: "12px 16px 0" }}>
      <button type="button" className={`button${showImage ? "" : " button-quiet"}`} aria-pressed={showImage} onClick={() => setImageOnly(true)}><Image size={15} aria-hidden="true" />Gambar</button>
      <button type="button" className={`button${showImage ? " button-quiet" : ""}`} aria-pressed={!showImage} disabled={failed} onClick={() => setImageOnly(false)}>3D</button>
    </div>
    {showImage ? <div style={{ padding: 16 }}>
      <img src={`${import.meta.env.BASE_URL}f12_casing.png`} alt="Gambar proposal: lima lapis simpul terurai, simpul terpasang berdiameter 96 mm dan tebal 34 mm, serta pager 70 × 44 × 18 mm dengan LED A, B, C, D dan tombol ditangani."
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 7 }} />
      <p style={{ margin: "12px 0 0", color: "var(--ink-2)", fontSize: 12 }}>Gambar konsep statis. Pilih komponen pada daftar untuk melihat fungsi dan estimasi biaya.</p>
    </div> : <DeviceBoundary onFailure={() => setFailed(true)}><Suspense fallback={<div role="status" style={{ minHeight: 380, display: "grid", placeItems: "center" }}>Menyiapkan render konsep…</div>}>
      <LazyCanvas kind={kind} open={open} parts={parts} selected={selected} onSelect={onSelect} reset={reset} onFailure={() => setFailed(true)} />
    </Suspense></DeviceBoundary>}
    <figcaption style={{ padding: 16, borderTop: "1px solid var(--line-2)" }}>
      <p style={{ fontWeight: 600, margin: "0 0 6px" }}>{copy.concept}</p>
      <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 12 }}>{kind === "simpul" ? "Dimensi rancangan: Ø96 × 34 mm. Lima lapis sesuai gambar proposal. Model diperbesar agar terbaca." : "Dimensi rancangan: 70 × 44 × 18 mm. Empat LED berlabel zona A sampai D, tombol ditangani, klip saku, dan isi daya USB. Isi pager ditunjukkan sebagai titik rujukan pada casing."}</p>
      {!showImage && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {kind === "simpul" && <button type="button" className="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Layers size={15} aria-hidden="true" />{open ? "Tutup simpul" : "Buka simpul"}</button>}
        <button type="button" className="button button-quiet" onClick={() => setReset((value) => value + 1)}><RotateCcw size={15} aria-hidden="true" />Reset tampilan</button>
        <span role="status" className="sr-only">{kind === "simpul" ? open ? "Simpul terbuka, lima lapis terurai." : "Simpul tertutup." : "Pager dengan empat LED zona."}</span>
      </div>}
    </figcaption>
  </figure>;
}

export default DeviceStage;
