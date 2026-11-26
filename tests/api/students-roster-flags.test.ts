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

describe("GET /api/students：recentLessonIds（名單上方的「上的課」）", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  const periodOf = (lessonId: number, daysAgo: number) => {
    const startTime = subDays(new Date(), daysAgo);
    return prisma.lessonPeriod.create({
      data: { lessonId, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
    });
  };

  const list = async () => {
    const res = await LIST(new Request("http://test.local/api/students"));
    expect(res.status).toBe(200);
    return Object.fromEntries(
      ((await res.json()) as { name: string; recentLessonIds: number[] }[]).map((s) => [s.name, s])
    );
  };

  it("近 63 天在進行中的課有出席才算；太久以前、已結束的課都不算", async () => {
    const { lesson: bachata } = await createLesson(classroomId, { name: "Bachata" });
    const { lesson: salsa } = await createLesson(classroomId, { name: "Salsa" });
    const { lesson: ended } = await createLesson(classroomId, { name: "結束的課" });
    await prisma.lesson.update({ where: { id: ended.id }, data: { status: "finished" } });

    const bachataRecent = await periodOf(bachata.id, 3);
    const bachataAgain = await periodOf(bachata.id, 10);
    const salsaOld = await periodOf(salsa.id, 120);
    const endedRecent = await periodOf(ended.id, 5);

    const regular = await createStudent(classroomId, { name: "常來" });
    const lapsed = await createStudent(classroomId, { name: "很久沒來" });
    const finishedOnly = await createStudent(classroomId, { name: "只上過結束的課" });
    await createStudent(classroomId, { name: "沒上過課" });
    await prisma.attendanceRecord.createMany({
      data: [
        { lessonPeriodId: bachataRecent.id, studentId: regular.id },
        // 同一堂課來兩次，id 只出現一次
        { lessonPeriodId: bachataAgain.id, studentId: regular.id },
        { lessonPeriodId: salsaOld.id, studentId: regular.id },
        { lessonPeriodId: endedRecent.id, studentId: regular.id },
        { lessonPeriodId: salsaOld.id, studentId: lapsed.id },
        { lessonPeriodId: endedRecent.id, studentId: finishedOnly.id },
      ],
    });

    const byName = await list();
    expect(byName["常來"].recentLessonIds).toEqual([bachata.id]);
    expect(byName["很久沒來"].recentLessonIds).toEqual([]);
    expect(byName["只上過結束的課"].recentLessonIds).toEqual([]);
    expect(byName["沒上過課"].recentLessonIds).toEqual([]);
  });

  it("報名整期的人沒來過也算在那堂課裡；課結束後就不算", async () => {
    const { lesson: term } = await createLesson(classroomId, { name: "整期課" });
    const { lesson: other } = await createLesson(classroomId, { name: "另一堂" });
    const { lesson: ended } = await createLesson(classroomId, { name: "結束的整期課" });
    await prisma.lesson.update({ where: { id: ended.id }, data: { status: "finished" } });

    const enrolled = await createStudent(classroomId, { name: "整期學生" });
    const both = await createStudent(classroomId, { name: "整期又來別堂" });
    await prisma.lessonEnrollment.createMany({
      data: [
        { lessonId: term.id, studentId: enrolled.id, price: 2000, sessions: 8 },
        { lessonId: ended.id, studentId: enrolled.id, price: 2000, sessions: 8 },
        { lessonId: term.id, studentId: both.id, price: 2000, sessions: 8 },
      ],
    });
    const otherPeriod = await periodOf(other.id, 1);
    // 整期學生自己也來了整期課：出席和報名重複，id 還是只有一個
    const termPeriod = await periodOf(term.id, 2);
    await prisma.attendanceRecord.createMany({
      data: [
        { lessonPeriodId: otherPeriod.id, studentId: both.id },
        { lessonPeriodId: termPeriod.id, studentId: both.id },
      ],
    });

    const byName = await list();
    expect(byName["整期學生"].recentLessonIds).toEqual([term.id]);
    expect(byName["整期又來別堂"].recentLessonIds).toEqual([term.id, other.id].sort((a, b) => a - b));
  });

  it("只看自己教室：別間教室的課和學生不會混進來", async () => {
    const otherOwner = await prisma.user.create({
      data: { email: "other-roster@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherOwner.id, name: "Other Classroom" },
    });
    const { lesson: theirs } = await createLesson(otherClassroom.id, { name: "別間的課" });
    const theirStudent = await createStudent(otherClassroom.id, { name: "別間的學生" });
    const theirPeriod = await periodOf(theirs.id, 1);
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: theirPeriod.id, studentId: theirStudent.id },
    });

    const { lesson: mine } = await createLesson(classroomId, { name: "我的課" });
    const myStudent = await createStudent(classroomId, { name: "我的學生" });
    const myPeriod = await periodOf(mine.id, 1);
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: myPeriod.id, studentId: myStudent.id },
    });

    const byName = await list();
    expect(Object.keys(byName)).toEqual(["我的學生"]);
    expect(byName["我的學生"].recentLessonIds).toEqual([mine.id]);
  });

  it("回應不再帶舊的 activeLessonIds／isInActiveLesson", async () => {
    await createStudent(classroomId, { name: "小明" });
    const byName = await list();
    expect(byName["小明"]).not.toHaveProperty("activeLessonIds");
    expect(byName["小明"]).not.toHaveProperty("isInActiveLesson");
    expect(byName["小明"]).not.toHaveProperty("lineUserId");
    expect(byName["小明"]).not.toHaveProperty("lineBindKey");
  });
});
