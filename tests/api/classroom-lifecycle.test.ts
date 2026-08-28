import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, jsonRequest, routeParams } from "../factories";

// Unlike the other API tests, this one does NOT mock `@/lib/auth`: the whole
// point is that `decodeAuthToken` re-reads the Membership row, so the cookie
// has to be real. Only the cookie jar is faked.
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
import { GET as classroomsGet } from "@/app/api/classrooms/route";
import { DELETE as classroomDelete } from "@/app/api/classrooms/[id]/route";
import { POST as leavePost } from "@/app/api/classrooms/[id]/leave/route";
import { POST as switchPost } from "@/app/api/classrooms/[id]/switch/route";
import { GET as membershipsGet } from "@/app/api/memberships/route";
import { DELETE as membershipDelete } from "@/app/api/memberships/[id]/route";
import { GET as studentsGet } from "@/app/api/students/route";
import { POST as loginPost } from "@/app/api/login/route";

const OWNER_ID = 1;

function signIn(userId: number, classroomId?: number) {
  jar.token = generateAuthToken(userId, classroomId);
}

// A classroom with a live wall-poster key, one 助教 alongside the owner, and a
// student to prove scoping.
async function seed() {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  await prisma.classroom.update({
    where: { id: classroom.id },
    data: { checkinKey: "wallkey123" },
  });
  const assistant = await createMember(classroom.id, { email: "assistant@test.local" });
  await prisma.user.updateMany({ data: { currentClassroomId: classroom.id } });
  await prisma.student.create({
    data: { classroomId: classroom.id, number: 1, name: "Alice", avatarUrl: "/a.png" },
  });

  signIn(OWNER_ID, classroom.id);
  return { classroom, assistant };
}

const listClassrooms = () =>
  classroomsGet(new Request("http://test.local/api/classrooms"), routeParams({}));
const listMembers = () =>
  membershipsGet(new Request("http://test.local/api/memberships"), routeParams({}));
const listStudents = () => studentsGet(new Request("http://test.local/api/students"));

