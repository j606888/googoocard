import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  enableFinanceFor,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as consume } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/[studentId]/consume/route";
import { updateAttendance } from "@/domains/attendance/attendance.service";
import { performConversion } from "@/service/studentCardConversion";
import { performTransfer } from "@/service/studentCardTransfer";
import { getCustody } from "@/service/finance/custody";

// R26：財務開啟時，退格順著轉換／轉讓鏈退到現在那張卡；consume 不能扣已關閉的卡。
const LAUNCH = new Date("2026-10-31T16:00:00Z");
const PERIOD = new Date("2026-11-09T02:00:00Z");

describe("finance: refunds follow the conversion chain, consume refuses closed cards", () => {
  let classroomId: number;
  let ownerId: number;
  let lessonId: number;
  let periodId: number;
  let studentId: number;
  let cardTypeId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    lessonId = (await createLesson(classroomId, { name: "L" })).lesson.id;
    periodId = (
      await prisma.lessonPeriod.create({
        data: { lessonId, startTime: PERIOD, endTime: new Date(PERIOD.getTime() + 3600_000), attendanceTakenAt: PERIOD },
      })
    ).id;
    studentId = (await createStudent(classroomId, { name: "A" })).id;
    cardTypeId = (await createCard(classroomId, { name: "十堂", price: 1000, sessions: 10 })).id;
  });

  async function enable() {
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: ownerId });
    await prisma.membership.updateMany({ where: { classroomId }, data: { isFinance: true } });
  }

  /** 1000／10 格的卡，上過這堂（扣 1 格、剩 9）。 */
  async function attendedCard() {
    const sc = await createStudentCard(studentId, cardTypeId, { finalPrice: 1000, totalSessions: 10, remainingSessions: 9, isPaid: true });
    await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: ownerId } });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: periodId, studentId, studentCardId: sc.id, sessionsUsed: 1 } });
    return prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id }, include: { card: true, student: true } });
  }

  const convert = async (source: Awaited<ReturnType<typeof attendedCard>>) =>
    performConversion({
      sourceCard: source,
      targetCard: { id: cardTypeId, name: "十堂", price: 1000, classroomId },
      sessions: source.remainingSessions,
      actorUserId: ownerId,
    });

  const totalCash = async () =>
    (await getCustody(classroomId)).users.reduce((sum, u) => sum + u.buckets.cash, 0);
  const remaining = async (id: number) => (await prisma.studentCard.findUniqueOrThrow({ where: { id } })).remainingSessions;

  it("untick an attendance paid by a converted card → the session goes to the new card, cash unchanged", async () => {
    await enable();
    const a = await attendedCard();
    const b = await convert(a);
    const before = await totalCash();
    expect(before).toBeCloseTo(1000, 5);

    await updateAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [] });

    expect(await remaining(b.id)).toBe(10);
    expect(await remaining(a.id)).toBe(9);
    expect(await totalCash()).toBeCloseTo(before, 5);
  });

  it("follows conversion then transfer to the end of the chain", async () => {
    await enable();
    const a = await attendedCard();
    const b = await convert(a);
    const other = await createStudent(classroomId, { name: "B" });
    const bFull = await prisma.studentCard.findUniqueOrThrow({
      where: { id: b.id },
      include: { card: true, student: true },
    });
    const c = await performTransfer({ sourceCard: bFull, toStudent: other, actorUserId: ownerId });
    const before = await totalCash();

    await updateAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [] });

    expect(await remaining(c!.id)).toBe(10);
    expect(await remaining(b.id)).toBe(9);
    expect(await totalCash()).toBeCloseTo(before, 5);
  });

  it("finance disabled: refund goes back to the original card (unchanged)", async () => {
    const a = await attendedCard();
    const b = await convert(a);
    await updateAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [] });
    expect(await remaining(a.id)).toBe(10);
    expect(await remaining(b.id)).toBe(9);
  });

  describe("consume", () => {
    async function pendingRecordWith(card: { expiredAt?: Date | null; expiresAt?: Date | null }) {
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: periodId, studentId, sessionsUsed: 1 } });
      const sc = await createStudentCard(studentId, cardTypeId, { isPaid: true });
      await prisma.studentCard.update({ where: { id: sc.id }, data: card });
      return sc.id;
    }
    const call = (studentCardId: number) =>
      consume(
        new Request("http://test.local", { method: "POST", body: JSON.stringify({ studentCardId: String(studentCardId) }) }),
        { params: Promise.resolve({ id: String(lessonId), periodId: String(periodId), studentId: String(studentId) }) },
      );

    it("finance on: refuses a closed card with 400 CARD_CLOSED", async () => {
      await enable();
      const id = await pendingRecordWith({ expiredAt: new Date("2026-11-05T00:00:00Z") });
      const res = await call(id);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("CARD_CLOSED");
      expect(await remaining(id)).toBe(6);
    });

    it("finance on: expires due cards first, then refuses", async () => {
      await enable();
      const id = await pendingRecordWith({ expiresAt: new Date(Date.now() - 86400_000) });
      const res = await call(id);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("CARD_CLOSED");
      expect((await prisma.studentCard.findUniqueOrThrow({ where: { id } })).closedReason).toBe("EXPIRED");
    });

    it("finance off: a closed card can still be consumed (unchanged)", async () => {
      const id = await pendingRecordWith({ expiredAt: new Date("2026-11-05T00:00:00Z") });
      expect((await call(id)).status).toBe(200);
      expect(await remaining(id)).toBe(5);
    });
  });
});
