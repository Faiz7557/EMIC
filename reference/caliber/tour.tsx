"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, MousePointerClick, X } from "lucide-react";
import { Lightbulb } from "@/components/icons";
import { cn } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * A game-style walkthrough: the screen dims, the part being explained is framed, and a step card sits beside it.
 * Mark any element with data-tour="name" and point a step at that name.
 */
export type TourStep = {
  /** The data-tour value to frame. Leave it out for a card in the middle of the screen. */
  target?: string;
  title: string;
  body: ReactNode;
  /** Moves on when the framed element is pressed. */
  waitForClick?: boolean;
  padding?: number;
};

type Rect = { x: number; y: number; w: number; h: number };

/** How long a step waits for its target to appear before moving on, for example while tasks load. */
const FIND_TIMEOUT = 6000;

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const step = steps[i];

  const next = useCallback(() => (i >= steps.length - 1 ? onClose() : setI(i + 1)), [i, steps.length, onClose]);
  const back = () => setI((x) => Math.max(0, x - 1));

  // Follow the target every frame, because animations and loading can shift the layout.
  useEffect(() => {
    if (!step) return;
    const find = () => (step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null);
    const pad = step.padding ?? 8;
    const started = Date.now();
    let scrolled = false;
    let raf = 0;
    const loop = () => {
      const el = find();
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
        }
        const r = el.getBoundingClientRect();
        const n = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
        setRect((p) => (p && Math.abs(p.x - n.x) < 0.5 && Math.abs(p.y - n.y) < 0.5 && Math.abs(p.w - n.w) < 0.5 && Math.abs(p.h - n.h) < 0.5 ? p : n));
      } else {
        setRect(null);
        if (step.target && Date.now() - started > FIND_TIMEOUT) {
          setI((x) => Math.min(steps.length - 1, x + 1));
          return;
        }
      }
      setVp((p) => (p.w === window.innerWidth && p.h === window.innerHeight ? p : { w: window.innerWidth, h: window.innerHeight }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, reduce, steps.length]);

  // A "press it" step moves on when the framed element is pressed.
  const targetReady = rect !== null;
  useEffect(() => {
    if (!step?.waitForClick || !targetReady) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return;
    const onPress = () => window.setTimeout(next, 150);
    el.addEventListener("click", onPress, { once: true });
    return () => el.removeEventListener("click", onPress);
  }, [step, targetReady, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !step?.waitForClick) next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onClose, step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, rect?.w]);

  if (!step) return null;

  // The card goes below the target if it fits, then above, then beside. It always stays on screen.
  const CW = Math.min(340, vp.w - 24);
  const gap = 16;
  let cx = vp.w / 2 - CW / 2;
  let cy = vp.h / 2 - cardH / 2;
  let side: "top" | "bottom" | "center" = "center";
  if (rect) {
    const below = vp.h - (rect.y + rect.h);
    if (below >= cardH + gap + 8) {
      cy = rect.y + rect.h + gap;
      side = "bottom";
    } else if (rect.y >= cardH + gap + 8) {
      cy = rect.y - cardH - gap;
      side = "top";
    } else if (vp.w - (rect.x + rect.w) >= CW + gap + 8) {
      cx = rect.x + rect.w + gap;
      cy = rect.y + rect.h / 2 - cardH / 2;
    } else if (rect.x >= CW + gap + 8) {
      cx = rect.x - CW - gap;
      cy = rect.y + rect.h / 2 - cardH / 2;
    } else {
      cy = vp.h - cardH - 16;
    }
    if (side !== "center") cx = rect.x + rect.w / 2 - CW / 2;
    cx = Math.max(12, Math.min(vp.w - CW - 12, cx));
    cy = Math.max(12, Math.min(vp.h - cardH - 12, cy));
  }
  const arrowX = rect ? Math.max(20, Math.min(CW - 20, rect.x + rect.w / 2 - cx)) : 0;
  const radius = rect ? Math.min(20, rect.h / 2, rect.w / 2) : 0;
  // An eased move, not a spring: a spring can overshoot into a negative height on the SVG mask.
  const spring = reduce ? { duration: 0 } : { duration: 0.28, ease: [0.23, 1, 0.32, 1] as const };

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={t("Tutorial", "Panduan")}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" width={vp.w} height={vp.h} aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect && <motion.rect initial={false} animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} transition={spring} rx={radius} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(22,23,26,0.62)" mask="url(#tour-hole)" />
      </svg>

      {/* Blocks presses outside the hole. The framed part itself stays usable. */}
      {rect ? (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: Math.max(0, rect.y) }} />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: rect.y + rect.h }} />
          <div className="pointer-events-auto absolute left-0" style={{ top: rect.y, height: rect.h, width: Math.max(0, rect.x) }} />
          <div className="pointer-events-auto absolute right-0" style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }} />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}

      {rect && (
        <motion.div initial={false} animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} transition={spring} className="pointer-events-none absolute" style={{ borderRadius: radius }}>
          <span className={cn("absolute inset-0 rounded-[inherit] ring-2 ring-accent", !reduce && "animate-pulse")} />
          {step.waitForClick && (
            <motion.span className="absolute -bottom-7 right-2 text-white drop-shadow" animate={reduce ? {} : { y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.1 }}>
              <MousePointerClick aria-hidden className="h-7 w-7" />
            </motion.span>
          )}
        </motion.div>
      )}

        <motion.div
          key={i}
          ref={cardRef}
          initial={reduce ? false : { opacity: 0, y: side === "top" ? -8 : 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
          className="pointer-events-auto absolute rounded-[18px] border border-line bg-panel p-4 text-ink shadow-float"
          style={{ width: CW, left: cx, top: cy }}
          aria-live="polite"
        >
          {side !== "center" && rect && <span aria-hidden className={cn("absolute h-3 w-3 rotate-45 bg-panel", side === "bottom" ? "-top-1.5" : "-bottom-1.5")} style={{ left: arrowX - 6 }} />}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-accent">
              <Lightbulb aria-hidden className="h-3.5 w-3.5" />{t(`Tutorial · ${i + 1} of ${steps.length}`, `Panduan · ${i + 1} dari ${steps.length}`)}
            </span>
            <button type="button" onClick={onClose} aria-label={t("Close the tutorial", "Tutup panduan")} className="grid h-8 w-8 place-items-center rounded-[8px] text-ink-3 transition-colors hover:bg-ink/[0.05] hover:text-ink"><X aria-hidden className="h-4 w-4" /></button>
          </div>
          <h3 className="m-0 mt-2.5 text-[16px] font-semibold leading-snug tracking-[-0.01em]">{step.title}</h3>
          <div className="mt-1 text-[13.5px] leading-[1.5] text-ink-2">{step.body}</div>
          {step.waitForClick && (
            <p className="m-0 mt-3 flex items-center gap-2 rounded-[10px] bg-accent-soft px-3 py-2 text-[12.5px] font-medium text-accent">
              <MousePointerClick aria-hidden className="h-4 w-4 shrink-0" />{t("Press the framed part to continue", "Tekan bagian yang dibingkai untuk melanjutkan")}
            </p>
          )}
          <div className="mt-3.5 flex items-center gap-2">
            <div className="mr-auto flex gap-1" aria-hidden>
              {steps.map((_, k) => (
                <span key={k} className={cn("h-1.5 rounded-full transition-all duration-300", k === i ? "w-4 bg-ink" : k < i ? "w-1.5 bg-ink-3" : "w-1.5 bg-ink/15")} />
              ))}
            </div>
            {i > 0 && (
              <button type="button" onClick={back} aria-label={t("Previous step", "Langkah sebelumnya")} className="grid h-9 w-9 place-items-center rounded-[10px] border border-line-2 text-ink-2 transition-colors hover:bg-ink/[0.04]"><ArrowLeft aria-hidden className="h-4 w-4" /></button>
            )}
            {step.waitForClick ? (
              <button type="button" onClick={next} className="h-9 rounded-[10px] px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/[0.05]">{t("Skip this step", "Lewati langkah ini")}</button>
            ) : (
              <button type="button" onClick={next} autoFocus className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-2">
                {i === steps.length - 1 ? t("Finish", "Selesai") : t("Next", "Lanjut")}
                {i < steps.length - 1 && <ArrowRight aria-hidden className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </motion.div>
    </div>,
    document.body,
  );
}
