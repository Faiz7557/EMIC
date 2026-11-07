import { describe, expect, test } from "vitest";
import reference from "../../reference/analysis.json";
import {
  doseFraction, falseAlarmPerHour, firstTrigger, LAM_F, mulberry32,
  SEED, SENS, simulate, twoTier, wrRisk,
} from "./model";
import type { RandomSource, TwoTierOptions } from "./model";

const rates = { Q1: 1.2, Median: 2.3, Q3: 4.1 } as const;
const tolerance = 0.015; // 1.5 percentage points, per the frozen work order.

function capture(sessions: readonly (number | null)[]): number {
  return sessions.filter((time) => time !== null).length / sessions.length;
}

function doseReduction(sessions: readonly (number | null)[]): number {
  return 1 - sessions.reduce<number>((total, time) => total + doseFraction(time), 0) / sessions.length;
}

function expectMedianCdf(sessions: readonly (number | null)[], median: number, goldenCapture: number): void {
  // A golden median splits captured sessions in half. Compare its cumulative
  // probability in percentage points, rather than imposing an arbitrary minute
  // tolerance on rare thresholds with only a few dozen captured sessions.
  const atMedian = sessions.filter((time) => time !== null && time <= median).length / sessions.length;
  expect(Math.abs(atMedian - goldenCapture / 2)).toBeLessThanOrEqual(tolerance);
}

/** A finite stream catches accidental extra draws, which also change later sessions. */
function stream(values: readonly number[]): { rng: RandomSource; consumed: () => number } {
  let index = 0;
  return {
    rng: () => {
      if (index >= values.length) throw new Error("Unexpected random draw");
      return values[index++];
    },
    consumed: () => index,
  };
}

// For the default mean (2.0792), k draws of 0.99 then 0 yield Poisson count k.
// The following k draws set the uniform event times, then comes compliance.
function sessionDraws(times: readonly number[], complianceDraw = 0.25): number[] {
  return [
    ...times.map(() => 0.99), 0,
    ...times.map((time) => time / 60),
    ...(times.length ? [complianceDraw] : []),
  ];
}

describe("firstTrigger: exact first_trigger behavior", () => {
  test.each([
    { times: [], N: 2, T: 15, expected: null },
    { times: [0], N: 2, T: 15, expected: null },
    { times: [0, 15], N: 2, T: 15, expected: 15 },
    { times: [0, 15 + 1 / 60], N: 2, T: 15, expected: null },
    { times: [1, 2, 30], N: 2, T: 5, expected: 2 },
    { times: [1, 20, 40], N: 2, T: 5, expected: null },
    { times: [0, 20, 21, 30], N: 3, T: 10, expected: 30 },
    { times: [0, 20, 21, 30, 31], N: 3, T: 10, expected: 30 },
    { times: [0, 0, 0], N: 3, T: 0, expected: 0 },
    { times: [0, 10], N: 1, T: 0, expected: 0 },
  ])("$times, N=$N, T=$T => $expected", ({ times, N, T, expected }) => {
    const frozen = Object.freeze([...times]);
    expect(firstTrigger(frozen, N, T)).toBe(expected);
    expect(frozen).toEqual(times);
  });
});

describe("falseAlarmPerHour: exact false_alarm_per_hour goldens", () => {
  test.each(Object.entries(reference.grid))("%s agrees within 1e-9", (key, golden) => {
    const [N, T] = key.split("_").map(Number);
    expect(Math.abs(falseAlarmPerHour(1.03, N, T) - golden.fa_room_h)).toBeLessThanOrEqual(1e-9);
  });

  test("N=1, no false events, zero window, and zone scaling", () => {
    expect(falseAlarmPerHour(1.03, 1, 0)).toBe(4.12);
    expect(falseAlarmPerHour(0, 2, 15)).toBe(0);
    expect(falseAlarmPerHour(1.03, 2, 0)).toBe(0);
    expect(falseAlarmPerHour(1.03, 2, 15, 0)).toBe(0);
    expect(falseAlarmPerHour(1.03, 2, 15, 1) * 4).toBe(falseAlarmPerHour(1.03, 2, 15));
  });
});

