import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLocation,
  createLesson,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/finance/receivers/route";
import { POST as RESTORE } from "@/app/api/finance/receivers/restore/route";
import { setupChecklist } from "@/service/finance/setup";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 11/1 台北

describe("opening: money received by non-custodians", () => {
  let classroomId: number;
  let ownerId: number;
  let noraId: number;
  let seanId: number;
  let studentId: number;
  let cardId: number;

  const receiversItem = async () => (await setupChecklist(classroomId)).find((i) => i.key === "receivers")!;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: ownerId });
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
    noraId = (await createMember(classroomId, { name: "Nora", email: "nora@test.local" })).id;
    seanId = (await createMember(classroomId, { name: "Sean", email: "sean@test.local" })).id;
    await prisma.membership.updateMany({ where: { userId: seanId, classroomId }, data: { isCustodian: true } });
    studentId = (await createStudent(classroomId)).id;
    cardId = (await createCard(classroomId)).id;
  });

  async function paidCard(paidByUserId: number | null, createdAt: Date, extra: { isPaid?: boolean } = {}) {
    const sc = await createStudentCard(studentId, cardId, { createdAt, finalPrice: 2000, ...extra });
    if (paidByUserId !== null) await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId } });
    return sc;
  }

  async function dropIn(paidByUserId: number, isPaid = true) {
    const { period } = await createLesson(classroomId, { withPeriod: true });
    const rec = await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId } });
    return prisma.dropInCharge.create({
      data: { attendanceRecordId: rec.id, amount: 400, isPaid, paidByUserId, paidAt: new Date("2026-11-03T04:00:00Z") },
    });
  }

  it("lists only paid post-launch cards / drop-ins whose receiver is not a custodian", async () => {
    const after = new Date("2026-11-02T04:00:00Z");
    const stray = await paidCard(noraId, after);
    await paidCard(ownerId, after); // custodian
    await paidCard(seanId, after); // custodian
    // 上線前的卡：還有剩格 → 也要改記到保管人；用完了／已關閉的不用
    const before = await paidCard(noraId, new Date("2026-10-01T00:00:00Z"));
    const usedUp = await paidCard(noraId, new Date("2026-10-01T00:00:00Z"));
    await prisma.studentCard.update({ where: { id: usedUp.id }, data: { remainingSessions: 0 } });
    const closed = await paidCard(noraId, new Date("2026-10-01T00:00:00Z"));
    await prisma.studentCard.update({ where: { id: closed.id }, data: { expiredAt: new Date("2026-10-20T00:00:00Z") } });
    await paidCard(noraId, after, { isPaid: false }); // unpaid: no money yet
    await paidCard(null, after); // no receiver
    const d = await dropIn(noraId);
    await dropIn(noraId, false);

    const res = await GET(jsonRequest("GET"), routeParams({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((i: { kind: string; id: number }) => `${i.kind}:${i.id}`).sort()).toEqual(
      [`card:${stray.id}`, `card:${before.id}`, `dropIn:${d.id}`].sort(),
    );
    const card = body.items.find((i: { kind: string; id: number }) => i.kind === "card" && i.id === stray.id);
    expect(card).toMatchObject({ amount: 2000, receiverUserId: noraId, receiverName: "Nora" });

    const item = await receiversItem();
    expect(item.done).toBe(false);
    expect(item.detail).toBe("3 筆、$4,400 記在不是保管人的人名下");
  });

  it("checklist item sits before opening and is done when nothing is stray", async () => {
    const keys = (await setupChecklist(classroomId)).map((i) => i.key);
    expect(keys.indexOf("receivers")).toBeLessThan(keys.indexOf("opening"));
    expect((await receiversItem()).done).toBe(true);
  });

  it("reassigns the chosen rows to a custodian and sets the sold branch when missing", async () => {
    const loc = await createLocation(classroomId, { name: "高雄" });
    await prisma.location.update({ where: { id: loc.id }, data: { keeperUserId: seanId } });
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const b = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const d = await dropIn(noraId);

    const res = await POST(
      jsonRequest("POST", { moves: [{ toUserId: seanId, cardIds: [a.id], dropInIds: [d.id] }] }),
      routeParams({}),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cards: 1, dropIns: 1 });

    const aa = await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } });
    expect(aa.paidByUserId).toBe(seanId);
    expect(aa.soldLocationId).toBe(loc.id);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: b.id } })).paidByUserId).toBe(noraId);
    expect((await prisma.dropInCharge.findUniqueOrThrow({ where: { id: d.id } })).paidByUserId).toBe(seanId);
    expect((await receiversItem()).done).toBe(false);

    await POST(jsonRequest("POST", { moves: [{ toUserId: ownerId, cardIds: [b.id], dropInIds: [] }] }), routeParams({}));
    expect((await receiversItem()).done).toBe(true);
  });

  it("keeps an existing sold branch", async () => {
    const loc = await createLocation(classroomId, { name: "台南" });
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    await prisma.studentCard.update({ where: { id: a.id }, data: { soldLocationId: loc.id } });
    await POST(jsonRequest("POST", { moves: [{ toUserId: seanId, cardIds: [a.id], dropInIds: [] }] }), routeParams({}));
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } })).soldLocationId).toBe(loc.id);
  });

  it("target must be a custodian; caller must be able to settle; other classrooms untouched", async () => {
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const bad = await POST(jsonRequest("POST", { moves: [{ toUserId: noraId, cardIds: [a.id], dropInIds: [] }] }), routeParams({}));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("NOT_FINANCE_MEMBER");

    // a custodian-only member cannot do it
    auth.userId = seanId;
    const forbidden = await POST(jsonRequest("POST", { moves: [{ toUserId: seanId, cardIds: [a.id], dropInIds: [] }] }), routeParams({}));
    expect(forbidden.status).toBe(403);
    auth.userId = ownerId;

    const other = await createClassroom({ name: "Other", email: "o2@test.local" });
    const os = await createStudent(other.id);
    const oc = await createCard(other.id);
    const otherCard = await createStudentCard(os.id, oc.id, { createdAt: new Date("2026-11-02T04:00:00Z") });
    await prisma.studentCard.update({ where: { id: otherCard.id }, data: { paidByUserId: other.ownerId } });
    const res = await POST(
      jsonRequest("POST", { moves: [{ toUserId: seanId, cardIds: [otherCard.id, a.id], dropInIds: [] }] }),
      routeParams({}),
    );
    expect(await res.json()).toEqual({ cards: 1, dropIns: 0 });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: otherCard.id } })).paidByUserId).toBe(other.ownerId);
  });

  it("keeps the first collector, lists the reassignment, and restores it", async () => {
    const vivi = (await createMember(classroomId, { name: "Vivi", email: "vivi@test.local" })).id;
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const b = await paidCard(vivi, new Date("2026-11-02T04:00:00Z"));
    const d = await dropIn(noraId);

    // 兩組一次送出
    const res = await POST(
      jsonRequest("POST", {
        moves: [
          { toUserId: seanId, cardIds: [a.id], dropInIds: [d.id] },
          { toUserId: ownerId, cardIds: [b.id], dropInIds: [] },
        ],
      }),
      routeParams({}),
    );
    expect(await res.json()).toEqual({ cards: 2, dropIns: 1 });
    const aa = await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } });
    expect([aa.paidByUserId, aa.collectedByUserId]).toEqual([seanId, noraId]);
    const bb = await prisma.studentCard.findUniqueOrThrow({ where: { id: b.id } });
    expect([bb.paidByUserId, bb.collectedByUserId]).toEqual([ownerId, vivi]);
    const dd = await prisma.dropInCharge.findUniqueOrThrow({ where: { id: d.id } });
    expect([dd.paidByUserId, dd.collectedByUserId]).toEqual([seanId, noraId]);

    // Sean 不再是保管人 → 又出現在待整理；再改記一次，collectedBy 仍是第一位（Nora）
    await prisma.membership.updateMany({ where: { userId: seanId, classroomId }, data: { isCustodian: false } });
    const again = await (await GET(jsonRequest("GET"), routeParams({}))).json();
    expect(again.items.find((i: { id: number; kind: string }) => i.kind === "card" && i.id === a.id)).toMatchObject({
      receiverName: "Sean",
      collectedByName: "Nora",
    });
    await POST(jsonRequest("POST", { moves: [{ toUserId: ownerId, cardIds: [a.id], dropInIds: [] }] }), routeParams({}));
    const a2 = await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } });
    expect([a2.paidByUserId, a2.collectedByUserId]).toEqual([ownerId, noraId]);

    const body = await (await GET(jsonRequest("GET"), routeParams({}))).json();
    expect(
      body.reassigned.map((i: { kind: string; id: number; collectedByName: string; holderName: string }) => [
        `${i.kind}:${i.id}`,
        i.collectedByName,
        i.holderName,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [`card:${a.id}`, "Nora", expect.any(String)],
        [`card:${b.id}`, "Vivi", expect.any(String)],
        [`dropIn:${d.id}`, "Nora", "Sean"],
      ]),
    );
    expect(body.reassigned).toHaveLength(3);

    // 復原：還給原收款人，清掉 collectedBy，回到待整理
    const r = await RESTORE(jsonRequest("POST", { cardIds: [a.id], dropInIds: [d.id] }), routeParams({}));
    expect(await r.json()).toEqual({ cards: 1, dropIns: 1 });
    const a3 = await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } });
    expect([a3.paidByUserId, a3.collectedByUserId]).toEqual([noraId, null]);
    const d3 = await prisma.dropInCharge.findUniqueOrThrow({ where: { id: d.id } });
    expect([d3.paidByUserId, d3.collectedByUserId]).toEqual([noraId, null]);
    const after = await (await GET(jsonRequest("GET"), routeParams({}))).json();
    expect(after.reassigned.map((i: { id: number }) => i.id)).toEqual([b.id]);
    expect(after.items.map((i: { kind: string; id: number }) => `${i.kind}:${i.id}`).sort()).toEqual(
      [`card:${a.id}`, `dropIn:${d.id}`].sort(),
    );
  });

  it("restore needs canSettle, is classroom-scoped, and is refused once the ledger is locked", async () => {
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    await POST(jsonRequest("POST", { moves: [{ toUserId: seanId, cardIds: [a.id], dropInIds: [] }] }), routeParams({}));

    auth.userId = seanId;
    expect((await RESTORE(jsonRequest("POST", { cardIds: [a.id], dropInIds: [] }), routeParams({}))).status).toBe(403);
    auth.userId = ownerId;

    const other = await createClassroom({ name: "Other", email: "o3@test.local" });
    const os = await createStudent(other.id);
    const oc = await createCard(other.id);
    const otherCard = await createStudentCard(os.id, oc.id);
    await prisma.studentCard.update({
      where: { id: otherCard.id },
      data: { paidByUserId: other.ownerId, collectedByUserId: noraId },
    });
    const res = await RESTORE(jsonRequest("POST", { cardIds: [otherCard.id], dropInIds: [] }), routeParams({}));
    expect(await res.json()).toEqual({ cards: 0, dropIns: 0 });

    await prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: new Date("2026-11-05T00:00:00Z") } });
    const locked = await RESTORE(jsonRequest("POST", { cardIds: [a.id], dropInIds: [] }), routeParams({}));
    expect(locked.status).toBe(409);
    expect((await locked.json()).code).toBe("PERIOD_LOCKED");
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } })).paidByUserId).toBe(seanId);
  });
  describe("opening cards held by a custodian (期初現金：錢已經交給另一位保管人)", () => {
    let locId: number;
    const oldCard = async (paidBy: number | null, createdAt = new Date("2026-10-01T04:00:00Z")) => {
      const sc = await paidCard(paidBy, createdAt);
      await prisma.studentCard.update({ where: { id: sc.id }, data: { soldLocationId: locId } });
      return sc;
    };
    const holder = async (id: number) => {
      const c = await prisma.studentCard.findUniqueOrThrow({ where: { id } });
      return [c.paidByUserId, c.collectedByUserId];
    };
    const move = (toUserId: number, cardIds: number[], conversionDate?: string) =>
      POST(jsonRequest("POST", { moves: [{ toUserId, cardIds, dropInIds: [] }], ...(conversionDate ? { conversionDate } : {}) }), routeParams({}));

    beforeEach(async () => {
      locId = (await createLocation(classroomId, { name: "台南" })).id;
    });

    it("moves an old card custodian → custodian (incl. a legacy-custodian card), keeps the first collector, and stays out of the stray list", async () => {
      const a = await oldCard(ownerId);
      const legacy = await oldCard(null); // 沒記收款人 → 算在預設保管人（owner）手上

      // 沒帶轉換日：不是待整理的錢，什麼都不動
      expect(await (await move(seanId, [a.id])).json()).toEqual({ cards: 0, dropIns: 0 });
      expect(await holder(a.id)).toEqual([ownerId, null]);

      const res = await move(seanId, [a.id, legacy.id], "2026-11-01");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ cards: 2, dropIns: 0 });
      expect(await holder(a.id)).toEqual([seanId, ownerId]);
      expect(await holder(legacy.id)).toEqual([seanId, ownerId]);
      expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } })).soldLocationId).toBe(locId);

      // 保管人之間改記不會進第 5 步的待整理
      const body = await (await GET(jsonRequest("GET"), routeParams({}))).json();
      expect(body.items).toEqual([]);
      expect((await receiversItem()).done).toBe(true);

      // 改回第一位經手的人＝復原
      await move(ownerId, [a.id], "2026-11-01");
      expect(await holder(a.id)).toEqual([ownerId, null]);

      // 復原
      const r = await RESTORE(jsonRequest("POST", { cardIds: [legacy.id], dropInIds: [] }), routeParams({}));
      expect(await r.json()).toEqual({ cards: 1, dropIns: 0 });
      expect(await holder(legacy.id)).toEqual([ownerId, null]);
    });

    it("refuses post-conversion cards, used-up cards and other classrooms; refused once locked", async () => {
      const post = await oldCard(ownerId, new Date("2026-11-05T04:00:00Z"));
      const usedUp = await oldCard(ownerId);
      await prisma.studentCard.update({ where: { id: usedUp.id }, data: { remainingSessions: 0 } });
      // 已開帳（11/1）：草稿的轉換日再晚，也不會碰開帳後買的卡
      expect(await (await move(seanId, [post.id, usedUp.id], "2026-12-01")).json()).toEqual({ cards: 0, dropIns: 0 });
      expect(await holder(post.id)).toEqual([ownerId, null]);
      expect(await holder(usedUp.id)).toEqual([ownerId, null]);

      const other = await createClassroom({ name: "Other", email: "o4@test.local" });
      const os = await createStudent(other.id);
      const otherCard = await createStudentCard(os.id, (await createCard(other.id)).id, { createdAt: new Date("2026-10-01T04:00:00Z") });
      await prisma.studentCard.update({ where: { id: otherCard.id }, data: { paidByUserId: ownerId } });
      expect(await (await move(seanId, [otherCard.id], "2026-11-01")).json()).toEqual({ cards: 0, dropIns: 0 });

      auth.userId = seanId; // custodian but cannot settle
      const a = await oldCard(ownerId);
      expect((await move(seanId, [a.id], "2026-11-01")).status).toBe(403);
      auth.userId = ownerId;

      await prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: new Date("2026-11-05T00:00:00Z") } });
      const locked = await move(seanId, [a.id], "2026-11-01");
      expect(locked.status).toBe(409);
      expect(await holder(a.id)).toEqual([ownerId, null]);
    });
  });
});
