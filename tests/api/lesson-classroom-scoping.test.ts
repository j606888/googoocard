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
  createPendingAttendance,
  jsonRequest,
  routeParams,
} from "../factories";

// auth.classroomId 固定指向「我的」教室；測試對「別人」教室的課程/時段操作。
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PUT as lessonPut, DELETE as lessonDelete } from "@/app/api/lessons/[id]/route";
import { POST as periodCreate } from "@/app/api/lessons/[id]/periods/route";
import { DELETE as periodDelete } from "@/app/api/lessons/[id]/periods/[periodId]/route";
import { POST as periodReset } from "@/app/api/lessons/[id]/periods/[periodId]/reset/route";
import {
  POST as attendancePost,
  PUT as attendancePut,
} from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { POST as consume } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/[studentId]/consume/route";
import { DELETE as tagDelete } from "@/app/api/students/[id]/tags/[tagId]/route";

// 建立一間「別人的」教室，內含一堂有時段的課與一名學生。
async function createForeignClassroom() {
  const user = await prisma.user.create({
    data: { email: "foreign@test.local", name: "Foreign", password: "x" },
  });
  const classroom = await prisma.classroom.create({
    data: { ownerId: user.id, name: "Foreign Classroom" },
  });
  const card = await createCard(classroom.id);
  const { lesson, period } = await createLesson(classroom.id, {
    danceType: DanceType.BACHATA,
    cardIds: [card.id],
    withPeriod: true,
  });
  const student = await createStudent(classroom.id, { name: "別人的學生" });
  const studentCard = await createStudentCard(student.id, card.id);
  return { classroom, lesson, period: period!, student, card, studentCard };
}

describe("跨教室授權：lessons/* 寫入路徑一律回 404", () => {
  beforeEach(async () => {
    await resetDb();
    // 我自己的教室（auth 指向這裡）
    const mine = await createClassroom();
    auth.classroomId = mine.id;
  });

  it("PUT lesson → 404，課程不被改動", async () => {
    const { lesson } = await createForeignClassroom();
    const res = await lessonPut(
      jsonRequest("PUT", {
        lessonName: "hacked",
        danceType: DanceType.SALSA,
        teacherIds: [],
        cardIds: [],
      }),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(404);
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(after.name).toBe(lesson.name);
    expect(after.danceType).toBe(DanceType.BACHATA);
  });

  it("DELETE lesson → 404，課程仍存在", async () => {
    const { lesson } = await createForeignClassroom();
    const res = await lessonDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(404);
    expect(await prisma.lesson.count({ where: { id: lesson.id } })).toBe(1);
  });

  it("POST period（新增時段）→ 404，不新增時段", async () => {
    const { lesson } = await createForeignClassroom();
    const before = await prisma.lessonPeriod.count({ where: { lessonId: lesson.id } });
    const res = await periodCreate(
      jsonRequest("POST", {
        startTime: "2026-07-01T02:00:00Z",
        endTime: "2026-07-01T03:00:00Z",
      }),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(404);
    expect(await prisma.lessonPeriod.count({ where: { lessonId: lesson.id } })).toBe(before);
  });

  it("DELETE period → 404，時段仍存在", async () => {
    const { lesson, period } = await createForeignClassroom();
    const res = await periodDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(404);
    expect(await prisma.lessonPeriod.count({ where: { id: period.id } })).toBe(1);
  });

  it("POST reset → 404，已扣的卡不被退還", async () => {
    const { lesson, period, student, studentCard } = await createForeignClassroom();
    // 模擬已點名扣卡
    await prisma.studentCard.update({
      where: { id: studentCard.id },
      data: { remainingSessions: 5 },
    });
    await prisma.attendanceRecord.create({
      data: {
        lessonPeriodId: period.id,
        studentId: student.id,
        studentCardId: studentCard.id,
      },
    });

    const res = await periodReset(
      jsonRequest("POST"),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(404);
    const sc = await prisma.studentCard.findUniqueOrThrow({ where: { id: studentCard.id } });
    expect(sc.remainingSessions).toBe(5); // 沒被退回
    expect(
      await prisma.attendanceRecord.count({ where: { lessonPeriodId: period.id } })
    ).toBe(1);
  });

  it("POST attendance（點名）→ 404，不建立紀錄/不扣卡", async () => {
    const { lesson, period, student } = await createForeignClassroom();
    const res = await attendancePost(
      jsonRequest("POST", { studentIds: [student.id] }),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(404);
    expect(
      await prisma.attendanceRecord.count({ where: { lessonPeriodId: period.id } })
    ).toBe(0);
  });

  it("PUT attendance（更新名單）→ 404", async () => {
    const { lesson, period, student } = await createForeignClassroom();
    const res = await attendancePut(
      jsonRequest("PUT", { studentIds: [student.id] }),
      routeParams({ id: String(lesson.id), periodId: String(period.id) })
    );
    expect(res.status).toBe(404);
    expect(
      await prisma.attendanceRecord.count({ where: { lessonPeriodId: period.id } })
    ).toBe(0);
  });

  it("POST consume（手動扣卡）→ 404，卡片不被扣", async () => {
    const { lesson, period, student, studentCard } = await createForeignClassroom();
    await createPendingAttendance(period.id, student.id);

    const res = await consume(
      jsonRequest("POST", { studentCardId: studentCard.id }),
      routeParams({
        id: String(lesson.id),
        periodId: String(period.id),
        studentId: String(student.id),
      })
    );
    expect(res.status).toBe(404);
    const sc = await prisma.studentCard.findUniqueOrThrow({ where: { id: studentCard.id } });
    expect(sc.remainingSessions).toBe(6); // 未被扣
  });

  it("DELETE student tag → 404，標籤仍在", async () => {
    const { classroom, student } = await createForeignClassroom();
    const tag = await prisma.tag.create({
      data: { name: "VIP", classroomId: classroom.id },
    });
    await prisma.studentTag.create({
      data: { studentId: student.id, tagId: tag.id },
    });

    const res = await tagDelete(
      jsonRequest("DELETE"),
      routeParams({ id: String(student.id), tagId: String(tag.id) })
    );
    expect(res.status).toBe(404);
    expect(
      await prisma.studentTag.count({
        where: { studentId: student.id, tagId: tag.id },
      })
    ).toBe(1);
  });
});
