import { describe, expect, it } from "vitest";
import { bestNameMatch, nameSimilarity, normalizeName } from "./nameMatch";

describe("normalizeName", () => {
  it("drops spaces, punctuation and emoji, lowercases", () => {
    expect(normalizeName("小美 Mei 💃")).toBe("小美mei");
    expect(normalizeName("Kevin_Lin!")).toBe("kevinlin");
  });
});

describe("nameSimilarity", () => {
  it("matches a LINE nickname inside the full name", () => {
    expect(nameSimilarity("小美 Mei", "陳小美")).toBeCloseTo(2 / 3);
    expect(nameSimilarity("kevin", "Kevin Lin")).toBe(1);
  });
  it("needs at least two characters in a row", () => {
    expect(nameSimilarity("小明", "陳小美")).toBe(0);
  });
  it("a one-character name must match exactly", () => {
    expect(nameSimilarity("美", "美")).toBe(1);
    expect(nameSimilarity("美", "陳小美")).toBe(1);
    expect(nameSimilarity("A", "Bob")).toBe(0);
  });
  it("is 0 for empty names", () => {
    expect(nameSimilarity("🙂", "陳小美")).toBe(0);
  });
});

describe("bestNameMatch", () => {
  const roster = [
    { id: 1, name: "陳小美" },
    { id: 2, name: "阿哲" },
    { id: 3, name: "Kevin" },
  ];
  it("picks the one clear match", () => {
    expect(bestNameMatch("小美 Mei", roster)?.id).toBe(1);
    expect(bestNameMatch("Kevin 🕺", roster)?.id).toBe(3);
  });
  it("returns null when nobody is close", () => {
    expect(bestNameMatch("Sean", roster)).toBeNull();
  });
  it("returns null on a tie", () => {
    expect(bestNameMatch("小美", [{ id: 1, name: "陳小美" }, { id: 2, name: "林小美" }])).toBeNull();
  });
});
