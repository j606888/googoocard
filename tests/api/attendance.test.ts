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
  routeParams,
} from "../factories";

// reset route 經過 decodeAuthToken 做 classroom 授權，需 mock auth；
// 每個 beforeEach 把 auth.classroomId 設成當前測試教室。
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { POST as resetAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/reset/route";
import {
  takeAttendance,
  updateAttendance,
  selfCheckIn,
} from "@/domains/attendance/attendance.service";
import { AttendanceSource } from "@prisma/client";

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
    auth.classroomId = classroomId;
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

  it("不符資格 + 持有多張複習卡 → not_qualified（不會誤判成 multiple_cards）", async () => {
    const { practice, lesson, period } =
      await setupBachataLessonWithBothCards();
    const extraPractice = await createCard(classroomId, {
      name: "Bachata 複習卡 2",
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    await prisma.lessonCard.create({
      data: { lessonId: lesson.id, cardId: extraPractice.id },
    });
    const student = await createStudent(classroomId); // 無資格
    await createStudentCard(student.id, practice.id);
    await createStudentCard(student.id, extraPractice.id);
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
    auth.classroomId = classroomId;
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

  it("已定案的時段再次 takeAttendance → 擋下（避免重複定案）", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [general.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, general.id);

    // 第一次定案：扣 1 堂、attendanceTakenAt 被設定
    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    // 第二次對同一時段 takeAttendance → 應被 validateAttendanceRequest 擋下
    await expect(
      takeAttendance({
        lessonId: lesson.id,
        lessonPeriodId: period!.id,
        studentIds: [student.id],
      })
    ).rejects.toThrow("Attendance already taken");

    // 卡只扣了第一次那一堂（沒有因第二次呼叫又被扣）
    const after = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(after.remainingSessions).toBe(5);
    const count = await prisma.attendanceRecord.count({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(count).toBe(1);
  });
});

describe("updateAttendance — 定案後修改點名", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("已定案時段可再編輯：移除原學生退卡 + 新增學生扣卡，且時段維持定案", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [general.id],
      withPeriod: true,
    });
    const studentA = await createStudent(classroomId, { name: "A" });
    const scA = await createStudentCard(studentA.id, general.id);
    const studentB = await createStudent(classroomId, { name: "B" });
    const scB = await createStudentCard(studentB.id, general.id);

    // 先用 takeAttendance 定案 A（takeAttendance 之後就無法再被它修改）
    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [studentA.id],
    });
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: scA.id } }))
        .remainingSessions
    ).toBe(5);

    // updateAttendance 把名單改成只有 B（不受「已定案」阻擋）
    await updateAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [studentB.id],
    });

    // A 的紀錄移除、課卡退回
    const aRecords = await prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: period!.id, studentId: studentA.id },
    });
    expect(aRecords).toHaveLength(0);
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: scA.id } }))
        .remainingSessions
    ).toBe(6);

    // B 的紀錄建立（TEACHER）、課卡扣 1 堂
    const bRecord = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: period!.id, studentId: studentB.id },
    });
    expect(bRecord.source).toBe(AttendanceSource.TEACHER);
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: scB.id } }))
        .remainingSessions
    ).toBe(5);

    // 時段仍為已定案
    const updatedPeriod = await prisma.lessonPeriod.findUniqueOrThrow({
      where: { id: period!.id },
    });
    expect(updatedPeriod.attendanceTakenAt).not.toBeNull();
  });

  it("已定案名單中的學生再次 updateAttendance（仍在名單）→ 不重複扣卡、不重建紀錄", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [general.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, general.id);

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });
    // 用 updateAttendance 重送一樣的名單（例如只是改了別人）
    await updateAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    const records = await prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(records).toHaveLength(1); // 未重建
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(5); // 只扣一次
  });
});

describe("selfCheckIn + takeAttendance — 學生自助簽到後老師定案", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("學生自助簽到後老師再點名同一人 → 不重複建紀錄、不重複扣卡", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [general.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, general.id);

    // 學生先自助簽到（source = STUDENT，不定案），扣 1 堂
    await selfCheckIn({
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: [period!.id],
    });

    const afterSelf = await prisma.studentCard.findUniqueOrThrow({
      where: { id: sc.id },
    });
    expect(afterSelf.remainingSessions).toBe(5); // -1

    // 老師把同一人也納入點名定案
    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    // 仍然只有一筆紀錄，且維持原本的 STUDENT source（未被覆蓋/重建）
    const records = await prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: period!.id, studentId: student.id },
    });
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe(AttendanceSource.STUDENT);

    // 課卡只被扣 1 堂（沒有 double-charge）
    const afterTake = await prisma.studentCard.findUniqueOrThrow({
      where: { id: sc.id },
    });
    expect(afterTake.remainingSessions).toBe(5);

    // 時段已定案
    const updatedPeriod = await prisma.lessonPeriod.findUniqueOrThrow({
      where: { id: period!.id },
    });
    expect(updatedPeriod.attendanceTakenAt).not.toBeNull();
  });

  it("老師定案時取消勾選已自助簽到者 → 移除紀錄並退還課卡，同時新增 walk-in", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [general.id],
      withPeriod: true,
    });
    const selfStudent = await createStudent(classroomId);
    const selfSC = await createStudentCard(selfStudent.id, general.id);
    const walkIn = await createStudent(classroomId);
    const walkInSC = await createStudentCard(walkIn.id, general.id);

    // selfStudent 自助簽到，扣 1 堂
    await selfCheckIn({
      studentId: selfStudent.id,
      lessonId: lesson.id,
      lessonPeriodIds: [period!.id],
    });

    // 老師定案：取消 selfStudent、改點 walk-in
    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [walkIn.id],
    });

    // selfStudent 的紀錄被移除、課卡退回
    const selfRecords = await prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: period!.id, studentId: selfStudent.id },
    });
    expect(selfRecords).toHaveLength(0);
    const refundedSelf = await prisma.studentCard.findUniqueOrThrow({
      where: { id: selfSC.id },
    });
    expect(refundedSelf.remainingSessions).toBe(6); // 退還

    // walk-in 紀錄建立、課卡扣 1 堂
    const walkInRecord = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: period!.id, studentId: walkIn.id },
    });
    expect(walkInRecord.source).toBe(AttendanceSource.TEACHER);
    const usedWalkIn = await prisma.studentCard.findUniqueOrThrow({
      where: { id: walkInSC.id },
    });
    expect(usedWalkIn.remainingSessions).toBe(5);
  });
});

