// TRD §8: port of reference/analysis.py. Times are minutes; rates are per hour.
export const SEED = 20261107;
export const SENS = 0.904;
export const LAM_F = 1.03;

export type RandomSource = () => number;

export interface SimulateOptions {
  ratePerH?: number;
  sens?: number;
  N?: number;
  TMin?: number;
  waitMin?: number;
  n?: number;
  seed?: number;
  /** Optional stream, corresponding to Python's rng; takes precedence over seed. */
  rng?: RandomSource;
}

export interface TwoTierOptions {
  rate?: number;
  c?: number;
  wait?: number;
  n?: number;
  N2?: number;
  T2?: number;
  react?: number;
  eff?: number;
  sens?: number;
  /** Defaults to SEED + trunc(rate * 10) + trunc(c * 10), as in Python. */
  seed?: number;
  rng?: RandomSource;
}

export interface TwoTierResult {
  dose_red: number;
  any_signal: number;
}

/** A fresh stream per call keeps identical seeds independent of earlier runs. */
export function mulberry32(seed: number): RandomSource {
  finite("seed", seed);
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function finite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function nonnegative(name: string, value: number): void {
  finite(name, value);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
}

function positive(name: string, value: number): void {
  finite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
}

function probability(name: string, value: number): void {
  nonnegative(name, value);
  if (value > 1) throw new RangeError(`${name} must be at most 1`);
}

function count(name: string, value: number, minimum = 1): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}`);
  }
}

/** Input is already sorted, matching first_trigger (no mutation or reordering). */
export function firstTrigger(times: readonly number[], N: number, T: number): number | null {
  count("N", N);
  nonnegative("T", T);
  for (let i = N - 1; i < times.length; i += 1) {
    if (times[i] - times[i - N + 1] <= T) return times[i];
  }
  return null;
}

export function falseAlarmPerHour(lamH: number, N: number, T: number, zones = 4): number {
  nonnegative("lamH", lamH);
  count("N", N);
  nonnegative("T", T);
  count("zones", zones, 0);
  const x = lamH * T / 60;
  let sum = 0;
  let factorial = 1;
  for (let k = 0; k < N - 1; k += 1) {
    if (k > 0) factorial *= k;
    sum += Math.exp(-x) * x ** k / factorial;
  }
  const p = 1 - sum;
  return lamH * p * zones;
}

/** Remaining dose, not reduction. The reference deliberately does not clamp it. */
export function doseFraction(trig: number | null, wait = 60, react = 5, maskEff = 0.56): number {
  positive("wait", wait);
  nonnegative("react", react);
  probability("maskEff", maskEff);
  if (trig === null || trig >= wait) return 1;
  nonnegative("trig", trig);
  return (trig + react * (1 - maskEff)) / wait;
}

/** Probability per person; multiply by 100 for wr_q82_ach3's per-100 values. */
export function wrRisk(q: number, ach: number, minutes: number, V = 150, p = 0.48): number {
  nonnegative("q", q);
  positive("ach", ach);
  nonnegative("minutes", minutes);
  positive("V", V);
  nonnegative("p", p);
  return 1 - Math.exp(-q * p * (minutes / 60) / (V * ach));
}

// NumPy's sampler is replaced by Knuth's exact Poisson sampler driven by
// mulberry32. Independent chunks avoid exp(-mean) underflow for large means.
// This changes the random stream, not the Poisson-count + sorted-uniform model.
function poisson(mean: number, rng: RandomSource): number {
  let remaining = mean;
  let total = 0;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 30);
    const limit = Math.exp(-chunk);
    let product = 1;
    let k = 0;
    do {
      k += 1;
      product *= rng();
    } while (product > limit);
    total += k - 1;
    remaining -= chunk;
  }
  return total;
}

function sampleTimes(mean: number, wait: number, rng: RandomSource): number[] {
  const k = poisson(mean, rng);
  const times = new Array<number>(k);
  for (let i = 0; i < k; i += 1) times[i] = rng() * wait;
  return times.sort((a, b) => a - b);
}

/** Python simulate: one first-trigger time (or null) for each waiting session. */
export function simulate(opts: SimulateOptions = {}): (number | null)[] {
  const { ratePerH = 2.3, sens = SENS, N = 2, TMin = 15, waitMin = 60, n = 20000, seed = SEED } = opts;
  nonnegative("ratePerH", ratePerH);
  probability("sens", sens);
  count("N", N);
  nonnegative("TMin", TMin);
  positive("waitMin", waitMin);
  count("n", n, 0);
  const rng = opts.rng ?? mulberry32(seed);
  const lam = ratePerH * sens / 60;
  const mean = lam * waitMin;
  finite("Poisson mean", mean);
  const out = new Array<number | null>(n);
  // ponytail: move recalculation to a Web Worker only if it exceeds 200 ms.
  for (let i = 0; i < n; i += 1) {
    const times = sampleTimes(mean, waitMin, rng);
    out[i] = times.length >= N ? firstTrigger(times, N, TMin) : null;
  }
  return out;
}

/** Port of main.two_tier, including response past the end of the session. */
export function twoTier(opts: TwoTierOptions = {}): TwoTierResult {
  const { rate = 2.3, c = 0, wait = 60, n = 20000, N2 = 2, T2 = 15, react = 5, eff = 0.56, sens = SENS } = opts;
  nonnegative("rate", rate);
  probability("c", c);
  positive("wait", wait);
  count("n", n);
  count("N2", N2);
  nonnegative("T2", T2);
  nonnegative("react", react);
  probability("eff", eff);
  probability("sens", sens);
  const rng = opts.rng ?? mulberry32(opts.seed ?? SEED + Math.trunc(rate * 10) + Math.trunc(c * 10));
  const lam = rate * sens / 60;
  const mean = lam * wait;
  finite("Poisson mean", mean);
  let total = 0;
  let hitAny = 0;
  for (let i = 0; i < n; i += 1) {
    const times = sampleTimes(mean, wait, rng);
    const k = times.length;
    const t1 = k ? times[0] : null;
    const t2 = k >= N2 ? firstTrigger(times, N2, T2) : null;
    const end = t2 !== null ? Math.min(t2 + react, wait) : wait;
    if (t1 !== null) hitAny += 1;
    let d: number;
    if (t1 !== null && rng() < c && t1 + 1 < end) {
      d = (t1 + 1) + (end - t1 - 1) * (1 - eff);
    } else {
      d = t2 !== null && t2 + react <= wait
        ? t2 + react * (1 - eff)
        : t2 === null ? wait : t2 + (wait - t2) * (1 - eff);
    }
    total += d / wait;
  }
  return { dose_red: 1 - total / n, any_signal: hitAny / n };
}
