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
  createPendingAttendance,
  routeParams,
} from "../factories";

// 點名 GET 不經過 decodeAuthToken，不需 mock auth
import { GET } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { takeAttendance } from "@/domains/attendance/attendance.service";

async function getAttendance(lessonId: number, periodId: number) {
  const res = await GET(
    new Request("http://test.local"),
    routeParams({ id: String(lessonId), periodId: String(periodId) })
  );
  expect(res.status).toBe(200);
  return res.json();
}

describe("GET attendance — uncheckedType 分類", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  async function setupBachataLessonWithBothCards() {
    const general = await createCard(classroomId, { name: "一般卡" });
    const practice = await createCard(classroomId, {
      name: "Bachata 複習卡",
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [general.id, practice.id],
      withPeriod: true,
    });
    return { general, practice, lesson, period: period! };
  }

  it("符合資格 + 同時持有複習卡與一般卡 → multiple_cards + PRACTICE_PRIORITY 推薦複習卡", async () => {
    const { general, practice, lesson, period } =
      await setupBachataLessonWithBothCards();
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    await createStudentCard(student.id, general.id);
    const practiceSC = await createStudentCard(student.id, practice.id);
    await createPendingAttendance(period.id, student.id);

    const [record] = await getAttendance(lesson.id, period.id);

    expect(record.uncheckedType).toBe("multiple_cards");
    expect(record.reason).toBe("PRACTICE_PRIORITY");
    expect(record.recommendedStudentCardId).toBe(practiceSC.id);
  });

  it("不符資格 + 只持有複習卡 → not_qualified", async () => {
    const { practice, lesson, period } =
      await setupBachataLessonWithBothCards();
    const student = await createStudent(classroomId); // 無資格
    await createStudentCard(student.id, practice.id);
    await createPendingAttendance(period.id, student.id);

    const [record] = await getAttendance(lesson.id, period.id);

    expect(record.uncheckedType).toBe("not_qualified");
    expect(record.recommendedStudentCardId).toBe(null);
  });

  it("不符資格 + 只持有一般卡 → not_checked（單卡推薦）", async () => {
    const { general, lesson, period } =
      await setupBachataLessonWithBothCards();
    const student = await createStudent(classroomId);
    const generalSC = await createStudentCard(student.id, general.id);
    await createPendingAttendance(period.id, student.id);

    const [record] = await getAttendance(lesson.id, period.id);

    expect(record.uncheckedType).toBe("not_checked");
    expect(record.recommendedStudentCardId).toBe(generalSC.id);
  });

  it("符合資格但沒有複習卡（只有一般卡）→ no_practice_card", async () => {
    const { general, lesson, period } =
      await setupBachataLessonWithBothCards();
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    await createStudentCard(student.id, general.id);
    await createPendingAttendance(period.id, student.id);

    const [record] = await getAttendance(lesson.id, period.id);

    expect(record.uncheckedType).toBe("no_practice_card");
  });

  it("沒有任何課卡 → no_card", async () => {
    const { lesson, period } = await setupBachataLessonWithBothCards();
    const student = await createStudent(classroomId);
    await createPendingAttendance(period.id, student.id);

    const [record] = await getAttendance(lesson.id, period.id);

    expect(record.uncheckedType).toBe("no_card");
  });

  it("新舞種（Kizomba）資格也能觸發複習卡優先 — 不再被寫死排除", async () => {
    const practice = await createCard(classroomId, {
      name: "Kizomba 複習卡",
      isPracticeCard: true,
      danceType: DanceType.KIZOMBA,
    });
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.KIZOMBA,
      cardIds: [general.id, practice.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.KIZOMBA],
    });
    await createStudentCard(student.id, general.id);
    const practiceSC = await createStudentCard(student.id, practice.id);
    await createPendingAttendance(period!.id, student.id);

    const [record] = await getAttendance(lesson.id, period!.id);

    expect(record.uncheckedType).toBe("multiple_cards");
    expect(record.reason).toBe("PRACTICE_PRIORITY");
    expect(record.recommendedStudentCardId).toBe(practiceSC.id);
  });

  it("重構前掛上的舞種不符複習卡 → not_qualified（不自動使用，但卡片仍存在）", async () => {
    // 歷史資料：Bachata 課程掛了 Salsa 複習卡
    const salsaPractice = await createCard(classroomId, {
      name: "Salsa 複習卡",
      isPracticeCard: true,
      danceType: DanceType.SALSA,
    });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [salsaPractice.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.SALSA], // 即使有 Salsa 資格
    });
    await createStudentCard(student.id, salsaPractice.id);
    await createPendingAttendance(period!.id, student.id);

    const [record] = await getAttendance(lesson.id, period!.id);

    expect(record.uncheckedType).toBe("not_qualified");
  });
});

describe("takeAttendance — 自動選卡與扣堂", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("符合資格者自動優先扣複習卡", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const practice = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [general.id, practice.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    const generalSC = await createStudentCard(student.id, general.id);
    const practiceSC = await createStudentCard(student.id, practice.id);

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(record.studentCardId).toBe(practiceSC.id);

    const updatedPractice = await prisma.studentCard.findUniqueOrThrow({
      where: { id: practiceSC.id },
    });
    const updatedGeneral = await prisma.studentCard.findUniqueOrThrow({
      where: { id: generalSC.id },
    });
    expect(updatedPractice.remainingSessions).toBe(5); // 複習卡 -1
    expect(updatedGeneral.remainingSessions).toBe(6); // 一般卡不動
  });

  it("不符資格者持複習卡+一般卡 → 自動扣一般卡（複習卡被排除）", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const practice = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [general.id, practice.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId); // 無資格
    const generalSC = await createStudentCard(student.id, general.id);
    const practiceSC = await createStudentCard(student.id, practice.id);

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(record.studentCardId).toBe(generalSC.id);

    const updatedPractice = await prisma.studentCard.findUniqueOrThrow({
      where: { id: practiceSC.id },
    });
    expect(updatedPractice.remainingSessions).toBe(6); // 複習卡未被誤扣
  });

  it("不符資格者只持複習卡 → 不自動扣卡（留待人工處理）", async () => {
    const practice = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [practice.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const practiceSC = await createStudentCard(student.id, practice.id);

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(record.studentCardId).toBe(null);

    const updatedPractice = await prisma.studentCard.findUniqueOrThrow({
      where: { id: practiceSC.id },
    });
    expect(updatedPractice.remainingSessions).toBe(6); // 卡片完好，未被扣
  });
});
