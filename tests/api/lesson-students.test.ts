import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as lessonStudentsGet } from "@/app/api/lessons/[id]/students/route";

// 課程名單除了出缺勤，還要回「這位學生在這堂課還能扣幾堂」——這是
// 需要注意清單的資料來源。與學生層級的「Needs Renewal」標籤刻意不同：
// 這裡是課程範圍、含「剩 1 堂」，標籤是學生全域、只在剛好 0 堂時亮。

async function fetchRoster(lessonId: number) {
  const response = await lessonStudentsGet(
    jsonRequest("GET"),
    routeParams({ id: String(lessonId) })
  );
  return { status: response.status, body: await response.json() };
}

async function enroll(lessonId: number, studentId: number) {
  await prisma.lessonStudent.create({ data: { lessonId, studentId } });
}

describe("GET /api/lessons/[id]/students", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("只算掛在這堂課上的課卡", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const onLesson = await createCard(classroom.id, { name: "8 堂團體卡" });
    const elsewhere = await createCard(classroom.id, { name: "別堂課的卡" });
    const { lesson } = await createLesson(classroom.id, { cardIds: [onLesson.id] });
    const student = await createStudent(classroom.id, { name: "王柏宇" });
    await enroll(lesson.id, student.id);

    await createStudentCard(student.id, onLesson.id, { remainingSessions: 3 });
    await createStudentCard(student.id, elsewhere.id, { remainingSessions: 5 });

    const { body } = await fetchRoster(lesson.id);

    expect(body[0].cardStatus).toMatchObject({
      usableSessions: 3,
      usableCardCount: 1,
      blockedCardCount: 0,
      level: "ok",
    });
  });

  it("排除用完與已停用的卡", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const card = await createCard(classroom.id);
    const { lesson } = await createLesson(classroom.id, { cardIds: [card.id] });
    const student = await createStudent(classroom.id);
    await enroll(lesson.id, student.id);

    await createStudentCard(student.id, card.id, { remainingSessions: 0 });
    const expired = await createStudentCard(student.id, card.id, { remainingSessions: 4 });
    await prisma.studentCard.update({
      where: { id: expired.id },
      data: { expiredAt: new Date() },
    });

    const { body } = await fetchRoster(lesson.id);

    expect(body[0].cardStatus).toMatchObject({ usableSessions: 0, level: "none" });
  });

  it("不符資格的複習卡算 blocked，不算可用；給了資格就變可用", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const practice = await createCard(classroom.id, {
      name: "Salsa 複習卡",
      isPracticeCard: true,
      danceType: DanceType.SALSA,
    });
    const { lesson } = await createLesson(classroom.id, {
      danceType: DanceType.SALSA,
      cardIds: [practice.id],
    });
    const student = await createStudent(classroom.id);
    await enroll(lesson.id, student.id);
    await createStudentCard(student.id, practice.id, { remainingSessions: 4 });

    const before = await fetchRoster(lesson.id);
    expect(before.body[0].cardStatus).toMatchObject({
      usableSessions: 0,
      usableCardCount: 0,
      blockedCardCount: 1,
      level: "none",
    });
    expect(before.body[0].danceQualifications).toEqual([]);

    await prisma.studentDanceQualification.create({
      data: { studentId: student.id, danceType: DanceType.SALSA },
    });

    const after = await fetchRoster(lesson.id);
    expect(after.body[0].cardStatus).toMatchObject({
      usableSessions: 4,
      usableCardCount: 1,
      blockedCardCount: 0,
      level: "ok",
    });
    expect(after.body[0].danceQualifications).toEqual([DanceType.SALSA]);
  });

  it("剩 1 堂算 low，剩 2 堂算 ok", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const card = await createCard(classroom.id);
    const { lesson } = await createLesson(classroom.id, { cardIds: [card.id] });
    const low = await createStudent(classroom.id, { name: "甲" });
    const ok = await createStudent(classroom.id, { name: "乙" });
    await enroll(lesson.id, low.id);
    await enroll(lesson.id, ok.id);
    await createStudentCard(low.id, card.id, { remainingSessions: 1 });
    await createStudentCard(ok.id, card.id, { remainingSessions: 2 });

    const { body } = await fetchRoster(lesson.id);
    const byId = new Map<number, { cardStatus: { level: string } }>(
      body.map((s: { id: number; cardStatus: { level: string } }) => [s.id, s])
    );

    expect(byId.get(low.id)?.cardStatus.level).toBe("low");
    expect(byId.get(ok.id)?.cardStatus.level).toBe("ok");
  });

  it("每個時段一列出缺勤，帶 periodId，依 startTime 排序", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const { lesson } = await createLesson(classroom.id);
    const later = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-08T10:00:00Z"),
        endTime: new Date("2026-06-08T11:00:00Z"),
        attendanceTakenAt: new Date("2026-06-08T11:05:00Z"),
      },
    });
    const earlier = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T10:00:00Z"),
        endTime: new Date("2026-06-01T11:00:00Z"),
        attendanceTakenAt: new Date("2026-06-01T11:05:00Z"),
      },
    });
    const student = await createStudent(classroom.id);
    await enroll(lesson.id, student.id);
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: earlier.id, studentId: student.id },
    });

    const { body } = await fetchRoster(lesson.id);

    expect(body[0].attendances).toHaveLength(2);
    expect(body[0].attendances.map((a: { periodId: number }) => a.periodId)).toEqual([
      earlier.id,
      later.id,
    ]);
    expect(body[0].attendances[0].attendanceStatus).toBe("attended");
    expect(body[0].attendances[1].attendanceStatus).toBe("absent");
  });

  it("時段還沒定案時算 not_started，即使學生已自助簽到", async () => {
    // 自助簽到會先建 AttendanceRecord 但不設 attendanceTakenAt，
    // 老師定案前不該被算成出席——這是既有行為，改版不能動到。
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const { lesson, period } = await createLesson(classroom.id, { withPeriod: true });
    const student = await createStudent(classroom.id);
    await enroll(lesson.id, student.id);
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: student.id, source: "STUDENT" },
    });

    const { body } = await fetchRoster(lesson.id);

    expect(body[0].attendances[0].attendanceStatus).toBe("not_started");
  });

  it("不回傳 lineBindKey / lineUserId", async () => {
    const classroom = await createClassroom();
    auth.classroomId = classroom.id;

    const { lesson } = await createLesson(classroom.id, { withPeriod: true });
    const student = await createStudent(classroom.id);
    await enroll(lesson.id, student.id);
    await prisma.student.update({
      where: { id: student.id },
      data: { lineBindKey: "bind-key", lineUserId: "U-line-id" },
    });

    const { body } = await fetchRoster(lesson.id);
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("bind-key");
    expect(serialized).not.toContain("U-line-id");
    expect(serialized).not.toContain("lineBindKey");
    expect(serialized).not.toContain("lineUserId");
  });

  it("別間教室的課程回 404，不回 403", async () => {
    const mine = await createClassroom();
    const theirs = await createClassroom({ email: "other@test.local" });
    auth.classroomId = mine.id;

    const { lesson } = await createLesson(theirs.id, { withPeriod: true });

    const { status } = await fetchRoster(lesson.id);
    expect(status).toBe(404);
  });

  it("別間教室的同名學生不會被算進卡況", async () => {
    // fetchStudentsWithValidCards 的 classroomId 是必填的安全參數（roadmap P0-3）。
    const mine = await createClassroom();
    const theirs = await createClassroom({ email: "other@test.local" });
    auth.classroomId = mine.id;

    const card = await createCard(mine.id);
    const { lesson } = await createLesson(mine.id, { cardIds: [card.id] });
    const outsider = await createStudent(theirs.id, { name: "外人" });
    await createStudentCard(outsider.id, card.id, { remainingSessions: 9 });
    await enroll(lesson.id, outsider.id);

    const { body } = await fetchRoster(lesson.id);

    expect(body[0].cardStatus).toMatchObject({ usableSessions: 0, level: "none" });
  });
});
