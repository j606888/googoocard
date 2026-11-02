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
  createLesson,
  createPendingAttendance,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { chargeDropIn } from "@/service/dropIn";
import { createStudentCardInTx } from "@/service/studentCard";
import { POST as BUY } from "@/app/api/students/[id]/student-cards/route";
import { POST as CONFIRM } from "@/app/api/students/[id]/student-cards/[studentCardId]/confirm-payment/route";

describe("finance receiver and sold branch", () => {
  let classroomId: number;
  let studentId: number;
  let assistantId: number;
  let keeperId: number;
  let locationId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
    studentId = (await createStudent(classroomId)).id;
    assistantId = (await createMember(classroomId, { email: "a@test.local" })).id;
    keeperId = (await createMember(classroomId, { email: "k@test.local", role: "teacher" })).id;
    locationId = (await createLocation(classroomId)).id;
  });

  const unpaidCard = async () => {
    const card = await createCard(classroomId);
    return createStudentCard(studentId, card.id, { isPaid: false });
  };
  const confirm = async (sc: { id: number }, body: object = {}) =>
    CONFIRM(jsonRequest("POST", body), routeParams({ id: String(studentId), studentCardId: String(sc.id) }));

  async function enable() {
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId: 1 });
    await prisma.membership.updateMany({ where: { userId: { in: [1, keeperId] }, classroomId }, data: { isFinance: true } });
    await prisma.location.update({ where: { id: locationId }, data: { keeperUserId: keeperId } });
  }

  it("assistant receiver rejected when finance enabled", async () => {
    await enable();
    const sc = await unpaidCard();
    const res = await confirm(sc, { receiverUserId: assistantId });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("RECEIVER_NOT_FINANCE");
  });

  it("default receiver is caller if finance, else rejected without a lesson branch", async () => {
    await enable();
    const sc = await unpaidCard();
    auth.userId = assistantId;
    expect((await confirm(sc)).status).toBe(400);
    auth.userId = 1;
    expect((await confirm(sc)).status).toBe(200);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } })).paidByUserId).toBe(1);
  });

  it("soldLocation from receiver's branch, overridable", async () => {
    await enable();
    const sc = await unpaidCard();
    expect((await confirm(sc, { receiverUserId: keeperId })).status).toBe(200);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } })).soldLocationId).toBe(locationId);

    const other = await createLocation(classroomId, { name: "B" });
    const sc2 = await unpaidCard();
    await confirm(sc2, { receiverUserId: keeperId, soldLocationId: other.id });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc2.id } })).soldLocationId).toBe(other.id);

    const sc3 = await unpaidCard();
    await confirm(sc3); // caller 1 keeps no branch
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc3.id } })).soldLocationId).toBeNull();
  });

  it("finance disabled: any member can receive", async () => {
    const sc = await unpaidCard();
    expect((await confirm(sc, { receiverUserId: assistantId })).status).toBe(200);
    const row = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(row.paidByUserId).toBe(assistantId);
    expect(row.soldLocationId).toBeNull();
  });

  it("paid-at-creation card needs a finance receiver and records the branch", async () => {
    await enable();
    const card = await createCard(classroomId);
    const make = (paidByUserId: number) =>
      prisma.$transaction((tx) =>
        createStudentCardInTx(tx, {
          studentId,
          card,
          finalPrice: 3000,
          sessions: 6,
          purchaseSource: "STAFF",
          isPaid: true,
          paidByUserId,
          eventDescription: "x",
        })
      );
    expect((await make(keeperId)).soldLocationId).toBe(locationId);
  });

  it("assistant sells a paid card in a lesson at a keeper's branch -> keeper receives", async () => {
    await enable();
    const card = await createCard(classroomId);
    const { lesson } = await createLesson(classroomId, { cardIds: [card.id], locationId });
    auth.userId = assistantId;
    const res = await BUY(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, lessonId: lesson.id, isPaid: true, paymentMethod: "CASH" }),
      routeParams({ id: String(studentId) })
    );
    expect(res.status).toBe(200);
    const row = await prisma.studentCard.findFirstOrThrow({ where: { studentId } });
    expect(row.paidByUserId).toBe(keeperId);
    expect(row.soldLocationId).toBe(locationId);
    // no lesson context and no finance caller -> 400
    const res2 = await BUY(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, isPaid: true, paymentMethod: "CASH" }),
      routeParams({ id: String(studentId) })
    );
    expect(res2.status).toBe(400);
  });

  async function dropInSetup() {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, { cardIds: [card.id], withPeriod: true, locationId });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { dropInPrice: 900 } });
    await createPendingAttendance(period!.id, studentId);
    return { lesson, period: period! };
  }
  const chargePaid = (classroomId: number, userId: number, lessonId: number, lessonPeriodId: number) =>
    chargeDropIn({
      classroomId,
      userId,
      lessonId,
      lessonPeriodId,
      studentId,
      payment: { isPaid: true, paymentMethod: "CASH" },
    });

  it("drop-in by a non-finance caller is recorded to the branch keeper", async () => {
    await enable();
    const { lesson, period } = await dropInSetup();
    await chargePaid(classroomId, assistantId, lesson.id, period.id);
    const charge = await prisma.dropInCharge.findFirstOrThrow();
    expect(charge.paidByUserId).toBe(keeperId);
  });

  it("drop-in with a non-finance keeper -> RECEIVER_REQUIRED", async () => {
    await enable();
    await prisma.membership.updateMany({ where: { userId: keeperId, classroomId }, data: { isFinance: false } });
    const { lesson, period } = await dropInSetup();
    await expect(chargePaid(classroomId, assistantId, lesson.id, period.id)).rejects.toMatchObject({
      code: "RECEIVER_REQUIRED",
    });
  });
});
