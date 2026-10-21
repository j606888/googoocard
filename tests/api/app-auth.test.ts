import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, jsonRequest, routeParams } from "../factories";

// Real `decodeAuthToken`; only the request's cookie jar and headers are faked.
const jar = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  bearer: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "auth_token" && jar.cookie ? { value: jar.cookie } : undefined,
    set: (name: string, value: string) => {
      if (name === "auth_token") jar.cookie = value;
    },
  }),
  headers: async () =>
    new Headers(jar.bearer ? { authorization: `Bearer ${jar.bearer}` } : {}),
}));

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { decodeAuthToken, generateAppToken, generateAuthToken } from "@/lib/auth";
import { POST as loginPost } from "@/app/api/login/route";
import { POST as tokenPost } from "@/app/api/app/token/route";
import { POST as webSessionPost } from "@/app/api/app/web-session/route";
import { POST as switchPost } from "@/app/api/classrooms/[id]/switch/route";
import { GET as todosGet } from "@/app/api/todos/route";
import { DELETE as meDelete } from "@/app/api/me/route";

const OWNER_ID = 1;

beforeEach(async () => {
  await resetDb();
  jar.cookie = undefined;
  jar.bearer = undefined;
});

function appLogin(email: string) {
  return loginPost(
    new Request("http://test.local/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-googoocard-client": "app" },
      body: JSON.stringify({ email, password: "password" }),
    })
  );
}

const todos = () => todosGet(new Request("http://test.local/api/todos"), routeParams({}));
const webSession = (next: string) =>
  webSessionPost(
    new Request(`http://test.local/api/app/web-session?next=${encodeURIComponent(next)}`, {
      method: "POST",
    })
  );

describe("App 登入（bearer token）", () => {
  it("App 登入拿到 token、不設 cookie，之後用 bearer 打 API", async () => {
    await createClassroom({ name: "Studio A" });
    await prisma.user.update({
      where: { id: OWNER_ID },
      data: { password: await bcrypt.hash("password", 4) },
    });

    const res = await appLogin("owner@test.local");
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(token).toEqual(expect.any(String));
    expect(jar.cookie).toBeUndefined();

    jar.bearer = token;
    expect((await todos()).status).toBe(200);
  });

  it("網頁的 cookie JWT 不能拿來當 bearer", async () => {
    const classroom = await createClassroom();
    jar.bearer = generateAuthToken(OWNER_ID, classroom.id);
    expect((await todos()).status).toBe(401);
  });

  it("App token 跟著 currentClassroomId：在 WebView 切換教室，App 也跟著切", async () => {
    const a = await createClassroom({ name: "A" });
    const b = await createClassroom({ name: "B", ownerUserId: OWNER_ID });
    await prisma.user.update({ where: { id: OWNER_ID }, data: { currentClassroomId: a.id } });

    jar.bearer = generateAppToken(OWNER_ID);
    expect((await decodeAuthToken()).classroomId).toBe(a.id);

    // The WebView switches with its cookie…
    jar.bearer = undefined;
    jar.cookie = generateAuthToken(OWNER_ID, a.id);
    expect((await switchPost(jsonRequest("POST"), routeParams({ id: String(b.id) }))).status).toBe(200);

    // …and the App's bearer follows.
    jar.bearer = generateAppToken(OWNER_ID);
    expect((await decodeAuthToken()).classroomId).toBe(b.id);
  });

  it("被移出目前的教室 → App 的 bearer 立刻 401", async () => {
    const classroom = await createClassroom();
    const assistant = await createMember(classroom.id, { email: "assistant@test.local" });
    await prisma.user.update({
      where: { id: assistant.id },
      data: { currentClassroomId: classroom.id },
    });
    jar.bearer = generateAppToken(assistant.id);
    expect((await todos()).status).toBe(200);

    await prisma.membership.deleteMany({ where: { userId: assistant.id } });
    expect((await todos()).status).toBe(401);
  });

  it("刪除帳號後，App 的 bearer 失效", async () => {
    const classroom = await createClassroom();
    const assistant = await createMember(classroom.id, { email: "assistant@test.local" });
    jar.bearer = generateAppToken(assistant.id);

    expect((await meDelete(jsonRequest("DELETE"), routeParams({}))).status).toBe(200);
    expect((await tokenPost(jsonRequest("POST"), routeParams({}))).status).toBe(401);
  });
});

describe("POST /api/app/token", () => {
  it("用 bearer 換新的 token", async () => {
    await createClassroom();
    jar.bearer = generateAppToken(OWNER_ID);
    const res = await tokenPost(jsonRequest("POST"), routeParams({}));
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect((jwt.decode(token) as { userId: number; app: boolean })).toMatchObject({
      userId: OWNER_ID,
      app: true,
    });
  });

  it("只有網頁 cookie → 401（頁面上的程式拿不到 App token）", async () => {
    const classroom = await createClassroom();
    jar.cookie = generateAuthToken(OWNER_ID, classroom.id);
    expect((await tokenPost(jsonRequest("POST"), routeParams({}))).status).toBe(401);
  });
});

describe("POST /api/app/web-session", () => {
  it("bearer 換成網頁 cookie（綁目前的教室），303 到 next", async () => {
    const classroom = await createClassroom();
    await prisma.user.update({ where: { id: OWNER_ID }, data: { currentClassroomId: classroom.id } });
    jar.bearer = generateAppToken(OWNER_ID);

    const res = await webSession("/students/5");
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/students/5");
    const cookie = res.headers.get("set-cookie")!;
    const value = cookie.match(/auth_token=([^;]+)/)![1];
    expect(jwt.decode(value)).toMatchObject({ userId: OWNER_ID, classroomId: classroom.id });
  });

  it("next 不是站內路徑 → 改導到首頁", async () => {
    await createClassroom();
    jar.bearer = generateAppToken(OWNER_ID);
    for (const next of ["//evil.example", "https://evil.example"]) {
      const res = await webSession(next);
      expect(new URL(res.headers.get("location")!).host).toBe("test.local");
      expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    }
  });

  it("沒有 bearer → 導到登入頁，不設 cookie", async () => {
    const res = await webSession("/");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
