import { CLAIMS } from "../data/claims";
import { copy } from "../data/copy";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

export default function BatasAudio() {
  return <>
    <PageHead title="Apa yang keluar dari alat?" answer={<>Audio hidup di memori selama satu detik, lalu ditimpa. Yang keluar hanya paket <Em>{CLAIMS.packetSize.tampil}</Em> <ClaimTag claim={CLAIMS.packetSize} />. Rancangan ini menunggu audit.</>} />
    <Panel className="stub-panel"><PanelHead title="Batas audio" /><div className="panel-body stub-body"><p>Peragaan pipa pemrosesan dan pemeriksa paket akan tersedia pada tahap berikutnya.</p></div></Panel>
    <p className="page-note">{copy.audioNote}</p>
  </>;
}
