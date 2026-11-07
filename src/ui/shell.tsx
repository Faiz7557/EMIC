import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, ChartColumn, ChevronsLeft, ChevronsRight, CircleHelp, Clock3, Cpu, FlaskConical, Menu, Play, RotateCcw, ShieldCheck, SlidersHorizontal, VolumeX, X } from "lucide-react";
import { routes, type RoutePath } from "../routes";
import { copy } from "../data/copy";
import { CLAIMS } from "../data/claims";
import { useSim } from "../store/sim-store";
import { ClaimTag } from "./claim-tag";
import { cn } from "./ui";
import { Tour } from "./tour";

const navIcons = { "/": AudioLines, "/dasbor": ChartColumn, "/alat": Cpu, "/batas-audio": VolumeX, "/ambang": SlidersHorizontal, "/bukti": ShieldCheck };
const groups = ["Apa yang terjadi?", "Apa alatnya?", "Bisakah dipercaya?"] as const;

function BrandMark() {
  return <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
    <rect width="32" height="32" rx="9" fill="var(--ink)" />
    <g fill="none" strokeLinecap="round" strokeWidth="1.8">
      <path d="M5 13a13 13 0 0 1 22 0" stroke="#a8ded2" />
      <path d="M9 16a8 8 0 0 1 14 0M13 19a3.5 3.5 0 0 1 6 0" stroke="white" />
    </g><circle cx="16" cy="23" r="2" fill="white" />
  </svg>;
}

function SimulationBadge() {
  return <span className="simulation-badge"><FlaskConical size={14} aria-hidden="true" />SIMULASI</span>;
}

function Navigation({ path, mini = false, onNavigate }: { path: RoutePath; mini?: boolean; onNavigate?: () => void }) {
  return <nav aria-label="Navigasi utama" className="navigation">
    {groups.map((group) => <div className="nav-group" key={group}>
      <p className={cn("nav-group-title", mini && "sr-only")}>{group}</p>
      {routes.filter((route) => route.group === group).map((route) => {
        const Icon = navIcons[route.path];
        return <a key={route.path} href={`#${route.path}`} onClick={onNavigate} aria-current={path === route.path ? "page" : undefined}
          aria-label={mini ? route.label : undefined} title={mini ? route.label : undefined} className="nav-link">
          <Icon size={18} aria-hidden="true" /><span className={mini ? "sr-only" : undefined}>{route.label}</span>
        </a>;
      })}
    </div>)}
  </nav>;
}

function SessionCard({ mini = false }: { mini?: boolean }) {
  const { state } = useSim();
  const elapsed = Math.floor(state.nowMs / 1000) + state.cfg.startClockMin * 60;
  const time = [Math.floor(elapsed / 3600) % 24, Math.floor(elapsed / 60) % 60, elapsed % 60].map((part) => String(part).padStart(2, "0")).join(":");
  const count = state.log.filter((entry) => entry.kind === "BATUK").length;
  if (mini) return <div className="session-mini" title={`Jam simulasi ${time}. ${count} kejadian. Audio keluar ${state.counters.audioBytesOut} byte.`}>
    <Clock3 size={18} aria-hidden="true" /><span className="sr-only">Sesi ini: {time}, {count} kejadian, audio keluar {state.counters.audioBytesOut} byte.</span>
  </div>;
  return <section className="session-card" aria-label="Sesi simulasi">
    <div className="session-heading"><Clock3 size={14} aria-hidden="true" /><span>Sesi ini</span></div>
    <p className="session-time"><time>{time}</time><span>Jam simulasi</span></p>
    <dl className="session-counts"><div><dt>Kejadian batuk</dt><dd>{count}</dd></div>
      <div><dt>Audio keluar</dt><dd>{state.counters.audioBytesOut} byte</dd></div>
    </dl>
    <ClaimTag claim={CLAIMS.audioOut} /><p className="session-note">Dirancang; menunggu audit.</p>
  </section>;
}