describe("doseFraction: remaining dose from dose_fraction", () => {
  test.each(Object.entries(reference.delay_curve))("delay %s min", (time, reduction) => {
    expect(Math.abs(1 - doseFraction(Number(time)) - reduction)).toBeLessThanOrEqual(1e-12);
  });

  test("best case and no-mask goldens", () => {
    expect(1 - doseFraction(10)).toBe(reference.best_case_dose_red);
    expect(1 - doseFraction(10, 60, 5, 0)).toBe(reference.no_mask_red);
  });

  test("no trigger, end boundary, zero trigger and parameter units", () => {
    expect(doseFraction(null)).toBe(1);
    expect(doseFraction(60)).toBe(1);
    expect(doseFraction(61)).toBe(1);
    expect(doseFraction(0)).toBeCloseTo(2.2 / 60, 14);
    expect(doseFraction(10, 30, 2, 0.75)).toBe(10.5 / 30);
    expect(doseFraction(10, 60, 0)).toBe(10 / 60);
    expect(doseFraction(10, 60, 5, 1)).toBe(10 / 60);
  });

  test("preserves the reference's uncapped late dose instead of changing the formula", () => {
    expect(doseFraction(59)).toBeCloseTo(1.02, 14);
    expect(doseFraction(59)).toBeGreaterThan(1);
  });
});

describe("wrRisk: wr_risk probability versus per-100 goldens", () => {
  test("both wr_q82_ach3 scenarios agree exactly", () => {
    expect(100 * wrRisk(8.2, 3, 60)).toBe(reference.wr_q82_ach3.no);
    expect(100 * wrRisk(8.2, 3, 10 + 5 * 0.44)).toBe(reference.wr_q82_ach3.yes);
  });

  test("zero exposure and custom volume/breathing rate", () => {
    expect(wrRisk(0, 3, 60)).toBe(0);
    expect(wrRisk(8.2, 3, 0)).toBe(0);
    expect(wrRisk(8.2, 3, 60, 150, 0)).toBe(0);
    expect(wrRisk(10, 2, 30, 100, 0.5)).toBe(1 - Math.exp(-0.0125));
  });
});

