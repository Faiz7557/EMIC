import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import reference from "../reference/analysis.json";
import { analysis, LATENCY_TOTAL_MS, RAM_TOTAL_KB } from "../src/data/analysis";
import { bomTotals } from "../src/data/bom";
import { claims, CLAIMS, CLAIM_STATUSES } from "../src/data/claims";
import { parseHash, routes } from "../src/routes";

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

  test("all PRD §8 opening claims use the specified exact golden and display rounding", () => {
    expect(CLAIMS.captureOld.nilai).toBe(reference.grid["3_10"].capture);
    expect(CLAIMS.captureTier2.nilai).toBe(reference.grid["2_15"].capture);
    expect(CLAIMS.anySignal.nilai).toBe(reference.two_tier.Median["0.0"].any_signal);
    expect(CLAIMS.falseAlarmTier2.nilai).toBe(reference.grid["2_15"].fa_room_h);
    expect([CLAIMS.captureOld.tampil, CLAIMS.captureTier2.tampil, CLAIMS.anySignal.tampil, CLAIMS.falseAlarmTier2.tampil]).toEqual(["7%", "43%", "87%", "0,94"]);
    for (const claim of claims.filter((claim) => claim.analysisPath)) {
      let golden: unknown = reference;
      for (const key of claim.analysisPath!) golden = (golden as Record<string, unknown>)[key];
      expect(claim.nilai).toBe(golden);
      expect(claim.status).toBe("tersimulasi");
      expect(claim.tampil).toBe(claim.format === "percent" ? `${Math.round(Number(golden) * 100)}%` : Number(golden).toFixed(2).replace(".", ","));
    }
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
