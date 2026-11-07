import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import reference from "../reference/analysis.json";
import reference2 from "../reference/analysis2.json";
import { analysis, analysis2, LATENCY_TOTAL_MS, RAM_TOTAL_KB } from "../src/data/analysis";
import { bomTotals } from "../src/data/bom";
import { claims, CLAIMS, CLAIM_STATUSES } from "../src/data/claims";
import { assumptions, gates, promises } from "../src/data/gates";
import Ambang from "../src/pages/ambang";
import Bukti from "../src/pages/bukti";
import { parseHash, routes } from "../src/routes";
import { createInitialState } from "../src/sim/engine";
import { Denah2D, floorPreview } from "../src/ui/denah-2d";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

const forbidden = new Set(["getUserMedia", "fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "dangerouslySetInnerHTML"]);
function violations(source: string, simulation = false): string[] {
  const failures: string[] = [];
  const ast = ts.createSourceFile("guard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && forbidden.has(node.text)) failures.push(node.text);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const owner = node.expression.getText(ast);
      const member = ts.isPropertyAccessExpression(node) ? node.name.text
        : node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : "";
      if (owner === "document" && member === "cookie") failures.push("document.cookie");
      if (simulation && ((owner === "Math" && member === "random") || (owner === "Date" && member === "now"))) failures.push(`${owner}.${member}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return failures;
}

describe("privacy and deterministic simulation guards (TRD §12, §14)", () => {
  for (const path of sourceFiles(join(root, "src"))) {
    const name = relative(root, path).replaceAll("\\", "/");
    test(`${name} has no forbidden API`, () => {
      expect(violations(readFileSync(path, "utf8"), name.startsWith("src/sim/"))).toEqual([]);
    });
  }

  test("the guard catches direct and bracket access, including unused references", () => {
    for (const name of forbidden) expect(violations(`window.${name}; window['${name}'];`)).toContain(name);
    expect(violations("document.cookie; document['cookie'];")).toEqual(["document.cookie", "document.cookie"]);
    expect(violations("Math.random(); Date['now']();", true)).toEqual(["Math.random", "Date.now"]);
    expect(violations("// fetch()\nconst caption = 'Sesi ini';")).toEqual([]);
  });

  test("HTML contains the agreed CSP", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'");
  });
});

describe("claim provenance and frozen data", () => {
  test("every Claim has a unique id, a display value, a supported status, and a source", () => {
    expect(claims.length).toBeGreaterThan(0);
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(claims.length);
    for (const claim of claims) {
      expect(claim.id.trim()).not.toBe("");
      expect(claim.tampil.trim()).not.toBe("");
      expect(CLAIM_STATUSES).toContain(claim.status);
      expect(claim.sumber.trim()).not.toBe("");
      expect(Number.isFinite(claim.nilai)).toBe(true);
    }
  });

  test("the shipped subset matches analysis.json exactly and excludes attribution cells", () => {
    expect(analysis).toEqual({
      grid: reference.grid, profiles: reference.profiles, two_tier: reference.two_tier,
      delay_curve: reference.delay_curve, latency: reference.latency, ram: reference.ram,
      kit_hw: reference.kit_hw, attrib: { amb_pct: reference.attrib.amb_pct, max_range: reference.attrib.max_range },
    });
    expect(analysis.attrib).not.toHaveProperty("cells");
    expect(LATENCY_TOTAL_MS).toBe(reference.latency_total);
    expect(RAM_TOTAL_KB).toBeCloseTo(reference.ram_total, 10);
    expect(bomTotals).toEqual({ node: 564680, pager: 130000, kit: reference.kit_hw });
  });

  test("the proposal revision subset matches analysis2.json exactly", () => {
    expect(analysis2).toEqual({
      pop: reference2.pop, pop_n3: reference2.pop_n3,
      alarm: { sim: reference2.alarm.sim, sim3: reference2.alarm.sim3 },
      attrib_gap: reference2.attrib_gap, g1_hours_for_claim: reference2.g1_hours_for_claim,
    });
  });

  test("all PRD §8 opening claims use the specified exact golden and display rounding", () => {
    expect(CLAIMS.captureOld.nilai).toBe(reference.grid["3_10"].capture);
    expect(CLAIMS.captureTier2.nilai).toBe(reference.grid["2_15"].capture);
    expect(CLAIMS.anySignal.nilai).toBe(reference.two_tier.Median["0.0"].any_signal);
    expect(CLAIMS.falseAlarmTier2.nilai).toBe(reference.grid["2_15"].fa_room_h);
    expect([CLAIMS.captureOld.tampil, CLAIMS.captureTier2.tampil, CLAIMS.anySignal.tampil, CLAIMS.falseAlarmTier2.tampil]).toEqual(["7%", "43%", "87%", "0,94"]);
    expect(CLAIMS.falseAlarmWithPause.nilai).toBe(reference2.alarm.sim[2]);
    expect(CLAIMS.capturePopulation.nilai).toBe(reference2.pop["0.0"].capture);
    expect(CLAIMS.taggedZone.nilai).toBe(reference2.attrib_gap["1.5"].tagged);
    expect([CLAIMS.falseAlarmWithPause.tampil, CLAIMS.capturePopulation.tampil, CLAIMS.taggedZone.tampil]).toEqual(["0,73", "49%", "91%"]);
    for (const claim of claims.filter((claim) => claim.analysisPath)) {
      const file = claim.analysisFile ?? "analysis.json";
      expect(claim.sumber).toContain(`reference/${file}`);
      let golden: unknown = file === "analysis2.json" ? reference2 : reference;
      for (const key of claim.analysisPath!) golden = (golden as Record<string, unknown>)[key];
      expect(claim.nilai).toBe(golden);
      expect(claim.status).toBe("tersimulasi");
      expect(claim.tampil).toBe(claim.format === "percent" ? `${Math.round(Number(golden) * 100)}%` : Number(golden).toFixed(2).replace(".", ","));
    }
  });

  test("population dose and noisy-mode claims retain their frozen values and rounding", () => {
    expect(CLAIMS.dosePopulationLow.nilai).toBe(reference2.pop["0.0"].dose_red);
    expect(CLAIMS.dosePopulationHigh.nilai).toBe(reference2.pop["0.5"].dose_red);
    expect(CLAIMS.captureNoisy.nilai).toBe(reference2.pop_n3.capture);
    expect(CLAIMS.falseAlarmNoisy.nilai).toBe(reference2.alarm.sim3[2]);
    expect([CLAIMS.dosePopulationLow.tampil, CLAIMS.dosePopulationHigh.tampil, CLAIMS.captureNoisy.tampil, CLAIMS.falseAlarmNoisy.tampil]).toEqual(["28%", "35%", "26%", "0,09"]);
  });

  test("PRD §8 examples also retain their numeric values and evidence status", () => {
    expect(CLAIMS.latency.nilai).toBe(reference.latency_total / 1000);
    expect(CLAIMS.latency.tampil).toBe("1,73 detik");
    expect(CLAIMS.nodeCost.tampil).toBe("Rp565 ribu");
    expect(CLAIMS.nodeCost.nilai).toBe((reference.kit_hw - 130000) / 4);
    expect(CLAIMS.latency.status).toBe("terhitung");
    expect(CLAIMS.nodeCost.status).toBe("terhitung");
    expect(CLAIMS.sensitivity).toMatchObject({ tampil: "≥90%", nilai: 0.9, status: "target" });
    expect(CLAIMS.response).toMatchObject({ tampil: "≤3 menit", nilai: 3, status: "target" });
    expect(CLAIMS.audioOut).toMatchObject({ tampil: "0 byte", nilai: 0, status: "dirancang" });
  });
});

describe("revised proposal evidence on screen", () => {
  test("all seven promises preserve the proposal order and revised evidence", () => {
    expect(promises.map((promise) => promise.janji)).toEqual([
      "Batuk di ruang tunggu menjadi data", "Petugas tahu tanpa terus mengamati",
      "Tidak mengganggu dengan alarm palsu", "Zona yang tepat ditandai",
      "Percakapan tetap aman", "Pengunjung lebih terlindung", "Terjangkau untuk klinik kecil",
    ]);
    expect(promises[2]).toMatchObject({ ukuran: "≤1 per jam per ruang", bukti: "Tersimulasi 0,73 per jam; belum diukur", status: "tersimulasi" });
    expect(promises[3]).toMatchObject({ ukuran: "≥80% zona benar tertandai", bukti: "Termodelkan 91%; belum diukur", status: "tersimulasi" });
    expect(promises[5]).toMatchObject({ ukuran: "Respons, masker, dosis relatif", bukti: "Termodelkan rata-rata 28% sampai 35%; pilot menentukan", status: "tersimulasi" });
    const html = renderToStaticMarkup(createElement(Bukti));
    expect(html).toContain("Tujuh manfaat");
    for (const promise of promises) expect(html).toContain(promise.bukti);
    expect(html.match(/Belum dijalankan/g)).toHaveLength(4);
  });

  test("gates and assumptions retain the revised acceptance criteria", () => {
    expect(gates.map((gate) => gate.id)).toEqual(["G1", "G2", "G3", "G4"]);
    expect(gates.every((gate) => gate.status === "target")).toBe(true);
    expect(gates[0].uji).toBe(`≥500 batuk diputar di perangkat dan ≥${reference2.g1_hours_for_claim} jam audio negatif disuntikkan`);
    expect(gates[0].kriteria).toContain("Sensitivitas ≥90% dan batas bawah ≥85%");
    expect(gates[2].kriteria).toContain("Zona benar tertandai ≥80%");
    expect(gates[3].uji).toBe("1 ruang tunggu, 1 minggu senyap dan 2 minggu aktif, setelah izin dan persetujuan etik");
    expect(assumptions.map((assumption) => assumption.id)).toEqual(["A1", "A2", "A3", "A4", "A6", "A7"]);
    expect(assumptions[5].isi).toContain("rata-rata level 50 ms awal minimal dua batuk, dengan model gema");
    expect(assumptions[5].isi).toContain("medan bebas tanpa gema dan menentukan zona per batuk");
    expect(assumptions[5].tindakLanjut).toContain("91%");
  });

  test("threshold page shows both patient scopes and distinguishes the two alarm models", () => {
    const html = renderToStaticMarkup(createElement(Ambang));
    expect(html).toContain("Mode bising ≥3/15");
    expect(html).toContain("Seluruh sebaran pasien");
    for (const claim of [CLAIMS.capturePopulation, CLAIMS.dosePopulationLow, CLAIMS.dosePopulationHigh, CLAIMS.captureNoisy, CLAIMS.falseAlarmNoisy, CLAIMS.falseAlarmWithPause]) {
      expect(html).toContain(`data-claim="${claim.id}"`);
      expect(html).toContain(claim.tampil);
    }
    expect(html).toContain("profil Median");
    expect(html).toContain("orde pertama tanpa jeda pemicu ulang");
    expect(html).toContain("memakai jeda pemicu ulang 15 menit");
    expect(html).toContain("Hasil simulasi, bukan hasil uji. Poisson mengabaikan batuk yang datang berkelompok.");
  });

  test("floor preview and hatching agree with the revised default over all 800 cells", () => {
    const state = createInitialState();
    const html = renderToStaticMarkup(createElement(Denah2D, {
      zones: state.zones, effects: [], packets: [], onFloorClick: () => {}, onFloorHover: () => {},
    }));
    expect(html.match(/data-floor-cell=/g)).toHaveLength(800);
    expect(html.match(/fill="url\(#floor-hatch-[^"]+\)"/g)).toHaveLength(reference.attrib.cells.filter((cell) => cell[4] < 1.5).length);
    expect(floorPreview(4.796920185194401, 2.5)).toBe("Zona B · ΔL 2,0 dB");
    expect(floorPreview(4.898544968737428, 2.5)).toBe("Zona B dan C · ΔL 1,0 dB");
    expect(html).toContain("ΔL &lt; 1,5 dB");
    expect(html).toContain("Simpul digantung di garis tengah pada tinggi 2 m");
    expect(html).toContain("medan bebas tanpa gema");
    for (const file of ["src/ui/denah-2d.tsx", "src/three/Scene3D.tsx", "src/three/room.ts"]) {
      expect(readFileSync(join(root, file), "utf8")).not.toContain("3 dB");
    }
  });
});

describe("static hash routes", () => {
  test("all six paths and their questions are registered", () => {
    expect(routes.map((route) => route.path)).toEqual(["/", "/dasbor", "/alat", "/batas-audio", "/ambang", "/bukti"]);
    for (const route of routes) {
      expect(parseHash(`#${route.path}`).path).toBe(route.path);
      expect(route.title.endsWith("?")).toBe(true);
    }
  });
  test("deep links, demo query, and invalid hashes", () => {
    expect(parseHash("#/ambang")).toEqual({ path: "/ambang", demo: false });
    expect(parseHash("#/?demo=1")).toEqual({ path: "/", demo: true });
    expect(parseHash("#/missing?demo=1")).toEqual({ path: "/", demo: false });
    expect(parseHash("#")).toEqual({ path: "/", demo: false });
  });
});
