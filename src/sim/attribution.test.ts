import { describe, expect, test } from "vitest";
import reference from "../../reference/analysis.json";
import { attribute, NODE_XY } from "./attribution";
import { ZONES } from "./types";

describe("free-field attribution (TRD §6)", () => {
  test("all 800 frozen cells, including both distance ranks and ΔL within 1e-9", () => {
    expect(reference.attrib.cells).toHaveLength(800);
    let ambiguous = 0;
    for (const [x, y, first, second, deltaDb] of reference.attrib.cells) {
      const result = attribute(x, y)!;
      expect(result.primary).toBe(ZONES[first]);
      expect(Math.abs(result.deltaDb - deltaDb)).toBeLessThanOrEqual(1e-9);
      expect(result.secondary).toBe(deltaDb < 3 ? ZONES[second] : null);
      const ranked = [...ZONES].sort((a, b) => result.levelsDb[b]! - result.levelsDb[a]!);
      expect(ranked.slice(0, 2)).toEqual([ZONES[first], ZONES[second]]);
      if (result.secondary) ambiguous++;
    }
    expect(100 * ambiguous / 800).toBe(36);
    expect(100 * ambiguous / 800).toBe(reference.attrib.amb_pct);
  });

  test("node positions and maximum room range agree with the reference", () => {
    expect(ZONES.map((zone) => [...NODE_XY[zone]])).toEqual(reference.attrib.nodes);
    const ranges: number[] = [];
    for (const x of [0, 2.5, 5, 7.5, 10]) {
      for (const y of [0, 5]) {
        const result = attribute(x, y)!;
        ranges.push(10 ** (-result.levelsDb[result.primary]! / 20));
      }
    }
    expect(Math.max(...ranges)).toBeCloseTo(reference.attrib.max_range, 12);
    expect(Math.max(...ranges)).toBeCloseTo(2.907, 3);
  });

  test("ties use zone order; ambiguity is strictly below the configured threshold", () => {
    expect(attribute(5, 2.5)).toMatchObject({ primary: "B", secondary: "C", deltaDb: 0 });
    const deltaDb = attribute(4.7, 2.5)!.deltaDb;
    expect(attribute(4.7, 2.5, { ambiguousDb: deltaDb })!.secondary).toBeNull();
    expect(attribute(4.7, 2.5, { ambiguousDb: deltaDb + 1e-9 })!.secondary).toBe("C");
  });

  test("only active nodes compete; the secondary is not filtered by range", () => {
    expect(attribute(6.25, 2.5, { activeZones: ["A", "B", "D"] })!.primary).toBe("B");
    expect(attribute(6.25, 2.5, { activeZones: [] })).toBeNull();
    expect(attribute(1.25, 2.5, { activeZones: ["D"] })).toBeNull();
    expect(attribute(1.25, 2.5, { activeZones: ["A"] })).toMatchObject({ primary: "A", secondary: null, deltaDb: Infinity });
    const atLimit = attribute(1.25, 2.5, { maxRangeM: 0.8 });
    expect(atLimit!.primary).toBe("A");
    expect(attribute(1.25, 2.5, { maxRangeM: 0.799 })).toBeNull();
    // B lies outside this range but remains the runner-up when ΔL is ambiguous.
    expect(attribute(2.4, 2.5, { maxRangeM: 1.5 })).toMatchObject({ primary: "A", secondary: "B" });
    expect(attribute(Number.NaN, 2.5)).toBeNull();
  });
});
