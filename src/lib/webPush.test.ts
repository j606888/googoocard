import { describe, it, expect, vi, beforeEach } from "vitest";

const lib = vi.hoisted(() => ({ error: null as null | { statusCode: number }, calls: 0 }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async () => {
      lib.calls++;
      if (lib.error) throw lib.error;
    },
  },
}));

import { sendWebPush, webPushConfigured } from "./webPush";

const target = { endpoint: "https://push.example/a", p256dh: "p", auth: "a" };
const payload = { title: "t", body: "b", url: "/" };

beforeEach(() => {
  lib.error = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendWebPush", () => {
  it("送出成功 → ok", async () => {
    expect(await sendWebPush(target, payload)).toBe("ok");
  });

  it.each([404, 410])("%i → gone（訂閱失效，呼叫端刪掉）", async (statusCode) => {
    lib.error = { statusCode };
    expect(await sendWebPush(target, payload)).toBe("gone");
  });

  it("其他錯誤 → error（留著下次再試）", async () => {
    lib.error = { statusCode: 500 };
    expect(await sendWebPush(target, payload)).toBe("error");
  });
});

describe("webPushConfigured", () => {
  it("兩把金鑰都要有", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(webPushConfigured()).toBe(false);
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    expect(webPushConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
