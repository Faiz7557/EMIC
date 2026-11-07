import { attribute, DEFAULT_AMBIGUOUS_DB, NODE_XY } from "./attribution";
import { encodePacket } from "./packet";
import {
  ZONES, type Endpoint, type LogKind, type NodeStatus, type PacketKind,
  type SimAction, type SimConfig, type SimEffect, type SimState, type ZoneId, type ZoneState,
} from "./types";

export const DEFAULT_CONFIG: SimConfig = {
  n2: 2, t2Min: 15, t1HoldMin: 15, rebuzzMin: 3, pauseMin: 15,
  mergeMs: 300, ambiguousDb: DEFAULT_AMBIGUOUS_DB, maxRangeM: 4, startClockMin: 540,
};

function initialZone(): ZoneState {
  return {
    tier: "normal", coughsMs: [], totalCoughs: 0, lastCoughMs: null,
    alertGroup: null, alertAtMs: null, rebuzzCount: 0, nextRebuzzMs: null,
    pauseUntilMs: null, nodeStatus: "normal",
  };
}

export function createInitialState(cfg: Partial<SimConfig> = {}): SimState {
  const config = { ...DEFAULT_CONFIG, ...cfg };
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid simulation config: ${key}`);
  }
  if (!Number.isInteger(config.n2) || config.n2 < 1 || config.rebuzzMin <= 0 || config.maxRangeM <= 0) {
    throw new RangeError("Invalid simulation threshold or interval");
  }
  return {
    cfg: config, nowMs: 0,
    zones: Object.fromEntries(ZONES.map((zone) => [zone, initialZone()])) as SimState["zones"],
    packets: [], log: [], effects: [], pagerBuzzing: false, pendingGroups: [],
    seq: { A: 0, B: 0, C: 0, D: 0 },
    counters: { audioBytesOut: 0, eventPackets: 0, speechIgnored: 0, mergedCoughs: 0, coughEvents: 0, alertEvents: 0 }, lastMerge: null,
  };
}

/** Helpers mutate only this private copy, never any caller-owned object. */
function copyState(state: SimState): SimState {
  return {
    ...state,
    zones: Object.fromEntries(ZONES.map((zone) => [zone, {
      ...state.zones[zone], coughsMs: [...state.zones[zone].coughsMs],
    }])) as SimState["zones"],
    packets: [...state.packets], log: [...state.log], effects: [...state.effects],
    pendingGroups: [...state.pendingGroups], seq: { ...state.seq }, counters: { ...state.counters },
  };
}

interface RadioState { status: NodeStatus; sinceMs: number }
type Radios = Record<ZoneId, RadioState>;

/** The frozen state has no separate radio/timeout fields. The append-only status
 * log records the requested hardware state, while nodeStatus is the displayed
 * state. Use the start of the latest status run so repeated missed coughs cannot
 * restart the 30-second offline timeout. No hidden mutable reducer state. */
function readRadios(state: SimState): Radios {
  return Object.fromEntries(ZONES.map((zone) => {
    let radio: RadioState | undefined;
    for (let i = state.log.length - 1; i >= 0; i--) {
      const entry = state.log[i];
      if (entry.kind !== "STATUS_SIMPUL" || entry.zone !== zone) continue;
      if (!radio) radio = { status: entry.status, sinceMs: entry.tMs };
      else if (entry.status !== radio.status) break;
      else radio.sinceMs = entry.tMs;
    }
    return [zone, radio ?? { status: state.zones[zone].nodeStatus, sinceMs: 0 }];
  })) as Radios;
}

function log(state: SimState, kind: LogKind, zone: ZoneId, levelDb: number | null = null, responseMs: number | null = null, status = state.zones[zone].nodeStatus): void {
  state.log.push({
    id: (state.log.at(-1)?.id ?? 0) + 1, tMs: state.nowMs, kind, zone,
    count: state.zones[zone].coughsMs.length, levelDb, status, responseMs,
    alertGroup: kind === "DITANGANI" ? state.zones[zone].alertGroup : null,
  });
}

function effect(state: SimState, fields: Omit<SimEffect, "id" | "tMs">): void {
  state.effects.push({ id: (state.effects.at(-1)?.id ?? 0) + 1, tMs: state.nowMs, ...fields });
  if (state.effects.length > 50) state.effects.splice(0, state.effects.length - 50);
}

function packet(state: SimState, kind: PacketKind, from: Exclude<Endpoint, "DASBOR">, to: Endpoint, levelDb = 0, tMs = state.nowMs, status: Exclude<NodeStatus, "luring"> = "normal"): void {
  // The coordinator tracks the pager's DONE exchange in its sequence stream;
  // the frozen contract supplies sequence counters for A–D only.
  const sequenceZone = from === "PAGER" ? "A" : from;
  const seq = state.seq[sequenceZone];
  state.seq[sequenceZone] = (seq + 1) & 0xffff;
  state.packets.push({
    id: (state.packets.at(-1)?.id ?? 0) + 1, tMs, kind, from, to,
    bytes: encodePacket({
      kind, nodeId: from, seq, tMs: Math.floor(tMs) % 0x100000000, levelDb, status,
    }),
  });
  if (state.packets.length > 500) state.packets.splice(0, state.packets.length - 500);
  if (kind === "EVENT") state.counters.eventPackets++;
}

function normal(state: SimState, zone: ZoneId): void {
  const previous = state.zones[zone];
  state.zones[zone] = { ...initialZone(), totalCoughs: previous.totalCoughs, nodeStatus: previous.nodeStatus };
  log(state, "NORMAL", zone);
}

function deadlines(state: SimState, radios: Radios): void {
  const rebuzzZones: ZoneId[] = [];
  for (const zone of ZONES) {
    const current = state.zones[zone];
    if (radios[zone].status === "luring" && state.nowMs >= radios[zone].sinceMs + 30000) current.nodeStatus = "luring";
    current.coughsMs = current.coughsMs.filter((time) => state.nowMs - time <= state.cfg.t2Min * 60000);
    if (current.tier === "tingkat1" && current.lastCoughMs !== null && state.nowMs > current.lastCoughMs + state.cfg.t1HoldMin * 60000) {
      normal(state, zone);
    } else if (current.tier === "ditangani" && current.pauseUntilMs !== null && state.nowMs >= current.pauseUntilMs) {
      normal(state, zone);
    } else if (current.tier === "menunggu" && current.nextRebuzzMs !== null && state.nowMs >= current.nextRebuzzMs) {
      current.rebuzzCount++;
      current.nextRebuzzMs += state.cfg.rebuzzMin * 60000;
      log(state, "ESKALASI", zone);
      rebuzzZones.push(zone);
    }
  }
  if (rebuzzZones.length) {
    state.pagerBuzzing = true;
    effect(state, { kind: "buzz", zones: rebuzzZones });
  }
}

/** First representable instant strictly after a nonnegative timestamp. Scheduling
 * this exclusive deadline preserves the ≤15-minute cough boundary and gives the
 * same NORMAL log time regardless of animation-frame/tick partitioning. */
function after(time: number): number {
  if (!Number.isFinite(time)) return time;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, time);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}

function advance(state: SimState, dtMs: number, radios: Radios): void {
  const target = state.nowMs + dtMs;
  while (state.nowMs < target) {
    // At most 1 s per step. Also split at absolute radio/pager deadlines so a
    // fractional animation-frame tick cannot shift their timestamps.
    let next = Math.min(target, state.nowMs + 1000, (Math.floor(state.nowMs / 10000) + 1) * 10000);
    for (const zone of ZONES) {
      const current = state.zones[zone];
      const due = current.tier === "menunggu" ? current.nextRebuzzMs
        : current.tier === "ditangani" ? current.pauseUntilMs
        : current.tier === "tingkat1" && current.lastCoughMs !== null ? after(current.lastCoughMs + state.cfg.t1HoldMin * 60000) : null;
      if (due !== null && due > state.nowMs) next = Math.min(next, due);
      const offlineAt = radios[zone].sinceMs + 30000;
      if (radios[zone].status === "luring" && offlineAt > state.nowMs) next = Math.min(next, offlineAt);
    }
    state.nowMs = next;
    deadlines(state, radios);
    if (next % 10000 === 0) {
      for (const zone of ZONES) packet(state, "SYNC", "A", zone, 0, next, radios.A.status === "terbatas" ? "terbatas" : "normal");
    }
    if (next % 30000 === 0) {
      for (const zone of ZONES) {
        const status = radios[zone].status;
        if (status !== "luring") packet(state, "HEARTBEAT", zone, "A", 0, next, status);
      }
    }
  }
}

function detectCough(state: SimState, x: number, y: number, radios: Radios): void {
  const result = attribute(x, y, {
    activeZones: ZONES.filter((zone) => radios[zone].status === "normal"),
    ambiguousDb: state.cfg.ambiguousDb, maxRangeM: state.cfg.maxRangeM,
  });
  effect(state, { kind: "ripple", x, y, zones: result ? [result.primary, ...(result.secondary ? [result.secondary] : [])] : [] });
  if (!result) {
    const nearest = attribute(x, y, { maxRangeM: Infinity })!.primary;
    log(state, "STATUS_SIMPUL", nearest, null, null, radios[nearest].status);
    return;
  }
  const affected = [result.primary, ...(result.secondary ? [result.secondary] : [])];
  const previous = state.lastMerge;
  if (previous && state.nowMs - previous.tMs <= state.cfg.mergeMs
    && affected.some((zone) => previous.zones.includes(zone))) {
    state.counters.mergedCoughs++;
    return;
  }
  // Radio reports are illustrative traces scheduled 20 ms apart. Their offsets
  // do not advance the simulation clock or shift the physical cough timestamp.
  let report = 0;
  for (const zone of ZONES) {
    const levelDb = result.levelsDb[zone];
    if (levelDb === undefined || Math.sqrt((x - NODE_XY[zone][0]) ** 2 + (y - NODE_XY[zone][1]) ** 2 + 0.8 ** 2) > state.cfg.maxRangeM) continue;
    const tMs = state.nowMs + report++ * 20;
    packet(state, "EVENT", zone, "A", levelDb, tMs);
    packet(state, "ACK", "A", zone, 0, tMs, radios.A.status === "terbatas" ? "terbatas" : "normal");
  }
  const group = (state.log.at(-1)?.id ?? 0) + 1;
  state.lastMerge = { tMs: state.nowMs, group, zones: affected };
  state.counters.coughEvents++;
  const alerted: ZoneId[] = [];
  for (const zone of affected) {
    const current = state.zones[zone];
    current.coughsMs = current.coughsMs.filter((time) => state.nowMs - time <= state.cfg.t2Min * 60000);
    current.coughsMs.push(state.nowMs);
    current.totalCoughs++;
    current.lastCoughMs = state.nowMs;
    log(state, "BATUK", zone, result.levelsDb[zone]!);
    if (current.tier === "normal") {
      current.tier = "tingkat1";
      log(state, "TINGKAT1", zone, result.levelsDb[zone]!);
    }
    if (current.tier === "tingkat1" && current.coughsMs.length >= state.cfg.n2) {
      current.tier = "menunggu";
      current.alertGroup = group;
      current.alertAtMs = state.nowMs;
      current.nextRebuzzMs = state.nowMs + state.cfg.rebuzzMin * 60000;
      current.rebuzzCount = 0;
      log(state, "TINGKAT2", zone, result.levelsDb[zone]!);
      alerted.push(zone);
    }
  }
  if (alerted.length) {
    state.counters.alertEvents++;
    state.pendingGroups.push(group);
    state.pagerBuzzing = true;
    packet(state, "ALERT", "A", "PAGER");
    effect(state, { kind: "buzz", zones: alerted });
  }
}

function handlePager(state: SimState): void {
  const group = state.pendingGroups.shift();
  for (const zone of ZONES) {
    const current = state.zones[zone];
    if (current.tier !== "menunggu" || current.alertGroup !== group) continue;
    current.tier = "ditangani";
    current.pauseUntilMs = state.nowMs + state.cfg.pauseMin * 60000;
    current.nextRebuzzMs = null;
    log(state, "DITANGANI", zone, null, state.nowMs - current.alertAtMs!);
    current.alertGroup = null;
  }
  packet(state, "DONE", "PAGER", "A");
  state.pagerBuzzing = state.pendingGroups.length > 0;
}

export function reduce(state: SimState, action: SimAction): SimState {
  if (action.type === "reset") return createInitialState(state.cfg);
  if (action.type === "tick" && (!Number.isFinite(action.dtMs) || action.dtMs <= 0 || !Number.isFinite(state.nowMs + action.dtMs))) return state;
  if (action.type === "pagerPress" && state.pendingGroups.length === 0) return state;
  if (action.type === "setNode" && action.zone === "A" && action.status === "luring") return state;
  if (action.type === "cough" && (!Number.isFinite(action.x) || !Number.isFinite(action.y))) return state;
  const radios = readRadios(state);
  if (action.type === "setNode" && radios[action.zone].status === action.status) return state;
  const next = copyState(state);
  switch (action.type) {
    case "tick": advance(next, action.dtMs, radios); break;
    case "cough": detectCough(next, action.x, action.y, radios); break;
    case "coughZone": detectCough(next, NODE_XY[action.zone][0], NODE_XY[action.zone][1], radios); break;
    case "speech":
      next.counters.speechIgnored++;
      effect(next, { kind: "speech", x: NODE_XY[action.zone][0], y: NODE_XY[action.zone][1], zones: [action.zone] });
      break;
    case "pagerPress": handlePager(next); break;
    case "setNode":
      if (action.status !== "luring") next.zones[action.zone].nodeStatus = action.status;
      log(next, "STATUS_SIMPUL", action.zone, null, null, action.status);
      break;
  }
  return next;
}
