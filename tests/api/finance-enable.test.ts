import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  enableFinanceFor,
  createLocation,
  createTeacher,
  createVenue,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as ENABLE } from "@/app/api/finance/enable/route";
import { GET as SETTINGS_GET, PATCH as SETTINGS_PATCH } from "@/app/api/finance/settings/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/finance/members/[userId]/route";
import { assertFinanceEnabled, assertCanSettle, isFinanceEnabled } from "@/service/finance/access";
import { assertReceiverIsCustodian } from "@/service/finance/receiver";
import { addMonthsTaipei } from "@/lib/taipei-date";

describe("finance enable / permission", () => {
  let classroomId: number;
  let ownerId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
  });

  it("addMonthsTaipei: launch + 6 months at Taipei midnight", () => {
    expect(addMonthsTaipei("2026-11-03", 6).toISOString()).toBe("2027-05-02T16:00:00.000Z");
    expect(addMonthsTaipei("2026-08-31", 6).toISOString()).toBe("2027-02-27T16:00:00.000Z");
  });

  it("enable: financeEnabledAt = now (a sent launchDate is ignored), legacy custodian, caller is finance, old cards keep no expiry until opening", async () => {
    const member = await createMember(classroomId);
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const open = await createStudentCard(student.id, card.id, { remainingSessions: 2 });

    const before = Date.now();
    const res = await ENABLE(
      jsonRequest("POST", { launchDate: "2020-01-01", legacyCustodianUserId: member.id }),
      routeParams({})
    );
    expect(res.status).toBe(200);

    const c = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } });
    expect(c.financeEnabledAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(c.financeEnabledAt!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(c.financeOpenedAt).toBeNull();
    expect(c.legacyCustodianUserId).toBe(member.id);
    const m = await prisma.membership.findFirstOrThrow({ where: { userId: ownerId, classroomId } });
    expect(m.isCustodian).toBe(true);
    expect(m.canSettle).toBe(true);
    // 舊卡的錢在他手上 → 他也是保管人（只當保管人，不能結算）
    const holder = await prisma.membership.findFirstOrThrow({ where: { userId: member.id, classroomId } });
    expect({ isCustodian: holder.isCustodian, canSettle: holder.canSettle }).toEqual({ isCustodian: true, canSettle: false });

    // 舊卡到期等開帳才設（轉換日＋6 個月，見 ledger-opening.test.ts）
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: open.id } })).expiresAt).toBeNull();
  });

  it("enable twice -> 409; custodian outside classroom -> 400", async () => {
    const stranger = await prisma.user.create({ data: { email: "s@test.local", name: "S", password: "x" } });
    const bad = await ENABLE(
      jsonRequest("POST", { launchDate: "2026-11-03", legacyCustodianUserId: stranger.id }),
      routeParams({})
    );
    expect(bad.status).toBe(400);
    const ok = { legacyCustodianUserId: ownerId };
    expect((await ENABLE(jsonRequest("POST", ok), routeParams({}))).status).toBe(200);
    const again = await ENABLE(jsonRequest("POST", ok), routeParams({}));
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("FINANCE_ALREADY_ENABLED");
  });

  it("non-owner cannot enable", async () => {
    const member = await createMember(classroomId, { role: "admin" });
    auth.userId = member.id;
    const res = await ENABLE(
      jsonRequest("POST", { legacyCustodianUserId: ownerId }),
      routeParams({})
    );
    expect(res.status).toBe(403);
  });

  it("finance API on disabled classroom -> 404 FINANCE_DISABLED", async () => {
    const res = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 10 }), routeParams({}));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("FINANCE_DISABLED");
    expect(await isFinanceEnabled(classroomId)).toBe(false);
    await expect(assertFinanceEnabled(classroomId)).rejects.toMatchObject({ status: 404 });
    const get = await (await SETTINGS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(get.enabled).toBe(false);
  });

  it("assertCanSettle requires canSettle, not isCustodian", async () => {
    const member = await createMember(classroomId);
    await enableFinanceFor(classroomId, { launch: new Date("2026-11-02T16:00:00Z") });
    await expect(assertCanSettle(member.id, classroomId)).rejects.toMatchObject({ status: 403, code: "NOT_FINANCE" });
    await prisma.membership.updateMany({ where: { userId: member.id, classroomId }, data: { isCustodian: true } });
    await expect(assertCanSettle(member.id, classroomId)).rejects.toMatchObject({ status: 403, code: "NOT_FINANCE" });
    await prisma.membership.updateMany({ where: { userId: member.id, classroomId }, data: { canSettle: true } });
    await expect(assertCanSettle(member.id, classroomId)).resolves.toBeUndefined();
  });

  it("custodian-only can receive but not settle; settler-only cannot receive", async () => {
    const sean = await createMember(classroomId, { email: "sean@test.local", name: "Sean" });
    const nora = await createMember(classroomId, { email: "nora@test.local", name: "Nora" });
    await enableFinanceFor(classroomId, { launch: new Date("2026-11-02T16:00:00Z"), legacyCustodianUserId: ownerId });
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
    await prisma.membership.updateMany({ where: { userId: sean.id, classroomId }, data: { isCustodian: true } });
    await prisma.membership.updateMany({ where: { userId: nora.id, classroomId }, data: { canSettle: true } });

    await expect(assertCanSettle(sean.id, classroomId)).rejects.toMatchObject({ status: 403 });
    await expect(assertReceiverIsCustodian(sean.id, classroomId)).resolves.toBeUndefined();
    await expect(assertCanSettle(nora.id, classroomId)).resolves.toBeUndefined();
    await expect(assertReceiverIsCustodian(nora.id, classroomId)).rejects.toMatchObject({ code: "RECEIVER_NOT_FINANCE" });
  });

  it("settings GET/PATCH and member toggles; each flag keeps its last holder", async () => {
    const member = await createMember(classroomId);
    await ENABLE(jsonRequest("POST", { legacyCustodianUserId: ownerId }), routeParams({}));

    // 舊卡保管人必須是保管人
    const notCustodian = await SETTINGS_PATCH(jsonRequest("PATCH", { legacyCustodianUserId: member.id }), routeParams({}));
    expect(notCustodian.status).toBe(400);
    expect((await notCustodian.json()).code).toBe("NOT_FINANCE_MEMBER");
    await prisma.membership.update({ where: { userId_classroomId: { userId: member.id, classroomId } }, data: { isCustodian: true } });
    const patch = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 10, legacyCustodianUserId: member.id }), routeParams({}));
    expect(patch.status).toBe(200);
    await prisma.membership.update({ where: { userId_classroomId: { userId: member.id, classroomId } }, data: { isCustodian: false } });
    const bad = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 5 }), routeParams({}));
    expect(bad.status).toBe(400);

    const s = await (await SETTINGS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(s).toMatchObject({ enabled: true, roundTo: 10, legacyCustodianUserId: member.id });
    expect(s.members).toHaveLength(2);
    expect(Object.keys(s.members[0]).sort()).toEqual(["canSettle", "isCustodian", "name", "role", "teacherName", "userId"]);

    const owner = routeParams({ userId: String(ownerId) });
    const other = routeParams({ userId: String(member.id) });
    const lastSettler = await MEMBER_PATCH(jsonRequest("PATCH", { canSettle: false }), owner);
    expect(lastSettler.status).toBe(409);
    expect((await lastSettler.json()).code).toBe("LAST_SETTLER");
    const lastCustodian = await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: false }), owner);
    expect(lastCustodian.status).toBe(409);
    expect((await lastCustodian.json()).code).toBe("LAST_CUSTODIAN");
    expect((await MEMBER_PATCH(jsonRequest("PATCH", {}), owner)).status).toBe(400);

    // 另一位只當保管人：可以拿掉 owner 的保管人，但結算仍只剩 owner。
    expect((await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: true }), other)).status).toBe(200);
    expect((await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: false }), owner)).status).toBe(200);
    expect((await MEMBER_PATCH(jsonRequest("PATCH", { canSettle: false }), owner)).status).toBe(409);
    const m = await prisma.membership.findFirstOrThrow({ where: { userId: member.id, classroomId } });
    expect({ isCustodian: m.isCustodian, canSettle: m.canSettle }).toEqual({ isCustodian: true, canSettle: false });

    expect((await MEMBER_PATCH(jsonRequest("PATCH", { canSettle: true }), other)).status).toBe(200);
    expect((await MEMBER_PATCH(jsonRequest("PATCH", { canSettle: false }), owner)).status).toBe(200);

    // non-finance can't write
    auth.userId = ownerId;
    const denied = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 1 }), routeParams({}));
    expect(denied.status).toBe(403);
  });

  it("取消保管人：他還是分部負責人／過期收入對象／房東／舊卡保管人（老師付款人不再算） → 409 說明是哪些", async () => {
    const member = await createMember(classroomId, { email: "k@test.local", name: "Sean" });
    await ENABLE(jsonRequest("POST", { legacyCustodianUserId: ownerId }), routeParams({}));
    await prisma.membership.update({
      where: { userId_classroomId: { userId: member.id, classroomId } },
      data: { isCustodian: true },
    });
    const kao = await createLocation(classroomId, { name: "高雄" });
    await prisma.location.update({ where: { id: kao.id }, data: { keeperUserId: member.id } });
    const other = await createLocation(classroomId, { name: "台南" });
    await prisma.location.update({ where: { id: other.id }, data: { expiryTo: "USER", expiryUserId: member.id } });
    await createTeacher(classroomId, { name: "Nini", payerUserId: member.id }); // 舊欄位，不再當成參照
    await createVenue(classroomId, { name: "24steps", landlordUserId: member.id });
    const target = routeParams({ userId: String(member.id) });

    const res = await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: false }), target);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CUSTODIAN_IN_USE");
    for (const word of ["高雄", "台南", "24steps"]) expect(body.error).toContain(word);
    expect(body.error).not.toContain("Nini");
    expect((await prisma.membership.findFirstOrThrow({ where: { userId: member.id, classroomId } })).isCustodian).toBe(true);

    // 全部改掉就可以取消
    await prisma.location.updateMany({ where: { classroomId }, data: { keeperUserId: null, expiryTo: "FUND", expiryUserId: null } });
    await prisma.venue.updateMany({ where: { classroomId }, data: { landlordUserId: null } });
    expect((await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: false }), target)).status).toBe(200);

    // 舊卡保管人也算
    const ownerTarget = routeParams({ userId: String(ownerId) });
    await prisma.membership.update({ where: { userId_classroomId: { userId: member.id, classroomId } }, data: { isCustodian: true } });
    const legacy = await MEMBER_PATCH(jsonRequest("PATCH", { isCustodian: false }), ownerTarget);
    expect(legacy.status).toBe(409);
    expect((await legacy.json()).error).toContain("舊卡保管人");
  });
});
