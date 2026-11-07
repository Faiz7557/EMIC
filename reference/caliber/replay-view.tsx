"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ArrowRight, Pause, Play, Search } from "lucide-react";
import type { ReplayMonth, ReplayPart, ReplayPartName, ReplayProof, ReplayRefresh } from "@/lib/data";
import { cn, monthLabel, num, partName, pct, rp } from "@/lib/format";
import { LimitsHistory } from "./limits-history";
import { AiBrief } from "./ai-brief";
import { CritTile, Em, PageHead, Panel } from "./ui";
import { Hint } from "./hint";
import { t } from "@/lib/i18n";

const COLOR = { today: "#d8402a", sparekit: "#1e8a5a" };
const daysIn = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();

export function ReplayView({ proof, months, refresh, parts, names }: { proof: ReplayProof; months: ReplayMonth[]; refresh: ReplayRefresh[]; parts: ReplayPart[]; names: ReplayPartName[] }) {
  const labels = useMemo(() => Array.from(new Set(months.map((m) => m.month))).sort(), [months]);
  const last = labels.length - 1;
  const [idx, setIdx] = useState(last);
  const [playing, setPlaying] = useState(false);
  const { today, sparekit, once } = proof;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i >= last) {
          setPlaying(false);
          return last;
        }
        return i + 1;
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing, last]);

  const play = () => {
    if (playing) return setPlaying(false);
    if (idx >= last) setIdx(0);
    setPlaying(true);
  };
  const jump = (i: number) => {
    setPlaying(false);
    setIdx(i);
  };

  const upTo = (policy: string, i: number) => {
    const rows = months.filter((m) => m.policy === policy && labels.indexOf(m.month) <= i);
    const days = rows.reduce((a, r) => a + daysIn(r.month), 0);
    const req = rows.reduce((a, r) => a + r.requested, 0);
    return {
      fill: rows.reduce((a, r) => a + r.served, 0) / Math.max(1, req),
      empty: rows.reduce((a, r) => a + r.stockout_days, 0),
      stock: rows.reduce((a, r) => a + r.avg_inv_idr * daysIn(r.month), 0) / Math.max(1, days),
    };
  };

  const curve = labels.map((m, i) => ({
    month: m,
    today: i <= idx ? upTo("today", i).fill * 100 : null,
    sparekit: i <= idx ? upTo("sparekit", i).fill * 100 : null,
  }));
  const rows = [
    { key: "today", label: t("Today's Min and Max", "Min dan Max saat ini"), sub: t("Fixed in SAP", "Tetap di SAP"), ...upTo("today", idx) },
    { key: "sparekit", label: "Sparekit", sub: t("Refreshed monthly", "Diperbarui bulanan"), ...upTo("sparekit", idx) },
  ];
  const month = refresh[idx];
  const later = refresh.slice(1);
  const moveMax = Math.max(1, ...later.map((r) => Math.max(r.min_up, r.min_down)));

  return (
    <div className="space-y-5">
      <PageHead
        title={t("Would it have worked? Play it back", "Apakah akan berhasil? Putar ulang")}
        actions={<AiBrief page="replay" />}
        answer={t(
          <>
            We replayed the real use of March to September 2026. On the {num(sparekit.parts)} critical stocked parts that were used, availability rises from {pct(today.fill_units, 0)} to <Em tone="ready">{pct(sparekit.fill_units, 0)}</Em> and empty-shelf days fall <Em tone="ready">{pct(1 - sparekit.stockout_days / today.stockout_days, 0)}</Em>. Across all {num(proof.stocked)} stocked parts, stock held falls <Em tone="ready">{pct(1 - sparekit.avg_inv_idr / today.avg_inv_idr, 0)}</Em>: money leaves idle parts and goes to the parts that get used.{" "}
            <Hint>Critical means criticality A or B. Non Stock parts are left out, because they are bought per job and an empty shelf is normal for them. Each plan starts with stock at its own Max. On the {num(sparekit.parts)} used parts alone, average stock rises from {rp(proof.measured.today)} to {rp(proof.measured.sparekit)}.</Hint>
          </>,
          <>
            Kami memutar ulang pemakaian riil Maret sampai September 2026. Pada {num(sparekit.parts)} suku cadang kritis yang distok dan terpakai, ketersediaan naik dari {pct(today.fill_units, 0)} menjadi <Em tone="ready">{pct(sparekit.fill_units, 0)}</Em> dan hari rak kosong turun <Em tone="ready">{pct(1 - sparekit.stockout_days / today.stockout_days, 0)}</Em>. Di seluruh {num(proof.stocked)} suku cadang yang distok, stok yang disimpan turun <Em tone="ready">{pct(1 - sparekit.avg_inv_idr / today.avg_inv_idr, 0)}</Em>: uang keluar dari suku cadang yang menganggur dan pindah ke yang benar-benar terpakai.{" "}
            <Hint>Kritis berarti kekritisan A atau B. Suku cadang Non Stock tidak dihitung karena dibeli per pekerjaan, sehingga rak kosong adalah hal normal. Setiap rencana dimulai dengan stok pada Max-nya sendiri. Khusus {num(sparekit.parts)} suku cadang yang terpakai, rata-rata stok naik dari {rp(proof.measured.today)} menjadi {rp(proof.measured.sparekit)}.</Hint>
          </>,
        )}
      />

      <Panel tour="r-time" className="p-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={play} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-2">
            {playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
            {playing ? t("Pause", "Jeda") : t("Play", "Putar")}
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={last}
              step={1}
              value={idx}
              onChange={(e) => jump(Number(e.target.value))}
              aria-label={t("Month of the replay", "Bulan simulasi ulang")}
              aria-valuetext={monthLabel(labels[idx])}
              className="h-2 w-full cursor-pointer accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between">
              {labels.map((m, i) => (
                <button key={m} type="button" onClick={() => jump(i)} className={cn("text-[12px] tabular-nums transition-colors", i === idx ? "font-semibold text-ink" : "text-ink-3 hover:text-ink")}>
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <h2 className="m-0 text-[14px] font-semibold">{t(`From March to the end of ${monthLabel(labels[idx])}`, `Dari Maret sampai akhir ${monthLabel(labels[idx])}`)}</h2>
            <table className="mt-2 w-full border-collapse text-[13px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="py-2 pr-2 font-medium">{t("Stock limits", "Batas stok")}</th>
                  <th className="py-2 pr-2 text-right font-medium">{t("On the shelf when asked", "Tersedia saat diminta")}</th>
                  <th className="py-2 pr-2 text-right font-medium">{t("Empty-shelf days", "Hari rak kosong")}</th>
                  <th className="py-2 text-right font-medium">{t(`Average stock, all ${num(proof.stocked)} stocked parts`, `Rata-rata stok, seluruh ${num(proof.stocked)} suku cadang distok`)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2 font-medium"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[r.key as keyof typeof COLOR] }} />{r.label}</span>
                      <span className="block pl-[18px] text-[12px] text-ink-3">{r.sub}</span>
                    </td>
                    <td className={cn("py-2.5 pr-2 text-right", r.key === "sparekit" ? "text-[22px] font-semibold text-ready-ink" : "text-[16px] font-medium")}>{pct(r.fill, 0)}</td>
                    <td className={cn("py-2.5 pr-2 text-right", r.key === "sparekit" && "font-semibold text-ready-ink")}>{num(r.empty)}</td>
                    <td className={cn("py-2.5 text-right", r.key === "sparekit" && "font-semibold text-ready-ink")}>{rp(r.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="m-0 flex items-center gap-1 text-[14px] font-semibold">{t("Share of requests served, so far", "Porsi permintaan yang terlayani, sejauh ini")}<Hint>{t("Units served from the shelf, as a share of the units asked for since 1 March.", "Unit yang terlayani dari rak, dibagi unit yang diminta sejak 1 Maret.")}</Hint></h2>
            <div className="mt-2 h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgb(30 26 20 / 0.07)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "#6f6f73" }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "#6f6f73" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
                  <Line dataKey="today" stroke={COLOR.today} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="sparekit" stroke={COLOR.sparekit} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Panel>

      <Panel tour="r-refresh" className="p-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <h2 className="m-0 text-[14px] font-semibold">{t("The limits move every month", "Batas stok bergerak setiap bulan")}</h2>
            <p className="m-0 mt-1 text-[13px] leading-[1.5] text-ink-2">{t("On the first of each month the model is retrained on what has happened so far, and new limits are set. It sees nothing after that day.", "Setiap tanggal 1, model dilatih ulang dengan kejadian sampai saat itu, lalu batas baru ditetapkan. Model tidak melihat apa pun setelah tanggal itu.")}</p>
            <div className="mt-3 rounded-[12px] bg-panel-2 px-4 py-3">
              <div className="text-[12px] text-ink-3">{t(`Update of 1 ${monthLabel(labels[idx])}`, `Pembaruan 1 ${monthLabel(labels[idx])}`)}</div>
              <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums">{num(month.changed)} <span className="text-[13px] font-normal text-ink-2">{idx === 0 ? t("stocked parts differ from SAP", "suku cadang stok berbeda dari SAP") : t("stocked parts got new limits", "suku cadang stok mendapat batas baru")}</span></div>
              <div className="mt-1.5 text-[12.5px] tabular-nums text-ink-2">{t(`Min up on ${num(month.min_up)}, down on ${num(month.min_down)}. ${num(month.critical)} are critical. Max across all stocked parts is worth ${rp(month.value_max_idr)}.`, `Min naik pada ${num(month.min_up)}, turun pada ${num(month.min_down)}. ${num(month.critical)} di antaranya kritis. Max seluruh suku cadang stok bernilai ${rp(month.value_max_idr)}.`)}</div>
            </div>
            <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-ink-2">
              {t(
                `Against setting limits once on 1 March, the monthly update leaves ${pct(1 - sparekit.stockout_days / once.stockout_days, 0)} fewer empty-shelf days (${num(sparekit.stockout_days)} against ${num(once.stockout_days)}) for ${pct(sparekit.avg_inv_idr / once.avg_inv_idr - 1, 0)} more stock. Availability stays about the same (${pct(sparekit.fill_units, 1)} against ${pct(once.fill_units, 1)}).`,
                `Dibandingkan menetapkan batas sekali pada 1 Maret, pembaruan bulanan menyisakan ${pct(1 - sparekit.stockout_days / once.stockout_days, 0)} lebih sedikit hari rak kosong (${num(sparekit.stockout_days)} dibandingkan ${num(once.stockout_days)}) dengan stok ${pct(sparekit.avg_inv_idr / once.avg_inv_idr - 1, 0)} lebih banyak. Ketersediaan kurang lebih sama (${pct(sparekit.fill_units, 1)} dibandingkan ${pct(once.fill_units, 1)}).`,
              )}
            </p>
          </div>
          <div>
            <h3 className="m-0 flex flex-wrap items-center gap-3 text-[13px] font-medium text-ink-2">
              {t("Parts whose Min changed from the month before", "Suku cadang yang Min-nya berubah dari bulan sebelumnya")}
              <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-ink-3"><i className="h-2.5 w-2.5 rounded-[3px] bg-plan" />{t("Up", "Naik")}</span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-ink-3"><i className="h-2.5 w-2.5 rounded-[3px] bg-ink-2/60" />{t("Down", "Turun")}</span>
            </h3>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {later.map((r) => {
                const on = labels[idx] === r.month;
                return (
                  <button key={r.month} type="button" onClick={() => jump(labels.indexOf(r.month))} className={cn("rounded-[10px] px-1 py-2 transition-colors", on ? "bg-panel-2 ring-1 ring-line-2" : "hover:bg-ink/[0.03]")}>
                    <div className="flex h-[70px] flex-col items-center justify-end gap-1">
                      <span className="text-[11.5px] font-semibold tabular-nums">{num(r.min_up)}</span>
                      <div className="w-7 rounded-t-[4px] bg-plan" style={{ height: `${Math.max(3, (r.min_up / moveMax) * 46)}px` }} />
                    </div>
                    <div className="mt-px flex h-[70px] flex-col items-center gap-1">
                      <div className="w-7 rounded-b-[4px] bg-ink-2/60" style={{ height: `${Math.max(3, (r.min_down / moveMax) * 46)}px` }} />
                      <span className="text-[11.5px] tabular-nums text-ink-3">{num(r.min_down)}</span>
                    </div>
                    <div className={cn("mt-1 text-[12px]", on ? "font-semibold text-ink" : "text-ink-3")}>{monthLabel(r.month)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      <PartPanel examples={parts} names={names} />

      <Panel className="p-5">
        <h2 className="m-0 text-[14px] font-semibold">{t("What this test assumes", "Asumsi dalam uji ini")}</h2>
        <ul className="m-0 mt-2 grid list-disc grid-cols-1 gap-x-8 gap-y-2 pl-4 text-[13px] leading-[1.5] text-ink-2 lg:grid-cols-2">
          <li>{t(`Stock value turns into cash only when excess leaves the shelf. Each plan here starts at its own Max, as if the excess were already gone. From the shelf on record, availability still rises from ${pct(proof.shelfToday.fill_units, 0)} to ${pct(proof.shelfSparekit.fill_units, 0)}, but stock stays near ${rp(proof.shelfSparekit.avg_inv_idr)} until the excess is returned, moved or written off. The shelf on record was read after these months, so this is a rough guide.`, `Nilai stok baru menjadi uang setelah kelebihannya keluar dari rak. Setiap rencana di sini dimulai pada Max-nya sendiri, seolah kelebihannya sudah hilang. Jika dimulai dari rak yang tercatat, ketersediaan tetap naik dari ${pct(proof.shelfToday.fill_units, 0)} menjadi ${pct(proof.shelfSparekit.fill_units, 0)}, tetapi stok bertahan sekitar ${rp(proof.shelfSparekit.avg_inv_idr)} sampai kelebihannya diretur, dipindahkan, atau dihapus. Catatan rak itu dibaca setelah bulan-bulan ini, jadi angkanya hanya panduan kasar.`)}</li>
          <li>{t(`Non Stock parts keep today's setting here, because they are bought per job. If critical Non Stock parts were kept on the shelf too, availability across all critical parts used would be ${proof.allParts ? pct(proof.allParts.fill_units_AB, 0) : "–"}, with ${proof.allParts ? rp(proof.allParts.avg_inv_idr) : "–"} of stock, on limits set once in March.`, `Suku cadang Non Stock tetap pada pengaturan saat ini karena dibeli per pekerjaan. Jika suku cadang Non Stock kritis juga disimpan di rak, ketersediaan seluruh suku cadang kritis yang terpakai menjadi ${proof.allParts ? pct(proof.allParts.fill_units_AB, 0) : "–"}, dengan stok ${proof.allParts ? rp(proof.allParts.avg_inv_idr) : "–"}, memakai batas yang ditetapkan sekali pada bulan Maret.`)}</li>
          <li>{t(`Availability is measured on the ${num(sparekit.parts)} critical stocked parts that were used. Stock value covers all ${num(proof.stocked)} stocked parts, because cutting limits on idle parts is where the money comes from. On the ${num(sparekit.parts)} used parts alone, average stock rises from ${rp(proof.measured.today)} to ${rp(proof.measured.sparekit)}. Each plan starts full at its own Max, and the March limits were set just after the turnaround, so that stock starts high. Later updates lower the limits, but slow parts use the stock up slowly, so a planner should trim those March orders by hand.`,`Ketersediaan diukur pada ${num(sparekit.parts)} suku cadang kritis yang distok dan terpakai. Nilai stok mencakup seluruh ${num(proof.stocked)} suku cadang yang distok, karena penghematan datang dari batas suku cadang yang menganggur. Khusus ${num(sparekit.parts)} suku cadang yang terpakai, rata-rata stok naik dari ${rp(proof.measured.today)} menjadi ${rp(proof.measured.sparekit)}. Setiap rencana dimulai penuh pada Max-nya sendiri, dan batas Maret ditetapkan tepat setelah turnaround, sehingga stok awalnya tinggi. Pembaruan berikutnya menurunkan batas, tetapi suku cadang yang lambat memakai stok itu dengan pelan, jadi planner perlu memangkas pesanan Maret itu secara manual.`)}</li>
          <li>{t(`Stock value uses the median price of the same part type where a part has no purchase order. On parts with a PO price alone, stock rises from ${rp(today.avg_inv_idr_po)} to ${rp(sparekit.avg_inv_idr_po)}: money moves out of idle parts and into parts that get used.`, `Nilai stok memakai harga median jenis suku cadang yang sama jika belum pernah dipesan. Khusus suku cadang berharga PO, stok naik dari ${rp(today.avg_inv_idr_po)} menjadi ${rp(sparekit.avg_inv_idr_po)}: uang berpindah dari suku cadang yang menganggur ke yang benar-benar terpakai.`)}</li>
          <li>{t(`Counted per request instead of per unit, availability rises from ${pct(today.fill_lines, 0)} to ${pct(sparekit.fill_lines, 0)}. A few bulk items, such as castable and terminals, weigh heavily on the unit count.`, `Jika dihitung per permintaan, bukan per unit, ketersediaan naik dari ${pct(today.fill_lines, 0)} menjadi ${pct(sparekit.fill_lines, 0)}. Beberapa barang curah, seperti castable dan terminal, sangat memengaruhi hitungan unit.`)}</li>
          {proof.strict && <li>{t(`The forecast reads today's Min and Max as a clue. Without that clue the result is ${pct(proof.strict.fill_units, 0)} availability, ${num(proof.strict.stockout_days)} empty-shelf days and ${rp(proof.strict.avg_inv_idr)} of stock.`, `Prakiraan membaca Min dan Max saat ini sebagai petunjuk. Tanpa petunjuk itu, hasilnya ${pct(proof.strict.fill_units, 0)} ketersediaan, ${num(proof.strict.stockout_days)} hari rak kosong, dan stok ${rp(proof.strict.avg_inv_idr)}.`)}</li>}
          <li>{t("Unmet requests count as lost. Delivery times are drawn from each part's own past orders, the same draws for every plan.", "Permintaan yang tidak terpenuhi dihitung hilang. Waktu kirim diambil dari pesanan masa lalu tiap suku cadang, dengan undian yang sama untuk setiap rencana.")}</li>
          <li>{t("The turnaround of Nov 2025 to Jan 2026 is outside these months, so it is not part of this test. It is planned separately on the Plant map.", "Turnaround Nov 2025 sampai Jan 2026 berada di luar bulan-bulan ini, sehingga tidak termasuk dalam uji ini. Turnaround direncanakan terpisah di Peta kilang.")}</li>
        </ul>
      </Panel>
    </div>
  );
}

function PartPanel({ examples, names }: { examples: ReplayPart[]; names: ReplayPartName[] }) {
  const [part, setPart] = useState<ReplayPart | undefined>(examples[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const found = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return names.filter((n) => words.every((w) => `${n.description} ${n.material_no}`.toLowerCase().includes(w))).slice(0, 8);
  }, [query, names]);

  const open = (no: number) => {
    setQuery("");
    setFailed(false);
    const known = examples.find((p) => p.material_no === no);
    if (known) return setPart(known);
    setLoading(true);
    fetch(`/api/replay-part?id=${no}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setPart)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  return (
    <Panel tour="r-part" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[14px] font-semibold">{t("One part, month by month", "Satu suku cadang, bulan demi bulan")}</h2>
          {part && (
            <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <CritTile crit={part.criticality} />
              <span className="font-medium text-ink">{partName(part.description)}</span>
              <Link href={`/parts/${part.material_no}`} className="inline-flex items-center gap-1 underline underline-offset-2">{t("Open the part", "Buka suku cadang")}<ArrowRight aria-hidden className="h-3.5 w-3.5" /></Link>
            </p>
          )}
        </div>
        <div className="relative w-full max-w-[320px]">
          <label className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-panel-2 px-2.5 text-[13px]">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(`Find any of the ${names.length} parts`, `Cari dari ${names.length} suku cadang`)} aria-label={t("Find a part in the replay", "Cari suku cadang dalam simulasi ulang")} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3" />
          </label>
          {query.trim() && (
            <ul className="absolute right-0 z-20 m-0 mt-1 max-h-[280px] w-full list-none overflow-auto rounded-[12px] border border-line bg-panel p-1 shadow-float">
              {found.length ? found.map((n) => (
                <li key={n.material_no}>
                  <button type="button" onClick={() => open(n.material_no)} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] hover:bg-ink/[0.04]">
                    <CritTile crit={n.criticality} />
                    <span className="min-w-0 truncate">{partName(n.description)}</span>
                  </button>
                </li>
              )) : <li className="px-2 py-1.5 text-[13px] text-ink-3">{t("Not in the replay. It covers critical stocked parts used in these months.", "Tidak ada dalam simulasi ulang. Cakupannya suku cadang kritis yang distok dan terpakai pada bulan-bulan ini.")}</li>}
            </ul>
          )}
        </div>
      </div>

      {examples.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-3">{t("Examples:", "Contoh:")}</span>
          {examples.map((p) => (
            <button key={p.material_no} type="button" onClick={() => open(p.material_no)} aria-pressed={part?.material_no === p.material_no} className={cn("h-7 max-w-[220px] truncate rounded-[8px] border px-2 text-[12px] transition-colors", part?.material_no === p.material_no ? "border-ink bg-panel-2 font-medium" : "border-line text-ink-2 hover:border-line-2")}>
              {partName(p.description)}
            </button>
          ))}
        </div>
      )}

      <div className={cn("mt-3 transition-opacity", loading && "opacity-50")}>
        {failed && <p className="m-0 mb-2 text-[13px] text-act-ink">{t("Could not load that part. Try again.", "Suku cadang itu gagal dimuat. Coba lagi.")}</p>}
        {part && <LimitsHistory part={part} />}
      </div>
    </Panel>
  );
}
