"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ArrowRight, Check, ChevronsLeft, CircleHelp, ChevronsRight, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Boxes, CalendarClock, ChartLine, Factory, History, ListTodo, Search, ShieldCheck, SlidersHorizontal, type LucideIcon } from "@/components/icons";
import { amount, cn, partName, ACTION_VERB, ACTION_STATUS, type Action, type Crit } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { signOut, switchRole, useMe } from "@/lib/me";
import { PEOPLE } from "@/lib/people";
import { Assistant } from "./assistant";
import { TourHost } from "./tour-host";
import { Avatar, BrandMark } from "./brand-mark";
import { Chip, CritTile } from "./ui";
import { LangToggle } from "./lang";
import { t } from "@/lib/i18n";

type NavItem = { href: string; label: string; icon: LucideIcon };
export type SideMachine = { slug: string; name: string; short: number };

const groups = (): { title: string; items: NavItem[] }[] => [
  { title: t("What will we need?", "Apa yang akan kita butuhkan?"), items: [{ href: "/forecast", label: t("Forecast", "Prakiraan"), icon: ChartLine }] },
  {
    title: t("What should we do?", "Apa yang harus kita lakukan?"),
    items: [
      { href: "/what-if", label: t("1. What if", "1. Simulasi"), icon: SlidersHorizontal },
      { href: "/stock", label: t("2. Stock", "2. Stok"), icon: Boxes },
      { href: "/todo", label: t("3. To do", "3. Tugas"), icon: ListTodo },
    ],
  },
  {
    title: t("Can we trust it?", "Bisakah datanya dipercaya?"),
    items: [
      { href: "/replay", label: t("Replay", "Simulasi ulang"), icon: History },
      { href: "/check", label: t("Data check", "Cek data"), icon: ShieldCheck },
    ],
  },
];

