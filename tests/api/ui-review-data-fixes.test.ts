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
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as incomeGET } from "@/app/api/income/route";
import { GET as studentsGET } from "@/app/api/students/route";
import { GET as studentGET } from "@/app/api/students/[id]/route";
import { GET as lessonStudentsGET } from "@/app/api/lessons/[id]/students/route";
import { POST as consume } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/[studentId]/consume/route";

// Problems found in the 2026-10 UI review (docs/ui-review-2026-10.md).

let classroomId: number;

beforeEach(async () => {
  await resetDb();
  const classroom = await createClassroom();
  classroomId = classroom.id;
  auth.classroomId = classroomId;
});

describe("GET /api/income", () => {
  it("never returns the student's LINE bind key or share token", async () => {
    const student = await createStudent(classroomId, { name: "小陶" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineBindKey: "secret-bind", randomKey: "secret-share", lineUserId: "U123" },
    });
    const card = await createCard(classroomId, { name: "體驗課" });
    await createStudentCard(student.id, card.id);

    const res = await incomeGET(new Request("http://test.local/api/income"));
    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(body.records[0].student).toEqual({ name: "小陶" });
    expect(body.records[0].card).toEqual({ name: "體驗課" });
    expect(raw).not.toContain("secret-bind");
    expect(raw).not.toContain("secret-share");
    expect(raw).not.toContain("U123");
  });
});

describe("最近上課 (lastAttendAt)", () => {
  // A class at 19:30 whose attendance the teacher takes after midnight.
  const classStart = new Date("2026-10-01T11:30:00Z");
  const takenAt = new Date("2026-10-01T16:03:00Z");

  async function attendedLesson(name: string, start: Date, attendanceTakenAt: Date | null) {
    const { lesson } = await createLesson(classroomId, { name });
    const period = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: start,
        endTime: new Date(start.getTime() + 60 * 60 * 1000),
        attendanceTakenAt,
      },
    });
    return period;
  }

  it("is the class's start time, not when attendance was taken", async () => {
    const student = await createStudent(classroomId);
    const period = await attendedLesson("10月份體驗課", classStart, takenAt);
    await createPendingAttendance(period.id, student.id);

    const list = await (await studentsGET(new Request("http://test.local/api/students"))).json();
    expect(new Date(list[0].lastAttendAt).toISOString()).toBe(classStart.toISOString());
    expect(list[0].lastAttendLessonName).toBe("10月份體驗課");

    const detail = await (
      await studentGET(new Request("http://test.local"), routeParams({ id: String(student.id) }))
    ).json();
    expect(new Date(detail.overview.lastAttendAt).toISOString()).toBe(classStart.toISOString());
    expect(detail.overview.lastAttendLessonName).toBe("10月份體驗課");
  });

  it("orders by class date, not by when the record was created", async () => {
    const student = await createStudent(classroomId);
    const later = await attendedLesson("Later class", new Date("2026-10-08T11:30:00Z"), takenAt);
    const earlier = await attendedLesson("Earlier class", classStart, takenAt);
    // The older class is recorded last (e.g. a backfilled 點名).
    await createPendingAttendance(later.id, student.id);
    await createPendingAttendance(earlier.id, student.id);

    const detail = await (
      await studentGET(new Request("http://test.local"), routeParams({ id: String(student.id) }))
    ).json();
    expect(detail.overview.lastAttendLessonName).toBe("Later class");
  });

  it("counts a self check-in the teacher has not finalised yet", async () => {
    const student = await createStudent(classroomId);
    const period = await attendedLesson("Self check-in", classStart, null);
    await createPendingAttendance(period.id, student.id);

    const detail = await (
      await studentGET(new Request("http://test.local"), routeParams({ id: String(student.id) }))
    ).json();
    expect(detail.overview.lastAttendLessonName).toBe("Self check-in");
  });
});

