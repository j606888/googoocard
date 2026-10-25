import { describe, it, expect, beforeEach, vi } from "vitest";
import { subDays } from "date-fns";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET as LIST } from "@/app/api/students/route";

describe("GET /api/students：點名名單的「未付 $X」「新學員」", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("unpaidAmount 加總所有未付款卡（含已用完）；只買過體驗卡的是新學員", async () => {
    const regular = await createCard(classroomId, { name: "10 堂卡", price: 2000 });
    const trial = await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true });

    const owes = await createStudent(classroomId, { name: "欠款舊生" });
    await createStudentCard(owes.id, regular.id, { isPaid: false, finalPrice: 2000 });
    await createStudentCard(owes.id, regular.id, { isPaid: false, finalPrice: 1500, remainingSessions: 0 });
    await createStudentCard(owes.id, regular.id, { isPaid: true, finalPrice: 2000 });

    const newcomer = await createStudent(classroomId, { name: "新同學" });
    await createStudentCard(newcomer.id, trial.id, { isPaid: false, finalPrice: 400, remainingSessions: 0 });

    const res = await LIST(new Request("http://test.local/api/students"));
    const byName = Object.fromEntries(
      ((await res.json()) as { name: string; unpaidAmount: number; isNewStudent: boolean }[]).map((s) => [s.name, s])
    );
    expect(byName["欠款舊生"]).toMatchObject({ unpaidAmount: 3500, isNewStudent: false });
    expect(byName["新同學"]).toMatchObject({ unpaidAmount: 400, isNewStudent: true });
  });

  it("recentAttendAt 只帶近 9 週內的出席，各學生各自的", async () => {
    const { lesson } = await createLesson(classroomId);
    const period = (startTime: Date) =>
      prisma.lessonPeriod.create({
        data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
      });
    const recent = await period(subDays(new Date(), 3));
    const weeksAgo = await period(subDays(new Date(), 40));
    const old = await period(subDays(new Date(), 120));

    const regular = await createStudent(classroomId, { name: "常來" });
    const quiet = await createStudent(classroomId, { name: "很久沒來" });
    await prisma.attendanceRecord.createMany({
      data: [
        { lessonPeriodId: recent.id, studentId: regular.id },
        { lessonPeriodId: weeksAgo.id, studentId: regular.id },
        { lessonPeriodId: old.id, studentId: regular.id },
        { lessonPeriodId: old.id, studentId: quiet.id },
      ],
    });

    const res = await LIST(new Request("http://test.local/api/students"));
    const byName = Object.fromEntries(
      ((await res.json()) as { name: string; recentAttendAt: string[] }[]).map((s) => [s.name, s])
    );
    expect(byName["常來"].recentAttendAt.map((t) => new Date(t).getTime()).sort()).toEqual(
      [weeksAgo.startTime.getTime(), recent.startTime.getTime()]
    );
    expect(byName["很久沒來"].recentAttendAt).toEqual([]);
  });
});
