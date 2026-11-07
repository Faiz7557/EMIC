import { copy } from "../data/copy";
import { PageHead, Panel, PanelHead } from "../ui/ui";

export default function Dasbor() {
  return <>
    <PageHead title="Apa yang dilihat pengelola?" answer="Dasbor menampilkan hitungan agregat per zona dan waktu respons petugas." />
    <Panel className="stub-panel"><PanelHead title="Sesi ini" />
      <div className="panel-body stub-body"><p>{copy.emptyDashboard}</p><a href="#/">Buka Ruang tunggu</a><p className="muted">Dasbor interaktif akan tersedia pada tahap berikutnya.</p></div>
    </Panel><p className="page-note">{copy.privacy}</p>
  </>;
}