/** Who is signed in. Pressing it opens the demo roles, so anyone can see the board as each person. */
function Account({ mini }: { mini: boolean }) {
  const { me } = useMe();
  const [switching, setSwitching] = useState<string | null>(null);
  if (!me) return <div className={cn("h-11 animate-pulse rounded-[12px] bg-ink/[0.04]", mini && "mx-auto w-10")} />;
  const pick = (id: string) => {
    setSwitching(id);
    switchRole(id);
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {mini ? (
          <button type="button" aria-label={`${me.name}, ${t("switch role", "ganti peran")}`} title={`${me.name}, ${t("switch role", "ganti peran")}`} className="mx-auto block rounded-full"><Avatar name={me.name} className="h-10 w-10 text-[12.5px]" /></button>
        ) : (
          <button type="button" className="flex w-full items-center gap-2.5 rounded-[12px] border border-line px-2 py-1.5 text-left transition-colors hover:border-line-2 hover:bg-ink/[0.02]">
            <Avatar name={me.name} className="h-8 w-8 text-[11.5px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{me.name}</span>
              <span className="block truncate text-[11.5px] leading-tight text-ink-3" title={me.title}>{me.title}</span>
            </span>
            <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={mini ? "right" : "top"} align={mini ? "end" : "start"} sideOffset={8} className="z-50 w-[300px] rounded-[14px] border border-line bg-panel p-1.5 shadow-float">
          <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-medium text-ink-3">{t("View the demo as", "Lihat demo sebagai")}</div>
          <ul role="radiogroup" aria-label={t("Demo role", "Peran demo")} className="m-0 list-none p-0">
            {PEOPLE.map((p) => (
              <li key={p.id}>
                <button type="button" role="radio" aria-checked={p.id === me.id} disabled={!!switching} onClick={() => (p.id === me.id ? undefined : pick(p.id))} className={cn("flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left transition-colors disabled:opacity-60", p.id === me.id ? "bg-accent-soft" : "hover:bg-ink/[0.04]")}>
                  <Avatar name={p.name} className="h-7 w-7 text-[10.5px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-tight">{p.title}</span>
                    <span className="block truncate text-[11.5px] leading-tight text-ink-3">{p.name}</span>
                  </span>
                  {switching === p.id ? <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-ink-3" /> : p.id === me.id ? <Check aria-hidden className="h-4 w-4 shrink-0" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            <button type="button" onClick={signOut} className="flex h-8 w-full items-center rounded-[10px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-ink/[0.04] hover:text-ink">{t("Sign out", "Keluar")}</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** usePathname suspends on prerendered routes, so the assistant gets its own boundary too. */
function AssistantLive() {
  const path = usePathname();
  return (
    <>
      <Assistant path={path} />
      <TourHost path={path} />
    </>
  );
}

function Tip({ on, label, children }: { on: boolean; label: string; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={10} className="z-50 rounded-[8px] bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type SideProps = { machines: SideMachine[]; urgent: number; taDays: number; taDate: string; abPct: number; asOf: string; onSearch: () => void };

/** usePathname suspends on prerendered routes, so the live sidebar sits in its own boundary. */
function SidebarLive(props: SideProps) {
  return <Sidebar {...props} path={usePathname()} />;
}

function Sidebar({ machines, urgent, taDays, taDate, abPct, asOf, onSearch, path }: SideProps & { path: string }) {
  const [mini, setMini] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("sk-side") === "1") setMini(true);
    } catch {
      /* the default width is fine */
    }
  }, []);
  const toggle = () => {
    const n = !mini;
    setMini(n);
    try {
      localStorage.setItem("sk-side", n ? "1" : "0");
    } catch {
      /* not remembered this time */
    }
  };
  const row = "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors duration-150";
  const planted = path === "/" || path.startsWith("/plant");
  return (
    <Tooltip.Provider delayDuration={120}>
      <aside className={cn("sticky top-0 z-30 flex h-dvh shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 ease-out-expo", mini ? "w-[68px]" : "w-[248px]")}>
        <div className={cn("flex h-16 shrink-0 items-center gap-2.5 px-4", mini && "justify-center px-0")}>
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={BRAND}>
            <BrandMark className="h-8 w-8 shrink-0" />
            {!mini && <span className="truncate text-[16px] font-semibold tracking-[-0.01em]">{BRAND}</span>}
          </Link>
          {!mini && (
            <button type="button" onClick={toggle} aria-label={t("Collapse the sidebar", "Ciutkan bilah samping")} className="ml-auto grid h-7 w-7 place-items-center rounded-[8px] text-ink-3 transition-colors hover:bg-ink/[0.05] hover:text-ink">
              <ChevronsLeft aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
        {mini && (
          <button type="button" onClick={toggle} aria-label={t("Expand the sidebar", "Bentangkan bilah samping")} className="mx-auto mb-1 grid h-7 w-7 place-items-center rounded-[8px] text-ink-3 transition-colors hover:bg-ink/[0.05] hover:text-ink">
            <ChevronsRight aria-hidden className="h-4 w-4" />
          </button>
        )}

        <div className="px-3">
          <Tip on={mini} label={t("Find a part", "Cari suku cadang")}>
            <button type="button" onClick={onSearch} aria-label={t("Find a part", "Cari suku cadang")} className={cn("flex h-9 w-full items-center gap-2 rounded-[10px] border border-line bg-panel-2 text-[13px] text-ink-3 transition-colors hover:border-line-2 hover:text-ink", mini ? "justify-center" : "px-2.5")}>
              <Search aria-hidden className="h-4 w-4 shrink-0" />
              {!mini && (
                <>
                  {t("Find a part", "Cari suku cadang")}
                  <kbd className="ml-auto rounded-[5px] border border-line px-1.5 font-sans text-[10.5px]">Ctrl K</kbd>
                </>
              )}
            </button>
          </Tip>
        </div>

        <nav data-tour="nav" aria-label={t("Main", "Utama")} className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {!mini && <div className="mb-1 px-2.5 text-[11px] font-medium text-ink-3">{t("Are we ready?", "Apakah kita siap?")}</div>}
          <Tip on={mini} label={t("Plant map", "Peta kilang")}>
            <Link href="/" aria-current={path === "/" ? "page" : undefined} className={cn(row, mini && "justify-center px-0", path === "/" ? "bg-accent-soft font-medium text-ink" : planted ? "font-medium text-ink hover:bg-ink/[0.04]" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink")}>
              <Factory aria-hidden className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
              {!mini && t("Plant map", "Peta kilang")}
            </Link>
          </Tip>
          <ul className={cn("m-0 mt-1 list-none space-y-0.5 p-0", !mini && "ml-[18px] border-l border-line pl-2")}>
            {machines.map((m) => {
              const on = path === `/plant/${m.slug}`;
              return (
                <li key={m.slug}>
                  <Tip on={mini} label={t(`${m.name}: ${m.short} short`, `${m.name}: ${m.short} kurang`)}>
                    <Link href={`/plant/${m.slug}`} aria-current={on ? "page" : undefined} className={cn("flex h-9 items-center gap-2 rounded-[10px] px-1.5 text-[13px] transition-colors duration-150", mini && "justify-center px-0", on ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/machines/${m.slug}.png`} alt="" className="h-7 w-7 shrink-0 rounded-[7px] object-cover" />
                      {!mini && (
                        <>
                          <span className="min-w-0 flex-1 truncate">{m.name}</span>
                          <span className={cn("rounded-[6px] px-1.5 text-[11.5px] font-medium leading-[18px] tabular-nums", on ? "bg-white text-ink" : "bg-act-soft text-act-ink")}>{m.short}</span>
                        </>
                      )}
                    </Link>
                  </Tip>
                </li>
              );
            })}
          </ul>

          {groups().map((g) => (
          <div key={g.title}>
          {!mini && <div className="mb-1 mt-4 px-2.5 text-[11px] font-medium text-ink-3">{g.title}</div>}
          <ul className={cn("m-0 list-none space-y-0.5 p-0", mini && "mt-3 border-t border-line pt-3")}>
            {g.items.map((n) => {
              const on = path.startsWith(n.href) || (n.href === "/todo" && path.startsWith("/parts"));
              return (
                <li key={n.href}>
                  <Tip on={mini} label={n.label}>
                    <Link href={n.href} aria-current={on ? "page" : undefined} className={cn(row, "relative", mini && "justify-center px-0", on ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink")}>
                      <n.icon aria-hidden className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                      {!mini && <span className="min-w-0 flex-1 truncate">{n.label}</span>}
                      {n.href === "/todo" && urgent > 0 && (mini ? <i aria-label={t(`${urgent} urgent`, `${urgent} mendesak`)} className="absolute right-3 top-2 h-2 w-2 rounded-full bg-act" /> : <span className={cn("rounded-[6px] px-1.5 text-[11.5px] font-medium leading-[18px] tabular-nums", on ? "bg-white text-act-ink" : "bg-act-soft text-act-ink")}>{urgent}</span>)}
                    </Link>
                  </Tip>
                </li>
              );
            })}
          </ul>
          </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-line p-3">
          <Tip on={mini} label={t("Tutorial", "Panduan")}>
            <button type="button" onClick={() => window.dispatchEvent(new Event("sk-tour"))} aria-label={t("Tutorial", "Panduan")} className={cn(row, "w-full text-ink-2 hover:bg-ink/[0.04] hover:text-ink", mini && "justify-center px-0")}>
              <CircleHelp aria-hidden className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
              {!mini && t("Tutorial", "Panduan")}
            </button>
          </Tip>
          <div data-tour="role"><Account mini={mini} /></div>
          {mini ? (
            <Tip on label={t(`Turnaround in ${taDays} days, ${taDate}`, `Turnaround ${taDays} hari lagi, ${taDate}`)}>
              <Link href="/" className="mx-auto grid h-10 w-10 place-items-center rounded-[10px] bg-panel-2 text-[13px] font-semibold tabular-nums">{Math.max(0, taDays)}</Link>
            </Tip>
          ) : (
            <Link href="/" title={t(`Data as of ${asOf}. Dummy case data from CALIBER 2026.`, `Data per ${asOf}. Data kasus fiktif dari CALIBER 2026.`)} className="block rounded-[12px] bg-panel-2 p-3 transition-colors hover:bg-ink/[0.04]">
              <div className="flex items-center justify-between text-[12px] text-ink-3">
                <span className="inline-flex items-center gap-1.5"><CalendarClock aria-hidden className="h-3.5 w-3.5" />{t("Turnaround", "Turnaround")}</span>
                <span>{taDate}</span>
              </div>
              <div className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] tabular-nums">{Math.max(0, taDays)} {t("days", "hari")}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]" role="img" aria-label={t(`A and B parts ${abPct}% ready`, `Suku cadang A dan B ${abPct}% siap`)}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${abPct}%` }} />
              </div>
              <div className="mt-1 text-[11.5px] text-ink-3">{t(`A and B parts ${abPct}% ready`, `Suku cadang A dan B ${abPct}% siap`)}</div>
            </Link>
          )}
        </div>
      </aside>
    </Tooltip.Provider>
  );
}

export function Shell({ children, asOf, taDays, taDate, urgent, machines, abPct }: { children: ReactNode; asOf: string; taDays: number; taDate: string; urgent: number; machines: SideMachine[]; abPct: number }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const side = { machines, urgent, taDays, taDate, abPct, asOf, onSearch: () => setSearchOpen(true) };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<Sidebar {...side} path="" />}>
        <SidebarLive {...side} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1480px] justify-end px-6 pt-4">
          <LangToggle />
        </div>
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-6 pb-6 pt-2">{children}</main>
        <footer className="mx-auto w-full max-w-[1480px] px-6 pb-6 text-[12px] text-ink-3">
          {t(
            `Data as of ${asOf} · Dummy case data from CALIBER 2026 · Task changes go to a temporary SQLite demo database`,
            `Data per ${asOf} · Data kasus fiktif dari CALIBER 2026 · Perubahan tugas disimpan di basis data SQLite demo sementara`,
          )}
        </footer>
      </div>
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      <Suspense><AssistantLive /></Suspense>
    </div>
  );
}

type Hit = { material_no: number; description: string; criticality: Crit; action: Action; stock: number; unit: string };

function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          setHits(d.results);
          setIdx(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const shown = q.trim().length < 2 ? [] : hits;
  const go = (h: Hit) => {
    onClose();
    router.push(`/parts/${h.material_no}`);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("Find a part", "Cari suku cadang")}>
      <button type="button" aria-label={t("Close", "Tutup")} onClick={onClose} className="absolute inset-0 bg-ink/25" />
      <div className="absolute left-1/2 top-[10vh] w-[min(580px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-line bg-panel shadow-float">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] text-ink-3" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(shown.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && shown[idx]) go(shown[idx]);
            }}
            placeholder={t("Gasket, bearing 6216, or 4100000142", "Gasket, bearing 6216, atau 4100000142")}
            aria-label={t("Part name or material number", "Nama suku cadang atau nomor material")}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-4"
          />
          <button type="button" onClick={onClose} aria-label={t("Close search", "Tutup pencarian")} className="grid h-8 w-8 place-items-center rounded-[8px] text-ink-3 hover:bg-ink/[0.05]">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="max-h-[56vh] overflow-y-auto p-2">
          {q.trim().length < 2 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">{t("Type a part name or number.", "Ketik nama atau nomor suku cadang.")}</li>}
          {q.trim().length >= 2 && shown.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">{t(`No part matches “${q}”.`, `Tidak ada suku cadang yang cocok dengan “${q}”.`)}</li>}
          {shown.map((h, i) => (
            <li key={h.material_no}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={cn("flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left", i === idx && "bg-ink/[0.05]")}>
                <CritTile crit={h.criticality} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{partName(h.description)}</span>
                  <span className="block text-[11.5px] text-ink-3">
                    {t(`Part no. ${h.material_no} · ${amount(h.stock, h.unit)} on the shelf`, `No. part ${h.material_no} · ${amount(h.stock, h.unit)} di rak`)}
                  </span>
                </span>
                <Chip status={ACTION_STATUS[h.action]} label={ACTION_VERB[h.action]} />
                <ArrowRight className="h-4 w-4 text-ink-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
