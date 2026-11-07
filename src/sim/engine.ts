import { ZONES, type SimAction, type SimConfig, type SimState, type ZoneState } from "./types";

/** T02 compilation stub. T03 replaces this with the simulation engine (TRD §5).
 * Only the clock and reset work here; no cough detection or zone transitions. */
export const DEFAULT_CONFIG: SimConfig = {
  n2: 2, t2Min: 15, t1HoldMin: 15, rebuzzMin: 3, pauseMin: 15,
  mergeMs: 300, ambiguousDb: 3, maxRangeM: 4, startClockMin: 540,
};

function initialZone(): ZoneState {
  return {
    tier: "normal", coughsMs: [], totalCoughs: 0, lastCoughMs: null,
    alertGroup: null, alertAtMs: null, rebuzzCount: 0, nextRebuzzMs: null,
    pauseUntilMs: null, nodeStatus: "normal",
  };
}

export function createInitialState(cfg: Partial<SimConfig> = {}): SimState {
  return {
    cfg: { ...DEFAULT_CONFIG, ...cfg }, nowMs: 0,
    zones: Object.fromEntries(ZONES.map((zone) => [zone, initialZone()])) as SimState["zones"],
    packets: [], log: [], effects: [], pagerBuzzing: false, pendingGroups: [],
    seq: { A: 0, B: 0, C: 0, D: 0 },
    counters: { audioBytesOut: 0, eventPackets: 0, speechIgnored: 0 }, lastMerge: null,
  };
}

export function reduce(state: SimState, action: SimAction): SimState {
  if (action.type === "reset") return createInitialState(state.cfg);
  if (action.type === "tick" && Number.isFinite(action.dtMs) && action.dtMs > 0) {
    return { ...state, nowMs: state.nowMs + action.dtMs };
  }
  return state;
}
