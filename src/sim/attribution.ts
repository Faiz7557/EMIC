import { ZONES, type Attribution, type ZoneId } from "./types";

export const NODE_XY = {
  A: [1.25, 2.5], B: [3.75, 2.5], C: [6.25, 2.5], D: [8.75, 2.5],
} as const;

export interface AttributionOptions {
  activeZones?: readonly ZoneId[];
  ambiguousDb?: number;
  maxRangeM?: number;
}

/** Free-field model from analysis.py; level is relative to a source at 1 m.
 * A null result means no active node is close enough to hear the event. */
export function attribute(x: number, y: number, options: AttributionOptions = {}): Attribution | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const active = options.activeZones ?? ZONES;
  const ranked = ZONES.filter((zone) => active.includes(zone)).map((zone) => {
    const [nx, ny] = NODE_XY[zone];
    return { zone, r2: (x - nx) ** 2 + (y - ny) ** 2 + 0.8 ** 2 };
  }).sort((a, b) => a.r2 - b.r2 || ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone));
  const first = ranked[0];
  if (!first || Math.sqrt(first.r2) > (options.maxRangeM ?? 4)) return null;
  const second = ranked[1];
  const deltaDb = second ? 10 * Math.log10(second.r2 / first.r2) : Infinity;
  return {
    primary: first.zone,
    secondary: second && deltaDb < (options.ambiguousDb ?? 3) ? second.zone : null,
    deltaDb,
    levelsDb: Object.fromEntries(ranked.map(({ zone, r2 }) => [zone, -10 * Math.log10(r2)])),
  };
}
