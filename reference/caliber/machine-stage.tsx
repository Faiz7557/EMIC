"use client";

import { t } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Layers, RotateCcw } from "@/components/icons";
import * as THREE from "three";
import { buildMachine, type Built, type Zone } from "./three/models";
import { createPipeline, studioFloor, studioLights, type Pipeline } from "./three/stage";
import type { MachineSlug } from "@/lib/machines";
import { ZONE_LABEL } from "@/lib/machines";
import { cn } from "@/lib/format";

export type ZoneStat = { key: string; short: number; total: number };

/**
 * The machine hall: a seamless studio, a real-looking machine, hotspots tied to part categories.
 * Renders on demand, so an idle page costs nothing.
 */
export function MachineStage({
  slug,
  zones,
  selected,
  onSelect,
  backdrop = 0xeee9e3,
  insetLeft = 0,
  className,
}: {
  slug: MachineSlug;
  zones: ZoneStat[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  backdrop?: number;
  /** Width of a panel sitting over the left of the stage; the machine centres in what is left. */
  insetLeft?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hotLayer = useRef<HTMLDivElement>(null);
  const engine = useRef<{ pipe: Pipeline; model: Built; setOpen: (o: boolean) => void; highlight: (k: string | null) => void; reset: () => void } | null>(null);
  const inset = useRef(insetLeft);
  useLayoutEffect(() => {
    inset.current = insetLeft;
    engine.current?.pipe.invalidate();
  }, [insetLeft]);
  const zonesRef = useRef(zones);
  useLayoutEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const hoverKey = useRef<string | null>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const lastPick = useRef(0);

  useEffect(() => {
    const start = (): (() => void) | undefined => {
    const cv = canvas.current;
    if (!cv) return;
    let pipe: Pipeline;
    let model: Built;
    try {
      pipe = createPipeline(cv, { fov: 27, exposure: 0.9, onFirstFrame: () => setShown(true) });
      model = buildMachine(slug);
    } catch {
      setFailed(true);
      return;
    }
    const { scene, camera } = pipe;
    studioFloor(scene, backdrop);
    const box = new THREE.Box3().setFromObject(model.root);
    const center = box.getCenter(new THREE.Vector3());
    const reach = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 1.15;
    studioLights(scene, reach, center);
    scene.add(model.root);

    /* each zone owns its material clones so it can glow alone */
    const glow: { z: Zone; mats: THREE.MeshStandardMaterial[] }[] = model.zones.map((z) => {
      const mats: THREE.MeshStandardMaterial[] = [];
      z.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const c = (mesh.material as THREE.MeshStandardMaterial).clone();
        mesh.material = c;
        mats.push(c);
      });
      return { z, mats };
    });

    let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
    const look = new THREE.Vector3(...model.look);
    const camBase = new THREE.Vector3(...model.cam).sub(look);
    const baseR = camBase.length();
    const orbit = { yaw: 0, pitch: 0, zoom: 1, tYaw: 0, tPitch: 0, tZoom: 1 };
    const base = new THREE.Spherical().setFromVector3(camBase);
    let intro = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) intro = 1;
    let explode = 0;
    let explodeTo = 0;
    let viewInset = inset.current;
    const s = new THREE.Spherical();
    const applyCam = () => {
      const fit = Math.max(1, 1.5 / (Math.max(1, pipe.size.w - viewInset) / pipe.size.h));
      const e = 1 - Math.pow(1 - intro, 3);
      s.set(baseR * orbit.zoom * fit * (1.1 - 0.1 * e), Math.max(0.15, Math.min(1.5, base.phi + orbit.pitch)), base.theta + orbit.yaw - 0.32 * (1 - e));
      camera.position.setFromSpherical(s).add(look);
      camera.lookAt(look);
      const { w, h } = pipe.size;
      camera.setViewOffset(w, h, -viewInset / 2, 0, w, h);
    };
    applyCam();

    const proj = new THREE.Vector3();
    const place = () => {
      const layer = hotLayer.current;
      if (!layer) return;
      for (const el of Array.from(layer.children) as HTMLElement[]) {
        const key = el.dataset.zone;
        const z = model.zones.find((q) => q.key === key);
        if (!z) continue;
        z.anchor.getWorldPosition(proj);
        proj.project(camera);
        el.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * pipe.size.w).toFixed(1)}px,${((-proj.y * 0.5 + 0.5) * pipe.size.h).toFixed(1)}px,0)`;
      }
    };

    let easing = false;
    pipe.onTick((dt) => {
      let moved = false;
      if (intro < 1) {
        intro = Math.min(1, intro + dt / 0.9);
        moved = true;
        pipe.setMoving(intro < 1);
      }
      // Frame-rate independent easing: snappy while the hand is on it, a soft glide after letting go.
      const f = 1 - Math.exp(-dt * (drag ? 22 : 9));
      const gap = Math.abs(orbit.tYaw - orbit.yaw) + Math.abs(orbit.tPitch - orbit.pitch) + Math.abs(orbit.tZoom - orbit.zoom);
      if (gap > 0.0005) {
        orbit.yaw += (orbit.tYaw - orbit.yaw) * f;
        orbit.pitch += (orbit.tPitch - orbit.pitch) * f;
        orbit.zoom += (orbit.tZoom - orbit.zoom) * f;
        moved = true;
        // Ambient occlusion stays off for the whole glide; switching it back mid-motion is what made the view shimmer.
        if (!easing) {
          easing = true;
          pipe.setMoving(true);
        }
      } else if (easing) {
        orbit.yaw = orbit.tYaw;
        orbit.pitch = orbit.tPitch;
        orbit.zoom = orbit.tZoom;
        easing = false;
        if (!drag) pipe.setMoving(false);
      }
      if (Math.abs(explodeTo - explode) > 0.001) {
        explode += (explodeTo - explode) * Math.min(1, dt * 4);
        if (Math.abs(explodeTo - explode) <= 0.001) explode = explodeTo;
        model.moves.forEach((q) => q.o.position.copy(q.home).addScaledVector(q.d, explode));
        moved = true;
        if (explode === explodeTo) {
          pipe.updateShadows();
          pipe.setMoving(false);
        }
      }
      if (Math.abs(viewInset - inset.current) > 0.5) {
        viewInset += (inset.current - viewInset) * f;
        moved = true;
      }
      if (moved) applyCam();
      place();
      return moved;
    });

    /* orbit and pick */
    const ray = new THREE.Raycaster();
    const v2 = new THREE.Vector2();

    const zoneAt = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v2, camera);
      const hits = ray.intersectObject(model.root, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData.zone) return o.userData.zone as string;
          o = o.parent;
        }
        if ((h.object as THREE.Mesh).isMesh) return null;
      }
      return null;
    };
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, yaw: orbit.tYaw, pitch: orbit.tPitch, moved: false };
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
    };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        orbit.tYaw = drag.yaw - dx * 0.0065;
        orbit.tPitch = Math.max(-0.5, Math.min(0.45, drag.pitch - dy * 0.0045));
        cv.style.cursor = "grabbing";
        return;
      }
      const r = cv.getBoundingClientRect();
      if (tipEl.current) tipEl.current.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 10}px)`;
      const now = performance.now();
      if (now - lastPick.current < 90) return;
      lastPick.current = now;
      const k = zoneAt(e);
      const found = k && zonesRef.current.some((z) => z.key === k) ? k : null;
      cv.style.cursor = found ? "pointer" : "grab";
      if (found !== hoverKey.current) {
        hoverKey.current = found;
        setHover(found);
      }
    };
    const up = (e: PointerEvent) => {
      const wasDrag = drag?.moved;
      drag = null;
      if (!easing) pipe.setMoving(false);
      cv.style.cursor = "grab";
      if (wasDrag) return;
      const k = zoneAt(e);
      if (k && zonesRef.current.some((z) => z.key === k)) onSelectRef.current(k);
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      orbit.tZoom = Math.max(0.5, Math.min(1.5, orbit.tZoom + e.deltaY * 0.001));
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    cv.style.cursor = "grab";
    cv.style.touchAction = "pan-y";

    engine.current = {
      pipe,
      model,
      setOpen: (o) => {
        explodeTo = o ? 1 : 0;
        pipe.setMoving(true);
        pipe.invalidate();
      },
      highlight: (k) => {
        for (const { z, mats } of glow)
          for (const c of mats) {
            const on = z.key === k;
            c.emissive = new THREE.Color(on ? 0xff6a1a : 0x000000);
            c.emissiveIntensity = on ? 0.42 : 0;
            c.needsUpdate = true;
          }
        pipe.invalidate();
      },
      reset: () => {
        orbit.tYaw = 0;
        orbit.tPitch = 0;
        orbit.tZoom = 1;
        pipe.invalidate();
      },
    };
    place();
     
    setReady(true);

    return () => {
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("wheel", wheel);
      engine.current = null;
      pipe.dispose();
    };
    };
    // Let the skeleton paint before building the model blocks the main thread.
    let stop: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      stop = start();
    }, 60);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [slug, backdrop]);

  useEffect(() => {
    engine.current?.highlight(selected);
    if (!selected) return;
    const z = engine.current?.model.zones.find((q) => q.key === selected);
    if (z?.inside && !open) {
      engine.current?.setOpen(true);
       
      setOpen(true);
    }
  }, [selected, open]);

  const present = zones.filter((z) => z.total > 0);
  return (
    <div className={cn("overflow-hidden", className ?? "relative")}>
      {!shown && !failed && (
        <div aria-label={t("Loading the machine", "Memuat mesin")} className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex w-[46%] max-w-[420px] flex-col items-center gap-4">
            <div className="relative h-[180px] w-full">
              <div className="absolute bottom-0 left-[6%] right-[6%] h-[26px] animate-pulse rounded-[10px] bg-ink/[0.06]" />
              <div className="absolute bottom-[26px] left-[14%] h-[90px] w-[22%] animate-pulse rounded-[12px] bg-ink/[0.07]" />
              <div className="absolute bottom-[26px] left-[38%] h-[120px] w-[44%] animate-pulse rounded-[40px] bg-ink/[0.08] [animation-delay:150ms]" />
              <div className="absolute bottom-[146px] left-[50%] h-[34px] w-[10%] animate-pulse rounded-t-[10px] bg-ink/[0.07] [animation-delay:300ms]" />
            </div>
            <span className="text-[12.5px] text-ink-3">{t("Loading the machine…", "Memuat mesin…")}</span>
          </div>
        </div>
      )}
      <canvas ref={canvas} className={cn("absolute inset-0 block h-full w-full transition-opacity duration-500 ease-out", shown ? "opacity-100" : "opacity-0")} aria-label={t("3D model of the machine. Drag to rotate, click a part to see what is short.", "Model 3D mesin. Seret untuk memutar, klik bagian mesin untuk melihat yang kurang.")} />
      {failed && <p className="absolute inset-x-0 top-1/2 m-0 text-center text-[13.5px] text-ink-2">{t("3D needs WebGL, which this browser has turned off.", "Tampilan 3D membutuhkan WebGL, yang dimatikan di peramban ini.")}</p>}
      <div ref={hotLayer} className={cn("pointer-events-none absolute inset-0 transition-opacity delay-200 duration-500", ready && shown ? "opacity-100" : "opacity-0")}>
        {present.map((z) => (
          <button
            key={z.key}
            type="button"
            data-zone={z.key}
            onClick={() => onSelect(selected === z.key ? null : z.key)}
            onPointerEnter={() => {
              hoverKey.current = null;
              setHover(null);
            }}
            aria-label={t(`${ZONE_LABEL[z.key] ?? z.key}: ${z.short} of ${z.total} short`, `${ZONE_LABEL[z.key] ?? z.key}: ${z.short} dari ${z.total} kurang`)}
            className="group pointer-events-auto absolute left-0 top-0 -ml-[12px] -mt-[12px] flex h-6 items-center will-change-transform"
          >
            <span
              className={cn(
                "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums ring-2 ring-white transition-transform duration-150 group-hover:scale-110",
                selected === z.key ? "bg-ink text-white" : z.short > 0 ? "bg-act text-white" : "bg-ready text-white",
              )}
            >
              {z.short}
            </span>
            <span className={cn("ml-1.5 whitespace-nowrap rounded-[8px] bg-white px-2 py-1 text-[12px] font-medium text-ink opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100", selected === z.key && "opacity-100")}>
              {ZONE_LABEL[z.key] ?? z.key}
            </span>
          </button>
        ))}
      </div>
      <div ref={tipEl} className={cn("pointer-events-none absolute left-0 top-0 z-10 rounded-[8px] bg-ink px-2 py-1 text-[12px] font-medium text-white", hover ? "visible" : "invisible")}>
        {hover && (ZONE_LABEL[hover] ?? hover)}
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const n = !open;
            setOpen(n);
            engine.current?.setOpen(n);
          }}
          className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[10px] bg-ink px-3 text-[13px] font-medium text-white transition-transform duration-150 active:scale-[0.97]"
        >
          {open ? <Box aria-hidden className="h-4 w-4" /> : <Layers aria-hidden className="h-4 w-4" />}
          {open ? t("Close the machine", "Tutup mesin") : t("Open the machine", "Buka mesin")}
        </button>
        <button type="button" onClick={() => engine.current?.reset()} aria-label={t("Reset the view", "Kembalikan tampilan")} className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/95 text-ink-2 shadow-card transition-colors hover:text-ink">
          <RotateCcw aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
