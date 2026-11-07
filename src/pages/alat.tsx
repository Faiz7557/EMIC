import { useEffect, useState } from "react";
import { Box, Radio } from "lucide-react";
import { bom, bomTotals, type BomItem } from "../data/bom";
import { CLAIMS } from "../data/claims";
import type { Claim } from "../data/claims";
import { copy } from "../data/copy";
import { DeviceStage, type DevicePart } from "../three/DeviceStage";
import type { DeviceKind, DevicePartId } from "../three/device";
import { ClaimTag } from "../ui/claim-tag";
import { Em, PageHead, Panel, PanelHead } from "../ui/ui";

interface Part extends DevicePart { function: string; bomIds: readonly BomItem["id"][] }
const parts: Record<DeviceKind, readonly Part[]> = {
  simpul: [
    { id: "cover", label: "Penutup depan", function: "Difuser membuat cahaya cincin terbaca dari berbagai arah. Tombol berada di tengah, dan lubang akustik melindungi mikrofon dari sentuhan. Biaya casing mencakup penutup depan dan casing belakang, dihitung sekali per simpul.", bomIds: ["node-case", "connectors"] },
    { id: "led", label: "Cincin WS2812", function: "Dua belas LED memperagakan status zona. Cahaya menandai zona agar petugas dapat menawarkan masker kepada seluruh zona.", bomIds: ["led"] },
    { id: "inmp441", label: "INMP441", function: "Mikrofon digital I2S menghadap lubang akustik. Pada rancangan fisik, sinyal diteruskan ke pemrosesan lokal. Simulator tidak memakai mikrofon dan tidak mendeteksi batuk sungguhan.", bomIds: ["inmp441"] },
    { id: "esp32-s3", label: "ESP32-S3-DevKitC-1", function: "Papan pengendali untuk inferensi lokal dan komunikasi metadata. Simpul A juga menjadi koordinator. Model ini menunjukkan susunan konsep, bukan PCB yang telah dirakit.", bomIds: ["esp32-s3"] },
    { id: "rear", label: "Casing belakang", function: "Casing PLA menyediakan dudukan dan lubang USB. Estimasi ±100 g mencakup seluruh casing simpul, termasuk penutup depan; biayanya dihitung sekali.", bomIds: ["node-case"] },
  ],
  pager: [
    { id: "pager-board", label: "Pengendali, getar, dan LED", function: "ESP32-C3 menerima peringatan. Motor getar dan empat LED berlabel A sampai D menunjukkan zona. Titik pada casing adalah rujukan komponen di dalam pager.", bomIds: ["pager-board"] },
    { id: "battery", label: "Baterai dan pengisi daya", function: "Li-Po 1000 mAh dengan modul TP4056 memasok daya pager dan dapat diisi melalui USB. Letak komponen di dalam casing bersifat ilustratif.", bomIds: ["battery"] },
    { id: "pager-case", label: "Casing dan tombol", function: "Badan 70 × 44 × 18 mm memiliki klip saku dan tombol besar ditangani. Halaman ini memperlihatkan rancangan alat; peragaan tombol petugas tersedia di Ruang tunggu.", bomIds: ["pager-case"] },
  ],
};
const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const costs = [
  { label: "Estimasi per simpul", value: bomTotals.node, note: "Satu simpul zona", id: "node" },
  { label: "Estimasi per pager", value: bomTotals.pager, note: "Satu pager petugas", id: "pager" },
  { label: "Estimasi per paket", value: bomTotals.kit, note: "Empat simpul dan satu pager", id: "kit" },
] as const;

