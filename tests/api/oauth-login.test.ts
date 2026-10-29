import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, jsonRequest, routeParams } from "../factories";

// Real auth; only the cookie jar is faked, and the ID-token check is mocked
// (tests never call Google／Apple).
const jar = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "auth_token" && jar.cookie ? { value: jar.cookie } : undefined,
    set: (name: string, value: string) => {
      if (name === "auth_token") jar.cookie = value;
    },
  }),
  headers: async () => new Headers(),
}));

const verify = vi.hoisted(() => ({
  identity: null as { sub: string; email: string; audience: string } | null,
}));
vi.mock("@/lib/oauth", () => ({ verifyIdToken: async () => verify.identity }));

const apple = vi.hoisted(() => ({
  exchanged: [] as [string, string][],
  revoked: [] as [string, string][],
}));
vi.mock("@/lib/appleAuth", () => ({
  exchangeAppleCode: async (code: string, clientId: string) => {
    apple.exchanged.push([code, clientId]);
    return `rt-for-${code}`;
  },
  revokeAppleToken: async (token: string, clientId: string) => {
    apple.revoked.push([token, clientId]);
    return true;
  },
}));

import { POST as oauthPost } from "@/app/api/auth/oauth/route";
import { POST as loginPost } from "@/app/api/login/route";
import { DELETE as meDelete } from "@/app/api/me/route";

beforeEach(async () => {
  await resetDb();
  jar.cookie = undefined;
  verify.identity = null;
  apple.exchanged = [];
  apple.revoked = [];
});

function oauth(body: Record<string, unknown>, app = false) {
  return oauthPost(
    new Request("http://test.local/api/auth/oauth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(app ? { "x-googoocard-client": "app" } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

describe("Google／Apple 登入", () => {
  it("ID token 驗不過 → 401，不建帳號", async () => {
    const res = await oauth({ provider: "google", idToken: "bad" });
    expect(res.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
    expect(jar.cookie).toBeUndefined();
  });

  it("不認得的 provider → 400", async () => {
    verify.identity = { sub: "g-1", email: "a@test.local", audience: "web" };
    expect((await oauth({ provider: "line", idToken: "x" })).status).toBe(400);
  });

  it("新的 email → 建新帳號（沒有密碼）並登入；再登入一次還是同一個人", async () => {
    verify.identity = { sub: "apple-1", email: "new@test.local", audience: "com.googoocard.app" };
    const res = await oauth({ provider: "apple", idToken: "x", name: "小明" });
    expect(res.status).toBe(200);
    expect(jar.cookie).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "new@test.local" } });
    expect(user).toMatchObject({ name: "小明", appleSub: "apple-1", password: "!" });

    await oauth({ provider: "apple", idToken: "x" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("同 email 的現有帳號 → 綁上 Google，登入到原本的教室", async () => {
    const classroom = await createClassroom({ email: "Owner@Test.local" });
    verify.identity = { sub: "g-1", email: "owner@test.local", audience: "web" };

    const res = await oauth({ provider: "google", idToken: "x" }, true);
    expect(res.status).toBe(200);
    expect((await res.json()).token).toEqual(expect.any(String));

    const user = await prisma.user.findFirstOrThrow({ where: { googleSub: "g-1" } });
    expect(user.currentClassroomId).toBe(classroom.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("綁過之後換了 email 也認得（用 sub 找）", async () => {
    await prisma.user.create({
      data: { email: "old@test.local", name: "A", password: "x", googleSub: "g-1" },
    });
    verify.identity = { sub: "g-1", email: "changed@test.local", audience: "web" };
    await oauth({ provider: "google", idToken: "x" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("刪除帳號後再用同一個 Apple 帳號登入 → 全新的帳號", async () => {
    verify.identity = { sub: "apple-1", email: "gone@test.local", audience: "com.googoocard.app" };
    await oauth({ provider: "apple", idToken: "x" });
    const first = await prisma.user.findUniqueOrThrow({ where: { email: "gone@test.local" } });

    expect((await meDelete(jsonRequest("DELETE"), routeParams({}))).status).toBe(200);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: first.id } })
    ).toMatchObject({ appleSub: null, googleSub: null });

    await oauth({ provider: "apple", idToken: "x" });
    const second = await prisma.user.findFirstOrThrow({ where: { appleSub: "apple-1" } });
    expect(second.id).not.toBe(first.id);
  });

  it("用 Google／Apple 建的帳號拿 email 密碼登入 → SOCIAL_ONLY", async () => {
    verify.identity = { sub: "g-1", email: "social@test.local", audience: "web" };
    await oauth({ provider: "google", idToken: "x" });

    const res = await loginPost(
      new Request("http://test.local/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "social@test.local", password: "!" }),
      })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "SOCIAL_ONLY", provider: "google" });
  });

  it("Apple 登入帶 code → 換成 refresh token 存起來；刪帳號時撤銷並清掉", async () => {
    verify.identity = { sub: "apple-9", email: "revoke@test.local", audience: "com.googoocard.app" };
    await oauth({ provider: "apple", idToken: "x", code: "c1" });
    expect(apple.exchanged).toEqual([["c1", "com.googoocard.app"]]);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "revoke@test.local" } });
    expect(user).toMatchObject({ appleRefreshToken: "rt-for-c1", appleClientId: "com.googoocard.app" });

    expect((await meDelete(jsonRequest("DELETE"), routeParams({}))).status).toBe(200);
    expect(apple.revoked).toEqual([["rt-for-c1", "com.googoocard.app"]]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      appleRefreshToken: null,
      appleClientId: null,
    });
  });

  it("Google 登入不換 Apple code；沒有 refresh token 的帳號刪除時不撤銷", async () => {
    verify.identity = { sub: "g-2", email: "g2@test.local", audience: "web" };
    await oauth({ provider: "google", idToken: "x", code: "ignored" });
    expect(apple.exchanged).toEqual([]);
    expect((await meDelete(jsonRequest("DELETE"), routeParams({}))).status).toBe(200);
    expect(apple.revoked).toEqual([]);
  });
});
