import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, jsonRequest } from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

// 攔下真正的發送：測試絕不可打到瀏覽器的推播服務或 Expo。
const web = vi.hoisted(() => ({
  configured: true,
  sent: [] as { endpoint: string; payload: Record<string, unknown> }[],
  results: new Map<string, "ok" | "gone" | "error">(),
}));
vi.mock("@/lib/webPush", () => ({
  webPushConfigured: () => web.configured,
  sendWebPush: async (target: { endpoint: string }, payload: Record<string, unknown>) => {
    web.sent.push({ endpoint: target.endpoint, payload });
    return web.results.get(target.endpoint) ?? "ok";
  },
}));
const expo = vi.hoisted(() => ({ fail: false, sent: 0 }));
vi.mock("@/lib/expoPush", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/expoPush")>();
  return {
    ...actual,
    sendExpoPush: async (messages: unknown[]) => {
      if (expo.fail) throw new Error("expo down");
      expo.sent += messages.length;
      return messages.map(() => ({ status: "ok", id: "ticket" }));
    },
  };
});

import { POST, DELETE } from "@/app/api/web-push-subscriptions/route";
import { DELETE as DELETE_ME } from "@/app/api/me/route";
import { notifyClassroom } from "@/service/push";

const ENDPOINT_A = "https://push.example/a";
const ENDPOINT_B = "https://push.example/b";
const push = { type: "NEEDS_RENEWAL" as const, title: "需續約", body: "小明 的卡用完了", path: "/students/5" };

let classroomId: number;

const subscribe = (endpoint: string) =>
  POST(
    jsonRequest("POST", { endpoint, keys: { p256dh: "p256", auth: "secret" } }),
    { params: Promise.resolve({}) }
  );

async function addSubscription(userId: number, endpoint: string) {
  await prisma.webPushSubscription.create({ data: { userId, endpoint, p256dh: "p", auth: "a" } });
}

beforeEach(async () => {
  await resetDb();
  classroomId = (await createClassroom()).id;
  auth.userId = 1;
  auth.classroomId = classroomId;
  web.configured = true;
  web.sent.length = 0;
  web.results.clear();
  expo.fail = false;
  expo.sent = 0;
});

describe("/api/web-push-subscriptions", () => {
  it("訂閱；同一個瀏覽器換帳號登入 → 改掛到新帳號", async () => {
    expect((await subscribe(ENDPOINT_A)).status).toBe(200);
    const assistant = await createMember(classroomId);
    auth.userId = assistant.id;
    await subscribe(ENDPOINT_A);

    const rows = await prisma.webPushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(assistant.id);
  });

  it("endpoint 不是 https 網址 → 400", async () => {
    expect((await subscribe("http://push.example/a")).status).toBe(400);
    expect((await subscribe("not a url")).status).toBe(400);
  });

  it("DELETE 只刪自己的", async () => {
    const assistant = await createMember(classroomId);
    await addSubscription(assistant.id, ENDPOINT_A);
    await DELETE(jsonRequest("DELETE", { endpoint: ENDPOINT_A }), { params: Promise.resolve({}) });
    expect(await prisma.webPushSubscription.count()).toBe(1);
  });

  it("刪除帳號時一併刪除", async () => {
    const assistant = await createMember(classroomId);
    await addSubscription(assistant.id, ENDPOINT_A);
    auth.userId = assistant.id;
    expect((await DELETE_ME(jsonRequest("DELETE"), { params: Promise.resolve({}) })).status).toBe(200);
    expect(await prisma.webPushSubscription.count()).toBe(0);
  });
});

describe("notifyClassroom → 網頁推播", () => {
  it("推給教室成員的瀏覽器，點開先切教室再開頁面", async () => {
    const assistant = await createMember(classroomId);
    const other = await createClassroom({ name: "別間", email: "other@test.local" });
    const outsider = await prisma.membership.findFirstOrThrow({ where: { classroomId: other.id } });
    await addSubscription(1, ENDPOINT_A);
    await addSubscription(assistant.id, ENDPOINT_B);
    await addSubscription(outsider.userId, "https://push.example/outsider");

    await notifyClassroom(classroomId, push);

    expect(web.sent.map((s) => s.endpoint).sort()).toEqual([ENDPOINT_A, ENDPOINT_B]);
    expect(web.sent[0].payload).toMatchObject({
      title: "需續約",
      body: "小明 的卡用完了",
      url: `/notification?classroomId=${classroomId}&next=%2Fstudents%2F5`,
      badge: 0,
    });
  });

  it("沒設 VAPID 金鑰 → 不發", async () => {
    web.configured = false;
    await addSubscription(1, ENDPOINT_A);
    await notifyClassroom(classroomId, push);
    expect(web.sent).toHaveLength(0);
  });

  it("關掉這一類的人不收", async () => {
    await addSubscription(1, ENDPOINT_A);
    await prisma.notificationPreference.create({
      data: { userId: 1, classroomId, type: "NEEDS_RENEWAL", enabled: false },
    });
    await notifyClassroom(classroomId, push);
    expect(web.sent).toHaveLength(0);
  });

  it("失效的訂閱（404/410）被刪掉，暫時性錯誤保留", async () => {
    await addSubscription(1, ENDPOINT_A);
    await addSubscription(1, ENDPOINT_B);
    web.results.set(ENDPOINT_A, "gone");
    web.results.set(ENDPOINT_B, "error");

    await notifyClassroom(classroomId, push);
    const left = await prisma.webPushSubscription.findMany();
    expect(left.map((s) => s.endpoint)).toEqual([ENDPOINT_B]);
  });

  it("Expo 掛掉不影響網頁推播，反之亦然", async () => {
    await prisma.pushToken.create({ data: { userId: 1, token: "ExponentPushToken[a]", platform: "ios" } });
    await addSubscription(1, ENDPOINT_A);
    expo.fail = true;

    await expect(notifyClassroom(classroomId, push)).resolves.toBeUndefined();
    expect(web.sent).toHaveLength(1);
  });
});
