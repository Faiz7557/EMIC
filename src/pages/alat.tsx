import { CLAIMS } from "../data/claims";
import { copy } from "../data/copy";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

export default function Alat() {
  return <>
    <PageHead title="Apa isi alatnya?" answer={<>SUAR adalah alat fisik. Satu simpul berisi lima lapis dan biaya komponennya sekitar <Em>{CLAIMS.nodeCost.tampil}</Em> <ClaimTag claim={CLAIMS.nodeCost} />. {copy.concept}</>} />
    <Panel className="stub-panel"><PanelHead title="Simpul dan pager" /><div className="panel-body stub-body"><p>Rincian komponen dan render konsep akan tersedia pada tahap berikutnya.</p></div></Panel>
  </>;
}
