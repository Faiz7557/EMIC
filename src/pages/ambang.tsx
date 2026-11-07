import { CLAIMS } from "../data/claims";
import { copy } from "../data/copy";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

export default function Ambang() {
  return <>
    <PageHead title="Kenapa dua tingkat?" answer={<>Pada pasien median, ambang ≥3/10 menangkap <Em>{CLAIMS.captureOld.tampil}</Em> <ClaimTag claim={CLAIMS.captureOld} />, sedangkan ambang ≥2/15 menangkap <Em>{CLAIMS.captureTier2.tampil}</Em> <ClaimTag claim={CLAIMS.captureTier2} />.</>} />
    <Panel className="stub-panel"><PanelHead title="Uji ambang" /><div className="panel-body stub-body"><p>Kontrol ambang dan grafik perbandingan akan tersedia pada tahap berikutnya.</p></div></Panel>
    <p className="page-note">{copy.modelLimit}</p>
  </>;
}
