import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import { resetDb, createClassroom, createCard, createLesson, createLocation, createMember, createStudent, enableModule, jsonRequest } from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

import { POST as BUILD } from "@/app/api/finance/build/route";
import { POST as PREVIEW } from "@/app/api/finance/build/preview/route";
import { GET as SETTING } from "@/app/api/finance/setting/route";
import { GET as QUESTS } from "@/app/api/finance/quests/route";

const params = { params: Promise.resolve({}) };
const build = (body: unknown) => BUILD(jsonRequest("POST", body), params);
const preview = (body: unknown) => PREVIEW(jsonRequest("POST", body), params);

describe("建城第 2～4 章：分帳一次存、開城前試算", () => {
  let classroomId: number;
  let ownerId: number;
  let tainanId: number;
  let sean: number;
  let dingding: number;
  let answers: Record<string, unknown>;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    ownerId = classroom.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableModule(classroomId, "finance");
    sean = (await prisma.teacher.create({ data: { classroomId, name: "Sean", userId: ownerId } })).id;
    dingding = (await prisma.teacher.create({ data: { classroomId, name: "丁丁" } })).id;
    tainanId = (await createLocation(classroomId, { name: "台南" })).id;
    answers = {
      teacherPay: "SPLIT",
      commissionPct: 10,
      roundTo: 100,
      remainderTo: "FUND",
      venues: [{ locationId: tainanId, venueMode: "PER_LESSON", venueAmount: 100, venuePayee: "MEMBER", venueTeacherId: dingding }],
    };
  });

  const setUp = () =>
    prisma.financeSetting.create({
      data: { classroomId, revenueOwnerUserId: ownerId, startDate: new Date("2026-09-30T16:00:00Z"), setupCompletedAt: new Date() },
    });

  /** 兩天前的一堂台南的課，Sean 教，兩個人用 10 堂 $3,000 的卡（每堂 $300）。 */
  async function lessonTwoDaysAgo() {
    const card = await createCard(classroomId, { name: "10 堂", price: 3000, sessions: 10 });
    const { lesson } = await createLesson(classroomId, { name: "Bachata lv2", locationId: tainanId, cardIds: [card.id] });
    await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: sean } });
    const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime: start, endTime: new Date(start.getTime() + 3_600_000), attendanceTakenAt: new Date() },
    });
    for (const name of ["小明", "小華"]) {
      const student = await createStudent(classroomId, { name });
      const sc = await prisma.studentCard.create({
        data: { studentId: student.id, cardId: card.id, serialNumber: student.id, basePrice: 3000, finalPrice: 3000, totalSessions: 10, remainingSessions: 9 },
      });
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: student.id, studentCardId: sc.id } });
    }
    return period.id;
  }

  it("試算：用最近一堂、還沒存的答案算，什麼都不寫", async () => {
    let res = await preview(answers);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();

    const periodId = await lessonTwoDaysAgo();
    res = await preview(answers);
    const result = await res.json();
    expect(result).toMatchObject({ periodId, lessonName: "Bachata lv2", locationId: tainanId, attendeeCount: 2, periodsThatDay: 1 });
    // 600 − 場地 100（給丁丁）− 抽成 50 ＝ 450，捨去到百位 → Sean 400，零頭 50 進基金
    expect(result.split).toMatchObject({ revenue: 600, venueFee: 100, venueTeacherId: dingding, commission: 50, remainder: 50, remainderTeacherId: null, fund: 100 });
    expect(result.split.teacherLines).toEqual([{ teacherId: sean, amount: 400 }]);
    expect(await prisma.financeSplitRule.count()).toBe(0);
  });

  it("開城前要先蓋主堡", async () => {
    const res = await build(answers);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("FINANCE_NOT_SET_UP");
  });

  it("開城：全教室＋分部兩層都從頭算；設過了再開一次 409", async () => {
    await setUp();
    expect((await (await SETTING(new Request("http://test.local/api"), params)).json()).splitBuilt).toBe(false);

    expect((await build(answers)).status).toBe(200);
    const rows = await prisma.financeSplitRule.findMany({ orderBy: { id: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ scope: "CLASSROOM", teacherPay: "SPLIT", commissionPct: 10, roundTo: 100, remainderTo: "FUND", venueMode: "NONE" });
    expect(rows[1]).toMatchObject({ scope: "LOCATION", locationId: tainanId, venueMode: "PER_LESSON", venueAmount: 100, venuePayee: "MEMBER", venueTeacherId: dingding, teacherPay: null });
    expect(rows.every((r) => r.effectiveFrom.getTime() === 0)).toBe(true);
    expect((await (await SETTING(new Request("http://test.local/api"), params)).json()).splitBuilt).toBe(true);

    const again = await build(answers);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("ALREADY_BUILT");
  });

  it("沒有分部：場地費掛在全教室那一層；不用算就不存抽成", async () => {
    await setUp();
    await build({ teacherPay: "NONE", venues: [{ locationId: null, venueMode: "PER_DAY", venueAmount: 500, venuePayee: "EXTERNAL" }] });
    const [row] = await prisma.financeSplitRule.findMany();
    expect(row).toMatchObject({ scope: "CLASSROOM", teacherPay: "NONE", venueMode: "PER_DAY", venueAmount: 500, venuePayee: "EXTERNAL", commissionPct: null, assistantMode: "NONE" });
  });

  it("答案不合理就 400", async () => {
    await setUp();
    const other = await createClassroom({ email: "other@test.local" });
    const elsewhere = await createLocation(other.id, { name: "別家" });
    const cases: [unknown, string][] = [
      [{ teacherPay: "HOURLY" }, "HOURLY_FEE_REQUIRED"],
      [{ teacherPay: "SPLIT", assistantMode: "PER_DAY" }, "ASSISTANT_FEE_REQUIRED"],
      [{ teacherPay: "SPLIT", venues: [{ locationId: tainanId, venueMode: "PER_LESSON", venueAmount: 100, venuePayee: "MEMBER" }] }, "VENUE_PAYEE_REQUIRED"],
      [{ teacherPay: "SPLIT", venues: [{ locationId: elsewhere.id, venueMode: "NONE" }] }, "LOCATION_NOT_FOUND"],
      [{ teacherPay: "SPLIT", venues: [{ locationId: tainanId, venueMode: "NONE" }, { locationId: tainanId, venueMode: "NONE" }] }, "DUPLICATE_VENUE"],
    ];
    for (const [body, code] of cases) {
      const res = await build(body);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(code);
    }
    expect(await prisma.financeSplitRule.count()).toBe(0);
  });

  it("要能改水庫設定的人才能蓋；新手任務裡有「繼續蓋」，蓋好就打勾", async () => {
    await setUp();
    let q = await (await QUESTS(jsonRequest("GET"), params)).json();
    expect(q.quests.find((x: { key: string }) => x.key === "build")).toMatchObject({ done: false });
    await build(answers);
    q = await (await QUESTS(jsonRequest("GET"), params)).json();
    expect(q.quests.find((x: { key: string }) => x.key === "build")).toMatchObject({ done: true });

    const teacher = await createMember(classroomId, { email: "t@test.local", role: "teacher" });
    auth.userId = teacher.id;
    expect((await build(answers)).status).toBe(403);
    expect((await preview(answers)).status).toBe(403);
    q = await (await QUESTS(jsonRequest("GET"), params)).json();
    expect(q.quests.some((x: { key: string }) => x.key === "build")).toBe(false);
  });
});
