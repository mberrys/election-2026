import { describe, expect, it } from "vitest";
import { pollCloseUtc } from "../../src/data/election-gate";

describe("pollCloseUtc", () => {
  it("uses EST (UTC-5) on Nov 3 2026", () => {
    expect(pollCloseUtc({ pollCloseEt: "19:00" }).toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });
  it("takes the last close for split states", () => {
    expect(pollCloseUtc({ pollCloseEt: "19:00/20:00" }).toISOString()).toBe("2026-11-04T01:00:00.000Z");
  });
  it("puts after-midnight closes on Nov 4", () => {
    expect(pollCloseUtc({ pollCloseEt: "00:00/01:00" }).toISOString()).toBe("2026-11-04T06:00:00.000Z");
  });
});
