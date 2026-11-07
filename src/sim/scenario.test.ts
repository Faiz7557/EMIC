import { expect, test } from "vitest";
import { morningScenario } from "./scenario";

test("morning scenario contains only timed actions; busy branch changes only pager time", () => {
  const actions = [
    { tMs: 300000, action: { type: "speech", zone: "C" } },
    { tMs: 900000, action: { type: "coughZone", zone: "C" } },
    { tMs: 1320000, action: { type: "coughZone", zone: "C" } },
    { tMs: 1480000, action: { type: "pagerPress" } },
  ];
  expect(morningScenario()).toEqual(actions);
  expect(morningScenario(true)).toEqual([...actions.slice(0, 3), { tMs: 1560000, action: { type: "pagerPress" } }]);
  expect(morningScenario()).not.toBe(morningScenario());
});
