import { describe, it, expect } from "vitest";
import { periodNotice } from "./periodNotice";

describe("periodNotice", () => {
  const at = (iso: string) => new Date(iso);

  it("another day → notToday (past or future)", () => {
    expect(periodNotice(at("2026-11-03T12:00:00"), at("2026-11-05T10:00:00"))).toBe("notToday");
    expect(periodNotice(at("2026-11-07T12:00:00"), at("2026-11-05T10:00:00"))).toBe("notToday");
  });

  it("later today → notStarted", () => {
    expect(periodNotice(at("2026-11-05T19:30:00"), at("2026-11-05T10:00:00"))).toBe("notStarted");
  });

  it("today and already started → no notice", () => {
    expect(periodNotice(at("2026-11-05T09:00:00"), at("2026-11-05T10:00:00"))).toBeNull();
    expect(periodNotice(at("2026-11-05T10:00:00"), at("2026-11-05T10:00:00"))).toBeNull();
  });
});