export default function Alat() {
  const [kind, setKind] = useState<DeviceKind>("simpul");
  const [selected, setSelected] = useState<DevicePartId | null>(null);
  const current = parts[kind].find((part) => part.id === selected);
  const select = (id: DevicePartId) => setSelected((value) => value === id ? null : id);
  const changeKind = (next: DeviceKind) => { setKind(next); setSelected(null); };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  return <>
    <PageHead title="Apa isi alatnya?" answer={<>SUAR adalah alat fisik. Satu simpul berisi lima lapis dan biaya komponennya sekitar <Em>{CLAIMS.nodeCost.tampil}</Em> <ClaimTag claim={CLAIMS.nodeCost} />. {copy.concept}</>} />
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
      <Panel>
        <PanelHead title="Simpul dan pager" icon={Box} />
        <div className="panel-body">
          <div role="group" aria-label="Pilih perangkat" className="mb-4 flex flex-wrap gap-2">
            <button type="button" className={`button${kind === "simpul" ? "" : " button-quiet"}`} aria-pressed={kind === "simpul"} onClick={() => changeKind("simpul")}>Simpul</button>
            <button type="button" className={`button${kind === "pager" ? "" : " button-quiet"}`} aria-pressed={kind === "pager"} onClick={() => changeKind("pager")}>Pager</button>
          </div>
          <DeviceStage kind={kind} parts={parts[kind]} selected={selected} onSelect={select} />
        </div>
      </Panel>
      <Panel>
        <PanelHead title={kind === "simpul" ? "Lima lapis simpul" : "Komponen pager"} icon={Radio} />
        <div className="panel-body">
          <p className="muted text-[13px]">Pilih nomor pada model atau daftar berikut untuk melihat fungsi dan estimasi biaya.</p>
          <ol className="m-0 grid list-none gap-2 p-0" aria-label={kind === "simpul" ? "Urutan lapisan dari depan ke belakang" : "Rujukan komponen pager"}>
            {parts[kind].map((part, index) => <li key={part.id}>
              <button type="button" className={`button w-full !justify-start !text-left${selected === part.id ? "" : " button-quiet"}`} aria-pressed={selected === part.id} aria-controls="device-part-detail" onClick={() => select(part.id)}>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current" aria-hidden="true">{index + 1}</span>{part.label}
              </button>
            </li>)}
          </ol>
          <div id="device-part-detail" role="region" aria-label="Detail komponen" aria-live="polite" className="mt-5 border-t border-line-2 pt-4">
            {current ? <>
              <div className="mb-2 flex items-start justify-between gap-3"><h3 className="m-0 text-[15px] font-semibold">{current.label}</h3><button type="button" className="button button-quiet shrink-0" onClick={() => setSelected(null)}>Tutup detail</button></div>
              <p className="text-[13px] text-ink-2">{current.function}</p>
              <dl className="m-0 text-[13px]">{bom.filter((item) => current.bomIds.includes(item.id)).map((item) => <div key={item.id} className="mb-3">
                <dt>{item.komponen}</dt><dd className="m-0"><strong>{rupiah(item.harga)}</strong> · estimasi komponen, {item.sumber}</dd>
              </div>)}</dl>
              <p className="muted !mb-0 text-xs">Sumber: proposal, gambar casing dan Lampiran C.</p>
            </> : <p className="muted !mb-0 text-[13px]">Belum ada komponen dipilih.</p>}
          </div>
        </div>
      </Panel>
    </div>
    <Panel>
      <PanelHead title="Berapa estimasi biaya komponennya?" />
      <div className="panel-body">
        <dl className="m-0 grid grid-cols-1 gap-5 md:grid-cols-3">{costs.map((cost) => {
          const claim: Claim = { id: `device-cost-${cost.id}`, tampil: rupiah(cost.value), nilai: cost.value, status: "terhitung", sumber: "Proposal · Lampiran C · estimasi biaya komponen, belum termasuk ongkos kirim, PPN, dan perakitan" };
          return <div key={cost.id}>
            <dt className="text-[13px] text-ink-2">{cost.label}</dt>
            <dd className="m-0 mt-1 text-[28px] font-semibold tracking-tight">{rupiah(cost.value)}</dd>
            <dd className="m-0 mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">{cost.note}<ClaimTag claim={claim} /></dd>
          </div>;
        })}</dl>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="pb-3 text-left font-semibold">Lampiran C · rincian estimasi {kind === "simpul" ? "simpul" : "pager"}</caption>
            <thead><tr className="border-b border-line-2"><th scope="col" className="py-2 pr-3 font-medium">Komponen</th><th scope="col" className="py-2 pr-3 font-medium">Jumlah</th><th scope="col" className="py-2 text-right font-medium">Estimasi biaya</th></tr></thead>
            <tbody>{bom.filter((item) => item.perangkat === kind).map((item) => <tr key={item.id} className="border-b border-line">
              <th scope="row" className="py-3 pr-3 font-normal">{item.komponen}<span className="block text-xs text-ink-3">{item.sumber}</span></th>
              <td className="py-3 pr-3">{item.jumlah}</td><td className="whitespace-nowrap py-3 text-right">{rupiah(item.harga * item.jumlah)}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={2} className="pt-3 font-semibold">Total estimasi {kind === "simpul" ? "per simpul" : "per pager"}</th><td className="whitespace-nowrap pt-3 text-right font-semibold">{rupiah(kind === "simpul" ? bomTotals.node : bomTotals.pager)}</td></tr></tfoot>
          </table>
        </div>
        <p className="muted !mb-0 mt-4 text-xs">Estimasi Lampiran C. Belum termasuk ongkos kirim, PPN, dan perakitan. Masker dan papan informasi di luar paket. Casing depan dan belakang dihitung sebagai satu komponen. Harga komponen belum merupakan harga jual alat.</p>
      </div>
    </Panel>
  </>;
}
