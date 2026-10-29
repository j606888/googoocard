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

// 外師課：一次出席扣好幾格（Lesson.sessionsPerAttendance），扣的格數抄在
// AttendanceRecord.sessionsUsed；剩不夠扣的卡不能用（不拆到兩張卡）。
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as getAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { POST as resetAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/reset/route";
import { POST as consumeCard } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/[studentId]/consume/route";
import { POST as createLessonRoute } from "@/app/api/lessons/route";
import {
  takeAttendance,
  updateAttendance,
  selfCheckIn,
  SelfCheckInError,
} from "@/domains/attendance/attendance.service";

const remaining = async (id: number) =>
  (await prisma.studentCard.findUniqueOrThrow({ where: { id } })).remainingSessions;

describe("外師課一次扣多格", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  async function setup() {
    const card = await createCard(classroomId, { name: "10 堂卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
      sessionsPerAttendance: 2,
    });
    return { card, lesson, period: period! };
  }

  it("點名扣 2 格並記下 sessionsUsed；取消勾選退回 2 格", async () => {
    const { card, lesson, period } = await setup();
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, card.id, { remainingSessions: 5, totalSessions: 10 });

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [student.id] });
    expect(await remaining(sc.id)).toBe(3);
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: student.id } });
    expect(record.sessionsUsed).toBe(2);
    expect(record.studentCardId).toBe(sc.id);

    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [] });
    expect(await remaining(sc.id)).toBe(5);
  });

  it("改課程設定不影響已點名的紀錄：退卡退當初扣的格數", async () => {
    const { card, lesson, period } = await setup();
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, card.id, { remainingSessions: 5 });

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [student.id] });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { sessionsPerAttendance: 1 } });

    const res = await resetAttendance(
      new Request("http://test.local"),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(200);
    expect(await remaining(sc.id)).toBe(5);
  });

  it("只剩 1 格的卡不夠扣：不自動扣，GET 回 no_card", async () => {
    const { card, lesson, period } = await setup();
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, card.id, { remainingSessions: 1 });

    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [student.id] });
    expect(await remaining(sc.id)).toBe(1);

    const res = await getAttendance(
      new Request("http://test.local"),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    const [row] = await res.json();
    expect(row.uncheckedType).toBe("no_card");
    expect(row.sessionsUsed).toBe(2);
  });

  it("手動綁卡：不夠扣回 400，夠扣就扣 2 格", async () => {
    const { card, lesson, period } = await setup();
    const student = await createStudent(classroomId);
    const short = await createStudentCard(student.id, card.id, { remainingSessions: 1 });
    const enough = await createStudentCard(student.id, card.id, { remainingSessions: 4 });
    await prisma.attendanceRecord.update({
      where: { id: (await createPendingAttendance(period.id, student.id)).id },
      data: { sessionsUsed: 2 },
    });
    const consume = (studentCardId: number) =>
      consumeCard(
        jsonRequest("POST", { studentCardId }),
        routeParams({ id: String(lesson.id), periodId: String(period.id), studentId: String(student.id) })
      );

    expect((await consume(short.id)).status).toBe(400);
    expect(await remaining(short.id)).toBe(1);

    expect((await consume(enough.id)).status).toBe(200);
    expect(await remaining(enough.id)).toBe(2);
  });

  it("自助簽到扣 2 格；只有不夠扣的卡時 requireCard 整筆拒絕", async () => {
    const { card, lesson, period } = await setup();
    const ok = await createStudent(classroomId, { name: "夠" });
    const okCard = await createStudentCard(ok.id, card.id, { remainingSessions: 2 });
    const { results } = await selfCheckIn({
      studentId: ok.id,
      lessonId: lesson.id,
      lessonPeriodIds: [period.id],
      requireCard: true,
    });
    expect(results[0]).toMatchObject({ status: "checked", remainingSessions: 0, exhausted: true });
    expect(await remaining(okCard.id)).toBe(0);

    const short = await createStudent(classroomId, { name: "不夠" });
    const shortCard = await createStudentCard(short.id, card.id, { remainingSessions: 1 });
    await expect(
      selfCheckIn({
        studentId: short.id,
        lessonId: lesson.id,
        lessonPeriodIds: [period.id],
        card: { studentCardId: shortCard.id },
        requireCard: true,
      })
    ).rejects.toBeInstanceOf(SelfCheckInError);
    expect(await remaining(shortCard.id)).toBe(1);
  });

  it("開課只接受 1–3 格", async () => {
    const res = await createLessonRoute(
      jsonRequest("POST", {
        lessonName: "外師課",
        teacherIds: [],
        cardIds: [],
        danceStyleId: 1,
        sessionsPerAttendance: 5,
      })
    );
    expect(res.status).toBe(400);
  });
});
