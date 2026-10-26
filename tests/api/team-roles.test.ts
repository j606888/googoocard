import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createLesson, createMember, jsonRequest, routeParams } from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0, role: "owner" }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
  createAuthSession: async () => {},
}));

import { GET as LIST_INVITES, POST as CREATE_INVITE } from "@/app/api/invite-tokens/route";
import { GET as LOOKUP_INVITE, DELETE as DELETE_INVITE } from "@/app/api/invite-tokens/[id]/route";
import { POST as JOIN } from "@/app/api/invite-tokens/[id]/join/route";
import { GET as LIST_MEMBERS } from "@/app/api/memberships/route";
import { PATCH as UPDATE_MEMBER, DELETE as REMOVE_MEMBER } from "@/app/api/memberships/[id]/route";
import { GET as MY_LESSONS } from "@/app/api/me/lessons/route";
import { joinClassroom } from "@/service/classroom";

const OWNER_ID = 1;

function as(userId: number, role: string) {
  auth.userId = userId;
  auth.role = role;
}

async function seed() {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  auth.classroomId = classroom.id;
  as(OWNER_ID, "owner");
  const helper = await createMember(classroom.id, { email: "helper@test.local", name: "小安" });
  const mei = await prisma.teacher.create({ data: { classroomId: classroom.id, name: "小美老師" } });
  const jay = await prisma.teacher.create({ data: { classroomId: classroom.id, name: "阿傑老師" } });
  return { classroom, helper, mei, jay };
}

const createInvite = (body: unknown) => CREATE_INVITE(jsonRequest("POST", body), routeParams({}));
const patchMember = (membershipId: number, body: unknown) =>
  UPDATE_MEMBER(jsonRequest("PATCH", body), routeParams({ id: String(membershipId) }));
const membershipOf = (userId: number, classroomId: number) =>
  prisma.membership.findFirstOrThrow({ where: { userId, classroomId } });
const linkedUser = async (teacherId: number) =>
  (await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } })).userId;

beforeEach(() => {
  as(OWNER_ID, "owner");
});

