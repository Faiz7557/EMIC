import { CLAIMS } from "../data/claims";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

/** T02 route stub. Interactive room is implemented by its own work order. */
export default function Ruang() {
  return <>
    <PageHead title="Apa yang terjadi saat seseorang batuk?" answer={<>Pada pasien median, rancangan dua tingkat memberi sinyal pada <Em>{CLAIMS.anySignal.tampil}</Em> <ClaimTag claim={CLAIMS.anySignal} /> dan memanggil petugas pada <Em>{CLAIMS.captureTier2.tampil}</Em> <ClaimTag claim={CLAIMS.captureTier2} />, dengan <Em>{CLAIMS.falseAlarmTier2.tampil}</Em> alarm palsu per jam per ruang <ClaimTag claim={CLAIMS.falseAlarmTier2} />. Hasil simulasi, belum diukur.</>} />
    <Panel className="stub-panel hall-mesh"><PanelHead title="Ruang tunggu" />
      <div className="panel-body stub-body"><p>Peragaan ruang tunggu akan tersedia pada tahap berikutnya.</p><p className="muted">Sinyal pertama mengajak mengambil masker. Sinyal kedua memanggil petugas.</p></div>
    </Panel>
  </>;
}
