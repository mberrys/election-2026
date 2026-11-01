import { describe, expect, it } from "vitest";
import { stripInline } from "../../src/lib/inline-links";

describe("stripInline", () => {
  it("handles links to the home page", () => {
    expect(stripInline("See the [Big Board](/) tonight.")).toBe("See the Big Board tonight.");
    expect(stripInline("[FEC](https://www.fec.gov/) and [explainers](/explainers)")).toBe("FEC and explainers");
  });
});

describe("protocol-relative links", () => {
  it("treats //host links as external, not site paths", () => {
    expect(stripInline("See [example](//example.com/x).")).toBe("See example.");
  });
});
