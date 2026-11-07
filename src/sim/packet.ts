import type { PacketKind, ZoneId } from "./types";

const KINDS: readonly PacketKind[] = ["SYNC", "EVENT", "ACK", "ALERT", "DONE", "HEARTBEAT"];
const NODES = ["A", "B", "C", "D", "PAGER"] as const;
const STATUSES = ["normal", "terbatas", "baterai", "galat"] as const;
export type PacketStatus = typeof STATUSES[number];

export interface PacketFields {
  kind: PacketKind;
  nodeId: ZoneId | "PAGER";
  seq: number;
  tMs: number;
  /** dB, quantized to the nearest 0.01 dB on the wire. */
  levelDb: number;
  conf?: number;
  status?: PacketStatus;
}

export interface DecodedPacket extends Required<PacketFields> {
  version: 1;
}

function integer(value: number, min: number, max: number, field: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`Invalid ${field}`);
  return value;
}

/** A6: fixed 16-byte, little-endian metadata layout from TRD §7. */
export function encodePacket(fields: PacketFields): Uint8Array {
  const kind = KINDS.indexOf(fields.kind) + 1;
  const node = NODES.indexOf(fields.nodeId);
  const status = STATUSES.indexOf(fields.status ?? "normal");
  integer(kind, 1, 6, "kind");
  integer(node, 0, 4, "nodeId");
  integer(status, 0, 3, "status");
  if (!Number.isFinite(fields.levelDb)) throw new RangeError("Invalid levelDb");
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, (1 << 4) | kind);
  view.setUint8(1, node);
  view.setUint16(2, integer(fields.seq, 0, 0xffff, "seq"), true);
  view.setUint32(4, integer(fields.tMs, 0, 0xffffffff, "tMs"), true);
  view.setInt16(8, integer(Math.round(fields.levelDb * 100), -32768, 32767, "levelDb"), true);
  view.setUint8(10, integer(fields.conf ?? 230, 0, 255, "conf"));
  view.setUint8(11, status);
  return bytes;
}

export function decodePacket(bytes: Uint8Array): DecodedPacket {
  if (bytes.byteLength !== 16) throw new RangeError("Packet must contain exactly 16 bytes");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = view.getUint8(0);
  const kind = (header & 15) - 1;
  const node = view.getUint8(1);
  const status = view.getUint8(11);
  if (header >> 4 !== 1 || !KINDS[kind] || !NODES[node] || !STATUSES[status] || view.getUint32(12, true) !== 0) {
    throw new RangeError("Unsupported packet header or reserved field");
  }
  return {
    version: 1, kind: KINDS[kind], nodeId: NODES[node],
    seq: view.getUint16(2, true), tMs: view.getUint32(4, true),
    levelDb: view.getInt16(8, true) / 100, conf: view.getUint8(10), status: STATUSES[status],
  };
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
