import type { SimAction } from "./types";

export interface ScenarioEntry {
  /** Time since the simulation's 09:00 start. The store advances to this time. */
  tMs: number;
  action: SimAction;
}

/** Data only: all transitions and timeouts belong to the engine. */
export function morningScenario(busy = false): ScenarioEntry[] {
  return [
    { tMs: 300000, action: { type: "speech", zone: "C" } },
    { tMs: 900000, action: { type: "coughZone", zone: "C" } },
    { tMs: 1320000, action: { type: "coughZone", zone: "C" } },
    { tMs: busy ? 1560000 : 1480000, action: { type: "pagerPress" } },
  ];
}
