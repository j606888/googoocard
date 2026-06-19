import { describe, it, expect, beforeEach } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
} from "../factories";
import { selfCheckIn, takeAttendance } from "@/domains/attendance/attendance.service";

// 自助簽到走 service 直呼，不經 route，不需 mock auth。

describe("selfCheckIn 並發 — 不重複扣卡 (#1 unique 約束)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("DB 層拒絕同一 (period, student) 的重複出席紀錄", async () => {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);

    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: student.id },
    });

    await expect(
      prisma.attendanceRecord.create({
        data: { lessonPeriodId: period!.id, studentId: student.id },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    void lesson;
  });

  it("兩個並發 selfCheckIn 同一時段 → 只建一筆、只扣一堂", async () => {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { remainingSessions: 6 });

    const args = {
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: [period!.id],
    };
    const [a, b] = await Promise.all([selfCheckIn(args), selfCheckIn(args)]);

    // 一筆出席、扣一堂（而非兩筆、扣兩堂）
    const records = await prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(records).toHaveLength(1);

    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });
    expect(sc.remainingSessions).toBe(5);

    // 恰好一個 call 報 checked，另一個被 unique 約束擋下 → already_checked
    const statuses = [...a, ...b].map((r) => r.status).sort();
    expect(statuses).toEqual(["already_checked", "checked"]);
  });

  it("並發簽到兩個不同時段、共用僅剩 1 堂的卡 → 不會扣成負數 (#3)", async () => {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
    });
    const period2 = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T12:00:00Z"),
        endTime: new Date("2026-06-01T13:00:00Z"),
      },
    });
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { remainingSessions: 1 });

    await Promise.all([
      selfCheckIn({ studentId: student.id, lessonId: lesson.id, lessonPeriodIds: [period!.id] }),
      selfCheckIn({ studentId: student.id, lessonId: lesson.id, lessonPeriodIds: [period2.id] }),
    ]);

    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });
    expect(sc.remainingSessions).toBeGreaterThanOrEqual(0); // 守門：不為負
    expect(sc.remainingSessions).toBe(0); // 僅扣一次
  });
});

describe("takeAttendance — period 必須屬於 lesson (#2)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("periodId 屬於別堂課 → throw Lesson period not found，且不建立紀錄", async () => {
    const card = await createCard(classroomId);
    const { lesson: lessonA } = await createLesson(classroomId, {
      name: "A",
      cardIds: [card.id],
    });
    const { period: periodB } = await createLesson(classroomId, {
      name: "B",
      danceType: DanceType.SALSA,
      withPeriod: true,
    });
    const student = await createStudent(classroomId);

    await expect(
      takeAttendance({
        lessonId: lessonA.id,
        lessonPeriodId: periodB!.id,
        studentIds: [student.id],
      })
    ).rejects.toThrow("Lesson period not found");

    // 別堂課的時段沒被動到
    expect(
      await prisma.attendanceRecord.count({ where: { lessonPeriodId: periodB!.id } })
    ).toBe(0);
    const stillOpen = await prisma.lessonPeriod.findUniqueOrThrow({
      where: { id: periodB!.id },
    });
    expect(stillOpen.attendanceTakenAt).toBeNull();
  });
});