export function Shell({ children, path, demoRequested = false }: { children: ReactNode; path: RoutePath; demoRequested?: boolean }) {
  const { reset } = useSim();
  const [mini, setMini] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const startDemo = () => { setDemoDismissed(true); window.location.hash = "#/"; setDemoOpen(true); };
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => { drawer.current?.close(); };

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (media.matches) drawer.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  return <div className={cn("app-shell", mini && "sidebar-mini")}>
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); document.getElementById("main-content")?.focus();
    }}>Langsung ke isi</a>
    <aside className="sidebar" aria-label="Menu SUAR">
      <a href="#/" className="brand" aria-label="SUAR, Ruang tunggu"><BrandMark />{!mini && <span>SUAR</span>}</a>
      {!mini && <p className="brand-slogan">{copy.slogan}</p>}
      <Navigation path={path} mini={mini} />
      <div className="sidebar-bottom"><SessionCard mini={mini} />
        <button className="sidebar-toggle" type="button" onClick={() => setMini(!mini)} aria-expanded={!mini}
          aria-label={mini ? "Perluas menu" : "Perkecil menu"} title={mini ? "Perluas menu" : "Perkecil menu"}>
          {mini ? <ChevronsRight size={18} aria-hidden="true" /> : <><ChevronsLeft size={18} aria-hidden="true" /><span>Perkecil menu</span></>}
        </button>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <button ref={menuButton} type="button" className="icon-button mobile-menu" aria-label="Buka menu navigasi" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="mobile-navigation"
          onClick={() => { drawer.current?.showModal(); setDrawerOpen(true); }}><Menu size={20} aria-hidden="true" /></button>
        <span className="topbar-label">SUAR Simulator</span><SimulationBadge />
      </header>
      <div className="content-wrap">
        <div className="global-actions">
          <details className="glossary" onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}><summary><CircleHelp size={15} aria-hidden="true" />Kamus</summary>
            <div className="glossary-content"><dl>
              <dt>Zona</dt><dd>Area ruang tunggu yang diamati satu simpul.</dd>
              <dt>Simpul</dt><dd>Alat fisik yang menghitung batuk per zona.</dd>
              <dt>Pager</dt><dd>Alat pemberi sinyal kepada petugas.</dd>
              <dt>Metadata</dt><dd>Catatan zona, waktu, level, dan status.</dd>
            </dl></div>
          </details>
          <button className="button button-quiet" type="button" onClick={reset}><RotateCcw size={15} aria-hidden="true" />Reset</button>
        </div>
        {path === "/" && demoRequested && !demoDismissed && <div className="demo-offer">
          <p>Lihat SUAR bekerja dalam 1 menit</p>
          <p>Enam langkah untuk mencoba alur SUAR. Demo dimulai dari keadaan reset.</p>
          <div className="page-actions"><button type="button" className="button" onClick={startDemo}>Mulai</button>
            <button type="button" className="button button-quiet" onClick={() => setDemoDismissed(true)}>Jelajahi sendiri</button></div>
        </div>}
        {children}
        <footer className="app-footer">{copy.footer}</footer>
      </div>
      <div className="demo-placeholder">
        <button className="demo-button" type="button" onClick={startDemo}><Play size={16} aria-hidden="true" />Demo 1 menit</button>
        {demoOpen && path === "/" && <Tour onClose={() => setDemoOpen(false)} />}
      </div>
    </div>
    <dialog id="mobile-navigation" className="mobile-drawer" ref={drawer} aria-label="Menu navigasi SUAR" onClose={() => { setDrawerOpen(false); menuButton.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
      <div className="drawer-content"><div className="drawer-top"><SimulationBadge /><button autoFocus type="button" className="icon-button" aria-label="Tutup menu" onClick={closeDrawer}><X size={20} aria-hidden="true" /></button></div>
        <a href="#/" className="brand" onClick={closeDrawer}><BrandMark /><span>SUAR</span></a><p className="brand-slogan">{copy.slogan}</p>
        <Navigation path={path} onNavigate={closeDrawer} /><SessionCard />
      </div>
    </dialog>
  </div>;
}
