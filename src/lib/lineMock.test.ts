import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeMockToken, encodeMockToken, isLineMockEnabled, newMockLineUserId } from "@/lib/lineMock";
import { verifyIdToken } from "@/lib/line";

const user = { userId: "Umock123", name: "小美 🌸", picture: "https://example.com/a.png" };

describe("lineMock", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("round-trips a persona through the mock token (UTF-8 names)", () => {
    expect(decodeMockToken(encodeMockToken(user))).toEqual(user);
  });

  it("rejects malformed mock tokens", () => {
    expect(decodeMockToken("mock.not-json")).toBeNull();
    expect(decodeMockToken("eyJhbGciOi.real.jwt")).toBeNull();
  });

  it("generates LINE-shaped user ids", () => {
    expect(newMockLineUserId()).toMatch(/^Umock[0-9a-f]{28}$/);
  });

  it("is off unless NEXT_PUBLIC_LINE_MOCK=1, and always off on Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_LINE_MOCK", "");
    expect(isLineMockEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_LINE_MOCK", "1");
    expect(isLineMockEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isLineMockEnabled()).toBe(false);
  });

  describe("verifyIdToken", () => {
    it("accepts a mock token only in mock mode, without calling LINE", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      vi.stubEnv("NEXT_PUBLIC_LINE_MOCK", "1");

      expect(await verifyIdToken(encodeMockToken(user))).toEqual(user);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("refuses mock tokens when mock mode is off (production)", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      vi.stubEnv("NEXT_PUBLIC_LINE_MOCK", "1");
      vi.stubEnv("VERCEL_ENV", "production");

      expect(await verifyIdToken(encodeMockToken(user))).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
