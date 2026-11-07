export type ZoneId = "A" | "B" | "C" | "D";
export const ZONES: readonly ZoneId[] = ["A", "B", "C", "D"];

export type NodeStatus = "normal" | "terbatas" | "luring";
export type ZoneTier = "normal" | "tingkat1" | "menunggu" | "ditangani";
export type PacketKind = "SYNC" | "EVENT" | "ACK" | "ALERT" | "DONE" | "HEARTBEAT";
export type Endpoint = ZoneId | "PAGER" | "DASBOR";

export interface SimConfig {
  n2: number;          // 2
  t2Min: number;       // 15
  t1HoldMin: number;   // 15, asumsi A1
  rebuzzMin: number;   // 3
  pauseMin: number;    // 15
  mergeMs: number;     // 300
  ambiguousDb: number; // 3
  maxRangeM: number;   // 4
  startClockMin: number; // 540, artinya 09.00
}

export interface Attribution {
  primary: ZoneId;
  secondary: ZoneId | null; // terisi bila deltaDb < ambiguousDb
  deltaDb: number;
  levelsDb: Partial<Record<ZoneId, number>>; // relatif terhadap 1 m
}

export interface ZoneState {
  tier: ZoneTier;
  coughsMs: number[];      // waktu batuk dalam jendela aktif
  totalCoughs: number;
  lastCoughMs: number | null;
  alertGroup: number | null;
  alertAtMs: number | null;
  rebuzzCount: number;
  nextRebuzzMs: number | null;
  pauseUntilMs: number | null;
  nodeStatus: NodeStatus;
}

export interface PacketTrace {
  id: number;
  tMs: number;
  kind: PacketKind;
  from: Endpoint;
  to: Endpoint;
  bytes: Uint8Array; // tepat 16 byte
}

export type LogKind = "BATUK" | "TINGKAT1" | "TINGKAT2" | "ESKALASI" | "DITANGANI" | "NORMAL" | "STATUS_SIMPUL";

/** Hanya metadata. Tipe ini sengaja tidak memiliki medan audio. */
export interface LogEntry {
  id: number;
  tMs: number;
  kind: LogKind;
  zone: ZoneId;
  count: number;
  levelDb: number | null;
  status: NodeStatus;
  responseMs: number | null;
}

export interface SimEffect {
  id: number;
  tMs: number;
  kind: "ripple" | "speech" | "buzz";
  x?: number;
  y?: number;
  zones?: ZoneId[];
}

export interface SimState {
  cfg: SimConfig;
  nowMs: number;
  zones: Record<ZoneId, ZoneState>;
  packets: PacketTrace[];   // FIFO, maksimal 500
  log: LogEntry[];          // append-only selama sesi
  effects: SimEffect[];     // antrean animasi, maksimal 50
  pagerBuzzing: boolean;
  pendingGroups: number[];  // kelompok peringatan, tertua di depan
  seq: Record<ZoneId, number>;
  counters: { audioBytesOut: 0; eventPackets: number; speechIgnored: number };
  lastMerge: { tMs: number; group: number } | null;
}

export type SimAction =
  | { type: "cough"; x: number; y: number }
  | { type: "coughZone"; zone: ZoneId }
  | { type: "speech"; zone: ZoneId }
  | { type: "pagerPress" }
  | { type: "tick"; dtMs: number }
  | { type: "setNode"; zone: ZoneId; status: NodeStatus }
  | { type: "reset" };
