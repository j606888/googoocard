import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  createPendingAttendance,
  createDanceStyles,
  routeParams,
  type DanceStyleIds,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0, role: "owner" }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET } from "@/app/api/lessons/[id]/periods/[periodId]/card-preview/route";
import { takeAttendance } from "@/domains/attendance/attendance.service";
import type { CardPreview } from "@/service/attendancePreview";

async function preview(lessonId: number, periodId: number, extra: number[] = []) {
  const res = await GET(
    new Request(`http://test.local/x?studentIds=${extra.join(",")}`),
    routeParams({ id: String(lessonId), periodId: String(periodId) })
  );
  return { status: res.status, body: (await res.json()) as Record<number, CardPreview> };
}

/** 預覽說會扣哪張，實際點名就要扣到那一張、剩下那個數字。 */
async function expectEngineAgrees(
  lessonId: number,
  periodId: number,
  studentIds: number[],
  previews: Record<number, CardPreview>
) {
  await takeAttendance({ lessonId, lessonPeriodId: periodId, studentIds });
  for (const studentId of studentIds) {
    const record = await prisma.attendanceRecord.findUniqueOrThrow({
      where: { lessonPeriodId_studentId: { lessonPeriodId: periodId, studentId } },
      include: { studentCard: { include: { card: true } } },
    });
    const expected = previews[studentId];
    if (expected.kind === "auto") {
      expect(record.studentCard?.card.name).toBe(expected.cardName);
      expect(record.studentCard?.remainingSessions).toBe(expected.remainingAfter);
    } else if (expected.kind === "choose" || expected.kind === "none") {
      expect(record.studentCardId).toBeNull();
    }
  }
}

