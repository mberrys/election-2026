import { describe, expect, it } from "vitest";
import { plainText, stripComments } from "../../scripts/lib/wikitext";

describe("wikitext cleanup", () => {
  it("strips comments that re-form after one pass", () => {
    expect(stripComments("a<!<!-- x -->-- y -->b")).toBe("ab");
  });

  it("strips tags", () => {
    expect(plainText("<b>x</b><br/>y")).toBe("x y");
  });

  it("unescapes &amp; last so entities are not double-decoded", () => {
    expect(plainText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(plainText("a &amp;ndash; b")).toBe("a &ndash; b");
  });
});
