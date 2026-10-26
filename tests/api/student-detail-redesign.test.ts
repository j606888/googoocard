import { describe, it, expect, beforeEach, vi } from "vitest";
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
import { attendanceCounts, buildStudentDetailPayload } from "@/service/studentDetail";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET as LIST } from "@/app/api/students/route";
import { GET as DETAIL, PATCH } from "@/app/api/students/[id]/route";
import { POST as BUY } from "@/app/api/students/[id]/student-cards/route";

const at = (iso: string) => ({ lessonPeriod: { startTime: new Date(iso) } });

describe("attendanceCounts（台北時區分月）", () => {
  it("依上課日算本月／上月，跨月邊界以台北時間為準", () => {
    const now = new Date("2026-10-13T04:00:00Z"); // 台北 10/13 中午
    const counts = attendanceCounts(
      [
        at("2026-10-01T11:30:00Z"), // 10/1 19:30 → 本月
        at("2026-09-30T16:30:00Z"), // 台北 10/1 00:30 → 本月（UTC 還是 9 月）
        at("2026-09-30T15:30:00Z"), // 台北 9/30 23:30 → 上月
        at("2026-08-20T11:30:00Z"), // 更早
      ],
      now
    );
    expect(counts).toEqual({ attendedCount: 4, thisMonthCount: 2, lastMonthCount: 1 });
  });

  it("一月的上月是去年十二月", () => {
    const counts = attendanceCounts(
      [at("2026-12-15T11:00:00Z"), at("2027-01-02T11:00:00Z")],
      new Date("2027-01-10T04:00:00Z")
    );
    expect(counts).toEqual({ attendedCount: 2, thisMonthCount: 1, lastMonthCount: 1 });
  });
});

describe("學生詳情 API 的新欄位", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("attendedCount 算出席時段數，不是報名門數；每筆出席帶卡號、來源與待確認", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "8 堂卡" });
    const studentCard = await createStudentCard(student.id, card.id);
    const { lesson } = await createLesson(classroomId, { name: "Bachata Lv2" });
    const p1 = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-09-24T11:30:00Z"),
        endTime: new Date("2026-09-24T13:00:00Z"),
        attendanceTakenAt: new Date("2026-09-24T16:03:00Z"),
      },
    });
    const p2 = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-10-01T11:30:00Z"),
        endTime: new Date("2026-10-01T13:00:00Z"),
      },
    });
    await prisma.lessonStudent.create({ data: { lessonId: lesson.id, studentId: student.id } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: p1.id, studentId: student.id, studentCardId: studentCard.id },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: p2.id, studentId: student.id, studentCardId: null, source: "STUDENT" },
    });

    const res = await DETAIL(new Request("http://test.local"), routeParams({ id: String(student.id) }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.overview.attendedCount).toBe(2);
    expect(body.overview.lastAttendLessonName).toBe("Bachata Lv2");
    expect(body.overview).not.toHaveProperty("attendLessonCount");

    // 新的在前
    const [latest, earlier] = body.attendancesByDate;
    expect(latest.attendances[0]).toMatchObject({
      lessonName: "Bachata Lv2",
      periodNumber: 2,
      totalPeriods: 2,
      source: "STUDENT",
      pending: true,
      studentCard: null,
    });
    expect(latest.attendances[0].danceStyle.name).toBe("Bachata");
    expect(earlier.attendances[0]).toMatchObject({
      source: "TEACHER",
      pending: false,
      studentCard: { id: studentCard.id, serialNumber: studentCard.serialNumber, name: "8 堂卡" },
    });

    const usage = body.studentCards.find((c: { id: number }) => c.id === studentCard.id).attendanceRecords;
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ lessonName: "Bachata Lv2", source: "TEACHER", pending: false });

    // 依課程：課的舞種／階級／狀態，每個時段帶第 N 堂、扣的卡與 pending
    const [byLesson] = body.attendancesByLesson;
    expect(byLesson).toMatchObject({ lessonId: lesson.id, level: lesson.level, status: "inProgress", totalPeriods: 2 });
    expect(byLesson.danceStyle.name).toBe("Bachata");
    expect(byLesson.studentAttendances).toMatchObject([
      {
        periodId: p1.id,
        periodNumber: 1,
        periodAttendantCheck: true,
        studentAttend: true,
        pending: false,
        studentCard: { id: studentCard.id, serialNumber: studentCard.serialNumber, name: "8 堂卡" },
      },
      { periodId: p2.id, periodNumber: 2, periodAttendantCheck: false, studentAttend: true, pending: true, studentCard: null },
    ]);
  });

  it("購買課卡時可以一起寫備註，空白當作沒填", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);

    const withNote = await BUY(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, note: "  朋友介紹  " }),
      routeParams({ id: String(student.id) })
    );
    expect(withNote.status).toBe(200);
    expect((await withNote.json()).note).toBe("朋友介紹");

    const blank = await BUY(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, note: "   " }),
      routeParams({ id: String(student.id) })
    );
    expect((await blank.json()).note).toBeNull();

    const tooLong = await BUY(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, note: "字".repeat(501) }),
      routeParams({ id: String(student.id) })
    );
    expect(tooLong.status).toBe(400);
  });
});

describe("封存學生", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  const list = async (params = "") =>
    (await (await LIST(new Request(`http://test.local/api/students${params}`))).json()) as {
      name: string;
      archivedAt: string | null;
    }[];

  it("封存後從名單消失、出現在已封存清單；還原後回來，資料保留", async () => {
    const amy = await createStudent(classroomId, { name: "Amy" });
    await createStudent(classroomId, { name: "Ben" });
    const card = await createCard(classroomId);
    await createStudentCard(amy.id, card.id);

    const res = await PATCH(jsonRequest("PATCH", { archived: true }), routeParams({ id: String(amy.id) }));
    expect(res.status).toBe(200);
    expect((await res.json()).archivedAt).not.toBeNull();

    expect((await list()).map((s) => s.name)).toEqual(["Ben"]);
    expect((await list("?archived=1")).map((s) => s.name)).toEqual(["Amy"]);
    // 只改封存狀態，名字和課卡都不動
    const row = await prisma.student.findUniqueOrThrow({
      where: { id: amy.id },
      include: { studentCards: true },
    });
    expect(row.name).toBe("Amy");
    expect(row.studentCards).toHaveLength(1);

    await PATCH(jsonRequest("PATCH", { archived: false }), routeParams({ id: String(amy.id) }));
    expect((await list()).map((s) => s.name)).toEqual(["Amy", "Ben"]);
  });

  it("archived 不是布林就 400", async () => {
    const amy = await createStudent(classroomId);
    const res = await PATCH(jsonRequest("PATCH", { archived: "yes" }), routeParams({ id: String(amy.id) }));
    expect(res.status).toBe(400);
  });
});

describe("公開頁／LIFF 的學生總覽（buildStudentDetailPayload）", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("課卡數與消費金額只算買的卡，跟老師端一致", async () => {
    const classroom = await createClassroom();
    const student = await createStudent(classroom.id);
    const card = await createCard(classroom.id);
    await createStudentCard(student.id, card.id, { finalPrice: 3000 });
    await createStudentCard(student.id, card.id, { finalPrice: 1500, origin: "CONVERSION" });
    await createStudentCard(student.id, card.id, { finalPrice: 800, origin: "TRANSFER" });

    const payload = await buildStudentDetailPayload(student.id);
    expect(payload?.overview.cardCount).toBe(1);
    expect(payload?.overview.totalSpend).toBe(3000);
    // 課卡列表本身還是全部列出
    expect(payload?.studentCards).toHaveLength(3);
  });
});
