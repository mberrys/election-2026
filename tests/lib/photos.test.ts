import { describe, expect, it } from "vitest";
import { candidatePhotoMap, creditText, getCandidateImage, thumbAt } from "../../src/data/reference/images";
import { initials } from "../../src/components/race/face";
import { KEY_RACE_COUNT, selectKeyRaces } from "../../src/components/board/key-races";
import { loadRaces } from "../../src/data/reference/load";

describe("thumbAt", () => {
  const url = "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/A_b_%28c%29.jpg/500px-A_b_%28c%29.jpg";
  it("swaps the width segment for a smaller one", () => {
    expect(thumbAt(url, 120)).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/A_b_%28c%29.jpg/120px-A_b_%28c%29.jpg");
  });
  it("never upsizes and leaves other URLs alone", () => {
    expect(thumbAt(url, 960)).toBe(url);
    expect(thumbAt(url, 500)).toBe(url);
    expect(thumbAt("https://example.com/x.jpg", 120)).toBe("https://example.com/x.jpg");
  });
});

describe("creditText", () => {
  it("joins author and licence", () => {
    expect(creditText({ author: "Jane Doe", license: "CC BY 4.0" })).toBe("Jane Doe / CC BY 4.0");
  });
});

describe("candidatePhotoMap", () => {
  it("includes only candidates with a photo, with a resized thumb and credit", () => {
    const withPhoto = loadRaces().flatMap((m) => m.candidates).find((c) => getCandidateImage(c.id))!;
    const map = candidatePhotoMap([withPhoto.id, "nobody-at-all"], 120);
    expect(Object.keys(map)).toEqual([withPhoto.id]);
    const img = getCandidateImage(withPhoto.id)!;
    expect(map[withPhoto.id].credit).toBe(creditText(img));
    expect(map[withPhoto.id].src).toContain("120px-");
  });
});

describe("initials", () => {
  it("uses first and last word and skips suffixes", () => {
    expect(initials("Jon Ossoff")).toBe("JO");
    expect(initials("Martin Luther King Jr.")).toBe("MK");
    expect(initials("Cher")).toBe("C");
    expect(initials("  ")).toBe("?");
  });
});

describe("selectKeyRaces", () => {
  it("returns at most KEY_RACE_COUNT competitive non-ballot races", () => {
    const picked = selectKeyRaces(loadRaces());
    expect(picked.length).toBeLessThanOrEqual(KEY_RACE_COUNT);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((m) => m.office !== "ballot" && m.office !== "stateleg")).toBe(true);
  });
});
