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
  enableFinanceFor,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as getStatementRoute } from "@/app/api/finance/settlements/[month]/route";
import { POST as reviewRoute } from "@/app/api/finance/settlements/[month]/reviews/route";
import { getMonthStatement } from "@/service/finance/settlement";
import { listBranchReviews, reviewBranch } from "@/service/finance/branchReview";
import { getFinanceHome } from "@/service/finance/home";
import type { SplitRule } from "@/domains/finance/types";

// 分部核對（.scratch/finance/spec.md「月結」）：負責人按核對；之後該分部資料變動 → 核對失效。
const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 00:00 台北
const DEC_3 = new Date("2026-12-03T04:00:00Z");
const DEC_5 = new Date("2026-12-05T04:00:00Z"); // 台北 12/5 中午
const DEC_6 = new Date("2026-12-05T16:00:00Z"); // 台北 12/6 00:00
const monthParams = (month: string) => ({ params: Promise.resolve({ month }) });
const post = (body: unknown) =>
  new Request("http://test.local/api/finance/settlements/2026-11/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("finance branch review", () => {
  let classroomId: number;
  let dingId: number;
  let seanId: number;
  let tainanId: number;
  let kaoId: number;
  let cardTypeId: number;
  let tainanPeriodId: number;
  let sundayPeriodId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = dingId;

    seanId = (await createMember(classroomId, { email: "s@test.local", name: "Sean", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
    await enableFinanceFor(classroomId, { launch: LAUNCH });
    tainanId = (await createLocation(classroomId, { name: "台南" })).id;
    await prisma.location.update({ where: { id: tainanId }, data: { keeperUserId: dingId } });
    kaoId = (await createLocation(classroomId, { name: "高雄" })).id;
    await prisma.location.update({ where: { id: kaoId }, data: { keeperUserId: seanId } });
    const tDing = (await createTeacher(classroomId, { name: "丁丁", userId: dingId })).id;
    const tSean = (await createTeacher(classroomId, { name: "Sean", userId: seanId })).id;
    cardTypeId = (await createCard(classroomId)).id;

    const rule = (teacherId: number, fundLocationId: number): SplitRule => ({
      lines: [{ kind: "percent", pct: 10, base: "income", to: { type: "fund", locationId: fundLocationId } }],
      rest: { type: "teachers", shares: [{ teacherId, weight: 1 }] },
      fundLocationId,
    });
    const lessonWith = async (name: string, locationId: number, r: SplitRule, startIso: string) => {
      const lesson = (await createLesson(classroomId, { name, locationId })).lesson;
      await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule: r, updatedById: dingId } });
      const startTime = new Date(startIso);
      const period = await prisma.lessonPeriod.create({
        data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000), attendanceTakenAt: startTime },
      });
      await attend(period.id, dingId);
      return period.id;
    };
    tainanPeriodId = await lessonWith("週二", tainanId, rule(tDing, tainanId), "2026-11-10T11:00:00Z");
    // 週日課：在台南上，基金是高雄 → 算高雄
    sundayPeriodId = await lessonWith("週日", tainanId, rule(tSean, kaoId), "2026-11-15T06:00:00Z");
  });

  async function attend(periodId: number, holder: number) {
    const student = await createStudent(classroomId, { name: `S${Math.random()}` });
    const sc = await createStudentCard(student.id, cardTypeId, {
      finalPrice: 2000, totalSessions: 5, remainingSessions: 4, isPaid: true,
    });
    await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: holder } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: periodId, studentId: student.id, studentCardId: sc.id, sessionsUsed: 1 },
    });
  }

  const reviewOf = async (locationId: number, now = DEC_3) => {
    const s = await getMonthStatement(classroomId, "2026-11", now);
    return (await listBranchReviews(classroomId, "2026-11", s)).find((r) => r.locationId === locationId)!;
  };

  it("結算單各分部依這堂課的基金歸類（週日課算高雄）", async () => {
    const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(s.byBranch.find((b) => b.locationId === tainanId)?.revenue).toBeCloseTo(400, 5);
    expect(s.byBranch.find((b) => b.locationId === kaoId)?.revenue).toBeCloseTo(400, 5);
  });

  it("負責人核對；GET 結算單帶各分部核對狀態", async () => {
    const res = await reviewRoute(post({ locationId: tainanId }), monthParams("2026-11"));
    expect(res.status).toBe(200);
    const body = await (await getStatementRoute(new Request("http://test.local"), monthParams("2026-11"))).json();
    const tainan = body.reviews.find((r: { locationId: number }) => r.locationId === tainanId);
    expect(tainan).toMatchObject({ name: "台南", keeperUserId: dingId, reviewedById: dingId, valid: true });
    expect(body.reviews.find((r: { locationId: number }) => r.locationId === kaoId)).toMatchObject({
      keeperUserId: seanId,
      reviewedById: null,
      valid: false,
    });
  });

  it("不是負責人不能核對（API 擋）", async () => {
    const res = await reviewRoute(post({ locationId: kaoId }), monthParams("2026-11"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "NOT_BRANCH_KEEPER" });
    expect(await prisma.financeBranchReview.count()).toBe(0);
  });

  it("核對後該分部資料變動 → 核對失效；別的分部不受影響", async () => {
    await reviewBranch({ classroomId, userId: dingId, month: "2026-11", locationId: tainanId, now: DEC_3 });
    await reviewBranch({ classroomId, userId: seanId, month: "2026-11", locationId: kaoId, now: DEC_3 });
    expect((await reviewOf(tainanId)).valid).toBe(true);
    expect((await reviewOf(kaoId)).valid).toBe(true);

    // 台南多一位學生出席 → 台南失效，高雄（週日課也在台南上）不受影響
    await attend(tainanPeriodId, dingId);
    expect((await reviewOf(tainanId)).valid).toBe(false);
    expect((await reviewOf(kaoId)).valid).toBe(true);

    // 高雄的支出 → 高雄失效
    await prisma.financeExpense.create({
      data: { classroomId, date: new Date("2026-11-20T04:00:00Z"), amount: 210, locationId: kaoId, category: "其他", paidByUserId: seanId, createdById: seanId },
    });
    expect((await reviewOf(kaoId)).valid).toBe(false);

    // 再核對一次就回來
    await reviewBranch({ classroomId, userId: dingId, month: "2026-11", locationId: tainanId, now: DEC_3 });
    expect((await reviewOf(tainanId)).valid).toBe(true);
    expect(await prisma.financeBranchReview.count()).toBe(2);
  });

  it("週日課的變動算高雄", async () => {
    await reviewBranch({ classroomId, userId: dingId, month: "2026-11", locationId: tainanId, now: DEC_3 });
    await reviewBranch({ classroomId, userId: seanId, month: "2026-11", locationId: kaoId, now: DEC_3 });
    await attend(sundayPeriodId, dingId);
    expect((await reviewOf(tainanId)).valid).toBe(true);
    expect((await reviewOf(kaoId)).valid).toBe(false);
  });

  it("首頁：5 號過後提醒負責人上個月還沒核對的分部", async () => {
    expect((await getFinanceHome(classroomId, dingId, DEC_5)).unreviewedBranches).toEqual([]);
    expect((await getFinanceHome(classroomId, dingId, DEC_6)).unreviewedBranches).toEqual([
      { month: "2026-11", locationId: tainanId, locationName: "台南" },
    ]);
    expect((await getFinanceHome(classroomId, seanId, DEC_6)).unreviewedBranches).toEqual([
      { month: "2026-11", locationId: kaoId, locationName: "高雄" },
    ]);
    await reviewBranch({ classroomId, userId: dingId, month: "2026-11", locationId: tainanId, now: DEC_6 });
    expect((await getFinanceHome(classroomId, dingId, DEC_6)).unreviewedBranches).toEqual([]);
    // 核對後又變了 → 再提醒
    await attend(tainanPeriodId, dingId);
    expect((await getFinanceHome(classroomId, dingId, DEC_6)).unreviewedBranches).toHaveLength(1);
  });
});