describe("失去教室後的存取權", () => {
  beforeEach(seed);

  it("完全沒有 cookie → classroom-scoped 路由查不到任何資料", async () => {
    jar.token = undefined;

    // 包了 apiRoute 的路由直接 401
    expect((await listMembers()).status).toBe(401);

    // 尚未包 wrapper 的路由靠 NO_CLASSROOM 收斂成空集合。Prisma 會把
    // `classroomId: undefined` 當成「不過濾」，所以這裡不能是 undefined。
    const res = await listStudents();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /api/classrooms", () => {
  beforeEach(seed);

  it("回傳 role，且不外洩 checkinKey", async () => {
    const body = await (await listClassrooms()).json();

    expect(body.classrooms).toEqual([
      { id: expect.any(Number), name: "Studio A", role: "owner" },
    ]);
    expect(JSON.stringify(body)).not.toContain("wallkey123");
  });

  it("JWT 指向已封存的教室時，currentClassroomId 回 null（前端會導向 onboarding）", async () => {
    const { classroom } = await seed();
    await prisma.classroom.update({
      where: { id: classroom.id },
      data: { deletedAt: new Date() },
    });

    const body = await (await listClassrooms()).json();
    expect(body.classrooms).toEqual([]);
    expect(body.currentClassroomId).toBeNull();
  });
});

describe("DELETE /api/classrooms/[id]", () => {
  beforeEach(seed);

  it("owner 封存教室 → 清空 checkinKey，其他成員立刻失去存取權", async () => {
    const { classroom, assistant } = await seed();

    const res = await classroomDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(classroom.id) })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nextClassroomId: null });

    const archived = await prisma.classroom.findUniqueOrThrow({ where: { id: classroom.id } });
    expect(archived.deletedAt).not.toBeNull();
    // 貼在牆上的 QR 看板必須立刻失效
    expect(archived.checkinKey).toBeNull();
    // Membership 保留，才救得回來
    expect(await prisma.membership.count({ where: { classroomId: classroom.id } })).toBe(2);

    // 助教手上的 JWT 沒變，但下一個請求就該被擋下
    signIn(assistant.id, classroom.id);
    expect((await listMembers()).status).toBe(401);
    expect(await (await listStudents()).json()).toEqual([]);
  });

  it("還有其他教室時，回傳下一間並更新 currentClassroomId", async () => {
    const { classroom } = await seed();
    const second = await createClassroom({ name: "Studio B", ownerUserId: OWNER_ID });

    const res = await classroomDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(classroom.id) })
    );
    expect(await res.json()).toEqual({ nextClassroomId: second.id });

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: OWNER_ID } });
    expect(owner.currentClassroomId).toBe(second.id);
    // 重簽的 cookie 已經指向新教室
    expect((await listMembers()).status).toBe(200);
  });

  it("助教不能封存教室 → 403", async () => {
    const { classroom, assistant } = await seed();
    signIn(assistant.id, classroom.id);

    const res = await classroomDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(classroom.id) })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOT_CLASSROOM_OWNER");
  });

  it("非成員 → 404（不確認別間教室的存在）", async () => {
    const { classroom } = await seed();
    const outsider = await prisma.user.create({
      data: { email: "outsider@test.local", name: "Outsider", password: "x" },
    });
    signIn(outsider.id);

    const res = await classroomDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(classroom.id) })
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/classrooms/[id]/leave", () => {
  beforeEach(seed);

  it("助教退出 → 自己的 membership 消失，owner 不受影響", async () => {
    const { classroom, assistant } = await seed();
    signIn(assistant.id, classroom.id);

    const res = await leavePost(jsonRequest("POST"), routeParams({ id: String(classroom.id) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nextClassroomId: null });

    expect(await prisma.membership.count({ where: { classroomId: classroom.id } })).toBe(1);
    expect((await listMembers()).status).toBe(401);

    signIn(OWNER_ID, classroom.id);
    expect((await listMembers()).status).toBe(200);
  });

  it("owner 不能退出 → 403 OWNER_CANNOT_LEAVE", async () => {
    const { classroom } = await seed();

    const res = await leavePost(jsonRequest("POST"), routeParams({ id: String(classroom.id) }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("OWNER_CANNOT_LEAVE");
  });

  it("退出最後一間教室後仍然登入得了（`memberships[0]` 曾經回 500）", async () => {
    const { classroom, assistant } = await seed();
    await prisma.user.update({
      where: { id: assistant.id },
      data: { password: await bcrypt.hash("secret", 10) },
    });
    signIn(assistant.id, classroom.id);

    await leavePost(jsonRequest("POST"), routeParams({ id: String(classroom.id) }));
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: assistant.id } })).currentClassroomId
    ).toBeNull();

    const res = await loginPost(
      jsonRequest("POST", { email: "assistant@test.local", password: "secret" })
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/memberships/[id]", () => {
  beforeEach(seed);

  it("owner 移除助教 → 對方下一個請求就 401", async () => {
    const { classroom, assistant } = await seed();
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: assistant.id, classroomId: classroom.id },
    });

    const res = await membershipDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(membership.id) })
    );
    expect(res.status).toBe(200);
    expect(await prisma.membership.findUnique({ where: { id: membership.id } })).toBeNull();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: assistant.id } })).currentClassroomId
    ).toBeNull();

    signIn(assistant.id, classroom.id);
    expect((await listMembers()).status).toBe(401);
  });

  it("不能移除自己 → 400 CANNOT_REMOVE_SELF", async () => {
    const { classroom } = await seed();
    const mine = await prisma.membership.findFirstOrThrow({
      where: { userId: OWNER_ID, classroomId: classroom.id },
    });

    const res = await membershipDelete(jsonRequest("DELETE"), routeParams({ id: String(mine.id) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CANNOT_REMOVE_SELF");
  });

  it("不能移除另一位 owner → 403", async () => {
    const { classroom } = await seed();
    const coOwner = await createMember(classroom.id, {
      email: "co-owner@test.local",
      role: "owner",
    });
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: coOwner.id, classroomId: classroom.id },
    });

    const res = await membershipDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(membership.id) })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CANNOT_REMOVE_OWNER");
  });

  it("助教不能移除任何人 → 403", async () => {
    const { classroom, assistant } = await seed();
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { userId: OWNER_ID, classroomId: classroom.id },
    });
    signIn(assistant.id, classroom.id);

    const res = await membershipDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(ownerMembership.id) })
    );
    expect(res.status).toBe(403);
  });

  it("別間教室的 membership id → 404", async () => {
    await seed();
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await prisma.membership.findFirstOrThrow({
      where: { classroomId: other.id },
    });

    const res = await membershipDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(foreign.id) })
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/classrooms/[id]/switch", () => {
  beforeEach(seed);

  it("切不進已封存的教室 → 404", async () => {
    const { classroom } = await seed();
    const second = await createClassroom({ name: "Studio B", ownerUserId: OWNER_ID });
    signIn(OWNER_ID, second.id);
    await prisma.classroom.update({
      where: { id: classroom.id },
      data: { deletedAt: new Date() },
    });

    const res = await switchPost(jsonRequest("POST"), routeParams({ id: String(classroom.id) }));
    expect(res.status).toBe(404);
  });
});