describe("simulate: Poisson counts, sorted uniform times, then first_trigger", () => {
  test("uses the specified defaults", () => {
    expect(simulate()).toEqual(simulate({ ratePerH: 2.3, sens: 0.904, N: 2, TMin: 15, waitMin: 60, n: 20000, seed: 20261107 }));
    expect([SENS, LAM_F, SEED]).toEqual([0.904, 1.03, 20261107]);
  });

  test("sorts events numerically and returns the first qualifying time, including zero", () => {
    const draws = stream([0.99, 0.99, 0.99, 0, 30 / 60, 2 / 60, 10 / 60]);
    expect(simulate({ n: 1, N: 2, TMin: 8, rng: draws.rng })).toEqual([10]);
    expect(draws.consumed()).toBe(7);
    const atZero = stream([0.99, 0, 0]);
    expect(simulate({ n: 1, N: 1, TMin: 0, rng: atZero.rng })).toEqual([0]);
  });

  test("custom waiting time, threshold, and sensitivity reach the sampler", () => {
    const draws = stream([0.99, 0.99, 0, 0.2, 0.7]);
    expect(simulate({ ratePerH: 4, sens: 0.5, waitMin: 30, n: 1, N: 2, TMin: 15, rng: draws.rng })).toEqual([21]);
    expect(draws.consumed()).toBe(5);
    expect(simulate({ ratePerH: 0, n: 5 })).toEqual([null, null, null, null, null]);
    expect(simulate({ sens: 0, n: 5 })).toEqual([null, null, null, null, null]);
    expect(simulate({ n: 0 })).toEqual([]);
  });

  test.each(Object.entries(reference.grid))("grid %s: capture within 1.5 percentage points", (key, golden) => {
    const [N, TMin] = key.split("_").map(Number);
    const sessions = simulate({ N, TMin });
    expect(sessions).toHaveLength(20000);
    expect(Math.abs(capture(sessions) - golden.capture)).toBeLessThanOrEqual(tolerance);
    expectMedianCdf(sessions, golden.median_trigger, golden.capture);
    expect(sessions.every((time) => time === null || (time >= 0 && time < 60))).toBe(true);
  });

  for (const [profile, ratePerH] of Object.entries(rates)) {
    const goldens = reference.profiles[profile as keyof typeof rates];
    test.each(Object.entries(goldens))(`${profile} %s: capture and dose within 1.5 percentage points`, (key, golden) => {
      const [N, TMin] = key.split("_").map(Number);
      const sessions = simulate({ ratePerH, N, TMin, seed: SEED + N + TMin });
      expect(Math.abs(capture(sessions) - golden.capture)).toBeLessThanOrEqual(tolerance);
      expectMedianCdf(sessions, golden.median_trigger, golden.capture);
      expect(Math.abs(doseReduction(sessions) - golden.dose_red)).toBeLessThanOrEqual(tolerance);
    });
  }

  test("handles Poisson means beyond the exp(-mean) underflow boundary", () => {
    // Mean 800 requires more than one chunk, yet must still generate events.
    const sessions = simulate({ ratePerH: 800, sens: 1, N: 1, n: 1000 });
    expect(capture(sessions)).toBe(1);
    const meanFirst = sessions.reduce<number>((sum, time) => sum + time!, 0) / sessions.length;
    expect(meanFirst).toBeGreaterThan(0.06);
    expect(meanFirst).toBeLessThan(0.09); // First-arrival mean is 60 / 800 = 0.075 min.
  });

  test("one n=20000 simulation finishes below 200 ms on this machine", () => {
    const started = performance.now();
    const sessions = simulate({ n: 20000 });
    const elapsed = performance.now() - started;
    console.info(`simulate(n=20000): ${elapsed.toFixed(2)} ms (limit 200 ms)`);
    expect(sessions).toHaveLength(20000);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("twoTier: every main.two_tier dose branch", () => {
  const cases: { name: string; times: number[]; c: number; draw?: number; dose: number; opts?: TwoTierOptions }[] = [
    { name: "no events", times: [], c: 0.5, dose: 60 },
    { name: "one event, no compliance and no T2", times: [10], c: 0, dose: 60 },
    { name: "T1 compliant with no T2", times: [10], c: 1, dose: 11 + 49 * 0.44 },
    { name: "T2 without compliance, response inside the session", times: [10, 20], c: 0, dose: 20 + 5 * 0.44 },
    { name: "T2 with compliance, response inside the session", times: [10, 20], c: 1, dose: 11 + 14 * 0.44 },
    { name: "T2 without compliance, response past wait", times: [50, 58], c: 0, dose: 58 + 2 * 0.44 },
    { name: "T2 with compliance, end capped at wait", times: [50, 58], c: 1, dose: 51 + 9 * 0.44 },
    { name: "T1+1 equals end, no early masking", times: [59, 59.5], c: 1, dose: 59.5 + 0.5 * 0.44 },
    { name: "T1+1 past end, no T2", times: [59.5], c: 1, dose: 60 },
    { name: "draw equals c, no compliance", times: [10], c: 0.5, draw: 0.5, dose: 60 },
    { name: "response equals wait", times: [50, 55], c: 0, dose: 55 + 5 * 0.44 },
    { name: "T2 boundary is inclusive", times: [15, 30], c: 0, dose: 30 + 5 * 0.44 },
    { name: "just outside T2 boundary", times: [15, 30 + 1 / 60], c: 0, dose: 60 },
    { name: "trigger at zero is a signal", times: [0], c: 0, dose: 5 * 0.44, opts: { N2: 1 } },
    { name: "custom N2 and T2 reject a spread-out triple", times: [10, 20, 30], c: 0, dose: 60, opts: { N2: 3, T2: 10 } },
    { name: "custom N2, T2, react and eff", times: [10, 12, 14], c: 0, dose: 14 + 2 * 0.25, opts: { N2: 3, T2: 4, react: 2, eff: 0.75 } },
  ];

  test.each(cases)("$name", ({ times, c, draw, dose, opts }) => {
    const values = sessionDraws(times, draw);
    const draws = stream(values);
    const result = twoTier({ n: 1, c, rng: draws.rng, ...opts });
    expect(result.dose_red).toBeCloseTo(1 - dose / 60, 12);
    expect(result.any_signal).toBe(times.length ? 1 : 0);
    expect(draws.consumed()).toBe(values.length);
  });

  test("averages all sessions and samples compliance even at c=0", () => {
    const values = [...sessionDraws([], 0), ...sessionDraws([10, 20], 0.5)];
    const draws = stream(values);
    expect(twoTier({ n: 2, c: 0, rng: draws.rng })).toEqual({
      dose_red: 1 - (1 + (20 + 5 * (1 - 0.56)) / 60) / 2,
      any_signal: 0.5,
    });
    expect(draws.consumed()).toBe(values.length);
  });

  test("custom wait and sensitivity affect event sampling and normalization", () => {
    const draws = stream([0.99, 0.99, 0, 0.1, 0.5, 0.75]);
    const result = twoTier({ rate: 4, sens: 0.5, wait: 30, n: 1, c: 0, rng: draws.rng });
    expect(result.dose_red).toBeCloseTo(1 - (15 + 5 * 0.44) / 30, 12);
    expect(result.any_signal).toBe(1);
    expect(draws.consumed()).toBe(6);
    expect(twoTier({ rate: 0, n: 5 })).toEqual({ dose_red: 0, any_signal: 0 });
    expect(twoTier({ sens: 0, n: 5 })).toEqual({ dose_red: 0, any_signal: 0 });
  });

  for (const [profile, rate] of Object.entries(rates)) {
    test.each(Object.entries(reference.two_tier[profile as keyof typeof rates]))(`${profile}, c=%s: both outputs within 1.5 percentage points`, (c, golden) => {
      const result = twoTier({ rate, c: Number(c) });
      expect(Math.abs(result.dose_red - golden.dose_red)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(result.any_signal - golden.any_signal)).toBeLessThanOrEqual(tolerance);
    });
  }
});

describe("seeded reproducibility", () => {
  test("mulberry32's fixed sequence and independent streams", () => {
    const rng = mulberry32(1);
    expect([rng(), rng(), rng()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    const a = mulberry32(SEED);
    const b = mulberry32(SEED);
    const values = Array.from({ length: 1000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  test("simulate repeats in full, regardless of intervening runs", () => {
    const opts = { n: 20000, seed: 1234 };
    const first = simulate(opts);
    expect(simulate({ ...opts, seed: 5678 })).not.toEqual(first);
    expect(simulate(opts)).toEqual(first);
    expect(simulate({ n: 200 })).toEqual(simulate({ n: 200, seed: SEED }));
  });

  test("twoTier repeats and preserves Python's profile-derived default seed", () => {
    const opts = { rate: 1.2, c: 0.5, n: 20000, seed: 1234 };
    const first = twoTier(opts);
    expect(twoTier({ ...opts, seed: 5678 })).not.toEqual(first);
    expect(twoTier(opts)).toEqual(first);
    expect(twoTier({ rate: 1.2, c: 0.5 })).toEqual(twoTier({ rate: 1.2, c: 0.5, seed: SEED + 12 + 5 }));
    expect(twoTier()).toEqual(twoTier({ rate: 2.3, c: 0, wait: 60, n: 20000, N2: 2, T2: 15, react: 5, eff: 0.56, sens: SENS }));
  });
});

describe("invalid model parameters fail instead of hanging or returning NaN", () => {
  test.each([
    () => firstTrigger([], 0, 15),
    () => firstTrigger([], 1.5, 15),
    () => firstTrigger([], 2, -1),
    () => falseAlarmPerHour(-1, 2, 15),
    () => falseAlarmPerHour(1, 2, 15, -1),
    () => doseFraction(10, 0),
    () => doseFraction(-1),
    () => doseFraction(10, 60, -1),
    () => doseFraction(10, 60, 5, 1.1),
    () => wrRisk(8.2, 0, 60),
    () => wrRisk(8.2, 3, 60, 0),
    () => simulate({ ratePerH: -1 }),
    () => simulate({ ratePerH: Infinity }),
    () => simulate({ sens: 1.1 }),
    () => simulate({ n: 1.5 }),
    () => simulate({ n: -1 }),
    () => simulate({ seed: NaN }),
    () => simulate({ N: 0 }),
    () => simulate({ TMin: -1 }),
    () => twoTier({ n: 0 }),
    () => twoTier({ c: -0.1 }),
    () => twoTier({ c: 1.1 }),
    () => twoTier({ N2: 0 }),
    () => twoTier({ eff: -0.1 }),
    () => twoTier({ wait: 0 }),
  ])("rejects invalid input %#", (run) => {
    expect(run).toThrow(RangeError);
  });
});