describe("POST /api/invite-tokens", () => {
  it("老師和小幫手不能建立邀請 → 403", async () => {
    const { helper, mei } = await seed();
    for (const role of ["assistant", "teacher"]) {
      as(helper.id, role);
      const res = await createInvite({ maxUses: 1, role: "teacher", teacherId: mei.id });
      expect(res.status).toBe(403);
    }
    expect(await prisma.inviteToken.count()).toBe(0);
  });

  it("老師的邀請一定要指定老師資料 → 400 TEACHER_REQUIRED", async () => {
    await seed();
    const res = await createInvite({ maxUses: 1, role: "teacher" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TEACHER_REQUIRED");
  });

  it("已經連到別人的老師資料不能再邀請 → 409", async () => {
    const { helper, mei } = await seed();
    await prisma.teacher.update({ where: { id: mei.id }, data: { userId: helper.id } });
    const res = await createInvite({ maxUses: 1, role: "teacher", teacherId: mei.id });
    expect(res.status).toBe(409);
  });

  it("別間教室的老師 → 400 TEACHER_NOT_FOUND", async () => {
    await seed();
    const other = await createClassroom({ name: "B", email: "b@test.local" });
    const foreign = await prisma.teacher.create({ data: { classroomId: other.id, name: "X" } });
    const res = await createInvite({ maxUses: 1, role: "teacher", teacherId: foreign.id });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TEACHER_NOT_FOUND");
  });

  it("老師的邀請只能用一次；小幫手的邀請不帶老師", async () => {
    const { mei } = await seed();
    await createInvite({ maxUses: 5, role: "teacher", teacherId: mei.id });
    await createInvite({ maxUses: 3, role: "assistant", teacherId: mei.id });
    const invites = await (await LIST_INVITES(jsonRequest("GET"), routeParams({}))).json();
    expect(invites.map((i: { role: string; maxUses: number; teacher: { id: number } | null }) => [i.role, i.maxUses, i.teacher?.id ?? null])).toEqual([
      ["teacher", 1, mei.id],
      ["assistant", 3, null],
    ]);
  });

  it("管理員（非建立者）也能邀請", async () => {
    const { classroom } = await seed();
    const admin = await createMember(classroom.id, { email: "admin@test.local", role: "admin" });
    as(admin.id, "admin");
    const res = await createInvite({ maxUses: 1, role: "admin" });
    expect(res.status).toBe(200);
  });
});

describe("加入邀請", () => {
  it("用老師的邀請加入 → 角色是老師，並連到那筆老師資料", async () => {
    const { classroom, mei } = await seed();
    const invite = await (await createInvite({ maxUses: 1, role: "teacher", teacherId: mei.id })).json();

    const newbie = await prisma.user.create({ data: { email: "mei@test.local", name: "小美", password: "x" } });
    as(newbie.id, "assistant");
    const res = await JOIN(jsonRequest("POST"), routeParams({ id: invite.token }));
    expect(res.status).toBe(200);

    expect((await membershipOf(newbie.id, classroom.id)).role).toBe("teacher");
    expect(await linkedUser(mei.id)).toBe(newbie.id);
  });

  it("註冊／登入時帶邀請碼（joinClassroom）也套用角色", async () => {
    const { classroom } = await seed();
    const invite = await (await createInvite({ maxUses: 1, role: "admin" })).json();
    const newbie = await prisma.user.create({ data: { email: "n@test.local", name: "N", password: "x" } });

    expect(await joinClassroom({ userId: newbie.id, token: invite.token })).toBe(classroom.id);
    expect((await membershipOf(newbie.id, classroom.id)).role).toBe("admin");
  });

  it("老師資料在等待期間被連給別人 → 還是以老師加入，只是沒連上", async () => {
    const { classroom, helper, mei } = await seed();
    const invite = await (await createInvite({ maxUses: 1, role: "teacher", teacherId: mei.id })).json();
    await prisma.teacher.update({ where: { id: mei.id }, data: { userId: helper.id } });

    const newbie = await prisma.user.create({ data: { email: "n@test.local", name: "N", password: "x" } });
    as(newbie.id, "assistant");
    expect((await JOIN(jsonRequest("POST"), routeParams({ id: invite.token }))).status).toBe(200);
    expect((await membershipOf(newbie.id, classroom.id)).role).toBe("teacher");
    expect(await linkedUser(mei.id)).toBe(helper.id);
  });

  it("公開查詢邀請只回教室名稱和角色，不外流簽到 key", async () => {
    const { classroom } = await seed();
    await prisma.classroom.update({ where: { id: classroom.id }, data: { checkinKey: "secret-key" } });
    const invite = await (await createInvite({ maxUses: 1, role: "assistant" })).json();
    const res = await LOOKUP_INVITE(jsonRequest("GET"), { params: Promise.resolve({ id: invite.token }) });
    const body = await res.json();
    expect(body.role).toBe("assistant");
    expect(body.classroom).toEqual({ id: classroom.id, name: "Studio A" });
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("小幫手不能刪邀請連結 → 403", async () => {
    const { helper } = await seed();
    const invite = await (await createInvite({ maxUses: 1, role: "assistant" })).json();
    as(helper.id, "assistant");
    const res = await DELETE_INVITE(jsonRequest("DELETE"), routeParams({ id: String(invite.id) }));
    expect(res.status).toBe(403);
    expect(await prisma.inviteToken.count()).toBe(1);
  });
});

describe("PATCH /api/memberships/[id]", () => {
  it("小幫手改成老師要連老師資料；連了之後成員列表帶出來", async () => {
    const { classroom, helper, mei } = await seed();
    const m = await membershipOf(helper.id, classroom.id);

    const missing = await patchMember(m.id, { role: "teacher" });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("TEACHER_REQUIRED");

    expect((await patchMember(m.id, { role: "teacher", teacherId: mei.id })).status).toBe(200);
    expect((await membershipOf(helper.id, classroom.id)).role).toBe("teacher");

    const members = await (await LIST_MEMBERS(jsonRequest("GET"), routeParams({}))).json();
    const row = members.find((x: { userId: number }) => x.userId === helper.id);
    expect(row.teacher).toMatchObject({ id: mei.id, name: "小美老師" });
  });

  it("換一筆老師資料 → 舊的解除；改回小幫手 → 全部解除", async () => {
    const { classroom, helper, mei, jay } = await seed();
    const m = await membershipOf(helper.id, classroom.id);
    await patchMember(m.id, { role: "teacher", teacherId: mei.id });

    expect((await patchMember(m.id, { teacherId: jay.id })).status).toBe(200);
    expect(await linkedUser(mei.id)).toBeNull();
    expect(await linkedUser(jay.id)).toBe(helper.id);

    expect((await patchMember(m.id, { role: "assistant" })).status).toBe(200);
    expect(await linkedUser(jay.id)).toBeNull();
  });

  it("小幫手不能帶老師資料 → 400", async () => {
    const { classroom, helper, mei } = await seed();
    const m = await membershipOf(helper.id, classroom.id);
    const res = await patchMember(m.id, { role: "assistant", teacherId: mei.id });
    expect(res.status).toBe(400);
  });

  it("老師資料已經是別人的 → 409，什麼都沒變", async () => {
    const { classroom, helper, mei } = await seed();
    const other = await createMember(classroom.id, { email: "o@test.local", role: "teacher" });
    await prisma.teacher.update({ where: { id: mei.id }, data: { userId: other.id } });
    const m = await membershipOf(helper.id, classroom.id);

    const res = await patchMember(m.id, { role: "teacher", teacherId: mei.id });
    expect(res.status).toBe(409);
    expect((await membershipOf(helper.id, classroom.id)).role).toBe("assistant");
    expect(await linkedUser(mei.id)).toBe(other.id);
  });

  it("不能改建立者或自己的角色，但可以替自己連老師資料", async () => {
    const { classroom, helper, mei } = await seed();
    const ownerM = await membershipOf(OWNER_ID, classroom.id);
    const admin = await createMember(classroom.id, { email: "admin@test.local", role: "admin" });
    const adminM = await membershipOf(admin.id, classroom.id);

    as(admin.id, "admin");
    expect((await patchMember(ownerM.id, { role: "assistant" })).status).toBe(403);
    expect((await patchMember(adminM.id, { role: "assistant" })).status).toBe(403);
    expect((await patchMember(adminM.id, { teacherId: mei.id })).status).toBe(200);
    expect(await linkedUser(mei.id)).toBe(admin.id);
    expect((await membershipOf(admin.id, classroom.id)).role).toBe("admin");

    // A no-op role in the body (same as now) is fine.
    as(OWNER_ID, "owner");
    const helperM = await membershipOf(helper.id, classroom.id);
    expect((await patchMember(helperM.id, { role: "assistant" })).status).toBe(200);
  });

  it("老師不能改別人的角色 → 403", async () => {
    const { classroom, helper } = await seed();
    const teacher = await createMember(classroom.id, { email: "t@test.local", role: "teacher" });
    as(teacher.id, "teacher");
    const m = await membershipOf(helper.id, classroom.id);
    expect((await patchMember(m.id, { role: "admin" })).status).toBe(403);
  });
});

describe("DELETE /api/memberships/[id]", () => {
  it("管理員可以移出成員，被移出的人不再連著老師資料", async () => {
    const { classroom, helper, mei } = await seed();
    await prisma.membership.updateMany({ where: { userId: helper.id }, data: { role: "teacher" } });
    await prisma.teacher.update({ where: { id: mei.id }, data: { userId: helper.id } });
    const admin = await createMember(classroom.id, { email: "admin@test.local", role: "admin" });
    as(admin.id, "admin");

    const m = await membershipOf(helper.id, classroom.id);
    const res = await REMOVE_MEMBER(jsonRequest("DELETE"), routeParams({ id: String(m.id) }));
    expect(res.status).toBe(200);
    expect(await linkedUser(mei.id)).toBeNull();
    expect(await prisma.teacher.count()).toBe(2);
  });

  it("管理員不能移出建立者；老師不能移出任何人", async () => {
    const { classroom, helper } = await seed();
    const admin = await createMember(classroom.id, { email: "admin@test.local", role: "admin" });
    const ownerM = await membershipOf(OWNER_ID, classroom.id);
    as(admin.id, "admin");
    expect((await REMOVE_MEMBER(jsonRequest("DELETE"), routeParams({ id: String(ownerM.id) }))).status).toBe(403);

    as(helper.id, "teacher");
    const adminM = await membershipOf(admin.id, classroom.id);
    expect((await REMOVE_MEMBER(jsonRequest("DELETE"), routeParams({ id: String(adminM.id) }))).status).toBe(403);
  });
});

describe("GET /api/me/lessons", () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function addPeriod(lessonId: number, startTime: Date) {
    return prisma.lessonPeriod.create({
      data: { lessonId, startTime, endTime: new Date(startTime.getTime() + 90 * 60 * 1000) },
    });
  }

  it("沒連老師資料 → teacher: null", async () => {
    await seed();
    const body = await (await MY_LESSONS(jsonRequest("GET"), routeParams({}))).json();
    expect(body).toEqual({ teacher: null, periods: [] });
  });

  it("只列自己教的課、今天起 7 天內、手動結束的課不算", async () => {
    const { classroom, helper, mei, jay } = await seed();
    await prisma.teacher.update({ where: { id: mei.id }, data: { userId: helper.id } });

    const now = Date.now();
    const { lesson: mine } = await createLesson(classroom.id, { name: "Salsa 初階" });
    const { lesson: coTaught } = await createLesson(classroom.id, { name: "Bachata 中階" });
    const { lesson: notMine } = await createLesson(classroom.id, { name: "Kizomba" });
    const { lesson: ended } = await createLesson(classroom.id, { name: "Ended" });
    await prisma.lessonTeacher.createMany({
      data: [
        { lessonId: mine.id, teacherId: mei.id },
        { lessonId: coTaught.id, teacherId: jay.id },
        { lessonId: coTaught.id, teacherId: mei.id },
        { lessonId: notMine.id, teacherId: jay.id },
        { lessonId: ended.id, teacherId: mei.id },
      ],
    });
    await prisma.lesson.update({ where: { id: ended.id }, data: { endedAt: new Date() } });

    const soon = await addPeriod(mine.id, new Date(now + 2 * 60 * 60 * 1000));
    const later = await addPeriod(coTaught.id, new Date(now + 3 * DAY));
    await addPeriod(mine.id, new Date(now + 10 * DAY)); // beyond the window
    await addPeriod(mine.id, new Date(now - 2 * DAY)); // already past
    await addPeriod(notMine.id, new Date(now + DAY));
    await addPeriod(ended.id, new Date(now + DAY));

    as(helper.id, "teacher");
    const body = await (await MY_LESSONS(jsonRequest("GET"), routeParams({}))).json();
    expect(body.teacher).toMatchObject({ id: mei.id, name: "小美老師" });
    expect(body.periods.map((p: { id: number }) => p.id)).toEqual([soon.id, later.id]);
    expect(body.periods[1].lesson.teachers.map((t: { name: string }) => t.name)).toEqual([
      "阿傑老師",
      "小美老師",
    ]);
  });
});
