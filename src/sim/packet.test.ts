import { describe, expect, test } from "vitest";
import { decodePacket, encodePacket, toHex, type PacketFields } from "./packet";
import type { PacketKind } from "./types";

const example: PacketFields = {
  kind: "EVENT", nodeId: "C", seq: 0x1234, tMs: 0x12345678,
  levelDb: -12.34, conf: 230, status: "terbatas",
};

describe("16-byte metadata packets (TRD §7)", () => {
  test("known little-endian bytes, fixed-width hex and zero reserve", () => {
    const bytes = encodePacket(example);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(16);
    expect(toHex(bytes)).toBe("12 02 34 12 78 56 34 12 2e fb e6 01 00 00 00 00");
    expect([...bytes.slice(12)]).toEqual([0, 0, 0, 0]);
    expect(decodePacket(bytes)).toEqual({ version: 1, ...example });
  });

  test.each<PacketKind>(["SYNC", "EVENT", "ACK", "ALERT", "DONE", "HEARTBEAT"])("%s round-trips without changing wire data", (kind) => {
    for (const nodeId of ["A", "B", "C", "D", "PAGER"] as const) {
      for (const status of ["normal", "terbatas", "baterai", "galat"] as const) {
        const fields = { ...example, kind, nodeId, status };
        const bytes = encodePacket(fields);
        expect(bytes).toHaveLength(16);
        expect(decodePacket(bytes)).toEqual({ version: 1, ...fields });
        expect(encodePacket(decodePacket(bytes))).toEqual(bytes);
      }
    }
  });

  test("all numeric field bounds, defaults, and centidecibel quantization", () => {
    for (const levelDb of [-327.68, 327.67]) {
      const fields = { ...example, seq: 65535, tMs: 4294967295, levelDb, conf: 255 };
      expect(decodePacket(encodePacket(fields))).toEqual({ version: 1, ...fields });
    }
    expect(decodePacket(encodePacket({ kind: "SYNC", nodeId: "A", seq: 0, tMs: 0, levelDb: 1.234 })))
      .toMatchObject({ levelDb: 1.23, status: "normal", conf: 230 });
  });

  test("decodes a Uint8Array view at a nonzero byte offset", () => {
    const buffer = new Uint8Array(24);
    buffer.set(encodePacket(example), 4);
    expect(decodePacket(buffer.subarray(4, 20))).toEqual({ version: 1, ...example });
  });

  test("rejects invalid packets and values instead of silently truncating them", () => {
    for (const length of [0, 15, 17]) expect(() => decodePacket(new Uint8Array(length))).toThrow();
    for (const [offset, value] of [[0, 0x22], [0, 0x10], [1, 5], [11, 4], [12, 1]]) {
      const bytes = encodePacket(example);
      bytes[offset] = value;
      expect(() => decodePacket(bytes)).toThrow();
    }
    for (const fields of [{ seq: -1 }, { seq: 65536 }, { seq: 1.5 }, { tMs: 4294967296 }, { tMs: NaN }, { conf: 256 }, { levelDb: Infinity }, { levelDb: 328 }]) {
      expect(() => encodePacket({ ...example, ...fields })).toThrow();
    }
    expect(() => encodePacket({ ...example, status: "luring" } as unknown as PacketFields)).toThrow();
  });
});
