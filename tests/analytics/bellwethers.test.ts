import { describe, expect, it } from "vitest";
import { rankBellwethers } from "../../src/analytics/bellwethers";

describe("rankBellwethers", () => {
  const state = { margin2024: -2, margin2020: 1 };
  const units = [
    { id: "B", name: "Bigrural", margin2024: -10, margin2020: -5 }, // leans -8, -6 -> 7
    { id: "A", name: "Average", margin2024: -1, margin2020: 2 }, // leans +1, +1 -> 1
    { id: "C", name: "Close", margin2024: -2 }, // lean 0 (one baseline)
    { id: "N", name: "NoData" },
  ];

  it("ranks by mean absolute lean across available baselines", () => {
    const r = rankBellwethers(units, state, 10);
    expect(r.map((b) => b.id)).toEqual(["C", "A", "B"]);
    expect(r[0]).toMatchObject({ lean: 0, absLean: 0, baselines: 1 });
    expect(r[1]).toMatchObject({ lean: 1, absLean: 1, baselines: 2 });
    expect(r[2]).toMatchObject({ lean: -7, absLean: 7, baselines: 2 });
  });

  it("uses absolute lean per baseline, not the absolute of the mean", () => {
    const r = rankBellwethers([{ id: "X", margin2024: 3, margin2020: -4 }], state, 1);
    // leans +5 and -5 -> mean 0, abs 5
    expect(r[0].lean).toBe(0);
    expect(r[0].absLean).toBe(5);
  });

  it("returns top N and prefers more baselines on ties", () => {
    const r = rankBellwethers(
      [
        { id: "one", margin2024: -2 },
        { id: "two", margin2024: -2, margin2020: 1 },
      ],
      state,
      1,
    );
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("two");
  });

  it("returns nothing when the state has no baselines", () => {
    expect(rankBellwethers(units, {}, 5)).toEqual([]);
  });
});
