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
  createVenuePack,
  enableFinanceFor,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/finance/periods/route";
import { loadPeriodFinance } from "@/service/finance/periods";
import type { SplitRule } from "@/domains/finance/types";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 00:00 台北

function expectAmounts(actual: { amount: number }[] | null, expected: number[]) {
  expect(actual).not.toBeNull();
  expect(actual!).toHaveLength(expected.length);
  expected.forEach((x, i) => expect(actual![i].amount).toBeCloseTo(x, 2));
}

async function takenPeriod(lessonId: number, startTime: Date, taken = true) {
  return prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime,
      endTime: new Date(startTime.getTime() + 3600_000),
      attendanceTakenAt: taken ? startTime : null,
    },
  });
}

async function attend(periodId: number, studentId: number, studentCardId: number | null, sessionsUsed = 1) {
  return prisma.attendanceRecord.create({
    data: { lessonPeriodId: periodId, studentId, studentCardId, sessionsUsed },
  });
}

function getReq(qs: string) {
  return new Request(`http://test.local/api/finance/periods?${qs}`);
}
const noParams = { params: Promise.resolve({}) };

describe("finance period loader", () => {
  let classroomId: number;
  let ownerId: number;
  let tainanId: number;
  let dingding: number;
  let charlene: number;
  let venueId: number;
  let cardId: number;
  let rule: SplitRule;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: ownerId });
    tainanId = (await createLocation(classroomId, { name: "A 分部" })).id;
    dingding = (await createTeacher(classroomId, { name: "T1", userId: ownerId })).id;
    charlene = (await createTeacher(classroomId, { name: "T2" })).id;
    venueId = (await createVenue(classroomId, { landlordUserId: ownerId })).id;
    cardId = (await createCard(classroomId)).id;
    rule = {
      lines: [
        { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: dingding } },
        { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: charlene } },
        { kind: "fixed", amount: 300, to: { type: "venue", venueId } },
      ],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    };
  });

  async function paidCard(studentId: number, paidByUserId: number | null = ownerId) {
    const sc = await createStudentCard(studentId, cardId, { finalPrice: 2000, totalSessions: 6, isPaid: true });
    return prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId } });
  }

  async function ruledLesson(r: SplitRule = rule, opts: { sessionsPerAttendance?: number } = {}) {
    const { lesson } = await createLesson(classroomId, { name: "Bachata Lv2", locationId: tainanId, ...opts });
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule: r, updatedById: ownerId } });
    return lesson;
  }

  it("case 1 end-to-end", async () => {
    const lesson = await ruledLesson();
    const period = await takenPeriod(lesson.id, new Date("2026-11-11T11:00:00Z"));
    const ming = await createStudent(classroomId, { name: "小明" });
    const hua = await createStudent(classroomId, { name: "小華" });
    const mei = await createStudent(classroomId, { name: "小美" });
    await attend(period.id, ming.id, (await paidCard(ming.id)).id);
    await attend(period.id, hua.id, (await paidCard(hua.id)).id);
    const meiRecord = await attend(period.id, mei.id, null);

    let [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(pf).toMatchObject({
      periodId: period.id,
      lessonId: lesson.id,
      lessonName: "Bachata Lv2",
      locationId: tainanId,
      month: "2026-11",
      ruleSource: "lesson",
      warnings: [],
    });
    expect(pf.income.total).toBeCloseTo(666.67, 2);
    expect(pf.income.realized).toHaveLength(2);
    expect(pf.income.pending).toEqual([{ studentId: mei.id, kind: "undecided", amount: null }]);
    expectAmounts(pf.allocations, [222.22, 222.22, 300, -77.78]);
    expect(pf.allocations![3]).toMatchObject({ payee: { type: "fund", locationId: tainanId }, source: "deficit" });

    const meiCard = await paidCard(mei.id);
    await prisma.attendanceRecord.update({ where: { id: meiRecord.id }, data: { studentCardId: meiCard.id } });
    [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(pf.income.total).toBeCloseTo(1000, 2);
    expect(pf.income.pending).toEqual([]);
    expectAmounts(pf.allocations, [333.33, 333.33, 300, 33.33]);
  });

  it("2-session lesson counts sessionsUsed; unpaid card and drop-in are pending; absences count", async () => {
    const lesson = await ruledLesson(rule, { sessionsPerAttendance: 2 });
    const period = await takenPeriod(lesson.id, new Date("2026-11-12T11:00:00Z"));
    const a = await createStudent(classroomId, { name: "A" });
    const b = await createStudent(classroomId, { name: "B" });
    const d = await createStudent(classroomId, { name: "D" });
    const e = await createStudent(classroomId, { name: "E" });
    await attend(period.id, a.id, (await paidCard(a.id)).id, 2);
    const unpaid = await createStudentCard(b.id, cardId, { finalPrice: 2000, totalSessions: 6, isPaid: false });
    await attend(period.id, b.id, unpaid.id, 2);
    const dropRec = await attend(period.id, d.id, null);
    await prisma.dropInCharge.create({ data: { attendanceRecordId: dropRec.id, amount: 400, isPaid: false } });
    await prisma.attendanceAbsence.create({
      data: { lessonPeriodId: period.id, studentId: e.id, studentCardId: (await paidCard(e.id)).id, sessionsUsed: 2 },
    });

    const [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    // card 2 × 333.33 + absence 2 × 333.33
    expect(pf.income.total).toBeCloseTo(1333.33, 2);
    expect(pf.income.realized.map((s) => s.kind).sort()).toEqual(["absence", "card"]);
    expect(pf.income.pending).toHaveLength(2);
    const pendB = pf.income.pending.find((p) => p.studentId === b.id)!;
    expect(pendB.kind).toBe("unpaid");
    expect(pendB.amount).toBeCloseTo(666.67, 2);
    expect(pf.income.pending.find((p) => p.studentId === d.id)).toEqual({ studentId: d.id, kind: "unpaid", amount: 400 });
  });

  it("no rule → allocations null, ruleSource none", async () => {
    const { lesson } = await createLesson(classroomId);
    const period = await takenPeriod(lesson.id, new Date("2026-11-11T11:00:00Z"));
    const s = await createStudent(classroomId);
    await attend(period.id, s.id, (await paidCard(s.id)).id);
    const [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(pf.ruleSource).toBe("none");
    expect(pf.allocations).toBeNull();
    expect(pf.income.total).toBeCloseTo(333.33, 2);
  });

  it("period override beats lesson rule", async () => {
    const lesson = await ruledLesson();
    const p1 = await takenPeriod(lesson.id, new Date("2026-11-11T11:00:00Z"));
    const p2 = await takenPeriod(lesson.id, new Date("2026-11-18T11:00:00Z"));
    const override: SplitRule = { lines: [], rest: { type: "teachers", shares: [{ teacherId: charlene, weight: 1 }] }, fundLocationId: tainanId };
    await prisma.periodSplitOverride.create({ data: { lessonPeriodId: p2.id, rule: override, updatedById: ownerId } });
    const s = await createStudent(classroomId);
    const sc = await paidCard(s.id);
    await attend(p1.id, s.id, sc.id);
    await attend(p2.id, s.id, sc.id);

    const res = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(res.map((r) => r.ruleSource)).toEqual(["lesson", "override"]);
    expect(res[1].allocations).toEqual([
      { payee: { type: "teacher", teacherId: charlene }, amount: expect.closeTo(333.33, 2), source: "rest" },
    ]);
  });

  it("periods before launch and untaken periods are excluded", async () => {
    const lesson = await ruledLesson();
    await takenPeriod(lesson.id, new Date("2026-10-31T10:00:00Z")); // 10/31 台北 → 上線前
    await takenPeriod(lesson.id, new Date("2026-11-20T11:00:00Z"), false);
    const ok = await takenPeriod(lesson.id, new Date("2026-10-31T16:00:00Z"));
    const res = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(res.map((r) => r.periodId)).toEqual([ok.id]);
  });

  it("pack FIFO and overdraw across lessons", async () => {
    const packRule: SplitRule = {
      lines: [{ kind: "venuePack", venueId }],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    };
    const x = await ruledLesson(packRule);
    const y = await ruledLesson(packRule);
    // 上線前買的期初包也算
    const packA = await createVenuePack(classroomId, venueId, { sessions: 2, price: 800, paidByUserId: ownerId, purchasedAt: new Date("2026-10-01T00:00:00Z") });
    const packB = await createVenuePack(classroomId, venueId, { sessions: 1, price: 500, paidByUserId: ownerId, purchasedAt: new Date("2026-11-05T00:00:00Z") });
    const voided = await createVenuePack(classroomId, venueId, { sessions: 10, price: 100, paidByUserId: ownerId, purchasedAt: new Date("2026-09-01T00:00:00Z") });
    await prisma.venuePack.update({ where: { id: voided.id }, data: { voidedAt: new Date() } });
    // 上線前的時段不吃包
    await takenPeriod(x.id, new Date("2026-10-20T11:00:00Z"));
    const p1 = await takenPeriod(x.id, new Date("2026-11-02T11:00:00Z"));
    const p2 = await takenPeriod(y.id, new Date("2026-11-03T11:00:00Z"));
    const p3 = await takenPeriod(x.id, new Date("2026-11-09T11:00:00Z"));
    const p4 = await takenPeriod(y.id, new Date("2026-11-10T11:00:00Z"));

    const res = await loadPeriodFinance(classroomId, {
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2026-12-01T00:00:00Z"),
    });
    expect(res.map((r) => r.periodId)).toEqual([p1.id, p2.id, p3.id, p4.id]);
    const venueLines = res.map((r) => r.allocations![0]);
    expect(venueLines.map((l) => l.amount)).toEqual([400, 400, 500, 500]);
    expect(venueLines.map((l) => l.payee)).toEqual([
      { type: "venue", venueId, packId: packA.id },
      { type: "venue", venueId, packId: packA.id },
      { type: "venue", venueId, packId: packB.id },
      { type: "venue", venueId, packId: packB.id },
    ]);
    expect(res.map((r) => r.warnings)).toEqual([[], [], [], ["PACK_OVERDRAWN"]]);
  });

  it("venue with no packs → amount 0 and NO_PACK", async () => {
    const lesson = await ruledLesson({
      lines: [{ kind: "venuePack", venueId }],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    });
    await takenPeriod(lesson.id, new Date("2026-11-02T11:00:00Z"));
    const [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(pf.warnings).toEqual(["NO_PACK"]);
    expect(pf.allocations![0]).toEqual({ payee: { type: "venue", venueId }, amount: 0, source: "line" });
  });

  it("per-session venue → its perSessionPrice every period, no pack consumed", async () => {
    await prisma.venue.update({ where: { id: venueId }, data: { perSessionPrice: 300 } });
    const pack = await createVenuePack(classroomId, venueId, { sessions: 5, price: 5000, paidByUserId: ownerId, purchasedAt: new Date("2026-11-01T00:00:00Z") });
    const lesson = await ruledLesson({
      lines: [{ kind: "venuePack", venueId }],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    });
    await takenPeriod(lesson.id, new Date("2026-11-02T11:00:00Z"));
    await takenPeriod(lesson.id, new Date("2026-11-03T11:00:00Z"));
    const res = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    expect(res.map((r) => r.warnings)).toEqual([[], []]);
    expect(res.map((r) => r.allocations![0])).toEqual([
      { payee: { type: "venue", venueId }, amount: 300, source: "line" },
      { payee: { type: "venue", venueId }, amount: 300, source: "line" },
    ]);
    const { packUsage } = await import("@/service/finance/periods");
    expect((await packUsage(classroomId)).get(pack.id)).toBeUndefined();
  });

  it("legacy card holder is legacy custodian", async () => {
    const member = await createMember(classroomId);
    await prisma.classroom.update({ where: { id: classroomId }, data: { legacyCustodianUserId: member.id } });
    const lesson = await ruledLesson();
    const period = await takenPeriod(lesson.id, new Date("2026-11-11T11:00:00Z"));
    const legacy = await createStudent(classroomId, { name: "L" });
    const fresh = await createStudent(classroomId, { name: "F" });
    await attend(period.id, legacy.id, (await paidCard(legacy.id, null)).id);
    await attend(period.id, fresh.id, (await paidCard(fresh.id, ownerId)).id);

    const [pf] = await loadPeriodFinance(classroomId, { lessonId: lesson.id });
    const holder = (studentId: number) => pf.income.realized.find((s) => s.studentId === studentId)!.holderUserId;
    expect(holder(legacy.id)).toBe(member.id);
    expect(holder(fresh.id)).toBe(ownerId);
  });

  describe("GET /api/finance/periods", () => {
    it("returns periods in the Taipei date range, any member", async () => {
      const member = await createMember(classroomId);
      auth.userId = member.id;
      const lesson = await ruledLesson();
      await takenPeriod(lesson.id, new Date("2026-11-10T16:30:00Z")); // 11/11 台北
      const inRange = await takenPeriod(lesson.id, new Date("2026-11-11T15:30:00Z")); // 11/11 台北
      await takenPeriod(lesson.id, new Date("2026-11-11T16:30:00Z")); // 11/12 台北
      const res = await GET(getReq("from=2026-11-11&to=2026-11-11"), noParams);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body.map((p: { periodId: number }) => p.periodId)).toContain(inRange.id);

      const byLesson = await GET(getReq(`lessonId=${lesson.id}`), noParams);
      expect(await byLesson.json()).toHaveLength(3);
    });

    it("400 on bad or missing params", async () => {
      expect((await GET(getReq("from=2026-13-01&to=2026-11-30"), noParams)).status).toBe(400);
      expect((await GET(getReq("from=2026-11-01"), noParams)).status).toBe(400);
      expect((await GET(getReq(""), noParams)).status).toBe(400);
      expect((await GET(getReq("lessonId=abc"), noParams)).status).toBe(400);
    });

    it("404 when finance is disabled", async () => {
      await prisma.classroom.update({ where: { id: classroomId }, data: { financeEnabledAt: null } });
      const res = await GET(getReq("from=2026-11-01&to=2026-11-30"), noParams);
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("FINANCE_DISABLED");
    });
  });
});
