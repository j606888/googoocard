import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createLocation,
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

import { POST as EXPIRE } from "@/app/api/students/[id]/student-cards/[studentCardId]/expire/route";
import { POST as POST_REFUND } from "@/app/api/finance/refunds/route";
import { createStudentCardInTx } from "@/service/studentCard";
import { performConversion } from "@/service/studentCardConversion";
import { performTransfer } from "@/service/studentCardTransfer";
import { expireDueCards, expiryEvents } from "@/service/finance/expiry";
import { getCustody } from "@/service/finance/custody";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { addMonthsTaipei, toTaipeiDateKey } from "@/lib/taipei-date";

describe("finance card expiry", () => {
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

  const enable = (legacyCustodianUserId = ownerId) =>
    enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId });

  async function buy(studentId: number) {
    // 財務開啟後收款人必須是財務成員。
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
    const card = await createCard(classroomId, { price: 2000, sessions: 6 });
    return prisma.$transaction((tx) =>
      createStudentCardInTx(tx, {
        studentId,
        card,
        finalPrice: 2000,
        sessions: 6,
        purchaseSource: "STAFF",
        isPaid: true,
        paidByUserId: ownerId,
        eventDescription: "test",
      })
    );
  }

  it("new card gets expiresAt +6 months when finance enabled", async () => {
    await enable();
    const student = await createStudent(classroomId);
    const sc = await buy(student.id);
    const expected = addMonthsTaipei(toTaipeiDateKey(new Date()), 6);
    expect(sc.expiresAt?.toISOString()).toBe(expected.toISOString());
  });

  it("finance disabled: new card has no expiresAt", async () => {
    const student = await createStudent(classroomId);
    const sc = await buy(student.id);
    expect(sc.expiresAt).toBeNull();
  });

  it("expireDueCards closes due cards with expiredAt = expiresAt and is idempotent", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const due = await createStudentCard(student.id, card.id, { remainingSessions: 3 });
    const later = await createStudentCard(student.id, card.id, { remainingSessions: 3 });
    const dueAt = new Date("2027-05-01T16:00:00Z");
    await prisma.studentCard.update({ where: { id: due.id }, data: { expiresAt: dueAt } });
    await prisma.studentCard.update({
      where: { id: later.id },
      data: { expiresAt: new Date("2027-06-01T16:00:00Z") },
    });
    const now = new Date("2027-05-10T00:00:00Z");

    // 財務沒開：不到期
    expect(await expireDueCards(classroomId, now)).toBe(0);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: due.id } })).expiredAt).toBeNull();

    await enable();
    expect(await expireDueCards(classroomId, now)).toBe(1);
    const after = await prisma.studentCard.findUniqueOrThrow({ where: { id: due.id } });
    expect(after.expiredAt?.toISOString()).toBe(dueAt.toISOString());
    expect(after.closedReason).toBe("EXPIRED");
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: later.id } })).expiredAt).toBeNull();

    expect(await expireDueCards(classroomId, now)).toBe(0);

    // 其他教室的到期卡不受影響
    const other = await createClassroom({ name: "O", email: "o@test.local" });
    await enableFinanceFor(other.id, { launch: new Date("2026-10-31T16:00:00Z") });
    const os = await createStudent(other.id);
    const oc = await createCard(other.id);
    const osc = await createStudentCard(os.id, oc.id);
    await prisma.studentCard.update({ where: { id: osc.id }, data: { expiresAt: dueAt } });
    expect(await expireDueCards(classroomId, now)).toBe(0);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: osc.id } })).expiredAt).toBeNull();
  });

  it("expireDueCards leaves a used-up (0-session) card open and keeps Needs Renewal (issue 08)", async () => {
    await enable();
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const used = await createStudentCard(student.id, card.id, { totalSessions: 6, remainingSessions: 0 });
    await prisma.studentCard.update({ where: { id: used.id }, data: { expiresAt: new Date("2027-05-01T16:00:00Z") } });
    await refreshNeedsRenewalTag(student.id, classroomId);
    const tagged = () =>
      prisma.studentTag.count({ where: { studentId: student.id, tag: { name: "Needs Renewal" } } });
    expect(await tagged()).toBe(1);

    expect(await expireDueCards(classroomId, new Date("2027-05-10T00:00:00Z"))).toBe(0);
    const after = await prisma.studentCard.findUniqueOrThrow({ where: { id: used.id } });
    expect(after.expiredAt).toBeNull();
    expect(after.closedReason).toBeNull();
    expect(await tagged()).toBe(1);
  });

  it("expiry with no branch and no legacy custodian surfaces as a custody warning (issue 08)", async () => {
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z") });
    const student = await createStudent(classroomId);
    const sc = await buy(student.id);
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { soldLocationId: null, expiresAt: new Date("2027-04-30T16:00:00Z") },
    });
    await expireDueCards(classroomId, new Date("2027-05-01T00:00:00Z"));
    expect(await expiryEvents(classroomId)).toEqual([]);

    const { warnings } = await getCustody(classroomId);
    expect(warnings).toContainEqual({ code: "UNRESOLVED_KEEPER", studentCardId: sc.id });
  });

  it("conversion and transfer inherit expiresAt", async () => {
    await enable();
    const loc = await createLocation(classroomId);
    const student = await createStudent(classroomId, { name: "A" });
    const toStudent = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId, { name: "Level 1", price: 3000, sessions: 6 });
    const target = await createCard(classroomId, { name: "Level 2", price: 3000, sessions: 6 });
    const expiresAt = new Date("2027-03-01T16:00:00Z");

    const src = await createStudentCard(student.id, card.id, { remainingSessions: 4 });
    const keeper = await createMember(classroomId, { email: "keeper@test.local" });
    await prisma.studentCard.update({
      where: { id: src.id },
      data: { expiresAt, soldLocationId: loc.id, paidByUserId: keeper.id },
    });
    const converted = await performConversion({
      sourceCard: { ...src, card: { name: card.name } },
      targetCard: target,
      sessions: 4,
      actorUserId: ownerId,
    });
    expect(converted.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
    expect(converted.soldLocationId).toBe(loc.id);
    // 保管人沿用舊卡，不是操作的人
    expect(converted.paidByUserId).toBe(keeper.id);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: src.id } })).closedReason).toBeNull();

    const transferred = await performTransfer({
      sourceCard: { ...converted, card: { name: target.name, classroomId }, student: { name: "A" } },
      toStudent: { id: toStudent.id, name: "B" },
    });
    expect(transferred?.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
    expect(transferred?.soldLocationId).toBe(loc.id);
    expect(transferred?.paidByUserId).toBe(keeper.id);
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: converted.id } })).closedReason
    ).toBeNull();

    // 轉換／轉讓關閉的卡不算過期收入
    expect(await expiryEvents(classroomId)).toEqual([]);
  });

  it("legacy source card (no holder) keeps a null holder through conversion and transfer", async () => {
    await enable();
    const student = await createStudent(classroomId, { name: "A" });
    const toStudent = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId, { name: "Level 1", price: 3000, sessions: 6 });
    const target = await createCard(classroomId, { name: "Level 2", price: 3000, sessions: 6 });
    const src = await createStudentCard(student.id, card.id, { remainingSessions: 4 });
    expect(src.paidByUserId).toBeNull();

    const converted = await performConversion({
      sourceCard: { ...src, card: { name: card.name } },
      targetCard: target,
      sessions: 4,
      actorUserId: ownerId,
    });
    expect(converted.paidByUserId).toBeNull();
    const transferred = await performTransfer({
      sourceCard: { ...converted, card: { name: target.name, classroomId }, student: { name: "A" } },
      toStudent: { id: toStudent.id, name: "B" },
      actorUserId: ownerId,
    });
    expect(transferred?.paidByUserId).toBeNull();
  });

  it("finance disabled: conversion holder is still the actor", async () => {
    const keeper = await createMember(classroomId, { email: "keeper@test.local" });
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "Level 1", price: 3000, sessions: 6 });
    const target = await createCard(classroomId, { name: "Level 2", price: 3000, sessions: 6 });
    const src = await createStudentCard(student.id, card.id, { remainingSessions: 4 });
    await prisma.studentCard.update({ where: { id: src.id }, data: { paidByUserId: keeper.id } });
    const converted = await performConversion({
      sourceCard: { ...src, card: { name: card.name } },
      targetCard: target,
      sessions: 4,
      actorUserId: ownerId,
    });
    expect(converted.paidByUserId).toBe(ownerId);
  });

  it("manual void becomes expiry income to sold branch fund", async () => {
    await enable();
    const tainan = await createLocation(classroomId, { name: "台南" });
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { price: 2000, sessions: 6 });
    const sc = await createStudentCard(student.id, card.id, {
      finalPrice: 2000,
      totalSessions: 6,
      remainingSessions: 2,
    });
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { soldLocationId: tainan.id, paidByUserId: ownerId },
    });
    // 沒付款的卡作廢沒有錢
    const unpaid = await createStudentCard(student.id, card.id, { remainingSessions: 2, isPaid: false });

    const res = await EXPIRE(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(200);
    await EXPIRE(jsonRequest("POST"), routeParams({ id: String(student.id), studentCardId: String(unpaid.id) }));

    const after = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(after.closedReason).toBe("VOIDED");

    const events = await expiryEvents(classroomId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      studentCardId: sc.id,
      holderUserId: ownerId,
      soldLocationId: tainan.id,
      to: { type: "fund", locationId: tainan.id },
    });
    expect(events[0].value).toBeCloseTo(666.67, 2);
    expect(events[0].date.toISOString()).toBe(after.expiredAt!.toISOString());
  });

  it("legacy card expiry goes to legacy custodian's branch target", async () => {
    const sean = await createMember(classroomId, { email: "k@test.local", name: "K" });
    await enable(sean.id);
    await createLocation(classroomId, { name: "南", sortOrder: 0 });
    const kaohsiung = await createLocation(classroomId, { name: "北", sortOrder: 1 });
    await prisma.location.update({
      where: { id: kaohsiung.id },
      data: { keeperUserId: sean.id, expiryTo: "USER", expiryUserId: sean.id },
    });
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const legacy = await createStudentCard(student.id, card.id, {
      finalPrice: 3000,
      totalSessions: 6,
      remainingSessions: 3,
    });
    const dueAt = new Date("2027-04-30T16:00:00Z");
    await prisma.studentCard.update({ where: { id: legacy.id }, data: { expiresAt: dueAt } });
    await expireDueCards(classroomId, new Date("2027-05-01T00:00:00Z"));

    const events = await expiryEvents(classroomId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      studentCardId: legacy.id,
      value: 1500,
      holderUserId: sean.id,
      soldLocationId: null,
      to: { type: "user", userId: sean.id },
    });
    expect(events[0].date.toISOString()).toBe(dueAt.toISOString());

    // 沒有他負責的分部 → 直接給 legacy custodian
    await prisma.location.update({ where: { id: kaohsiung.id }, data: { keeperUserId: null } });
    const [e] = await expiryEvents(classroomId);
    expect(e.to).toEqual({ type: "user", userId: sean.id });
    await prisma.location.update({
      where: { id: kaohsiung.id },
      data: { keeperUserId: sean.id, expiryTo: "FUND" },
    });
    const [f] = await expiryEvents(classroomId);
    expect(f.to).toEqual({ type: "fund", locationId: kaohsiung.id });
  });

  it("refund remainder becomes expiry income", async () => {
    await enable();
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
    const tainan = await createLocation(classroomId, { name: "台南" });
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { price: 2000, sessions: 6 });
    const sc = await createStudentCard(student.id, card.id, {
      finalPrice: 2000,
      totalSessions: 6,
      remainingSessions: 2,
    });
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { soldLocationId: tainan.id, paidByUserId: ownerId },
    });
    const res = await POST_REFUND(
      jsonRequest("POST", { studentCardId: sc.id, amount: 500, paidByUserId: ownerId, date: "2026-11-02" }),
      routeParams({})
    );
    expect(res.status).toBe(200);

    const events = await expiryEvents(classroomId);
    expect(events).toHaveLength(1);
    expect(events[0].to).toEqual({ type: "fund", locationId: tainan.id });
    expect(events[0].value).toBeCloseTo(166.67, 2);
  });
});
