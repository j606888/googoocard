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

// The teacher-side key endpoint reads the cookie JWT; the public endpoints below
// don't touch auth at all (the URL key is the only credential).
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET as board } from "@/app/api/checkin/[key]/route";
import { GET as roster } from "@/app/api/checkin/[key]/students/route";
import { POST as checkin } from "@/app/api/checkin/[key]/checkin/route";
import {
  GET as getKey,
  POST as rotateKey,
} from "@/app/api/checkin-key/route";

const KEY = "wallKey123";

function boardRequest(key: string, studentId?: number) {
  const qs = studentId ? `?studentId=${studentId}` : "";
  return new Request(`http://test.local/api/checkin/${key}${qs}`);
}

function checkinRequest(key: string, body: unknown) {
  return new Request(`http://test.local/api/checkin/${key}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function keyRequest(method: string) {
  return new Request("http://test.local/api/checkin-key", { method });
}

async function createPeriod(lessonId: number, start: Date, end: Date) {
  return prisma.lessonPeriod.create({
    data: { lessonId, startTime: start, endTime: end },
  });
}

// A second classroom (own owner — createClassroom() hardcodes one email).
async function createOtherClassroom() {
  const user = await prisma.user.create({
    data: { email: "other@test.local", name: "Other", password: "x" },
  });
  return prisma.classroom.create({
    data: { ownerId: user.id, name: "Other Classroom" },
  });
}

describe("公開 QR 簽到 API", () => {
  let classroomId: number;
  let studentId: number;
  let cardId: number;
  let lessonId: number;
  let periodId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    await prisma.classroom.update({
      where: { id: classroomId },
      data: { checkinKey: KEY },
    });
    auth.classroomId = classroomId;

    const student = await createStudent(classroomId, { name: "Amy" });
    studentId = student.id;

    const card = await createCard(classroomId, { name: "10 堂卡", sessions: 10 });
    cardId = card.id;

    const { lesson } = await createLesson(classroomId, {
      name: "今日課",
      cardIds: [cardId],
    });
    lessonId = lesson.id;

    const now = new Date();
    const period = await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));
    periodId = period.id;
  });

  describe("GET /api/checkin/[key]", () => {
    it("金鑰錯誤 → 404 invalid_key", async () => {
      const res = await board(boardRequest("nope"), routeParams({ key: "nope" }));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("invalid_key");
    });

    it("回教室名稱與今天的課程時段", async () => {
      const res = await board(boardRequest(KEY), routeParams({ key: KEY }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.classroomName).toBe("Test Classroom");
      expect(body.today).toHaveLength(1);
      expect(body.today[0].lessonName).toBe("今日課");
      expect(body.today[0].periods[0].periodId).toBe(periodId);
      expect(body.today[0].periods[0].alreadyChecked).toBe(false);
    });

    it("帶 studentId → 標出該學生已簽到的時段", async () => {
      await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );

      const res = await board(boardRequest(KEY, studentId), routeParams({ key: KEY }));
      const body = await res.json();
      expect(body.today[0].periods[0].alreadyChecked).toBe(true);
    });

    it("別的教室的 studentId → 忽略，不標已簽到", async () => {
      const other = await createOtherClassroom();
      const outsider = await createStudent(other.id, { name: "Outsider" });

      const res = await board(
        boardRequest(KEY, outsider.id),
        routeParams({ key: KEY })
      );
      const body = await res.json();
      expect(body.today[0].periods[0].alreadyChecked).toBe(false);
    });

    it("今天沒課 → today 空、回 nextLesson", async () => {
      await prisma.lessonPeriod.deleteMany({ where: { lessonId } });
      const future = new Date(Date.now() + 7 * 24 * 3600_000);
      await createPeriod(lessonId, future, new Date(future.getTime() + 3600_000));

      const res = await board(boardRequest(KEY), routeParams({ key: KEY }));
      const body = await res.json();
      expect(body.today).toHaveLength(0);
      expect(body.nextLesson?.lessonName).toBe("今日課");
    });
  });

  describe("GET /api/checkin/[key]/students", () => {
    it("只回該教室學生的 id / name / avatarUrl", async () => {
      const other = await createOtherClassroom();
      await createStudent(other.id, { name: "Outsider" });

      const res = await roster(boardRequest(KEY), routeParams({ key: KEY }));
      expect(res.status).toBe(200);
      const { students } = await res.json();
      expect(students).toHaveLength(1);
      expect(Object.keys(students[0]).sort()).toEqual(["avatarUrl", "id", "name"]);
      expect(students[0].name).toBe("Amy");
    });

    it("今天沒課 → 不外流名單", async () => {
      await prisma.lessonPeriod.deleteMany({ where: { lessonId } });

      const res = await roster(boardRequest(KEY), routeParams({ key: KEY }));
      const { students } = await res.json();
      expect(students).toHaveLength(0);
    });

    it("金鑰錯誤 → 404", async () => {
      const res = await roster(boardRequest("nope"), routeParams({ key: "nope" }));
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/checkin/[key]/checkin", () => {
    it("建立 source=STUDENT 紀錄、扣一堂、不設 attendanceTakenAt", async () => {
      await createStudentCard(studentId, cardId, {
        remainingSessions: 5,
        totalSessions: 5,
      });

      const res = await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0]).toMatchObject({
        periodId,
        status: "checked",
        remainingSessions: 4,
      });

      const record = await prisma.attendanceRecord.findFirst({
        where: { studentId, lessonPeriodId: periodId },
      });
      expect(record?.source).toBe("STUDENT");

      const period = await prisma.lessonPeriod.findUnique({ where: { id: periodId } });
      expect(period?.attendanceTakenAt).toBeNull();

      const sc = await prisma.studentCard.findFirst({ where: { studentId } });
      expect(sc?.remainingSessions).toBe(4);
    });

    it("沒有可用課卡 → 仍簽到成功，只是 status no_card", async () => {
      const res = await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );
      const body = await res.json();
      expect(body.results[0]).toMatchObject({ periodId, status: "no_card" });

      const record = await prisma.attendanceRecord.findFirst({
        where: { studentId, lessonPeriodId: periodId },
      });
      expect(record).not.toBeNull();
      expect(record?.studentCardId).toBeNull();
    });

    it("重複簽到 → already_checked，不重複扣堂", async () => {
      await createStudentCard(studentId, cardId, {
        remainingSessions: 5,
        totalSessions: 5,
      });

      await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );
      const res = await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );
      const body = await res.json();
      expect(body.results[0].status).toBe("already_checked");

      const count = await prisma.attendanceRecord.count({
        where: { studentId, lessonPeriodId: periodId },
      });
      expect(count).toBe(1);
      const sc = await prisma.studentCard.findFirst({ where: { studentId } });
      expect(sc?.remainingSessions).toBe(4);
    });

    it("一次簽兩個時段但課卡只剩一堂 → 一筆 checked、一筆 no_card，兩筆紀錄都建立", async () => {
      await createStudentCard(studentId, cardId, {
        remainingSessions: 1,
        totalSessions: 10,
      });
      const now = new Date();
      const second = await createPeriod(
        lessonId,
        new Date(now.getTime() + 3600_000),
        new Date(now.getTime() + 7200_000)
      );

      const res = await checkin(
        checkinRequest(KEY, {
          studentId,
          lessonId,
          periodIds: [periodId, second.id],
        }),
        routeParams({ key: KEY })
      );
      const body = await res.json();
      expect(body.results).toHaveLength(2);
      expect(body.results[0]).toMatchObject({ status: "checked", exhausted: true });
      expect(body.results[1]).toMatchObject({ status: "no_card" });

      const count = await prisma.attendanceRecord.count({ where: { studentId } });
      expect(count).toBe(2);
    });

    it("別的教室的學生 → 403", async () => {
      const other = await createOtherClassroom();
      const outsider = await createStudent(other.id, { name: "Outsider" });

      const res = await checkin(
        checkinRequest(KEY, { studentId: outsider.id, lessonId, periodIds: [periodId] }),
        routeParams({ key: KEY })
      );
      expect(res.status).toBe(403);
    });

    it("別的教室的課程 → 404", async () => {
      const other = await createOtherClassroom();
      const { lesson: otherLesson } = await createLesson(other.id);
      const now = new Date();
      const otherPeriod = await createPeriod(
        otherLesson.id,
        now,
        new Date(now.getTime() + 3600_000)
      );

      const res = await checkin(
        checkinRequest(KEY, {
          studentId,
          lessonId: otherLesson.id,
          periodIds: [otherPeriod.id],
        }),
        routeParams({ key: KEY })
      );
      expect(res.status).toBe(404);
    });

    it("不是今天的時段 → 400 period_not_today", async () => {
      const future = new Date(Date.now() + 7 * 24 * 3600_000);
      const futurePeriod = await createPeriod(
        lessonId,
        future,
        new Date(future.getTime() + 3600_000)
      );

      const res = await checkin(
        checkinRequest(KEY, {
          studentId,
          lessonId,
          periodIds: [futurePeriod.id],
        }),
        routeParams({ key: KEY })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("period_not_today");

      const count = await prisma.attendanceRecord.count({ where: { studentId } });
      expect(count).toBe(0);
    });

    it("periodIds 為空 → 400", async () => {
      const res = await checkin(
        checkinRequest(KEY, { studentId, lessonId, periodIds: [] }),
        routeParams({ key: KEY })
      );
      expect(res.status).toBe(400);
    });

    it("金鑰錯誤 → 404，且不建立紀錄", async () => {
      const res = await checkin(
        checkinRequest("nope", { studentId, lessonId, periodIds: [periodId] }),
        routeParams({ key: "nope" })
      );
      expect(res.status).toBe(404);
      const count = await prisma.attendanceRecord.count({ where: { studentId } });
      expect(count).toBe(0);
    });
  });

  describe("/api/checkin-key（老師端）", () => {
    it("尚未有金鑰時，第一次讀取就產生一組", async () => {
      await prisma.classroom.update({
        where: { id: classroomId },
        data: { checkinKey: null },
      });

      const res = await getKey(keyRequest("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.key).toBeTruthy();
      expect(body.url).toContain(`/checkin/${body.key}`);

      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
      });
      expect(classroom?.checkinKey).toBe(body.key);
    });

    it("重新產生後，舊金鑰立刻失效", async () => {
      const res = await rotateKey(keyRequest("POST"));
      const { key: newKey } = await res.json();
      expect(newKey).not.toBe(KEY);

      const oldRes = await board(boardRequest(KEY), routeParams({ key: KEY }));
      expect(oldRes.status).toBe(404);

      const newRes = await board(
        boardRequest(newKey),
        routeParams({ key: newKey })
      );
      expect(newRes.status).toBe(200);
    });

    it("未登入（沒有教室）→ 401", async () => {
      auth.classroomId = 0;
      const res = await getKey(keyRequest("GET"));
      expect(res.status).toBe(401);
    });
  });
});
