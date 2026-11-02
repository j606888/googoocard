import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  createLocation,
  createTeacher,
  createVenue,
  enableFinanceFor,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/finance/custody/route";
import { loadLedger } from "@/service/finance/custody";
import { computeCustody } from "@/domains/finance/ledger";
import type { Buckets } from "@/domains/finance/ledger";
import type { SplitRule } from "@/domains/finance/types";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 00:00 台北
const noParams = { params: Promise.resolve({}) };
const getReq = (qs = "") => new Request(`http://test.local/api/finance/custody${qs}`);

type Body = { users: { userId: number; name: string; buckets: Buckets }[]; warnings: { code: string }[] };

describe("GET /api/finance/custody", () => {
  let classroomId: number;
  let ownerId: number;
  let seanId: number;
  let tainanId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
  });

  async function seed() {
    seanId = (await createMember(classroomId, { email: "s@test.local", name: "S", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isFinance: true } });
    // 開帳保管人＝第二位成員：沒有收款人的舊卡算他的（案例 10）。
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: seanId });

    const tainan = await createLocation(classroomId, { name: "T" });
    tainanId = tainan.id;
    await prisma.location.update({ where: { id: tainan.id }, data: { keeperUserId: ownerId } });
    const kao = await createLocation(classroomId, { name: "K" });
    await prisma.location.update({ where: { id: kao.id }, data: { keeperUserId: seanId } });

    const teacherS = await createTeacher(classroomId, { name: "TS", userId: seanId }); // 財務成員、沒設付款人 → 自己的
    const home = await createVenue(classroomId, { name: "Home", landlordUserId: ownerId });

    const { lesson } = await createLesson(classroomId, { locationId: tainan.id });
    const rule: SplitRule = {
      lines: [{ kind: "fixed", amount: 300, to: { type: "venue", venueId: home.id } }],
      rest: { type: "teachers", shares: [{ teacherId: teacherS.id, weight: 1 }] },
      fundLocationId: tainan.id,
    };
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule, updatedById: ownerId } });
    const startTime = new Date("2026-11-09T02:00:00Z");
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000), attendanceTakenAt: startTime },
    });

    const card = await createCard(classroomId);
    const studentA = await createStudent(classroomId, { name: "A" });
    const studentB = await createStudent(classroomId, { name: "B" });
    // A：第一位成員收的；B：上線前的舊卡（沒有收款人）
    const cardA = await createStudentCard(studentA.id, card.id, { finalPrice: 2000, totalSessions: 6, remainingSessions: 5, isPaid: true });
    await prisma.studentCard.update({ where: { id: cardA.id }, data: { paidByUserId: ownerId } });
    const cardB = await createStudentCard(studentB.id, card.id, { finalPrice: 2000, totalSessions: 6, remainingSessions: 5, isPaid: true });
    for (const [studentId, studentCardId] of [[studentA.id, cardA.id], [studentB.id, cardB.id]]) {
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId, studentCardId, sessionsUsed: 1 } });
    }

    // 第二位成員付了一筆 T 分部的支出 → T 的 keeper（第一位）欠他
    await prisma.financeExpense.create({
      data: {
        classroomId, date: new Date("2026-11-20T04:00:00Z"), amount: 500, locationId: tainan.id,
        category: "廣告", paidByUserId: seanId, createdById: ownerId,
      },
    });
  }

  it("matches the ledger and the hand-computed buckets", async () => {
    await seed();
    const res = await GET(getReq(), noParams);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.warnings).toEqual([]);

    const { input, keepers } = await loadLedger(classroomId);
    const ledger = computeCustody(input, keepers);
    for (const u of body.users) expect(u.buckets).toEqual(JSON.parse(JSON.stringify(ledger[u.userId])));

    const owner = body.users.find((u) => u.userId === ownerId)!.buckets;
    const sean = body.users.find((u) => u.userId === seanId)!.buckets;
    expect(body.users.find((u) => u.userId === ownerId)!.name).toBe("Owner");

    // 這堂 666.67：兩人各持一半；場地 300 → 房東（第一位）自己的；剩下 366.67 → TS 本人
    expect(owner.cash).toBeCloseTo(1666.67 + 333.33 - 0, 2);
    expect(owner.prepaid).toBeCloseTo(1666.67, 2);
    expect(owner.self).toBeCloseTo(300, 2);
    expect(owner.funds[tainanId]).toBeCloseTo(-500, 2);
    expect(owner.peers[seanId]).toBeCloseTo(183.33 - 150 + 500, 2);

    expect(sean.cash).toBeCloseTo(1666.67 + 333.33 - 500, 2);
    expect(sean.self).toBeCloseTo(366.67, 2);
    expect(sean.peers[ownerId]).toBeCloseTo(-533.33, 2);
  });

  it("legacy prepaid goes to legacy custodian", async () => {
    await seed();
    const body = (await (await GET(getReq(), noParams)).json()) as Body;
    const sean = body.users.find((u) => u.userId === seanId)!.buckets;
    expect(sean.prepaid).toBeCloseTo((2000 / 6) * 5, 2);
  });

  it("?through excludes later months", async () => {
    await seed();
    const body = (await (await GET(getReq("?through=2026-10"), noParams)).json()) as Body;
    const owner = body.users.find((u) => u.userId === ownerId)!.buckets;
    expect(owner.cash).toBeCloseTo((2000 / 6) * 5, 2);
    expect(owner.self).toBe(0);
    expect(owner.peers).toEqual({});
  });

  it("any member can read; bad through → 400; finance off → 404", async () => {
    await seed();
    const helper = await createMember(classroomId, { email: "h@test.local", name: "H" });
    auth.userId = helper.id;
    expect((await GET(getReq(), noParams)).status).toBe(200);
    expect((await GET(getReq("?through=2026-13"), noParams)).status).toBe(400);

    await prisma.classroom.update({ where: { id: classroomId }, data: { financeEnabledAt: null } });
    const res = await GET(getReq(), noParams);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("FINANCE_DISABLED");
  });

  it("untaken period (self check-in): deducted session stays prepaid until finalised", async () => {
    await seed();
    const before = (await (await GET(getReq(), noParams)).json()) as Body;
    const ownerBefore = before.users.find((u) => u.userId === ownerId)!.buckets;

    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classroomId } });
    const startTime = new Date("2026-11-16T02:00:00Z");
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
    });
    const cardA = await prisma.studentCard.findFirstOrThrow({ where: { paidByUserId: ownerId } });
    // 自助簽到：扣格、建紀錄，但老師還沒定案
    await prisma.studentCard.update({ where: { id: cardA.id }, data: { remainingSessions: { decrement: 1 } } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: cardA.studentId, studentCardId: cardA.id, sessionsUsed: 1, source: "STUDENT" },
    });

    const mid = (await (await GET(getReq(), noParams)).json()) as Body;
    const ownerMid = mid.users.find((u) => u.userId === ownerId)!.buckets;
    expect(ownerMid.cash).toBeCloseTo(ownerBefore.cash, 5);
    expect(ownerMid.prepaid).toBeCloseTo(ownerBefore.prepaid, 5);

    await prisma.lessonPeriod.update({ where: { id: period.id }, data: { attendanceTakenAt: startTime } });
    const after = (await (await GET(getReq(), noParams)).json()) as Body;
    const ownerAfter = after.users.find((u) => u.userId === ownerId)!.buckets;
    expect(ownerAfter.cash).toBeCloseTo(ownerBefore.cash, 5);
    expect(ownerAfter.prepaid).toBeCloseTo(ownerBefore.prepaid - 2000 / 6, 5);
    // 那堂的 333.33：場地 300 → 自己的，剩下 33.33 → TS（第二位成員）
    expect(ownerAfter.self).toBeCloseTo(ownerBefore.self + 300, 5);
    expect(ownerAfter.peers[seanId]).toBeCloseTo(ownerBefore.peers[seanId] + 2000 / 6 - 300, 5);
  });

  it("teacher without payer → unallocated + UNRESOLVED_KEEPER", async () => {
    await seed();
    const t = await createTeacher(classroomId, { name: "NoPayer" });
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classroomId } });
    await prisma.lessonSplitRule.update({
      where: { lessonId: lesson.id },
      data: { rule: { lines: [], rest: { type: "teachers", shares: [{ teacherId: t.id, weight: 1 }] }, fundLocationId: tainanId } },
    });
    const body = (await (await GET(getReq(), noParams)).json()) as Body;
    expect(body.warnings.map((w) => w.code)).toContain("UNRESOLVED_KEEPER");
    const owner = body.users.find((u) => u.userId === ownerId)!.buckets;
    expect(owner.unallocated).toBeCloseTo(333.33, 2);
  });
});
