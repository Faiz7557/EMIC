import { copy } from "../data/copy";
import { PageHead, Panel, PanelHead } from "../ui/ui";

export default function Bukti() {
  return <>
    <PageHead title="Seberapa kuat buktinya?" answer={copy.mandatory} />
    <Panel className="stub-panel"><PanelHead title="Status bukti" /><div className="panel-body stub-body"><p>Tabel janji, gerbang uji, dan asumsi rancangan akan tersedia pada tahap berikutnya.</p><p className="muted">Belum ada hasil uji perangkat pada fondasi ini.</p></div></Panel>
  </>;
}
