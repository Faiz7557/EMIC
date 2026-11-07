import { expect, test } from "vitest";
import { ZONES } from "./types";

test("empat zona", () => {
  expect(ZONES).toEqual(["A", "B", "C", "D"]);
});
