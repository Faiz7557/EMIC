import type { HTMLAttributes, ReactNode } from "react";
import { Bell, BellRing, CircleCheck, EarOff, HandHelping, Megaphone, WifiOff, type LucideIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NodeStatus, ZoneTier } from "../sim/types";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export type Status = ZoneTier | NodeStatus | "escalation";
export const STATUS_LABEL: Record<Status, string> = {
  normal: "Normal", tingkat1: "Ajakan", menunggu: "Tindakan", ditangani: "Ditangani",
  terbatas: "Terbatas", luring: "Luring", escalation: "Eskalasi",
};
export const STATUS_ICON: Record<Status, LucideIcon> = {
  normal: CircleCheck, tingkat1: Megaphone, menunggu: Bell, ditangani: HandHelping,
  terbatas: EarOff, luring: WifiOff, escalation: BellRing,
};

export function Panel({ children, className, as: As = "section", tour, ...props }: HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article"; tour?: string }) {
  return <As {...props} data-tour={tour} className={cn("panel squircle", className)}>{children}</As>;
}

export function PanelHead({ title, icon: Icon, aside, className }: { title: ReactNode; icon?: LucideIcon; aside?: ReactNode; className?: string }) {
  return <div className={cn("panel-head", className)}>
    {Icon && <Icon size={16} aria-hidden="true" />}<h2>{title}</h2>
    {aside && <div className="panel-aside">{aside}</div>}
  </div>;
}

export function PageHead({ title, answer, actions }: { title: string; answer?: ReactNode; actions?: ReactNode }) {
  return <header className="page-head"><div><h1>{title}</h1>{answer && <p className="page-answer">{answer}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

export function Em({ children, tone }: { children: ReactNode; tone?: Status }) {
  return <strong className={cn("em", tone && `ink-${tone}`)}>{children}</strong>;
}

export function Chip({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const Icon = STATUS_ICON[status];
  return <span className={cn("chip squircle", `status-${status}`, className)}><Icon size={13} aria-hidden="true" />{label ?? STATUS_LABEL[status]}</span>;
}

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("dot", className)} />;
}
