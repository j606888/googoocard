import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, jsonRequest, routeParams } from "../factories";

// Real `decodeAuthToken` (only the cookie jar is faked), like
// classroom-lifecycle.test.ts: transferring ownership and deleting an account
// are only correct if the very next request sees the new state.
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "auth_token" && jar.token ? { value: jar.token } : undefined,
    set: (name: string, value: string) => {
      if (name === "auth_token") jar.token = value;
    },
  }),
}));

import { generateAuthToken } from "@/lib/auth";
import { POST as transferPost } from "@/app/api/memberships/[id]/transfer-ownership/route";
import { POST as leavePost } from "@/app/api/classrooms/[id]/leave/route";
import { DELETE as classroomDelete } from "@/app/api/classrooms/[id]/route";
import { GET as classroomsGet } from "@/app/api/classrooms/route";
import { GET as meGet, DELETE as meDelete } from "@/app/api/me/route";
import { POST as pushTokenPost } from "@/app/api/push-tokens/route";

const OWNER_ID = 1;

function signIn(userId: number, classroomId?: number) {
  jar.token = generateAuthToken(userId, classroomId);
}

async function seed() {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  const assistant = await createMember(classroom.id, { email: "assistant@test.local" });
  const assistantMembership = await prisma.membership.findFirstOrThrow({
    where: { userId: assistant.id },
  });
  signIn(OWNER_ID, classroom.id);
  return { classroom, assistant, assistantMembership };
}

const transfer = (membershipId: number) =>
  transferPost(jsonRequest("POST"), routeParams({ id: String(membershipId) }));
const deleteMe = () => meDelete(jsonRequest("DELETE"), routeParams({}));

describe("POST /api/memberships/[id]/transfer-ownership", () => {
  it("owner 交給助教：角色對調、ownerId 跟著走，原 owner 之後可以退出", async () => {
    const { classroom, assistant, assistantMembership } = await seed();

    const res = await transfer(assistantMembership.id);
    expect(res.status).toBe(200);

    const memberships = await prisma.membership.findMany({
      where: { classroomId: classroom.id },
      orderBy: { userId: "asc" },
    });
    expect(memberships.map((m) => [m.userId, m.role])).toEqual([
      [OWNER_ID, "assistant"],
      [assistant.id, "owner"],
    ]);
    expect((await prisma.classroom.findUniqueOrThrow({ where: { id: classroom.id } })).ownerId).toBe(
      assistant.id
    );

    const leave = await leavePost(jsonRequest("POST"), routeParams({ id: String(classroom.id) }));
    expect(leave.status).toBe(200);
  });

  it("助教不能轉移 → 403", async () => {
    const { classroom, assistant } = await seed();
    const ownerMembership = await prisma.membership.findFirstOrThrow({ where: { userId: OWNER_ID } });
    signIn(assistant.id, classroom.id);

    const res = await transfer(ownerMembership.id);
    expect(res.status).toBe(403);
  });

  it("別間教室的成員 → 404，什麼都沒變", async () => {
    await seed();
    const other = await createClassroom({ name: "別間", email: "other@test.local" });
    const outsider = await prisma.membership.findFirstOrThrow({ where: { classroomId: other.id } });

    const res = await transfer(outsider.id);
    expect(res.status).toBe(404);
    expect((await prisma.membership.findFirstOrThrow({ where: { userId: OWNER_ID } })).role).toBe("owner");
  });

  it("轉給自己 → 400", async () => {
    await seed();
    const mine = await prisma.membership.findFirstOrThrow({ where: { userId: OWNER_ID } });
    const res = await transfer(mine.id);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/me", () => {
  it("還擁有未封存的教室 → 409 並列出教室，帳號不動", async () => {
    await seed();

    const res = await deleteMe();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("OWNS_CLASSROOMS");
    expect(body.classrooms.map((c: { name: string }) => c.name)).toEqual(["Studio A"]);

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: OWNER_ID } });
    expect(owner.deletedAt).toBeNull();
    expect(owner.email).toBe("owner@test.local");
  });

  it("助教刪除帳號：移出教室、資料匿名化、email 釋出、token 清掉", async () => {
    const { classroom, assistant } = await seed();
    await prisma.user.update({
      where: { id: assistant.id },
      data: { lineUserId: "U123", currentClassroomId: classroom.id },
    });
    await prisma.pushToken.create({
      data: { userId: assistant.id, token: "ExponentPushToken[x]", platform: "ios" },
    });
    signIn(assistant.id, classroom.id);

    const res = await deleteMe();
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: assistant.id } });
    expect(user).toMatchObject({
      name: "已刪除的使用者",
      lineUserId: null,
      currentClassroomId: null,
    });
    expect(user.email).not.toBe("assistant@test.local");
    expect(user.deletedAt).not.toBeNull();
    expect(await prisma.membership.count({ where: { userId: assistant.id } })).toBe(0);
    expect(await prisma.pushToken.count()).toBe(0);
  });

  it("刪除後，其他裝置上的舊 JWT 什麼都打不進去", async () => {
    const { classroom, assistant } = await seed();
    signIn(assistant.id, classroom.id);
    const staleToken = jar.token;
    await deleteMe();

    jar.token = staleToken;
    expect((await meGet()).status).toBe(404);
    expect((await classroomsGet(new Request("http://test.local"), routeParams({}))).status).toBe(401);
    const push = await pushTokenPost(
      jsonRequest("POST", { token: "ExponentPushToken[y]", platform: "ios" }),
      routeParams({})
    );
    expect(push.status).toBe(401);
  });

  it("owner 先把教室轉出去，就可以刪除", async () => {
    const { assistantMembership } = await seed();
    await transfer(assistantMembership.id);

    const res = await deleteMe();
    expect(res.status).toBe(200);
  });

  it("owner 的教室都已封存，也可以刪除", async () => {
    const { classroom } = await seed();
    await classroomDelete(jsonRequest("DELETE"), routeParams({ id: String(classroom.id) }));

    const res = await deleteMe();
    expect(res.status).toBe(200);
  });
});