describe("GET card-preview — 跟點名引擎同一個答案", () => {
  let classroomId: number;
  let S: DanceStyleIds;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    S = await createDanceStyles(classroomId);
  });

  it("一張卡自動扣、多張卡待選、沒卡，名冊外的人要傳 id 才算", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const other = await createCard(classroomId, { name: "十堂卡", sessions: 10 });
    const unrelated = await createCard(classroomId, { name: "別堂課的卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [general.id, other.id],
      withPeriod: true,
    });
    const one = await createStudent(classroomId, { name: "一張" });
    const two = await createStudent(classroomId, { name: "兩張" });
    const none = await createStudent(classroomId, { name: "沒卡" });
    const walkIn = await createStudent(classroomId, { name: "名冊外" });
    await prisma.lessonStudent.createMany({
      data: [one, two, none].map((s) => ({ lessonId: lesson.id, studentId: s.id })),
    });
    await createStudentCard(one.id, general.id, { remainingSessions: 4 });
    await createStudentCard(two.id, general.id, { remainingSessions: 2 });
    await createStudentCard(two.id, other.id, { remainingSessions: 9, totalSessions: 10 });
    await createStudentCard(none.id, unrelated.id);
    await createStudentCard(walkIn.id, general.id, { remainingSessions: 1 });

    const rosterOnly = await preview(lesson.id, period!.id);
    expect(rosterOnly.status).toBe(200);
    expect(rosterOnly.body).toEqual({
      [one.id]: { kind: "auto", cardName: "一般卡", remainingAfter: 3 },
      [two.id]: { kind: "choose", count: 2 },
      [none.id]: { kind: "none" },
    });

    const withWalkIn = await preview(lesson.id, period!.id, [walkIn.id]);
    expect(withWalkIn.body[walkIn.id]).toEqual({ kind: "auto", cardName: "一般卡", remainingAfter: 0 });

    await expectEngineAgrees(lesson.id, period!.id, [one.id, two.id, none.id, walkIn.id], withWalkIn.body);
  });

  it("體驗卡優先、合格的複習卡優先——就算還有別張能用的卡", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const practice = await createCard(classroomId, {
      name: "Bachata 複習卡",
      isPracticeCard: true,
      danceStyleId: S.BACHATA,
    });
    const trial = await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true });
    const { lesson, period } = await createLesson(classroomId, {
      danceStyleId: S.BACHATA,
      cardIds: [general.id, practice.id, trial.id],
      withPeriod: true,
    });
    const trialist = await createStudent(classroomId, { name: "體驗" });
    const qualified = await createStudent(classroomId, { name: "有資格", qualifications: [S.BACHATA] });
    await prisma.lessonStudent.createMany({
      data: [trialist, qualified].map((s) => ({ lessonId: lesson.id, studentId: s.id })),
    });
    await createStudentCard(trialist.id, general.id, { remainingSessions: 5 });
    await createStudentCard(trialist.id, trial.id, { remainingSessions: 1, totalSessions: 1, finalPrice: 400 });
    await createStudentCard(qualified.id, general.id, { remainingSessions: 5 });
    await createStudentCard(qualified.id, practice.id, { remainingSessions: 3 });

    const { body } = await preview(lesson.id, period!.id);
    expect(body[trialist.id]).toEqual({ kind: "auto", cardName: "體驗課", remainingAfter: 0 });
    expect(body[qualified.id]).toEqual({ kind: "auto", cardName: "Bachata 複習卡", remainingAfter: 2 });

    await expectEngineAgrees(lesson.id, period!.id, [trialist.id, qualified.id], body);
  });

  it("一次扣兩格的課：剩一格的卡不算能用，扣完剩的數字照兩格算", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [general.id],
      withPeriod: true,
      sessionsPerAttendance: 2,
    });
    const short = await createStudent(classroomId, { name: "只剩一格" });
    const enough = await createStudent(classroomId, { name: "夠扣" });
    await prisma.lessonStudent.createMany({
      data: [short, enough].map((s) => ({ lessonId: lesson.id, studentId: s.id })),
    });
    await createStudentCard(short.id, general.id, { remainingSessions: 1 });
    await createStudentCard(enough.id, general.id, { remainingSessions: 5 });

    const { body } = await preview(lesson.id, period!.id);
    expect(body[short.id]).toEqual({ kind: "none" });
    expect(body[enough.id]).toEqual({ kind: "auto", cardName: "一般卡", remainingAfter: 3 });

    await expectEngineAgrees(lesson.id, period!.id, [short.id, enough.id], body);
  });

  it("這個時段已經有紀錄的人照紀錄回報——完成點名不會再扣一次", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, { cardIds: [general.id], withPeriod: true });
    const selfChecked = await createStudent(classroomId, { name: "自助簽到" });
    const pending = await createStudent(classroomId, { name: "沒綁卡的紀錄" });
    const dropIn = await createStudent(classroomId, { name: "單堂" });
    const card = await createStudentCard(selfChecked.id, general.id, { remainingSessions: 3 });
    await createStudentCard(pending.id, general.id, { remainingSessions: 4 });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: selfChecked.id, studentCardId: card.id, source: "STUDENT" },
    });
    await createPendingAttendance(period!.id, pending.id);
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: dropIn.id, dropInCharge: { create: { amount: 400 } } },
    });

    const { body } = await preview(lesson.id, period!.id);
    expect(body).toEqual({
      [selfChecked.id]: { kind: "covered", cardName: "一般卡", remaining: 3 },
      // 已有一筆沒綁卡的紀錄：引擎留著不動，所以就算他有卡也不會自動扣。
      [pending.id]: { kind: "none" },
      [dropIn.id]: { kind: "covered", cardName: null, remaining: null },
    });

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [selfChecked.id, pending.id, dropIn.id],
    });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: card.id } })).remainingSessions).toBe(3);
    expect(
      (
        await prisma.attendanceRecord.findUniqueOrThrow({
          where: { lessonPeriodId_studentId: { lessonPeriodId: period!.id, studentId: pending.id } },
        })
      ).studentCardId
    ).toBeNull();
  });

  it("別間教室的課回 404，別間教室的學生 id 不會被算進來", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const { lesson: foreign, period: foreignPeriod } = await createLesson(other.id, { withPeriod: true });
    expect((await preview(foreign.id, foreignPeriod!.id)).status).toBe(404);

    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, { cardIds: [general.id], withPeriod: true });
    const outsider = await createStudent(other.id, { name: "別間的人" });
    const { body } = await preview(lesson.id, period!.id, [outsider.id]);
    expect(body).toEqual({});
  });
});
