import { describe, expect, test } from "vitest";
import { createInitialState, DEFAULT_CONFIG, reduce } from "./engine";
import { decodePacket } from "./packet";
import { morningScenario } from "./scenario";
import { ZONES, type SimState } from "./types";

const tick = (state: SimState, dtMs: number) => reduce(state, { type: "tick", dtMs });
const cough = (state: SimState, zone = "C" as const) => reduce(state, { type: "coughZone", zone });
function waiting(state = createInitialState()): SimState {
  return cough(tick(cough(state), 1000));
}
function replay(busy = false): SimState {
  let state = createInitialState();
  for (const entry of morningScenario(busy)) {
    state = tick(state, entry.tMs - state.nowMs);
    state = reduce(state, entry.action);
  }
  return state;
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

describe("scenario and time boundaries (TRD §5)", () => {
  test("morning reaches each exact milestone and returns to normal after the pause", () => {
    let state = replay();
    expect(state.log.filter((entry) => entry.kind !== "BATUK").map(({ tMs, kind, responseMs }) => ({ tMs, kind, responseMs }))).toEqual([
      { tMs: 900000, kind: "TINGKAT1", responseMs: null },
      { tMs: 1320000, kind: "TINGKAT2", responseMs: null },
      { tMs: 1480000, kind: "DITANGANI", responseMs: 160000 },
    ]);
    expect(state.zones.C.tier).toBe("ditangani");
    state = tick(state, 899999);
    expect(state.zones.C.tier).toBe("ditangani");
    state = tick(state, 1);
    expect(state.zones.C.tier).toBe("normal");
    expect(state.zones.C.coughsMs).toEqual([]);
    expect(state.log.at(-1)).toMatchObject({ kind: "NORMAL", tMs: 2380000 });
  });

  test("busy staff escalates at 09:25 and responds in exactly 240000 ms", () => {
    const state = replay(true);
    expect(state.log.filter((entry) => entry.kind === "ESKALASI")).toMatchObject([{ zone: "C", tMs: 1500000 }]);
    expect(state.log.at(-1)).toMatchObject({ kind: "DITANGANI", tMs: 1560000, responseMs: 240000 });
  });

  test("900000 ms is inclusive, 901000 ms restarts tier 1", () => {
    const first = cough(createInitialState());
    const boundary = tick(first, 900000);
    expect(boundary.zones.C.tier).toBe("tingkat1");
    expect(cough(boundary).zones.C.tier).toBe("menunggu");
    const late = cough(tick(first, 901000));
    expect(late.zones.C.tier).toBe("tingkat1");
    expect(late.zones.C.coughsMs).toEqual([901000]);
    expect(late.log.some((entry) => entry.kind === "TINGKAT2")).toBe(false);
  });

  test("expired trigger window restarts even while a longer tier 1 hold remains", () => {
    const state = cough(tick(cough(createInitialState({ t1HoldMin: 30 })), 901000));
    expect(state.zones.C.tier).toBe("tingkat1");
    expect(state.zones.C.coughsMs).toEqual([901000]);
  });

  test("N-cough trigger uses the configured inclusive window", () => {
    let state = createInitialState({ n2: 3 });
    state = cough(state);
    state = cough(tick(state, 450000));
    expect(state.zones.C.tier).toBe("tingkat1");
    state = cough(tick(state, 450000));
    expect(state.zones.C.tier).toBe("menunggu");
    expect(cough(createInitialState({ n2: 1 })).zones.C.tier).toBe("menunggu");
  });

  test("rebuzz starts exactly at three minutes and repeats at exact deadlines", () => {
    const state = waiting();
    expect(tick(state, 179999).zones.C.rebuzzCount).toBe(0);
    const escalated = tick(state, 540000);
    expect(escalated.zones.C.rebuzzCount).toBe(3);
    expect(escalated.log.filter((entry) => entry.kind === "ESKALASI").map((entry) => entry.tMs)).toEqual([181000, 361000, 541000]);
  });

  test.each(["normal", "tingkat1", "menunggu", "ditangani"] as const)("one 900000-ms tick equals 900 1000-ms ticks from %s", (tier) => {
    let state = createInitialState();
    if (tier === "tingkat1") state = cough(state);
    if (tier === "menunggu" || tier === "ditangani") state = waiting();
    if (tier === "ditangani") state = reduce(state, { type: "pagerPress" });
    let small = state;
    for (let i = 0; i < 900; i++) small = tick(small, 1000);
    expect(tick(state, 900000)).toEqual(small);
  });

  test("fractional ticks preserve exact periodic and response deadlines", () => {
    let state = tick(createInitialState(), 123.5);
    state = waiting(state);
    state = tick(state, 180000);
    expect(state.log.at(-1)).toMatchObject({ kind: "ESKALASI", tMs: 181123.5 });
    const sync = state.packets.filter((packet) => packet.kind === "SYNC");
    expect(sync.every((packet) => packet.tMs % 10000 === 0)).toBe(true);
    expect(reduce(state, { type: "pagerPress" }).log.at(-1)!.responseMs).toBe(180000);
  });

  test.each([1, 123.5])("tick batching also agrees off the 1-second grid (%s ms)", (offset) => {
    let state = tick(createInitialState(), offset);
    state = cough(state);
    state = tick(state, 10001);
    let small = state;
    for (let i = 0; i < 900; i++) small = tick(small, 1000);
    expect(tick(state, 900000)).toEqual(small);
    expect(small.log.at(-1)!.tMs).toBeGreaterThan(offset + 900000);
  });

  test("tier 1 expires even a fraction of a millisecond past the inclusive boundary", () => {
    const boundary = tick(cough(createInitialState()), 900000);
    expect(boundary.zones.C.tier).toBe("tingkat1");
    expect(tick(boundary, 0.001).zones.C.tier).toBe("normal");
  });
});

describe("cough groups and pager queue", () => {
  test("one ambiguous cough updates two zones; the second creates one alert group", () => {
    let state = reduce(createInitialState(), { type: "cough", x: 5, y: 2.5 });
    expect([state.zones.B.tier, state.zones.C.tier]).toEqual(["tingkat1", "tingkat1"]);
    state = reduce(tick(state, 1000), { type: "cough", x: 5, y: 2.5 });
    expect([state.zones.B.tier, state.zones.C.tier]).toEqual(["menunggu", "menunggu"]);
    expect(state.zones.B.alertGroup).toBe(state.zones.C.alertGroup);
    expect(state.pendingGroups).toEqual([state.zones.B.alertGroup]);
    expect(state.packets.filter((packet) => packet.kind === "ALERT")).toHaveLength(1);
    expect(state.pagerBuzzing).toBe(true);
    state = reduce(tick(state, 5000), { type: "pagerPress" });
    expect([state.zones.B.tier, state.zones.C.tier]).toEqual(["ditangani", "ditangani"]);
    expect(state.log.filter((entry) => entry.kind === "DITANGANI").map((entry) => entry.responseMs)).toEqual([5000, 5000]);
    expect(state.pendingGroups).toEqual([]);
    expect(state.pagerBuzzing).toBe(false);
  });

  test("pager closes the oldest group while leaving later groups buzzing", () => {
    let state = waiting();
    state = reduce(tick(state, 1000), { type: "coughZone", zone: "A" });
    state = reduce(tick(state, 1000), { type: "coughZone", zone: "A" });
    expect(state.pendingGroups).toHaveLength(2);
    state = reduce(state, { type: "pagerPress" });
    expect(state.zones.C.tier).toBe("ditangani");
    expect(state.zones.A.tier).toBe("menunggu");
    expect(state.pendingGroups).toHaveLength(1);
    expect(state.pagerBuzzing).toBe(true);
    state = reduce(state, { type: "pagerPress" });
    expect(state.zones.A.tier).toBe("ditangani");
    expect(state.pagerBuzzing).toBe(false);
  });

  test("coughs within the inclusive merge window count once; the window does not slide", () => {
    let state = cough(createInitialState());
    state = cough(tick(state, 200));
    state = cough(tick(state, 100));
    expect(state.zones.C.totalCoughs).toBe(1);
    expect(state.zones.C.coughsMs).toEqual([0]);
    state = cough(tick(state, 1));
    expect(state.zones.C.totalCoughs).toBe(2);
    expect(state.zones.C.tier).toBe("menunggu");
  });

  test("waiting and handled coughs remain logged without another alert or extending pause", () => {
    let state = waiting();
    state = cough(tick(state, 1000));
    expect(state.packets.filter((packet) => packet.kind === "ALERT")).toHaveLength(1);
    state = reduce(state, { type: "pagerPress" });
    const deadline = state.zones.C.pauseUntilMs!;
    state = cough(tick(state, 1000));
    expect(state.zones.C.tier).toBe("ditangani");
    expect(state.zones.C.totalCoughs).toBe(4);
    expect(state.zones.C.pauseUntilMs).toBe(deadline);
    expect(state.log.at(-1)!.kind).toBe("BATUK");
    state = tick(state, deadline - state.nowMs);
    expect(state.zones.C.coughsMs).toEqual([]);
    expect(state.zones.C.lastCoughMs).toBeNull();
    expect(cough(tick(state, 1000)).zones.C.tier).toBe("tingkat1");
  });
});

describe("node radio, privacy, and reducer integrity", () => {
  test("active nodes in range each send EVENT followed by coordinator ACK, 20 ms apart", () => {
    const state = cough(createInitialState());
    expect(state.packets.map(({ kind, from, to, tMs }) => [kind, from, to, tMs])).toEqual([
      ["EVENT", "B", "A", 0], ["ACK", "A", "B", 0],
      ["EVENT", "C", "A", 20], ["ACK", "A", "C", 20],
      ["EVENT", "D", "A", 40], ["ACK", "A", "D", 40],
    ]);
    expect(state.counters.eventPackets).toBe(3);
    expect(state.counters.audioBytesOut).toBe(0);
    expect(state.zones.C.totalCoughs).toBe(1);
    expect(state.zones.B.totalCoughs).toBe(0);
  });

  test("periodic SYNC every 10 seconds, HEARTBEAT every 30 seconds", () => {
    const state = tick(createInitialState(), 30000);
    expect(state.packets.filter((packet) => packet.kind === "SYNC").map((packet) => packet.tMs)).toEqual([
      ...Array(4).fill(10000), ...Array(4).fill(20000), ...Array(4).fill(30000),
    ]);
    expect(state.packets.filter((packet) => packet.kind === "HEARTBEAT").map((packet) => packet.from)).toEqual(ZONES);
  });

  test("offline stops reporting immediately, appears after 30 seconds, and can recover", () => {
    let state = reduce(createInitialState(), { type: "setNode", zone: "C", status: "luring" });
    expect(state.zones.C.nodeStatus).toBe("normal");
    state = cough(state);
    expect(state.packets.some((packet) => packet.kind === "EVENT" && packet.from === "C")).toBe(false);
    state = tick(state, 29999);
    expect(state.zones.C.nodeStatus).toBe("normal");
    state = tick(state, 1);
    expect(state.zones.C.nodeStatus).toBe("luring");
    expect(state.packets.some((packet) => packet.kind === "HEARTBEAT" && packet.from === "C")).toBe(false);
    state = reduce(state, { type: "setNode", zone: "C", status: "normal" });
    expect(state.zones.C.nodeStatus).toBe("normal");
    state = cough(tick(state, 1000));
    expect(state.packets.some((packet) => packet.kind === "EVENT" && packet.from === "C")).toBe(true);
  });

  test("offline timeout does not restart on repeated commands or undetected coughs", () => {
    let state = createInitialState({ maxRangeM: 1 });
    state = reduce(state, { type: "setNode", zone: "C", status: "luring" });
    state = cough(tick(state, 10000));
    state = reduce(state, { type: "setNode", zone: "C", status: "luring" });
    expect(tick(state, 20000).zones.C.nodeStatus).toBe("luring");
  });

  test("limited nodes do not report coughs, but still send a limited heartbeat", () => {
    let state = reduce(createInitialState(), { type: "setNode", zone: "C", status: "terbatas" });
    state = cough(state);
    expect(state.zones.C.totalCoughs).toBe(0);
    expect(state.packets.some((packet) => packet.kind === "EVENT" && packet.from === "C")).toBe(false);
    state = tick(state, 30000);
    const heartbeat = state.packets.find((packet) => packet.kind === "HEARTBEAT" && packet.from === "C")!;
    expect(decodePacket(heartbeat.bytes).status).toBe("terbatas");
  });

  test("no reporter logs nearest zone without changing tiers, and A cannot go offline", () => {
    const initial = createInitialState();
    expect(reduce(initial, { type: "setNode", zone: "A", status: "luring" })).toBe(initial);
    let state = createInitialState({ maxRangeM: 1 });
    state = reduce(state, { type: "setNode", zone: "C", status: "luring" });
    state = cough(state);
    expect(state.log.at(-1)).toMatchObject({ kind: "STATUS_SIMPUL", zone: "C", status: "luring" });
    expect(state.packets).toHaveLength(0);
    expect(ZONES.every((zone) => state.zones[zone].tier === "normal")).toBe(true);
  });

  test("speech produces only its visual effect and ignored counter", () => {
    const state = reduce(createInitialState(), { type: "speech", zone: "C" });
    expect(state.counters).toEqual({ audioBytesOut: 0, eventPackets: 0, speechIgnored: 1 });
    expect(state.packets).toEqual([]);
    expect(state.log).toEqual([]);
    expect(state.effects).toMatchObject([{ kind: "speech", zones: ["C"] }]);
  });

  test("FIFO bounds, monotonic ids/sequences, and 16-byte packets across a long session", () => {
    let state = waiting();
    state = tick(state, 3600000);
    expect(state.packets).toHaveLength(500);
    expect(state.log.filter((entry) => entry.kind === "ESKALASI")).toHaveLength(20);
    for (let i = 0; i < 60; i++) state = reduce(state, { type: "speech", zone: "C" });
    expect(state.effects).toHaveLength(50);
    for (const collection of [state.log, state.packets, state.effects]) {
      expect(new Set(collection.map((entry) => entry.id)).size).toBe(collection.length);
      expect(collection.every((entry, index) => index === 0 || entry.id > collection[index - 1].id)).toBe(true);
    }
    for (const packet of state.packets) {
      expect(packet.bytes).toHaveLength(16);
      expect(decodePacket(packet.bytes).kind).toBe(packet.kind);
      expect([...packet.bytes.slice(12)]).toEqual([0, 0, 0, 0]);
    }
    expect(state.counters.audioBytesOut).toBe(0);
  });

  test("pure updates tolerate frozen inputs; reset preserves config and clears the session", () => {
    const initial = freezeDeep(createInitialState({ n2: 3 }));
    const first = cough(initial);
    expect(initial.zones.C.totalCoughs).toBe(0);
    const frozen = freezeDeep(first);
    const advanced = tick(frozen, 1000000);
    expect(frozen.nowMs).toBe(0);
    expect(reduce(advanced, { type: "reset" })).toEqual(createInitialState({ n2: 3 }));
    expect(createInitialState().cfg).toEqual(DEFAULT_CONFIG);
    for (const dtMs of [0, -1, Infinity, NaN]) expect(tick(initial, dtMs)).toBe(initial);
    expect(reduce(initial, { type: "pagerPress" })).toBe(initial);
  });
});
