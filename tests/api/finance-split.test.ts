import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import {
  resetDb,
  createClassroom,
  createCard,
  createLesson,
  createLocation,
  createStudent,
  enableModule,
  jsonRequest,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

import { GET as RULES, PUT as SAVE_RULE } from "@/app/api/finance/split-rules/route";
import { GET as LESSONS } from "@/app/api/finance/lessons/route";
import { POST as VERIFY } from "@/app/api/finance/lessons/verify/route";

const saveRule = (body: unknown) => SAVE_RULE(jsonRequest("PUT", body), { params: Promise.resolve({}) });
const lessons = (from: string, to = from) =>
  LESSONS(new Request(`http://test.local/api/finance/lessons?from=${from}&to=${to}`), { params: Promise.resolve({}) });
const verify = (periodIds: number[], batch = false) =>
  VERIFY(jsonRequest("POST", { periodIds, batch }), { params: Promise.resolve({}) });

/** 10/25（日）台北時間 hh:00。 */
const at = (hour: number) => new Date(`2026-10-25T${String(hour - 8).padStart(2, "0")}:00:00Z`);

describe("水庫第二步：分帳規則、每堂分帳、驗收", () => {
  let classroomId: number;
  let ownerId: number;
  let sean: number;
  let nini: number;
  let dingding: number;
  let akai: number;
  let tenCardId: number;
  let periods: { body: number; bachata: number; salsa: number };

  async function attend(periodId: number, count: number, { withCard = true } = {}) {
    for (let i = 0; i < count; i++) {
      const student = await createStudent(classroomId, { name: `學生${periodId}-${i}-${withCard}` });
      const card = withCard
        ? await prisma.studentCard.create({
            data: { studentId: student.id, cardId: tenCardId, serialNumber: student.id, basePrice: 3000, finalPrice: 3000, totalSessions: 10, remainingSessions: 9 },
          })
        : null;
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: periodId, studentId: student.id, studentCardId: card?.id ?? null } });
    }
    await prisma.lessonPeriod.update({ where: { id: periodId }, data: { attendanceTakenAt: new Date() } });
  }

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    ownerId = classroom.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableModule(classroomId, "finance");
    await prisma.financeSetting.create({ data: { classroomId, revenueOwnerUserId: ownerId } });

    sean = (await prisma.teacher.create({ data: { classroomId, name: "Sean", userId: ownerId } })).id;
    nini = (await prisma.teacher.create({ data: { classroomId, name: "Nini" } })).id;
    dingding = (await prisma.teacher.create({ data: { classroomId, name: "丁丁" } })).id;
    akai = (await prisma.teacher.create({ data: { classroomId, name: "阿凱", isAssistant: true } })).id;
    tenCardId = (await createCard(classroomId, { name: "10 堂", price: 3000, sessions: 10 })).id;
    await createCard(classroomId, { name: "單堂", price: 350, sessions: 1 });
    const tainan = await createLocation(classroomId, { name: "台南" });

    const make = async (name: string, hour: number, teacherId: number) => {
      const { lesson } = await createLesson(classroomId, { name, locationId: tainan.id, cardIds: [tenCardId] });
      await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId } });
      const period = await prisma.lessonPeriod.create({ data: { lessonId: lesson.id, startTime: at(hour), endTime: at(hour + 1) } });
      await prisma.lessonPeriodAssistant.create({ data: { lessonPeriodId: period.id, teacherId: akai } });
      return period.id;
    };
    periods = {
      body: await make("Body movement", 14, sean),
      bachata: await make("Bachata lv2", 15, sean),
      salsa: await make("Salsa", 16, nini),
    };

    expect((await saveRule({ scope: "CLASSROOM", teacherPay: "SPLIT", commissionPct: 10, roundTo: 10, remainderTo: "REVENUE_OWNER", assistantMode: "PER_DAY", assistantAmount: 250 })).status).toBe(200);
    expect((await saveRule({ scope: "LOCATION", locationId: tainan.id, venueMode: "PER_DAY", venueAmount: 500, venuePayee: "MEMBER", venueTeacherId: dingding })).status).toBe(200);
  });

  it("規則：第一次設的從頭算；之後改的預設下個月 1 號生效，同一天的直接改", async () => {
    let rows = await (await RULES(new Request("http://test.local/api"), { params: Promise.resolve({}) })).json();
    expect(rows).toHaveLength(2);
    expect(new Date(rows.find((r: { scope: string }) => r.scope === "CLASSROOM").effectiveFrom).getTime()).toBe(0);

    await saveRule({ scope: "CLASSROOM", teacherPay: "SPLIT", commissionPct: 15, roundTo: 10 });
    await saveRule({ scope: "CLASSROOM", teacherPay: "SPLIT", commissionPct: 12, roundTo: 10 });
    rows = await (await RULES(new Request("http://test.local/api"), { params: Promise.resolve({}) })).json();
    const classroomRows = rows.filter((r: { scope: string }) => r.scope === "CLASSROOM");
    expect(classroomRows).toHaveLength(2);
    expect(classroomRows[0].commissionPct).toBe(12);
  });

  it("規則：比例要加起來 100、課程要是這間教室的", async () => {
    const { lesson } = await createLesson(classroomId, { name: "Bachata training" });
    let res = await saveRule({ scope: "LESSON", lessonId: lesson.id, shares: [{ teacherId: sean, pct: 60 }, { teacherId: nini, pct: 30 }] });
    expect((await res.json()).code).toBe("SHARES_NOT_100");
    res = await saveRule({ scope: "LESSON", lessonId: 999 });
    expect(res.status).toBe(400);
  });

  it("點完名就帶進來算好；沒點名的不算", async () => {
    await attend(periods.body, 7);
    await attend(periods.bachata, 9);
    const rows = await (await lessons("2026-10-25")).json();
    const body = rows.find((r: { periodId: number }) => r.periodId === periods.body);
    const salsa = rows.find((r: { periodId: number }) => r.periodId === periods.salsa);
    expect(body.status).toBe("PENDING");
    // 只有 2 堂點過名：場地 $500、助教 $250 由這 2 堂平攤
    expect(body.split).toMatchObject({ revenue: 2100, venueFee: 250, venueTeacherId: dingding, assistantFee: 125, commission: 173 });
    expect(body.split.teacherLines).toEqual([{ teacherId: sean, amount: 1550 }]);
    expect(salsa).toMatchObject({ status: "NOT_TAKEN", split: null });
  });

  it("整批驗收只收沒提醒的；沒卡的要一堂一堂驗收", async () => {
    await attend(periods.body, 7);
    await attend(periods.bachata, 8);
    await attend(periods.bachata, 1, { withCard: false });
    await attend(periods.salsa, 5);

    let res = await verify([periods.body, periods.bachata, periods.salsa], true);
    let body = await res.json();
    expect(body.verified.sort()).toEqual([periods.body, periods.salsa].sort());
    expect(body.skipped).toEqual([{ periodId: periods.bachata, reason: "NEEDS_REVIEW" }]);

    res = await verify([periods.bachata]);
    expect((await res.json()).verified).toEqual([periods.bachata]);

    const rows = await (await lessons("2026-10-25")).json();
    const bachata = rows.find((r: { periodId: number }) => r.periodId === periods.bachata);
    expect(bachata.status).toBe("VERIFIED");
    expect(bachata.flags).toContain("NO_CARD");
    // 暫估用這門課最便宜的每堂價：10 堂卡 $300
    expect(bachata.split).toMatchObject({ revenue: 2700, estimated: 300 });
    expect(bachata.verified.by.id).toBe(ownerId);

    const settlement = await prisma.financeLessonSettlement.findUnique({ where: { lessonPeriodId: periods.salsa }, include: { lines: true } });
    expect(settlement!.lines.map((l) => l.kind).sort()).toEqual(["ASSISTANT", "REMAINDER", "TEACHER", "VENUE"]);
  });

  it("驗收後點名又被改 → 退回待驗收、標出差多少；重新驗收留紀錄", async () => {
    await attend(periods.body, 7);
    await verify([periods.body]);
    await attend(periods.body, 1);

    let rows = await (await lessons("2026-10-25")).json();
    let body = rows.find((r: { periodId: number }) => r.periodId === periods.body);
    expect(body.status).toBe("CHANGED");
    expect(body.verified.revenueDiff).toBe(300);

    await verify([periods.body]);
    rows = await (await lessons("2026-10-25")).json();
    body = rows.find((r: { periodId: number }) => r.periodId === periods.body);
    expect(body.status).toBe("VERIFIED");
    expect(await prisma.financeSettlementRevision.count()).toBe(1);
  });

  it("同一天後來又點了一堂名，先驗收的場地費平攤會變 → 也退回待驗收", async () => {
    await attend(periods.body, 7);
    await verify([periods.body]);
    await attend(periods.salsa, 5);
    const rows = await (await lessons("2026-10-25")).json();
    expect(rows.find((r: { periodId: number }) => r.periodId === periods.body).status).toBe("CHANGED");
  });

  it("沒開水庫：404", async () => {
    await prisma.classroomModule.deleteMany({ where: { classroomId } });
    expect((await lessons("2026-10-25")).status).toBe(404);
  });
});
