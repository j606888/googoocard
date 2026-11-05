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
import { getCustody } from "@/service/finance/custody";
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

  it("enable sets launch, legacy custodian, caller is finance, open cards expire launch+6mo", async () => {
    const member = await createMember(classroomId);
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const voided = await createStudentCard(student.id, card.id, { remainingSessions: 3 });
    await prisma.studentCard.update({ where: { id: voided.id }, data: { expiredAt: new Date("2026-01-01") } });
    const empty = await createStudentCard(student.id, card.id, { remainingSessions: 0 });
    const open = await createStudentCard(student.id, card.id, { remainingSessions: 2 });

    const res = await ENABLE(
      jsonRequest("POST", { launchDate: "2026-11-03", legacyCustodianUserId: member.id }),
      routeParams({})
    );
    expect(res.status).toBe(200);

    const c = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } });
    expect(c.financeEnabledAt?.toISOString()).toBe("2026-11-02T16:00:00.000Z");
    expect(c.legacyCustodianUserId).toBe(member.id);
    const m = await prisma.membership.findFirstOrThrow({ where: { userId: ownerId, classroomId } });
    expect(m.isCustodian).toBe(true);
    expect(m.canSettle).toBe(true);

    const get = (id: number) => prisma.studentCard.findUniqueOrThrow({ where: { id } });
    expect((await get(open.id)).expiresAt?.toISOString()).toBe("2027-05-02T16:00:00.000Z");
    expect((await get(voided.id)).expiresAt).toBeNull();
    expect((await get(empty.id)).expiresAt).toBeNull();
  });

  it("enable twice -> 409; custodian outside classroom -> 400", async () => {
    const stranger = await prisma.user.create({ data: { email: "s@test.local", name: "S", password: "x" } });
    const bad = await ENABLE(
      jsonRequest("POST", { launchDate: "2026-11-03", legacyCustodianUserId: stranger.id }),
      routeParams({})
    );
    expect(bad.status).toBe(400);
    const badDate = await ENABLE(
      jsonRequest("POST", { launchDate: "2026-02-31", legacyCustodianUserId: ownerId }),
      routeParams({})
    );
    expect(badDate.status).toBe(400);
    const ok = { launchDate: "2026-11-03", legacyCustodianUserId: ownerId };
    expect((await ENABLE(jsonRequest("POST", ok), routeParams({}))).status).toBe(200);
    const again = await ENABLE(jsonRequest("POST", ok), routeParams({}));
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("FINANCE_ALREADY_ENABLED");
  });

  it("non-owner cannot enable", async () => {
    const member = await createMember(classroomId, { role: "admin" });
    auth.userId = member.id;
    const res = await ENABLE(
      jsonRequest("POST", { launchDate: "2026-11-03", legacyCustodianUserId: ownerId }),
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

  it("custodian-only can receive but not settle; settler-only is not in custody", async () => {
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

    const { users } = await getCustody(classroomId);
    const ids = users.map((u) => u.userId);
    expect(ids).toEqual(expect.arrayContaining([ownerId, sean.id]));
    expect(ids).not.toContain(nora.id);
  });

  it("settings GET/PATCH and member toggles; each flag keeps its last holder", async () => {
    const member = await createMember(classroomId);
    await ENABLE(jsonRequest("POST", { launchDate: "2026-11-03", legacyCustodianUserId: ownerId }), routeParams({}));

    const patch = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 10, legacyCustodianUserId: member.id }), routeParams({}));
    expect(patch.status).toBe(200);
    const bad = await SETTINGS_PATCH(jsonRequest("PATCH", { roundTo: 5 }), routeParams({}));
    expect(bad.status).toBe(400);

    const s = await (await SETTINGS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(s).toMatchObject({ enabled: true, launchDate: "2026-11-03", roundTo: 10, legacyCustodianUserId: member.id });
    expect(s.members).toHaveLength(2);
    expect(Object.keys(s.members[0]).sort()).toEqual(["canSettle", "isCustodian", "name", "userId"]);

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
});
