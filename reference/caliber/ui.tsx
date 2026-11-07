import type { ReactNode } from "react";
import { OctagonAlert, Clock, Eye, CircleCheck, Package, Archive, ArrowLeftRight, type LucideIcon } from "@/components/icons";
import { type Crit, type Status, STATUS_LABEL, CRIT_NAME, cn } from "@/lib/format";
import { bi, t } from "@/lib/i18n";

export const STATUS_ICON: Record<Status, LucideIcon> = {
  act: OctagonAlert,
  plan: Clock,
  watch: Eye,
  ready: CircleCheck,
  excess: Package,
  idle: Archive,
  twin: ArrowLeftRight,
};

export const STATUS_TONE: Record<Status, { soft: string; ink: string; solid: string; text: string; ring: string }> = {
  act: { soft: "bg-act-soft", ink: "text-act-ink", solid: "bg-act", text: "text-act", ring: "stroke-act" },
  plan: { soft: "bg-plan-soft", ink: "text-plan-ink", solid: "bg-plan", text: "text-plan", ring: "stroke-plan" },
  watch: { soft: "bg-watch-soft", ink: "text-watch-ink", solid: "bg-watch", text: "text-watch", ring: "stroke-watch" },
  ready: { soft: "bg-ready-soft", ink: "text-ready-ink", solid: "bg-ready", text: "text-ready", ring: "stroke-ready" },
  excess: { soft: "bg-excess-soft", ink: "text-excess-ink", solid: "bg-excess", text: "text-excess", ring: "stroke-excess" },
  idle: { soft: "bg-idle-soft", ink: "text-idle-ink", solid: "bg-idle", text: "text-idle", ring: "stroke-idle" },
  twin: { soft: "bg-twin-soft", ink: "text-twin-ink", solid: "bg-twin", text: "text-twin", ring: "stroke-twin" },
};

/** Status chip: icon + word on a soft tint. 22px tall, never colour alone. */
export function Chip({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const Icon = STATUS_ICON[status];
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "squircle inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[7px] px-2 text-[11.5px] font-medium leading-none",
        tone.soft,
        tone.ink,
        className,
      )}
    >
      <Icon aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/** A neutral chip for category, unit, equipment. */
export function Tag({ children, icon: Icon, className }: { children: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "squircle inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[7px] bg-ink/[0.05] px-2 text-[11.5px] leading-none text-ink-2",
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />}
      {children}
    </span>
  );
}

/** Criticality as a letter tile whose weight drops from A (highest) to S (lowest). */
export function CritTile({ crit, size = "sm" }: { crit: Crit; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-9 w-9 text-[17px] rounded-[10px]" : size === "md" ? "h-7 w-7 text-[14px] rounded-[8px]" : "h-[22px] w-[22px] text-[11.5px] rounded-[7px]";
  const tone =
    crit === "A"
      ? "bg-ink text-white"
      : crit === "B"
        ? "bg-ink-2 text-white"
        : crit === "C"
          ? "bg-panel text-ink-2 ring-1 ring-inset ring-line-2"
          : "bg-ink/[0.04] text-ink-3";
  return (
    <span
      title={`${t("Criticality", "Kekritisan")} ${CRIT_NAME[crit]}`}
      aria-label={`${t("Criticality", "Kekritisan")} ${CRIT_NAME[crit]}`}
      className={cn("squircle inline-grid shrink-0 place-items-center font-display font-semibold leading-none", dims, tone)}
    >
      {crit}
    </span>
  );
}

/** Ring from the 21st kanban card: one value, one colour, the number beside it. */
export function Ring({
  value,
  status = "ready",
  size = 14,
  stroke = 2,
  label,
  className,
}: {
  value: number;
  status?: Status;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink/[0.09]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - c * v}
          className={cn(STATUS_TONE[status].ring, "transition-[stroke-dashoffset] duration-500 ease-out-expo")}
        />
      </svg>
      {label}
    </span>
  );
}

/** White panel with a hairline and a soft contact shadow. Never nest one inside another. */
export function Panel({ children, className, as: As = "section", tour }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; tour?: string }) {
  return (
    <As data-tour={tour} className={cn("rounded-[20px] border border-line bg-panel shadow-card", className)}>
      {children}
    </As>
  );
}

export function PanelHead({ title, icon: Icon, aside, className }: { title: ReactNode; icon?: LucideIcon; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-5 pt-5", className)}>
      {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />}
      <h2 className="m-0 text-[14px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
      {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
}

/** Page title as the question the page answers, and the answer as one sentence. */
export function PageHead({ title, answer, actions }: { title: string; answer?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{title}</h1>
        {answer && <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-2">{answer}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Inline emphasis for a number inside a sentence. */
export function Em({ children, tone }: { children: ReactNode; tone?: Status }) {
  return <strong className={cn("font-semibold", tone ? STATUS_TONE[tone].text : "text-ink")}>{children}</strong>;
}

/** Small legend dot + label. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} />;
}

/** A single big figure with a short label underneath. Used sparingly, inside a visual, not as a page scaffold. */
export function Figure({ value, label, tone, className }: { value: ReactNode; label: ReactNode; tone?: Status; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("font-display text-[26px] font-medium leading-none tracking-[-0.03em]", tone ? STATUS_TONE[tone].text : "text-ink")}>{value}</div>
      <div className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------ severity */

/** Green: enough. Orange: order, still in time. Red: too late, or a critical part that is empty. None: not a shortage question. */
export type Severity = "ok" | "warn" | "bad" | "none";

export const SEV_BAR: Record<Severity, string> = { ok: "bg-ready", warn: "bg-plan", bad: "bg-act", none: "bg-ink/10" };
export const SEV_NAME: Record<Severity, string> = bi({ ok: ["Enough", "Cukup"], warn: ["Order in time", "Pesan tepat waktu"], bad: ["Too late or critical and empty", "Terlambat, atau kritis dan kosong"], none: ["", ""] });

export function sevOf(o: { short: boolean; late: boolean; critical: boolean; empty: boolean }): Severity {
  if (!o.short) return "ok";
  return o.late || (o.critical && o.empty) ? "bad" : "warn";
}

const SEV_FILL: Record<Severity, string> = { ok: "bg-ready/[0.16]", warn: "bg-plan/[0.24]", bad: "bg-act/[0.2]", none: "" };

/** Tints the whole row or card by status. The parent needs `relative`; the tint sits under nothing it has to block. */
export function SevBar({ sev }: { sev: Severity; className?: string }) {
  if (sev === "none") return null;
  return <span aria-label={SEV_NAME[sev]} className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", SEV_FILL[sev])} />;
}

/** Criticality as a quiet letter, for lists where the colour carries the status. */
export function CritText({ crit }: { crit: Crit }) {
  return (
    <span title={`${t("Criticality", "Kekritisan")} ${CRIT_NAME[crit]}`} aria-label={`${t("Criticality", "Kekritisan")} ${CRIT_NAME[crit]}`} className={cn("inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-[5px] border px-1 text-[10.5px] font-semibold leading-none", crit === "A" || crit === "B" ? "border-ink-3/50 text-ink-2" : "border-line-2 text-ink-4")}>
      {crit}
    </span>
  );
}
