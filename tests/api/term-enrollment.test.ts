import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as getRoster, POST as postEnrollment } from "@/app/api/lessons/[id]/enrollments/route";
import { DELETE as deleteEnrollmentRoute } from "@/app/api/lesson-enrollments/[id]/route";
import { POST as confirmPayment } from "@/app/api/lesson-enrollments/[id]/confirm-payment/route";
import { POST as postPeriods } from "@/app/api/lessons/[id]/periods/route";
import { GET as getTerm } from "@/app/api/lessons/[id]/periods/[periodId]/term/route";
import { takeAttendance, updateAttendance, selfCheckIn } from "@/domains/attendance/attendance.service";
import { getLessonPeriodStats } from "@/service/lessonStats";
import { previewPeriodCards } from "@/service/attendancePreview";
import { getTodos } from "@/service/todos";
import { GET as getLessonStudents } from "@/app/api/lessons/[id]/students/route";
import { POST as createLessonRoute } from "@/app/api/lessons/route";
import { PUT as updateLessonRoute } from "@/app/api/lessons/[id]/route";

const json = (method: string, url: string, body?: unknown) =>
  new Request(`http://test.local${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const enroll = (lessonId: number, body: unknown) =>
  postEnrollment(json("POST", `/api/lessons/${lessonId}/enrollments`, body), routeParams({ id: String(lessonId) }));

const DAY = 24 * 60 * 60 * 1000;

// 報名整期：$1,600 / 5 堂，每堂 $320，請假曠課照算、不扣卡、時段不能超過堂數。
describe("報名整期", () => {
  let classroomId: number;
  let lessonId: number;
  let periodIds: number[];
  let cardId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    cardId = (await createCard(classroomId, { name: "8 堂", price: 3200, sessions: 8 })).id;
    const { lesson } = await createLesson(classroomId, { cardIds: [cardId] });
    lessonId = lesson.id;
    await prisma.lesson.update({ where: { id: lessonId }, data: { termPrice: 1600, termSessions: 5 } });
    const start = new Date("2026-12-01T11:30:00Z");
    periodIds = [];
    for (let i = 0; i < 3; i++) {
      const p = await prisma.lessonPeriod.create({
        data: {
          lessonId,
          startTime: new Date(start.getTime() + i * 7 * DAY),
          endTime: new Date(start.getTime() + i * 7 * DAY + 90 * 60 * 1000),
        },
      });
      periodIds.push(p.id);
    }
  });

  it("登記：預設課程價與堂數、可個別改價；同一門課不能報兩次；沒付進待處理", async () => {
    const a = await createStudent(classroomId, { name: "小琳" });
    const res = await enroll(lessonId, { studentId: a.id, isPaid: true, paymentMethod: "CASH" });
    expect(res.status).toBe(200);
    const { enrollmentId } = await res.json();
    expect(await prisma.lessonEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).toMatchObject({
      price: 1600,
      sessions: 5,
      isPaid: true,
      paymentMethod: "CASH",
      paidByUserId: auth.userId,
    });

    const again = await enroll(lessonId, { studentId: a.id, isPaid: false });
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe("ALREADY_ENROLLED");

    const half = await enroll(lessonId, { newStudentName: "舊生", price: 800, isPaid: false });
    const halfId = (await half.json()).enrollmentId;
    expect(await prisma.lessonEnrollment.findUniqueOrThrow({ where: { id: halfId } })).toMatchObject({
      price: 800,
      sessions: 5,
      isPaid: false,
    });

    const tooMany = await enroll(lessonId, { newStudentName: "多報", sessions: 6, isPaid: false });
    expect(tooMany.status).toBe(400);

    const todos = await getTodos(classroomId);
    expect(todos.unpaidEnrollments.map((e) => e.id)).toEqual([halfId]);
    const confirmed = await confirmPayment(
      json("POST", `/api/lesson-enrollments/${halfId}/confirm-payment`, { paymentMethod: "TRANSFER" }),
      routeParams({ id: String(halfId) })
    );
    expect(confirmed.status).toBe(200);
    expect((await getTodos(classroomId)).unpaidEnrollments).toEqual([]);
  });

  it("沒開整期的課不能登記", async () => {
    await prisma.lesson.update({ where: { id: lessonId }, data: { termPrice: null, termSessions: null } });
    const res = await enroll(lessonId, { newStudentName: "x", isPaid: false });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TERM_NOT_OFFERED");
  });

  it("點名：整期的人不扣卡（手上有卡也一樣），請假／曠課照算收入", async () => {
    const present = await createStudent(classroomId, { name: "有來" });
    const leave = await createStudent(classroomId, { name: "請假" });
    const absent = await createStudent(classroomId, { name: "曠課" });
    const cardUser = await createStudent(classroomId, { name: "課卡" });
    const sc = await createStudentCard(present.id, cardId, { remainingSessions: 8 });
    const sc2 = await createStudentCard(cardUser.id, cardId, { remainingSessions: 8 });
    for (const s of [present, leave, absent]) await enroll(lessonId, { studentId: s.id, isPaid: true });

    const preview = await previewPeriodCards({
      lessonId,
      periodId: periodIds[0],
      classroomId,
      extraStudentIds: [cardUser.id],
    });
    expect(preview?.[present.id]).toEqual({ kind: "enrolled", index: 1, sessions: 5 });
    expect(preview?.[cardUser.id]).toMatchObject({ kind: "auto" });

    await takeAttendance({
      lessonId,
      lessonPeriodId: periodIds[0],
      studentIds: [present.id, cardUser.id],
      leaveStudentIds: [leave.id, present.id],
    });

    const records = await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: periodIds[0] } });
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    expect(byStudent.get(present.id)).toMatchObject({ studentCardId: null });
    expect(byStudent.get(present.id)!.enrollmentId).not.toBeNull();
    expect(byStudent.get(cardUser.id)!.studentCardId).toBe(sc2.id);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } })).remainingSessions).toBe(8);

    // 有來的人不會被記請假（就算送了）。
    const leaves = await prisma.periodLeave.findMany({ include: { enrollment: true } });
    expect(leaves.map((l) => l.enrollment.studentId)).toEqual([leave.id]);

    // 3 人 × $320 + 課卡一堂
    const stats = await getLessonPeriodStats(lessonId);
    expect(stats.periods[0]).toMatchObject({ revenue: Math.round(3 * 320 + sc2.finalPrice / sc2.totalSessions), termRevenue: 960, termEnrolledCount: 3 });

    // 整期的出席不算「出席沒綁課卡」。
    expect((await getTodos(classroomId)).unboundAttendance).toEqual([]);

    // 名單：每人每堂的狀態。
    const roster = await (await getRoster(json("GET", `/api/lessons/${lessonId}/enrollments`), routeParams({ id: String(lessonId) }))).json();
    const statusOf = (id: number) => roster.enrollments.find((e: { student: { id: number } }) => e.student.id === id).statuses;
    expect(statusOf(present.id)).toEqual(["present", "upcoming", "upcoming"]);
    expect(statusOf(leave.id)).toEqual(["leave", "upcoming", "upcoming"]);
    expect(statusOf(absent.id)).toEqual(["absent", "upcoming", "upcoming"]);

    // 下一堂點名頁：提醒上一堂誰請假。
    const term = await (
      await getTerm(json("GET", "/x"), routeParams({ id: String(lessonId), periodId: String(periodIds[1]) }))
    ).json();
    expect(term.offered).toBe(true);
    expect(term.enrolled).toHaveLength(3);
    expect(term.previousLeaves.students.map((s: { id: number }) => s.id)).toEqual([leave.id]);

    // 重新點名改成請假的人也來了：請假清掉。
    await updateAttendance({ lessonId, lessonPeriodId: periodIds[0], studentIds: [present.id, cardUser.id, leave.id] });
    expect(await prisma.periodLeave.count()).toBe(0);
  });

  it("每位報名各自 price / sessions，只涵蓋前 N 堂", async () => {
    const short = await createStudent(classroomId, { name: "三堂" });
    await enroll(lessonId, { studentId: short.id, price: 900, sessions: 2, isPaid: true });
    for (const periodId of periodIds) {
      await takeAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [] });
    }
    const stats = await getLessonPeriodStats(lessonId);
    expect(stats.periods.map((p) => p.revenue)).toEqual([450, 450, 0]);
    expect(stats.totalRevenue).toBe(900);
  });

  it("時段數不能超過整期堂數", async () => {
    const add = (n: number) =>
      postPeriods(
        json("POST", `/api/lessons/${lessonId}/periods`, {
          periods: Array.from({ length: n }, (_, i) => ({
            startTime: new Date(Date.UTC(2027, 0, 1 + i, 11)).toISOString(),
            endTime: new Date(Date.UTC(2027, 0, 1 + i, 12)).toISOString(),
          })),
        }),
        routeParams({ id: String(lessonId) })
      );
    expect((await add(3)).status).toBe(400);
    expect((await add(2)).status).toBe(200);
    expect((await add(1)).status).toBe(400);
  });

  it("自助簽到：整期的人不用選卡、也不會被 requireCard 擋", async () => {
    const s = await createStudent(classroomId, { name: "掃 QR" });
    await createStudentCard(s.id, cardId, { remainingSessions: 8 });
    await enroll(lessonId, { studentId: s.id, isPaid: true });
    const period = await prisma.lessonPeriod.findUniqueOrThrow({ where: { id: periodIds[1] } });

    const outcome = await selfCheckIn({
      studentId: s.id,
      lessonId,
      lessonPeriodIds: [period.id],
      requireCard: true,
      openOn: period.startTime,
    });
    expect(outcome.results).toEqual([
      { periodId: period.id, status: "enrolled", termIndex: 2, termSessions: 5 },
    ]);
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: period.id } });
    expect(record).toMatchObject({ studentCardId: null, source: "STUDENT" });
    expect(record.enrollmentId).not.toBeNull();
  });

  it("取消報名：只有還沒出席過的能取消", async () => {
    const s = await createStudent(classroomId, { name: "登記錯" });
    const { enrollmentId } = await (await enroll(lessonId, { studentId: s.id, isPaid: false })).json();
    await takeAttendance({ lessonId, lessonPeriodId: periodIds[0], studentIds: [s.id] });
    const del = () =>
      deleteEnrollmentRoute(json("DELETE", "/x"), routeParams({ id: String(enrollmentId) }));
    expect((await del()).status).toBe(409);

    await updateAttendance({ lessonId, lessonPeriodId: periodIds[0], studentIds: [] });
    expect((await del()).status).toBe(200);
    expect(await prisma.lessonEnrollment.count()).toBe(0);
  });

  it("課程名冊：報整期的人標 term、不算「沒卡」", async () => {
    const s = await createStudent(classroomId, { name: "整期生" });
    await enroll(lessonId, { studentId: s.id, isPaid: true });
    const res = await getLessonStudents(json("GET", "/x"), routeParams({ id: String(lessonId) }));
    const roster = await res.json();
    expect(roster.find((r: { id: number }) => r.id === s.id).cardStatus).toMatchObject({ level: "ok", term: true });
  });

  it("開課／改設定：整期要兩個欄位一起、只能固定期數、時段不能比堂數多、有人報了不能關", async () => {
    const styleId = (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).danceStyleId;
    const draft = (extra: Record<string, unknown>) => ({
      lessonName: "新的一期",
      teacherIds: [],
      cardIds: [],
      danceStyleId: styleId,
      periods: [
        { startTime: "2027-01-05T11:00:00Z", endTime: "2027-01-05T12:00:00Z" },
        { startTime: "2027-01-12T11:00:00Z", endTime: "2027-01-12T12:00:00Z" },
      ],
      ...extra,
    });
    const create = async (extra: Record<string, unknown>) =>
      (await createLessonRoute(json("POST", "/api/lessons", draft(extra)))).json();

    expect((await create({ termPrice: 1600 })).error).toBe("INVALID_TERM");
    expect((await create({ termPrice: 1600, termSessions: 5, kind: "ongoing" })).error).toBe("TERM_REQUIRES_FIXED");
    expect((await create({ termPrice: 1600, termSessions: 1 })).error).toBe("TERM_SESSIONS_EXCEEDED");
    expect(await create({ termPrice: 1600, termSessions: 5 })).toEqual({ message: "Lesson created" });
    expect(await prisma.lesson.count({ where: { termPrice: 1600, termSessions: 5, name: "新的一期" } })).toBe(1);

    // 已經排了 3 堂、有人報名：堂數不能改成 2，也不能關掉整期。
    await enroll(lessonId, { newStudentName: "已報", isPaid: true });
    const update = async (extra: Record<string, unknown>) =>
      (
        await updateLessonRoute(
          json("PUT", `/api/lessons/${lessonId}`, { ...draft(extra), lessonName: "改名" }),
          routeParams({ id: String(lessonId) })
        )
      ).json();
    expect((await update({ termPrice: 1600, termSessions: 2 })).error).toBe("TERM_SESSIONS_EXCEEDED");
    expect((await update({ termPrice: null, termSessions: null })).error).toBe("TERM_HAS_ENROLLMENTS");
    expect((await update({ termPrice: 2000, termSessions: 6 })).id).toBe(lessonId);
  });
});