describe("POST consume (手動扣卡)", () => {
  async function setup() {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, { cardIds: [card.id], withPeriod: true });
    const student = await createStudent(classroomId, { name: "A" });
    const studentCard = await createStudentCard(student.id, card.id);
    await createPendingAttendance(period!.id, student.id);
    return { card, lesson, period: period!, student, studentCard };
  }

  function call(lessonId: number, periodId: number, studentId: number, studentCardId: number) {
    return consume(
      jsonRequest("POST", { studentCardId }),
      routeParams({ id: String(lessonId), periodId: String(periodId), studentId: String(studentId) })
    );
  }

  async function remaining(studentCardId: number) {
    return (await prisma.studentCard.findUniqueOrThrow({ where: { id: studentCardId } }))
      .remainingSessions;
  }

  it("charges the student's own card", async () => {
    const { lesson, period, student, studentCard } = await setup();
    const res = await call(lesson.id, period.id, student.id, studentCard.id);
    expect(res.status).toBe(200);
    expect(await remaining(studentCard.id)).toBe(5);
  });

  it("refuses another student's card → 404, nothing charged", async () => {
    const { card, lesson, period, student } = await setup();
    const other = await createStudent(classroomId, { name: "B" });
    const othersCard = await createStudentCard(other.id, card.id);

    const res = await call(lesson.id, period.id, student.id, othersCard.id);
    expect(res.status).toBe(404);
    expect(await remaining(othersCard.id)).toBe(6);
  });

  it("refuses a period of another lesson → 404", async () => {
    const { card, lesson, student, studentCard } = await setup();
    const { period: otherPeriod } = await createLesson(classroomId, { cardIds: [card.id], withPeriod: true });
    await createPendingAttendance(otherPeriod!.id, student.id);

    const res = await call(lesson.id, otherPeriod!.id, student.id, studentCard.id);
    expect(res.status).toBe(404);
    expect(await remaining(studentCard.id)).toBe(6);
  });

  it("refuses a card with no sessions left → 400", async () => {
    const { card, lesson, period, student } = await setup();
    const empty = await createStudentCard(student.id, card.id, { remainingSessions: 0 });

    const res = await call(lesson.id, period.id, student.id, empty.id);
    expect(res.status).toBe(400);
    expect(await remaining(empty.id)).toBe(0);
  });

  it("refuses to bind a second card to the same record → 409", async () => {
    const { card, lesson, period, student, studentCard } = await setup();
    const second = await createStudentCard(student.id, card.id);
    expect((await call(lesson.id, period.id, student.id, studentCard.id)).status).toBe(200);

    const res = await call(lesson.id, period.id, student.id, second.id);
    expect(res.status).toBe(409);
    expect(await remaining(second.id)).toBe(6);
  });
});

describe("GET /api/lessons/[id]/students — cardStatus.otherSessions", () => {
  it("counts live sessions on cards the lesson does not accept", async () => {
    const trial = await createCard(classroomId, { name: "體驗課" });
    const advanced = await createCard(classroomId, { name: "進階6堂" });
    const { lesson } = await createLesson(classroomId, { cardIds: [trial.id] });
    const student = await createStudent(classroomId, { name: "小陶" });
    await prisma.lessonStudent.create({ data: { lessonId: lesson.id, studentId: student.id } });
    await createStudentCard(student.id, advanced.id, { remainingSessions: 2 });
    await createStudentCard(student.id, advanced.id, { remainingSessions: 1 });
    // Neither an empty nor an expired card counts.
    await createStudentCard(student.id, advanced.id, { remainingSessions: 0 });
    const expired = await createStudentCard(student.id, advanced.id, { remainingSessions: 4 });
    await prisma.studentCard.update({ where: { id: expired.id }, data: { expiredAt: new Date() } });

    const res = await lessonStudentsGET(new Request("http://test.local"), routeParams({ id: String(lesson.id) }));
    const [row] = await res.json();
    expect(row.cardStatus).toMatchObject({ usableSessions: 0, level: "none", otherSessions: 3 });
  });
});