describe("selfCheckIn — 一次多時段的扣卡同步", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  // Two periods on one lesson, ordered by startTime.
  async function lessonWithTwoPeriods(cardId: number) {
    const { lesson } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [cardId],
    });
    const p1 = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T10:00:00Z"),
        endTime: new Date("2026-06-01T11:00:00Z"),
      },
    });
    const p2 = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T13:00:00Z"),
        endTime: new Date("2026-06-01T14:00:00Z"),
      },
    });
    return { lesson, p1, p2 };
  }

  it("卡在第一個時段用罄 → 第二時段回 no_card，課卡只扣到 0 不會變負", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, p1, p2 } = await lessonWithTwoPeriods(general.id);
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, general.id, {
      remainingSessions: 1,
      totalSessions: 10,
    });

    const results = await selfCheckIn({
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: [p1.id, p2.id],
    });

    const byPeriod = Object.fromEntries(results.map((r) => [r.periodId, r]));
    expect(byPeriod[p1.id]).toMatchObject({
      status: "checked",
      remainingSessions: 0,
      exhausted: true,
    });
    expect(byPeriod[p2.id]).toMatchObject({ status: "no_card" });

    // 課卡只扣 1 堂（用罄後不再被第二時段重選 / 不會扣成 -1）
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(0);

    // 兩筆紀錄都建立：第一筆綁卡、第二筆無卡
    const r1 = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: p1.id, studentId: student.id },
    });
    const r2 = await prisma.attendanceRecord.findFirstOrThrow({
      where: { lessonPeriodId: p2.id, studentId: student.id },
    });
    expect(r1.studentCardId).not.toBeNull();
    expect(r2.studentCardId).toBeNull();
  });

  it("堂數足夠 → 兩個時段各扣 1 堂，回報的 remainingSessions 逐次遞減", async () => {
    const general = await createCard(classroomId, { name: "一般卡" });
    const { lesson, p1, p2 } = await lessonWithTwoPeriods(general.id);
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, general.id, {
      remainingSessions: 5,
      totalSessions: 5,
    });

    const results = await selfCheckIn({
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: [p1.id, p2.id],
    });

    const byPeriod = Object.fromEntries(results.map((r) => [r.periodId, r]));
    // 遞減而非各自回報 4（記憶體未同步會兩筆都報 4）
    expect(byPeriod[p1.id]).toMatchObject({ status: "checked", remainingSessions: 4 });
    expect(byPeriod[p2.id]).toMatchObject({ status: "checked", remainingSessions: 3 });

    // DB 實扣 2 堂
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(3);
  });
});

describe("resetAttendance — 清除事件 (audit events)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  async function reset(lessonId: number, periodId: number) {
    const res = await resetAttendance(
      new Request("http://test.local", { method: "POST" }),
      routeParams({ id: String(lessonId), periodId: String(periodId) })
    );
    expect(res.status).toBe(200);
    return res.json();
  }

  it("reset 後移除「簽到」事件並退還課卡堂數", async () => {
    const card = await createCard(classroomId, { name: "一般卡" });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, card.id);

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    // 簽到事件已建立、課卡扣 1 堂
    expect(
      await prisma.event.count({
        where: { studentId: student.id, title: "簽到" },
      })
    ).toBe(1);
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(5);

    await reset(lesson.id, period!.id);

    // 簽到事件被清除、課卡退還、出席紀錄刪除
    expect(
      await prisma.event.count({
        where: { studentId: student.id, title: "簽到" },
      })
    ).toBe(0);
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(6);
    expect(
      await prisma.attendanceRecord.count({
        where: { lessonPeriodId: period!.id },
      })
    ).toBe(0);
  });

  it("reset 後移除已退還課卡的「課卡使用完畢」事件", async () => {
    const card = await createCard(classroomId, { name: "單堂卡", sessions: 1 });
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [card.id],
      withPeriod: true,
    });
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, card.id, {
      remainingSessions: 1,
      totalSessions: 1,
    });

    await takeAttendance({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      studentIds: [student.id],
    });

    // 課卡用罄 → 產生使用完畢事件
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(0);
    expect(
      await prisma.event.count({
        where: { studentId: student.id, title: "課卡使用完畢" },
      })
    ).toBe(1);

    await reset(lesson.id, period!.id);

    // 課卡退還 → 使用完畢事件被清除
    expect(
      (await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } }))
        .remainingSessions
    ).toBe(1);
    expect(
      await prisma.event.count({
        where: { studentId: student.id, title: "課卡使用完畢" },
      })
    ).toBe(0);
  });
});
