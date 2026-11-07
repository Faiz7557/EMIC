import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useSim } from "../store/sim-store";
import { TOUR_STEPS } from "./tour-steps";

type Rect = { x: number; y: number; w: number; h: number };

/** Caliber's spotlight adapted to the local engine and keyboard-operated targets. */
export function Tour({ onClose }: { onClose: () => void }) {
  const { dispatch, reset, paused, setPaused, setSpeed } = useSim();
  // A running scenario pauses the provider clock itself; that is not a user pause to restore.
  const wasPaused = useRef(paused && !document.querySelector('[data-scenario-running="true"]'));
  const enteredStep = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardHeight, setCardHeight] = useState(260);
  const card = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const advancing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const reduced = useReducedMotion();
  const step = TOUR_STEPS[index];
  const complete = !step;

  // Mount after navigating home. Use the existing room reset to also stop its
  // local scenario, then freeze the provider clock for this interactive demo.
  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const room = document.getElementById("main-content");
    Array.from(room?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Reset ruang")?.click();
    const role = Array.from(room?.querySelectorAll("label") ?? []).find((label) => label.textContent?.trim().startsWith("Peran"))?.querySelector("select");
    if (role) { role.value = "petugas"; role.dispatchEvent(new Event("change", { bubbles: true })); }
    reset();
    setPaused(true);
    setReady(true);
    return () => {
      window.clearTimeout(timer.current);
      setSpeed(1); setPaused(wasPaused.current);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else document.querySelector<HTMLButtonElement>(".demo-button")?.focus({ preventScroll: true });
    };
  }, [reset, setPaused, setSpeed]);

  const next = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    // Let React's target handler commit and show its result before moving on.
    timer.current = window.setTimeout(() => setIndex((value) => value + 1), 220);
  }, []);

  useEffect(() => {
    if (!ready || enteredStep.current === index) return;
    enteredStep.current = index;
    advancing.current = false;
    if (step?.advanceMs) dispatch({ type: "tick", dtMs: step.advanceMs });
  }, [step, index, ready, dispatch]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let scrolled: HTMLElement | null = null;
    const track = () => {
      const element = step?.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      target.current = element;
      if (element && element !== scrolled) {
        scrolled = element;
        element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      }
      const bounds = element?.getBoundingClientRect();
      const w = window.innerWidth, h = window.innerHeight;
      const visible = bounds && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < h && bounds.right > 0 && bounds.left < w;
      const nextRect = visible ? { x: Math.max(4, bounds.left - 6), y: Math.max(4, bounds.top - 6), w: Math.min(w - 4, bounds.right + 6) - Math.max(4, bounds.left - 6), h: Math.min(h - 4, bounds.bottom + 6) - Math.max(4, bounds.top - 6) } : null;
      setRect((old) => JSON.stringify(old) === JSON.stringify(nextRect) ? old : nextRect);
      setViewport((old) => old.w === w && old.h === h ? old : { w, h });
      frame = requestAnimationFrame(track);
    };
    track();
    return () => { cancelAnimationFrame(frame); target.current = null; };
  }, [step, ready]);

  useEffect(() => {
    if (!ready) return;
    const press = (event: MouseEvent) => {
      if (step?.action && target.current?.contains(event.target as Node) && !target.current.matches(":disabled")) {
        if (advancing.current) { event.preventDefault(); event.stopPropagation(); }
        else next();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...(target.current?.matches("button:not(:disabled)") && step?.action ? [target.current] : []), ...Array.from(card.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])];
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      const destination = current < 0 ? (event.shiftKey ? controls.length - 1 : 0)
        : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[destination].focus({ preventScroll: true });
    };
    document.addEventListener("click", press, true);
    document.addEventListener("keydown", key, true);
    card.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener("click", press, true); document.removeEventListener("keydown", key, true); };
  }, [step, next, onClose, ready]);

  useLayoutEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(() => setCardHeight(card.current?.offsetHeight ?? 260));
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [ready, complete]);

  if (!ready) return null;
  const width = Math.min(340, viewport.w - 24);
  const height = Math.min(cardHeight, viewport.h - 24);
  let x = (viewport.w - width) / 2, y = (viewport.h - height) / 2;
  if (rect) {
    x = rect.x + (rect.w - width) / 2;
    if (viewport.h - rect.y - rect.h >= height + 28) y = rect.y + rect.h + 16;
    else if (rect.y >= height + 28) y = rect.y - height - 16;
    else if (viewport.w - rect.x - rect.w >= width + 28) { x = rect.x + rect.w + 16; y = rect.y; }
    else if (rect.x >= width + 28) { x = rect.x - width - 16; y = rect.y; }
    else y = viewport.h - height - 12;
  }
  x = Math.max(12, Math.min(viewport.w - width - 12, x));
  y = Math.max(12, Math.min(viewport.h - height - 12, y));
  const usable = rect && target.current?.matches("button:not(:disabled)");
  const blocker = { position: "absolute", pointerEvents: "auto" } as const;

  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
    <svg width={viewport.w} height={viewport.h} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs><mask id="suar-tour-hole"><rect width="100%" height="100%" fill="white" />{rect && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={10} fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgb(20 34 50 / .66)" mask="url(#suar-tour-hole)" />
    </svg>
    {rect ? <>
      <div style={{ ...blocker, top: 0, left: 0, right: 0, height: rect.y }} />
      <div style={{ ...blocker, top: rect.y + rect.h, bottom: 0, left: 0, right: 0 }} />
      <div style={{ ...blocker, top: rect.y, height: rect.h, left: 0, width: rect.x }} />
      <div style={{ ...blocker, top: rect.y, height: rect.h, left: rect.x + rect.w, right: 0 }} />
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 10, outline: "2px solid var(--accent-soft)" }} />
    </> : <div style={{ ...blocker, inset: 0 }} />}
    <motion.div ref={card} role="dialog" aria-label={complete ? "Demo selesai" : `Demo terpandu, langkah ${index + 1} dari 6`} tabIndex={-1}
      initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
      style={{ position: "absolute", pointerEvents: "auto", left: x, top: y, width, maxHeight: viewport.h - 24, overflowY: "auto", padding: 20, borderRadius: 18, background: "var(--panel)", color: "var(--ink)", boxShadow: "var(--shadow-float)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span>{complete ? "Demo selesai" : `Demo · ${index + 1} dari 6`}</span>
        <button type="button" className="icon-button" aria-label="Tutup demo" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      <h2 style={{ fontSize: 18, margin: "12px 0 8px" }}>{step?.title ?? "Jelajahi rancangan SUAR"}</h2>
      <p>{step?.body ?? "Simulator ini memperagakan rancangan. Simulator ini tidak membuktikan bahwa alat mampu mendengar batuk."}</p>
      {step?.action && <p style={{ marginTop: 12, color: "var(--accent-ink)" }}>{usable ? "Tekan tombol yang dibingkai untuk melanjutkan." : "Target tidak tersedia. Jalankan langkah dari kartu ini."}</p>}
      <div className="page-actions" style={{ marginTop: 16 }}>
        {complete ? <>
          <a className="button button-quiet" href="#/ambang" onClick={onClose}>Uji ambang</a>
          <a className="button button-quiet" href="#/alat" onClick={onClose}>Simpul dan pager</a>
          <a className="button button-quiet" href="#/bukti" onClick={onClose}>Status bukti</a>
          <button className="button" type="button" onClick={onClose}>Tutup</button>
        </> : <>
          <button className="button button-quiet" type="button" onClick={onClose}>Lewati demo</button>
          {(!step.action || !usable) && <button className="button" type="button" onClick={() => {
            if (advancing.current) return;
            if (step.action) dispatch(step.action);
            next();
          }}>{step.action ? "Jalankan langkah" : index === TOUR_STEPS.length - 1 ? "Selesai" : "Lanjut"}</button>}
        </>}
      </div>
    </motion.div>
  </div>, document.body);
}
