import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  enableFinanceFor,
  defaultDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as GET_CARDS, POST as POST_CARD } from "@/app/api/cards/route";
import { POST as POST_LESSON } from "@/app/api/lessons/route";
import { POST as BUY } from "@/app/api/students/[id]/student-cards/route";
import { mergeStudents } from "@/service/studentMerge";
import { PATCH as PATCH_CARD } from "@/app/api/cards/[id]/route";
import { POST as resetAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/reset/route";
import { selfCheckIn, takeAttendance, updateAttendance } from "@/domains/attendance/attendance.service";
import { createStudentCardInTx } from "@/service/studentCard";
import { isUniversalCard } from "@/service/finance/bound";
import { addMonthsTaipei, toTaipeiDateKey } from "@/lib/taipei-date";

// 綁課卡之後的時段（買卡是「現在」，時段放在未來才會被缺席扣）。
const FUTURE = new Date("2030-01-02T11:00:00Z");

describe("finance bound cards, absences, gift cards", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
  });

  async function enable() {
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId: 1 });
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isFinance: true } });
  }

  async function addPeriod(lessonId: number, startTime = FUTURE) {
    return prisma.lessonPeriod.create({
      data: { lessonId, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
    });
  }

  /** A fixed lesson + a bound card type (5 格 $2000) attached to it. */
  async function boundSetup({ sessionsPerAttendance = 1 } = {}) {
    const { lesson } = await createLesson(classroomId, { name: "週四期班", sessionsPerAttendance });
    const card = await createCard(classroomId, { name: "週四綁課卡", price: 2000, sessions: 5 });
    await prisma.card.update({ where: { id: card.id }, data: { boundLessonId: lesson.id } });
    await prisma.lessonCard.create({ data: { lessonId: lesson.id, cardId: card.id } });
    return { lesson, card: { ...card, boundLessonId: lesson.id } };
  }

  async function buyBound(studentId: number, card: { id: number; name: string; price: number; classroomId: number; sessions: number }) {
    return prisma.$transaction((tx) =>
      createStudentCardInTx(tx, {
        studentId,
        card,
        finalPrice: card.price,
        sessions: card.sessions,
        purchaseSource: "STAFF",
        isPaid: true,
        paidByUserId: 1,
        eventDescription: "test",
      })
    );
  }

  async function holders(n: number, card: Parameters<typeof buyBound>[1]) {
    const out: { studentId: number; studentCardId: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = await createStudent(classroomId, { name: `S${i}` });
      const sc = await buyBound(s.id, card);
      out.push({ studentId: s.id, studentCardId: sc.id });
    }
    return out;
  }

  const remaining = async (id: number) =>
    (await prisma.studentCard.findUniqueOrThrow({ where: { id } })).remainingSessions;

  it("absent bound holder is auto-deducted (case 6)", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const hs = await holders(8, card);
    const present = hs.slice(0, 7);
    const absent = hs[7];

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: present.map((h) => h.studentId) });

    const absences = await prisma.attendanceAbsence.findMany({ where: { lessonPeriodId: period.id } });
    expect(absences).toHaveLength(1);
    expect(absences[0]).toMatchObject({ studentId: absent.studentId, studentCardId: absent.studentCardId, sessionsUsed: 1 });
    expect(await remaining(absent.studentCardId)).toBe(4);
    for (const h of present) expect(await remaining(h.studentCardId)).toBe(4);
    expect(await prisma.attendanceRecord.count({ where: { lessonPeriodId: period.id } })).toBe(7);
    // 缺席不是出席：沒有 LessonStudent、沒有簽到事件。
    expect(await prisma.lessonStudent.count({ where: { studentId: absent.studentId } })).toBe(0);
    expect(await prisma.event.count({ where: { studentId: absent.studentId, title: "簽到" } })).toBe(0);
  });

  it("absence is idempotent across repeated updates", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    expect(await prisma.attendanceAbsence.count({ where: { lessonPeriodId: period.id } })).toBe(1);
    expect(await remaining(b.studentCardId)).toBe(4);
    expect(await remaining(a.studentCardId)).toBe(4);
  });

  it("re-check turns absence into attendance without double deduct", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    expect(await remaining(b.studentCardId)).toBe(4);

    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId, b.studentId] });

    expect(await prisma.attendanceAbsence.count({ where: { lessonPeriodId: period.id } })).toBe(0);
    const records = await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: period.id, studentId: b.studentId } });
    expect(records).toHaveLength(1);
    expect(records[0].studentCardId).toBe(b.studentCardId);
    expect(await remaining(b.studentCardId)).toBe(4);

    // 再把他取消勾選 → 退出席、改回缺席扣，還是剩 4。
    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    expect(await prisma.attendanceAbsence.count({ where: { lessonPeriodId: period.id } })).toBe(1);
    expect(await remaining(b.studentCardId)).toBe(4);
  });

  it("re-check works even when the absence took the card's last session", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);
    await prisma.studentCard.update({ where: { id: b.studentCardId }, data: { remainingSessions: 1 } });

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    expect(await remaining(b.studentCardId)).toBe(0);

    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId, b.studentId] });
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id, studentId: b.studentId } });
    expect(record.studentCardId).toBe(b.studentCardId);
    expect(await remaining(b.studentCardId)).toBe(0);
  });

  it("periods before purchase are not deducted", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const past = await addPeriod(lesson.id, new Date("2026-06-01T10:00:00Z"));
    const [a, b] = await holders(2, card);

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: past.id, studentIds: [a.studentId] });

    expect(await prisma.attendanceAbsence.count()).toBe(0);
    expect(await remaining(b.studentCardId)).toBe(5);
  });

  it("multi-session lesson deducts sessionsPerAttendance", async () => {
    await enable();
    const { lesson, card } = await boundSetup({ sessionsPerAttendance: 2 });
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    const absence = await prisma.attendanceAbsence.findFirstOrThrow({ where: { studentId: b.studentId } });
    expect(absence.sessionsUsed).toBe(2);
    expect(await remaining(b.studentCardId)).toBe(3);
    expect(await remaining(a.studentCardId)).toBe(3);
  });

  it("reset attendance refunds absences", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    const res = await resetAttendance(
      new Request("http://test.local", { method: "POST" }),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(200);
    expect(await prisma.attendanceAbsence.count()).toBe(0);
    expect(await remaining(b.studentCardId)).toBe(5);
    expect(await remaining(a.studentCardId)).toBe(5);
  });

  it("bound card is auto-picked first in its own lesson", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const general = await createCard(classroomId, { name: "一般卡" });
    await prisma.lessonCard.create({ data: { lessonId: lesson.id, cardId: general.id } });
    const period = await addPeriod(lesson.id);
    const [a] = await holders(1, card);
    await prisma.studentCard.create({
      data: { serialNumber: 999, studentId: a.studentId, cardId: general.id, basePrice: 3000, finalPrice: 3000, totalSessions: 1, remainingSessions: 1 },
    });

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id } });
    expect(record.studentCardId).toBe(a.studentCardId);
  });

  it("gift card issued with bound card and usable in any lesson", async () => {
    await enable();
    const { card } = await boundSetup();
    const [a] = await holders(1, card);

    const gift = await prisma.studentCard.findUniqueOrThrow({
      where: { giftFromId: a.studentCardId },
      include: { card: true },
    });
    expect(gift).toMatchObject({
      studentId: a.studentId,
      finalPrice: 0,
      totalSessions: 1,
      remainingSessions: 1,
      isPaid: true,
      paidByUserId: null,
    });
    expect(gift.card).toMatchObject({ isGift: true, name: "贈送卡", price: 0, sessions: 1 });
    expect(gift.expiresAt?.toISOString()).toBe(addMonthsTaipei(toTaipeiDateKey(new Date()), 6).toISOString());
    expect(isUniversalCard(gift, false)).toBe(true);

    // 另一門課沒掛贈送卡也沒掛綁課卡 → 點名時贈送卡被選到。
    const { lesson: other } = await createLesson(classroomId, { name: "週日課", kind: "ongoing" });
    const period = await addPeriod(other.id);
    await takeAttendance({ lessonId: other.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id } });
    expect(record.studentCardId).toBe(gift.id);
    expect(await remaining(gift.id)).toBe(0);
    expect(await remaining(a.studentCardId)).toBe(5);

    // 第二張綁課卡共用同一個贈送卡種。
    await buyBound(a.studentId, card);
    expect(await prisma.card.count({ where: { classroomId, isGift: true } })).toBe(1);
  });

  it("bound card becomes universal once its lesson is finished", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const [a] = await holders(1, card);
    // 贈送卡先用掉，只留綁課卡。
    await prisma.studentCard.updateMany({ where: { giftFromId: a.studentCardId }, data: { remainingSessions: 0 } });
    const { lesson: other } = await createLesson(classroomId, { name: "別的課", kind: "ongoing" });
    const period = await addPeriod(other.id);

    expect(isUniversalCard({ card: { isGift: false, boundLessonId: lesson.id } }, false)).toBe(false);
    expect(isUniversalCard({ card: { isGift: false, boundLessonId: lesson.id } }, true)).toBe(true);

    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "finished" } });
    await takeAttendance({ lessonId: other.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id } });
    expect(record.studentCardId).toBe(a.studentCardId);
  });

  it("finance disabled: no absence, no gift", async () => {
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });

    expect(await prisma.attendanceAbsence.count()).toBe(0);
    expect(await remaining(b.studentCardId)).toBe(5);
    expect(await prisma.studentCard.count({ where: { giftFromId: { not: null } } })).toBe(0);
    expect(await prisma.card.count({ where: { isGift: true } })).toBe(0);
  });

  it("bound card type requires fixed lesson", async () => {
    const { lesson: fixed } = await createLesson(classroomId, { name: "期班" });
    const { lesson: ongoing } = await createLesson(classroomId, { name: "常態", kind: "ongoing" });
    const body = (boundLessonId: number | null) => ({ name: "綁課卡", price: 2000, sessions: 5, boundLessonId });

    // 財務沒開 → 400 FINANCE_DISABLED
    let res = await POST_CARD(jsonRequest("POST", body(fixed.id)), routeParams({}));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("FINANCE_DISABLED");

    await enable();
    res = await POST_CARD(jsonRequest("POST", body(ongoing.id)), routeParams({}));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("BOUND_LESSON_INVALID");

    // 別的教室的課也不行
    const otherClassroom = await createClassroom({ name: "Other", email: "o@test.local" });
    const { lesson: foreign } = await createLesson(otherClassroom.id, { name: "外面的課" });
    res = await POST_CARD(jsonRequest("POST", body(foreign.id)), routeParams({}));
    expect(res.status).toBe(400);

    res = await POST_CARD(jsonRequest("POST", body(fixed.id)), routeParams({}));
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created.boundLessonId).toBe(fixed.id);
    expect(await prisma.lessonCard.count({ where: { lessonId: fixed.id, cardId: created.id } })).toBe(1);

    // PATCH：改綁另一門 fixed 課 → 那門也掛上；ongoing → 400
    const { lesson: fixed2 } = await createLesson(classroomId, { name: "期班2" });
    res = await PATCH_CARD(jsonRequest("PATCH", body(fixed2.id)), routeParams({ id: String(created.id) }));
    expect(res.status).toBe(200);
    expect(await prisma.lessonCard.count({ where: { lessonId: fixed2.id, cardId: created.id } })).toBe(1);
    res = await PATCH_CARD(jsonRequest("PATCH", body(ongoing.id)), routeParams({ id: String(created.id) }));
    expect(res.status).toBe(400);
    // 已經掛著也不會重複建
    res = await PATCH_CARD(jsonRequest("PATCH", body(fixed2.id)), routeParams({ id: String(created.id) }));
    expect(res.status).toBe(200);
    expect(await prisma.lessonCard.count({ where: { lessonId: fixed2.id, cardId: created.id } })).toBe(1);
  });

  it("late self check-in after an absence refunds it instead of charging twice", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const period = await addPeriod(lesson.id);
    const [a, b] = await holders(2, card);
    await prisma.studentCard.update({ where: { id: b.studentCardId }, data: { remainingSessions: 1 } });
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [a.studentId] });
    expect(await remaining(b.studentCardId)).toBe(0);

    // 贈送卡也在手上：還是要用綁課卡（缺席退回的那格），不能變成多扣一張。
    const out = await selfCheckIn({
      studentId: b.studentId,
      lessonId: lesson.id,
      lessonPeriodIds: [period.id],
      requireCard: true,
    });
    expect(out.results[0].status).toBe("checked");
    expect(await prisma.attendanceAbsence.count({ where: { lessonPeriodId: period.id } })).toBe(0);
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id, studentId: b.studentId } });
    expect(record.studentCardId).toBe(b.studentCardId);
    expect(await remaining(b.studentCardId)).toBe(0);
    const gift = await prisma.studentCard.findUniqueOrThrow({ where: { giftFromId: b.studentCardId } });
    expect(gift.remainingSessions).toBe(1);
  });

  it("binding is locked once the card type was issued", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const { lesson: other } = await createLesson(classroomId, { name: "期班2" });
    const patch = (boundLessonId: number | null) =>
      PATCH_CARD(
        jsonRequest("PATCH", { name: card.name, price: 2000, sessions: 5, boundLessonId }),
        routeParams({ id: String(card.id) })
      );
    // 還沒賣過：可以改
    expect((await patch(other.id)).status).toBe(200);
    expect((await patch(lesson.id)).status).toBe(200);

    await holders(1, card);
    for (const next of [other.id, null]) {
      const res = await patch(next);
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).toContain("BOUND_LESSON_LOCKED");
    }
    // 同一個值、改價格：照常
    const same = await PATCH_CARD(
      jsonRequest("PATCH", { name: card.name, price: 2200, sessions: 5, boundLessonId: lesson.id }),
      routeParams({ id: String(card.id) })
    );
    expect(same.status).toBe(200);
    expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).boundLessonId).toBe(lesson.id);
  });

  it("bound lesson must be a general card on an unfinished fixed lesson", async () => {
    await enable();
    const { lesson } = await createLesson(classroomId, { name: "期班" });
    const style = await defaultDanceStyle(classroomId);
    const post = async (extra: object) => {
      const res = await POST_CARD(
        jsonRequest("POST", { name: "X", price: 100, sessions: 1, boundLessonId: lesson.id, ...extra }),
        routeParams({})
      );
      return { status: res.status, body: JSON.stringify(await res.json()) };
    };
    for (const extra of [{ isTrial: true }, { isPracticeCard: true, danceStyleId: style.id }]) {
      const r = await post(extra);
      expect(r.status).toBe(400);
      expect(r.body).toContain("BOUND_LESSON_INVALID");
    }
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "finished" } });
    const r = await post({});
    expect(r.status).toBe(400);
    expect(r.body).toContain("BOUND_LESSON_INVALID");
    expect(await prisma.card.count({ where: { classroomId } })).toBe(0);
  });

  it("gift card type is hidden and can't be sold or attached", async () => {
    await enable();
    const { card } = await boundSetup();
    const [a] = await holders(1, card);
    const giftType = await prisma.card.findFirstOrThrow({ where: { classroomId, isGift: true } });

    const list = await (await GET_CARDS(new Request("http://test.local"), routeParams({}))).json();
    const ids = [...list.activeCards, ...list.expiredCards].map((c: { id: number }) => c.id);
    expect(ids).toContain(card.id);
    expect(ids).not.toContain(giftType.id);

    const buy = await BUY(
      jsonRequest("POST", { cardId: giftType.id, sessions: 1, price: 0, isPaid: true }),
      routeParams({ id: String(a.studentId) })
    );
    expect(buy.status).toBe(400);
    expect(JSON.stringify(await buy.json())).toContain("GIFT_CARD_NOT_SELLABLE");

    await prisma.location.create({ data: { classroomId, name: "L" } });
    const loc = await prisma.location.findFirstOrThrow({ where: { classroomId } });
    const style = await defaultDanceStyle(classroomId);
    const attach = await POST_LESSON(
      jsonRequest("POST", {
        lessonName: "L", danceStyleId: style.id, teacherIds: [], cardIds: [giftType.id], periods: [], locationId: loc.id,
      })
    );
    expect(attach.status).toBe(400);
    expect((await attach.json()).error).toBe("GIFT_CARD_NOT_SELLABLE");
  });

  it("merge moves absences without duplicates or absence next to attendance", async () => {
    await enable();
    const { lesson, card } = await boundSetup();
    const p1 = await addPeriod(lesson.id, new Date("2030-01-02T11:00:00Z"));
    const p2 = await addPeriod(lesson.id, new Date("2030-01-09T11:00:00Z"));
    const p3 = await addPeriod(lesson.id, new Date("2030-01-16T11:00:00Z"));
    const [src, dst, other] = await holders(3, card);

    // p1：兩人都缺席；p2：src 缺席、dst 出席；p3：src 缺席、dst 不在。
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: p1.id, studentIds: [other.studentId] });
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: p2.id, studentIds: [dst.studentId, other.studentId] });
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: p3.id, studentIds: [dst.studentId, other.studentId] });
    expect(await remaining(src.studentCardId)).toBe(2);
    expect(await remaining(dst.studentCardId)).toBe(2);

    await mergeStudents(classroomId, src.studentId, dst.studentId);

    const absences = await prisma.attendanceAbsence.findMany({ orderBy: { lessonPeriodId: "asc" } });
    expect(absences.map((a) => [a.lessonPeriodId, a.studentId])).toEqual([[p1.id, dst.studentId]]);
    // src 的卡：p1（重複）、p2、p3（dst 有出席）都退 → 5
    expect(await remaining(src.studentCardId)).toBe(5);
    expect(await remaining(dst.studentCardId)).toBe(2);
  });
});
