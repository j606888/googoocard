import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import { apiRoute } from "@/lib/apiRoute";
import { NO_CLASSROOM } from "@/lib/authz";
import { resetDb, createClassroom, createMember, enableModule, jsonRequest, routeParams } from "../factories";

// Unlike most API tests, the session here is read from the database on every
// call — grants, revokes and modules included — so switching a module or
// editing someone's permissions takes effect on the next request, as it does
// for real.
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

import { GET as ACCESS } from "@/app/api/me/access/route";
import { GET as LIST_MODULES } from "@/app/api/classroom-modules/route";
import { PUT as ENABLE, DELETE as DISABLE } from "@/app/api/classroom-modules/[module]/route";
import { GET as LIST_MEMBERS } from "@/app/api/memberships/route";
import { PATCH as UPDATE_MEMBER } from "@/app/api/memberships/[id]/route";

const OWNER_ID = 1;
const as = (userId: number) => {
  auth.userId = userId;
};

// A stand-in for a module route: answers 200 only with the permission.
const financeOnly = apiRoute(async () => ({ ok: true }), { permission: "finance.view" });
const callFinance = () => financeOnly(jsonRequest("GET"), routeParams({}));

const enable = (module: string) => ENABLE(jsonRequest("PUT"), routeParams({ module }));
const disable = (module: string) => DISABLE(jsonRequest("DELETE"), routeParams({ module }));
const access = async () => (await ACCESS(jsonRequest("GET"), routeParams({}))).json();
const patchMember = (membershipId: number, body: unknown) =>
  UPDATE_MEMBER(jsonRequest("PATCH", body), routeParams({ id: String(membershipId) }));
const membershipOf = (userId: number) =>
  prisma.membership.findFirstOrThrow({ where: { userId, classroomId: auth.classroomId } });

async function seed() {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  auth.classroomId = classroom.id;
  as(OWNER_ID);
  const admin = await createMember(classroom.id, { email: "admin@test.local", name: "阿管", role: "admin" });
  const teacher = await createMember(classroom.id, { email: "t@test.local", name: "小美", role: "teacher" });
  // A teacher member is always linked to a Teacher row (PATCH insists).
  await prisma.teacher.create({ data: { classroomId: classroom.id, name: "小美老師", userId: teacher.id } });
  const helper = await createMember(classroom.id, { email: "h@test.local", name: "小安", role: "assistant" });
  return { classroom, admin, teacher, helper };
}

beforeEach(() => as(OWNER_ID));

describe("apiRoute 的 permission 選項", () => {
  it("模組沒開 → 404 MODULE_NOT_ENABLED（連 owner 也是）", async () => {
    await seed();
    const res = await callFinance();
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("MODULE_NOT_ENABLED");
  });

  it("模組有開、沒權限 → 403 PERMISSION_DENIED；有權限 → 200", async () => {
    const { classroom, teacher } = await seed();
    await enableModule(classroom.id, "finance");
    expect((await callFinance()).status).toBe(200);

    as(teacher.id);
    const res = await callFinance();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
  });

  it("個人多給的權限立刻生效", async () => {
    const { classroom, teacher } = await seed();
    await enableModule(classroom.id, "finance");
    await prisma.membership.updateMany({ where: { userId: teacher.id }, data: { grants: ["finance.view"] } });
    as(teacher.id);
    expect((await callFinance()).status).toBe(200);
  });
});

describe("GET /api/me/access", () => {
  it("回傳角色、實際權限與有開的模組", async () => {
    const { classroom, helper } = await seed();
    expect(await access()).toEqual({
      role: "owner",
      permissions: ["members.manage", "modules.manage"],
      modules: [],
    });

    await enableModule(classroom.id, "curriculum");
    as(helper.id);
    expect(await access()).toEqual({ role: "assistant", permissions: ["curriculum.view"], modules: ["curriculum"] });
  });
});

describe("/api/classroom-modules", () => {
  it("列出每個模組的開關狀態", async () => {
    const { classroom } = await seed();
    await enableModule(classroom.id, "curriculum");
    const list = await (await LIST_MODULES(jsonRequest("GET"), routeParams({}))).json();
    expect(list.map((m: { module: string; enabled: boolean }) => [m.module, m.enabled])).toEqual([
      ["curriculum", true],
      ["finance", false],
    ]);
  });

  it("開啟是冪等的；關掉後該模組的 API 變 404，資料表不動", async () => {
    await seed();
    expect((await enable("finance")).status).toBe(200);
    expect((await enable("finance")).status).toBe(200);
    expect(await prisma.classroomModule.count()).toBe(1);
    expect((await callFinance()).status).toBe(200);

    expect((await disable("finance")).status).toBe(200);
    expect((await callFinance()).status).toBe(404);
  });

  it("沒有 modules.manage 的人不能開關 → 403", async () => {
    const { teacher } = await seed();
    as(teacher.id);
    const res = await enable("curriculum");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PERMISSION_DENIED");
    expect(await prisma.classroomModule.count()).toBe(0);
  });

  it("不認得的模組 → 404", async () => {
    await seed();
    expect((await enable("payroll")).status).toBe(404);
  });

  it("別間教室的開關不影響這間", async () => {
    await seed();
    const other = await createClassroom({ name: "B", email: "b@test.local" });
    await enableModule(other.id, "finance");
    expect((await callFinance()).status).toBe(404);
  });
});

