import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { hit, reset, resetAll, clientIp } from "./rateLimit";

const OPTS = { limit: 3, windowMs: 1000 };

describe("rateLimit", () => {
  beforeEach(() => {
    resetAll();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("允許到上限為止", () => {
    expect(hit("k", OPTS).ok).toBe(true);
    expect(hit("k", OPTS).ok).toBe(true);
    expect(hit("k", OPTS).ok).toBe(true);
    expect(hit("k", OPTS).ok).toBe(false);
  });

  it("被擋下時回報還要等幾秒", () => {
    hit("k", OPTS);
    hit("k", OPTS);
    hit("k", OPTS);
    const blocked = hit("k", OPTS);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("視窗滑過後重新放行", () => {
    hit("k", OPTS);
    hit("k", OPTS);
    hit("k", OPTS);
    expect(hit("k", OPTS).ok).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(hit("k", OPTS).ok).toBe(true);
  });

  it("被擋下的請求不會把封鎖時間往後推", () => {
    hit("k", OPTS);
    hit("k", OPTS);
    hit("k", OPTS);

    // 在視窗內狂打，不該延長封鎖 —— 否則攻擊者能把真正的使用者永久鎖死。
    vi.advanceTimersByTime(900);
    expect(hit("k", OPTS).ok).toBe(false);
    expect(hit("k", OPTS).ok).toBe(false);

    vi.advanceTimersByTime(101);
    expect(hit("k", OPTS).ok).toBe(true);
  });

  it("不同 key 各自計數", () => {
    hit("a", OPTS);
    hit("a", OPTS);
    hit("a", OPTS);
    expect(hit("a", OPTS).ok).toBe(false);
    expect(hit("b", OPTS).ok).toBe(true);
  });

  it("reset 後重新開始", () => {
    hit("k", OPTS);
    hit("k", OPTS);
    hit("k", OPTS);
    expect(hit("k", OPTS).ok).toBe(false);

    reset("k");
    expect(hit("k", OPTS).ok).toBe(true);
  });

  describe("clientIp", () => {
    it("取 x-forwarded-for 最左邊那個（原始 client）", () => {
      const req = new Request("http://test.local", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(clientIp(req)).toBe("1.2.3.4");
    });

    it("退回 x-real-ip", () => {
      const req = new Request("http://test.local", {
        headers: { "x-real-ip": "9.9.9.9" },
      });
      expect(clientIp(req)).toBe("9.9.9.9");
    });

    it("都沒有時回 unknown（降級成 per-email 限制，不是完全放行）", () => {
      expect(clientIp(new Request("http://test.local"))).toBe("unknown");
    });
  });
});
