// 財務 v2 測試共用情境：設計文件 §14 的十一月（docs/finance-v2/06 P2 驗收）。
import prisma from "@/lib/prisma";
import {
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  createLocation,
  createTeacher,
  createVenue,
  createVenuePack,
  enableFinanceFor,
} from "./factories";
import type { SplitRule } from "@/domains/finance/types";

export const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 台北
export const at = (ymd: string, hour = 11) => new Date(`${ymd}T${String(hour - 8).padStart(2, "0")}:00:00Z`); // 台北時間

export type NovemberWorld = Awaited<ReturnType<typeof seedNovember>>;

export async function seedNovember(classroomId: number, dingId: number) {
  const seanId = (await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" })).id;
  await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
  await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: seanId });

  const T = await createLocation(classroomId, { name: "台南", sortOrder: 0 });
  const K = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });
  await prisma.location.update({ where: { id: T.id }, data: { keeperUserId: dingId } });
  await prisma.location.update({ where: { id: K.id }, data: { keeperUserId: seanId } });

  const tDing = await createTeacher(classroomId, { name: "丁丁", userId: dingId });
  const tCharlene = await createTeacher(classroomId, { name: "Charlene", payerUserId: dingId });
  const tNora = await createTeacher(classroomId, { name: "Nora", payerUserId: dingId });
  const tSean = await createTeacher(classroomId, { name: "Sean", userId: seanId });
  const tPartner = await createTeacher(classroomId, { name: "高雄搭檔", payerUserId: seanId });
  const home = await createVenue(classroomId, { name: "丁丁家", landlordUserId: dingId });
  const steps = await createVenue(classroomId, { name: "24steps" });
  const pack = await createVenuePack(classroomId, steps.id, { sessions: 10, price: 4050, paidByUserId: seanId, purchasedAt: at("2026-11-05") });

  const tainanRule = (partner: number): SplitRule => ({
    lines: [
      { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: tDing.id } },
      { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: partner } },
      { kind: "fixed", amount: 300, to: { type: "venue", venueId: home.id } },
    ],
    rest: { type: "fund", locationId: T.id },
    fundLocationId: T.id,
  });
  const lesson = async (name: string, locationId: number, rule: SplitRule) => {
    const { lesson } = await createLesson(classroomId, { name, locationId });
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule, updatedById: dingId } });
    return lesson;
  };
  const thu = await lesson("週四期班", T.id, tainanRule(tNora.id));
  const tue = await lesson("Bachata Lv2", T.id, tainanRule(tCharlene.id));
  const sun = await lesson("Body movement", T.id, {
    lines: [{ kind: "fixed", amount: 300, to: { type: "venue", venueId: home.id } }],
    rest: { type: "teachers", shares: [{ teacherId: tSean.id, weight: 1 }] },
    fundLocationId: T.id,
  });
  const kao = await lesson("Bachata Training", K.id, {
    lines: [
      { kind: "venuePack", venueId: steps.id },
      { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: K.id } },
    ],
    rest: { type: "teachers", shares: [{ teacherId: tSean.id, weight: 1 }, { teacherId: tPartner.id, weight: 1 }] },
    fundLocationId: K.id,
  });

  const period = (lessonId: number, ymd: string) =>
    prisma.lessonPeriod.create({
      data: { lessonId, startTime: at(ymd, 20), endTime: at(ymd, 21), attendanceTakenAt: at(ymd, 21) },
    });

  const cardType = await createCard(classroomId);
  const student = (name: string) => createStudent(classroomId, { name });
  const buy = async (
    name: string,
    ymd: string,
    { price = 2000, sessions = 6, remaining, paidBy, sold }: { price?: number; sessions?: number; remaining: number; paidBy: number | null; sold: number },
  ) => {
    const s = await student(name);
    const c = await createStudentCard(s.id, cardType.id, {
      finalPrice: price, totalSessions: sessions, remainingSessions: remaining, isPaid: paidBy !== null, createdAt: at(ymd, 12),
    });
    await prisma.studentCard.update({
      where: { id: c.id },
      data: { soldLocationId: sold, ...(paidBy !== null ? { paidByUserId: paidBy, paidAt: at(ymd, 12) } : {}) },
    });
    return { studentId: s.id, cardId: c.id };
  };

  const ming = await buy("小明", "2026-11-04", { remaining: 2, paidBy: dingId, sold: T.id });
  const b1 = await buy("B1", "2026-11-04", { sessions: 5, remaining: 3, paidBy: dingId, sold: T.id });
  const b2 = await buy("B2", "2026-11-04", { sessions: 5, remaining: 3, paidBy: dingId, sold: T.id });
  const g1 = await buy("G1", "2026-11-04", { price: 0, sessions: 1, remaining: 0, paidBy: dingId, sold: T.id });
  const hua = await buy("小華", "2026-11-09", { remaining: 3, paidBy: dingId, sold: T.id });
  const qiang = await buy("小強", "2026-11-12", { remaining: 5, paidBy: seanId, sold: K.id });
  const mei = await buy("小美", "2026-11-18", { remaining: 4, paidBy: dingId, sold: T.id });
  const jie = await buy("阿傑", "2026-11-26", { remaining: 5, paidBy: null, sold: T.id });

  const attend = (lessonPeriodId: number, x: { studentId: number; cardId: number }) =>
    prisma.attendanceRecord.create({ data: { lessonPeriodId, studentId: x.studentId, studentCardId: x.cardId, sessionsUsed: 1 } });
  const dropIn = async (lessonPeriodId: number, amount: number, paidBy: number, ymd: string) => {
    const s = await student(`單堂${amount}`);
    const r = await prisma.attendanceRecord.create({ data: { lessonPeriodId, studentId: s.id, studentCardId: null } });
    await prisma.dropInCharge.create({ data: { attendanceRecordId: r.id, amount, isPaid: true, paidAt: at(ymd, 20), paidByUserId: paidBy } });
  };

  const L1 = await period(thu.id, "2026-11-05");
  await attend(L1.id, b1);
  await attend(L1.id, b2);
  await dropIn(L1.id, 450, dingId, "2026-11-05");
  const L2 = await period(sun.id, "2026-11-09");
  for (const x of [ming, hua, g1]) await attend(L2.id, x);
  const L3 = await period(tue.id, "2026-11-11");
  for (const x of [ming, hua, mei]) await attend(L3.id, x); // 小美 11/18 才買卡，回頭扣 L3
  const L4 = await period(kao.id, "2026-11-12");
  for (const x of [qiang, ming]) await attend(L4.id, x);
  await dropIn(L4.id, 350, seanId, "2026-11-12");
  const L5 = await period(thu.id, "2026-11-12");
  await attend(L5.id, b1);
  await prisma.attendanceAbsence.create({ data: { lessonPeriodId: L5.id, studentId: b2.studentId, studentCardId: b2.cardId, sessionsUsed: 1 } });
  const L6 = await period(tue.id, "2026-11-26");
  for (const x of [ming, hua, mei, jie]) await attend(L6.id, x);

  await prisma.financeExpense.create({
    data: { classroomId, date: at("2026-11-20"), amount: 500, locationId: T.id, category: "廣告", paidByUserId: dingId, createdById: dingId },
  });
  await prisma.financeExpense.create({
    data: { classroomId, date: at("2026-11-22"), amount: 210, locationId: K.id, category: "飲料", paidByUserId: seanId, createdById: seanId },
  });

  return { seanId, T, K, tDing, tCharlene, tNora, tSean, tPartner, pack, jie, L6 };
}