describe("PATCH /api/memberships/[id] — 權限", () => {
  it("勾選結果存成跟角色預設的差異，列表顯示「自訂」", async () => {
    const { classroom, teacher } = await seed();
    await enableModule(classroom.id, "finance");
    await enableModule(classroom.id, "curriculum");
    const target = await membershipOf(teacher.id);

    const res = await patchMember(target.id, { permissions: ["curriculum.view", "finance.view"] });
    expect(res.status).toBe(200);
    const saved = await membershipOf(teacher.id);
    expect(saved.grants).toEqual(["finance.view"]);
    expect(saved.revokes).toEqual(["curriculum.edit"]);

    const members = await (await LIST_MEMBERS(jsonRequest("GET"), routeParams({}))).json();
    const row = members.find((m: { userId: number }) => m.userId === teacher.id);
    expect(row.customized).toBe(true);
    expect(row.permissions.sort()).toEqual(["curriculum.view", "finance.view"]);
    expect(members.find((m: { userId: number }) => m.userId === OWNER_ID).customized).toBe(false);
  });

  it("恢復成角色預設 → 差異清空、不再是自訂", async () => {
    const { classroom, teacher } = await seed();
    await enableModule(classroom.id, "curriculum");
    const target = await membershipOf(teacher.id);
    await prisma.membership.update({ where: { id: target.id }, data: { revokes: ["curriculum.edit"] } });

    await patchMember(target.id, { permissions: ["curriculum.view", "curriculum.edit"] });
    const saved = await membershipOf(teacher.id);
    expect(saved.grants).toEqual([]);
    expect(saved.revokes).toEqual([]);
  });

  it("模組沒開時，那個模組的個人調整原封不動", async () => {
    const { teacher } = await seed();
    const target = await membershipOf(teacher.id);
    await prisma.membership.update({ where: { id: target.id }, data: { grants: ["finance.view"] } });

    await patchMember(target.id, { permissions: ["members.manage"] });
    const saved = await membershipOf(teacher.id);
    expect(saved.grants.sort()).toEqual(["finance.view", "members.manage"]);
  });

  it("不能改 owner、不能改自己 → 403", async () => {
    const { admin } = await seed();
    const owner = await membershipOf(OWNER_ID);
    as(admin.id);
    const res = await patchMember(owner.id, { permissions: [] });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CANNOT_CHANGE_OWNER_PERMISSIONS");

    const self = await membershipOf(admin.id);
    const own = await patchMember(self.id, { permissions: [] });
    expect(own.status).toBe(403);
    expect((await own.json()).code).toBe("CANNOT_CHANGE_OWN_PERMISSIONS");
  });

  it("只能給自己有的權限 → 403 CANNOT_GRANT_PERMISSION", async () => {
    const { classroom, admin, teacher } = await seed();
    await enableModule(classroom.id, "finance");
    await prisma.membership.updateMany({ where: { userId: admin.id }, data: { revokes: ["finance.view"] } });
    const target = await membershipOf(teacher.id);

    as(admin.id);
    const res = await patchMember(target.id, {
      permissions: ["curriculum.view", "curriculum.edit", "finance.view"],
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CANNOT_GRANT_PERMISSION");
    expect((await membershipOf(teacher.id)).grants).toEqual([]);

    // 拿掉別人的權限不受這條限制
    const ok = await patchMember(target.id, { permissions: ["curriculum.view"] });
    expect(ok.status).toBe(200);
  });

  it("改角色會清掉個人調整", async () => {
    const { teacher } = await seed();
    const target = await membershipOf(teacher.id);
    await prisma.membership.update({
      where: { id: target.id },
      data: { grants: ["finance.view"], revokes: ["curriculum.edit"] },
    });

    expect((await patchMember(target.id, { role: "assistant" })).status).toBe(200);
    const saved = await membershipOf(teacher.id);
    expect(saved.role).toBe("assistant");
    expect(saved.grants).toEqual([]);
    expect(saved.revokes).toEqual([]);
  });

  it("同時改角色和權限 → 以新角色為基準", async () => {
    const { classroom, helper } = await seed();
    await enableModule(classroom.id, "finance");
    const target = await membershipOf(helper.id);
    const res = await patchMember(target.id, {
      role: "admin",
      permissions: ["members.manage", "modules.manage", "finance.view", "finance.edit"],
    });
    expect(res.status).toBe(200);
    const saved = await membershipOf(helper.id);
    expect(saved.role).toBe("admin");
    expect(saved.grants).toEqual([]);
    expect(saved.revokes).toEqual([]);
  });

  it("不認得的權限 → 400", async () => {
    const { teacher } = await seed();
    const target = await membershipOf(teacher.id);
    const res = await patchMember(target.id, { permissions: ["root.everything"] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UNKNOWN_PERMISSION");
  });

  it("老師不能改別人的權限 → 403", async () => {
    const { teacher, helper } = await seed();
    const target = await membershipOf(helper.id);
    as(teacher.id);
    expect((await patchMember(target.id, { permissions: [] })).status).toBe(403);
  });
});

it("被移出教室的人拿到 401（session 從 DB 讀）", async () => {
  const { helper } = await seed();
  await prisma.membership.deleteMany({ where: { userId: helper.id } });
  as(helper.id);
  expect(NO_CLASSROOM).toBe(-1);
  expect((await ACCESS(jsonRequest("GET"), routeParams({}))).status).toBe(401);
});
