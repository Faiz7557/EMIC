import { copy } from "../data/copy";
import { CLAIM_STATUSES, CLAIM_STATUS_LABEL, type ClaimStatus } from "../data/claims";
import { assumptions, gates, promises } from "../data/gates";
import { ClaimTag } from "../ui/claim-tag";
import { PageHead, Panel, PanelHead } from "../ui/ui";

const meanings: Record<ClaimStatus, string> = {
  terhitung: "Hasil perhitungan dari datasheet dan estimasi; belum diukur.",
  tersimulasi: "Hasil simulasi atau model; bukan hasil uji perangkat.",
  target: "Sasaran rancangan yang belum diukur.",
  dirancang: "Sifat rancangan yang menunggu audit.",
  asumsi: "Keputusan simulator yang tidak dirinci proposal.",
  ilustratif: "Tampilan contoh tanpa nilai bukti.",
};

export default function Bukti() {
  return <>
    <PageHead title="Seberapa kuat buktinya?" answer={copy.mandatory} />
    <Panel>
      <PanelHead title="Janji dan status bukti hari ini" />
      <div className="panel-body">
        <p>Belum ada baris yang berstatus terukur. Status berikut mengikuti Tabel janji pada Bab VI proposal.</p>
        <div className="overflow-x-auto" role="region" aria-label="Tabel janji proposal" tabIndex={0}>
          <table className="w-full min-w-[620px] text-left">
            <caption className="sr-only">Enam janji, ukuran pembukti, dan status hari ini dari Bab VI proposal</caption>
            <thead><tr>{["Janji kepada pengguna", "Ukuran pembukti", "Status hari ini"].map((title) => <th key={title} scope="col" className="p-3 align-top">{title}</th>)}</tr></thead>
            <tbody>{promises.map((promise) => <tr key={promise.janji} className="border-t border-line">
              <th scope="row" className="p-3 align-top font-medium">{promise.janji}</th>
              <td className="p-3 align-top">{promise.ukuran}</td>
              <td className="p-3 align-top">{promise.bukti}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="page-note">Sumber: proposal Bab VI, “Janji, ukuran pembukti, dan status buktinya hari ini”.</p>
      </div>
    </Panel>
    <Panel>
      <PanelHead title="Empat gerbang uji" />
      <div className="panel-body space-y-6">
        <p>Semua kriteria adalah target. Bila satu gerbang gagal, tahap berikutnya berhenti sampai sebabnya ditangani.</p>
        {gates.map((gate) => <article key={gate.id} className="border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="m-0 text-base font-semibold">{gate.id} · {gate.title}</h3>
            <span className="chip bg-idle-soft text-idle-ink">Belum dijalankan</span>
            <ClaimTag claim={{ id: gate.id, tampil: gate.kriteria, status: gate.status, sumber: gate.sumber, nilai: 0 }} />
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr]">
            <dt className="font-medium">Pengujian</dt><dd className="m-0">{gate.uji}</dd>
            <dt className="font-medium">Kriteria lulus</dt><dd className="m-0">{gate.kriteria}</dd>
            <dt className="font-medium">Bila gagal</dt><dd className="m-0">{gate.bilaGagal}</dd>
          </dl>
        </article>)}
        <p className="page-note">Sumber: proposal Bab V, tabel gerbang. Simulator tidak menjalankan pengujian perangkat ini.</p>
      </div>
    </Panel>
    <Panel>
      <PanelHead title="Arti label status" />
      <dl className="panel-body m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[150px_1fr]">
        {CLAIM_STATUSES.map((status) => <div key={status} className="contents">
          <dt><ClaimTag claim={{ id: `legenda-${status}`, tampil: CLAIM_STATUS_LABEL[status], status, sumber: "docs/PRD.md · §8 · Aturan kejujuran", nilai: 0 }} /></dt>
          <dd className="m-0">{meanings[status]}</dd>
        </div>)}
      </dl>
    </Panel>
    <Panel>
      <PanelHead title="Asumsi simulator A1 sampai A6" />
      <div className="panel-body space-y-5">
        {assumptions.map((assumption) => <article key={assumption.id}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-semibold">{assumption.id} · {assumption.title}</h3>
            <ClaimTag claim={{ id: assumption.id, tampil: assumption.isi, status: assumption.status, sumber: assumption.sumber, nilai: 0 }} />
          </div>
          <p className="mt-2">{assumption.isi}</p>
          <p className="muted">Tindak lanjut: {assumption.tindakLanjut}.</p>
        </article>)}
        <p className="page-note">Sumber: PRD §10; rancangan terkait pada proposal Bab III dan Lampiran D.</p>
      </div>
    </Panel>
    <Panel>
      <PanelHead title="Apa yang tidak dibuktikan simulator?" />
      <div className="panel-body">
        <ul className="m-0 list-disc space-y-2 pl-5">
          <li>Deteksi batuk nyata, sensitivitas, dan alarm palsu model TinyML. Simulator tidak memiliki audio atau input mikrofon.</li>
          <li>Atribusi zona di ruangan bergema. Model medan bebas belum memasukkan gema; penempatan simpul perlu diuji.</li>
          <li>Latensi, keandalan radio, pemulihan gangguan, konsumsi daya, dan biaya rakit alat fisik.</li>
          <li>Privasi firmware perangkat. Klaim 0 byte audio keluar masih dirancang dan menunggu audit.</li>
          <li>Respons petugas, kepatuhan masker, dan manfaat klinis nyata. Dosis relatif termodelkan bukan penurunan kasus TBC.</li>
        </ul>
        <p className="mt-4">{copy.modelLimit}</p>
        <p className="page-note">Rujukan: proposal Bab III (rancangan dan model), Bab IV (anggaran dan manfaat), Bab V (pengujian), Bab VI (status janji), serta Lampiran C dan D. Prototipe fisik tetap diperlukan pada tahap final.</p>
      </div>
    </Panel>
  </>;
}
