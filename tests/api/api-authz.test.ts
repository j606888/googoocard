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
  jsonRequest,
  routeParams,
} from "../factories";

// auth.classroomId 指向「我的」教室。classroomId = 0 代表「未登入」
// （decodeAuthToken 在無有效 cookie 時回傳空物件）。
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as studentGet, PATCH as studentPatch } from "@/app/api/students/[id]/route";
import { GET as studentListGet, POST as studentPost } from "@/app/api/students/route";
import { GET as studentCardsGet } from "@/app/api/students/[id]/student-cards/route";
import { GET as studentEventsGet } from "@/app/api/students/[id]/events/route";
import { GET as lessonGet } from "@/app/api/lessons/[id]/route";
import { GET as periodAttendanceGet } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { GET as lessonStudentsGet } from "@/app/api/lessons/[id]/students/route";
import { GET as lessonStudentCardsGet } from "@/app/api/lessons/[id]/students/[studentId]/student-cards/route";
import { POST as checkStudentCards } from "@/app/api/lessons/[id]/check-student-cards/route";
import { PATCH as cardPatch } from "@/app/api/cards/[id]/route";
import { POST as studentTagPost } from "@/app/api/students/[id]/tags/route";
import { GET as publicStudentGet } from "@/app/api/public-students/[randomKey]/route";

// 三個「拿到就等於拿到權限」的欄位，任何 API 回應都不該出現：
// - lineBindKey：傳給 LINE bot 就能把該學生綁到自己的 LINE 帳號（形同接管）
// - lineUserId：學生的 LINE 帳號 id
// - checkinKey：整間教室的現場 QR 自助簽到金鑰
const SECRET_FIELDS = ["lineBindKey", "lineUserId", "checkinKey"] as const;

function findSecrets(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findSecrets(item, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      (SECRET_FIELDS as readonly string[]).includes(key)
        ? [`${path}.${key}`]
        : findSecrets(child, `${path}.${key}`)
    );
  }
  return [];
}

async function seedForeignClassroom() {
  const user = await prisma.user.create({
    data: { email: "foreign@test.local", name: "Foreign", password: "x" },
  });
  const classroom = await prisma.classroom.create({
    data: { ownerId: user.id, name: "Foreign Classroom", checkinKey: "foreignkey" },
  });
  const student = await createStudent(classroom.id, { name: "Foreign Student" });
  const card = await createCard(classroom.id, { name: "Foreign Card" });
  const { lesson } = await createLesson(classroom.id, {
    danceType: DanceType.BACHATA,
    cardIds: [card.id],
    withPeriod: true,
  });
  return { classroom, student, card, lesson };
}

describe("API 授權邊界", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("未登入時一律擋下（這些 route 曾經完全沒有驗證）", () => {
    beforeEach(() => {
      auth.classroomId = undefined;
    });

    it("GET /api/students/[id] 未登入回 401", async () => {
      const res = await studentGet(jsonRequest("GET"), routeParams({ id: "1" }));
      expect(res.status).toBe(401);
    });

    // 已改用 apiRoute 包裝的 route 在 wrapper 層就回 401（根本沒進 handler），
    // 尚未遷移的則是 handler 內查不到資源而回 404。兩者都算擋下。
    it("GET /api/students/[id]/student-cards 未登入不回資料", async () => {
      const res = await studentCardsGet(jsonRequest("GET"), routeParams({ id: "1" }));
      expect(res.status).toBe(401);
    });

    it("GET /api/students/[id]/events 未登入不回資料", async () => {
      const res = await studentEventsGet(jsonRequest("GET"), routeParams({ id: "1" }));
      expect(res.status).toBe(404);
    });

    it("GET /api/lessons/[id]/students 未登入不回資料", async () => {
      const res = await lessonStudentsGet(jsonRequest("GET"), routeParams({ id: "1" }));
      expect(res.status).toBe(404);
    });

    it("GET /api/lessons/[id]/students/[studentId]/student-cards 未登入不回資料", async () => {
      const res = await lessonStudentCardsGet(
        jsonRequest("GET"),
        routeParams({ id: "1", studentId: "1" })
      );
      expect(res.status).toBe(404);
    });

    it("POST /api/lessons/[id]/check-student-cards 未登入不回資料", async () => {
      const res = await checkStudentCards(
        jsonRequest("POST", { studentIds: [1, 2, 3] }),
        routeParams({ id: "1" })
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/lessons/[id] 未登入不回資料", async () => {
      const res = await lessonGet(jsonRequest("GET"), routeParams({ id: "1" }));
      expect(res.status).toBe(404);
    });

    it("GET /api/lessons/[id]/periods/[periodId]/attendance 未登入不回資料", async () => {
      const res = await periodAttendanceGet(
        jsonRequest("GET"),
        routeParams({ id: "1", periodId: "1" })
      );
      expect(res.status).toBe(404);
    });
  });

  describe("跨教室資源一律回 404（不洩漏存在與否）", () => {
    it("讀不到別間教室的學生", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await studentGet(
        jsonRequest("GET"),
        routeParams({ id: String(foreign.student.id) })
      );
      expect(res.status).toBe(404);
    });

    it("改不到別間教室的學生", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await studentPatch(
        jsonRequest("PATCH", { name: "Hijacked" }),
        routeParams({ id: String(foreign.student.id) })
      );
      expect(res.status).toBe(404);

      const after = await prisma.student.findUnique({ where: { id: foreign.student.id } });
      expect(after?.name).toBe("Foreign Student");
    });

    it("改不到別間教室的課卡價格", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await cardPatch(
        jsonRequest("PATCH", { name: "Hijacked", price: 1, sessions: 99 }),
        routeParams({ id: String(foreign.card.id) })
      );
      expect(res.status).toBe(404);

      const after = await prisma.card.findUnique({ where: { id: foreign.card.id } });
      expect(after?.price).toBe(3000);
    });

    it("掛不了 tag 到別間教室的學生", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await studentTagPost(
        jsonRequest("POST", { tagName: "Hijacked" }),
        routeParams({ id: String(foreign.student.id) })
      );
      expect(res.status).toBe(404);

      const tags = await prisma.studentTag.count({ where: { studentId: foreign.student.id } });
      expect(tags).toBe(0);
    });

    it("讀不到別間教室的課程名單", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await lessonStudentsGet(
        jsonRequest("GET"),
        routeParams({ id: String(foreign.lesson.id) })
      );
      expect(res.status).toBe(404);
    });

    it("讀不到別間教室的課程本身", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();

      const res = await lessonGet(
        jsonRequest("GET"),
        routeParams({ id: String(foreign.lesson.id) })
      );
      expect(res.status).toBe(404);
    });

    it("讀不到別間教室的時段點名紀錄", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const foreign = await seedForeignClassroom();
      const foreignPeriod = await prisma.lessonPeriod.findFirstOrThrow({
        where: { lessonId: foreign.lesson.id },
      });

      const res = await periodAttendanceGet(
        jsonRequest("GET"),
        routeParams({ id: String(foreign.lesson.id), periodId: String(foreignPeriod.id) })
      );
      expect(res.status).toBe(404);
    });

    it("不能拿別間教室的 periodId 搭自己的 lessonId 取得紀錄", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const myCard = await createCard(mine.id);
      const { lesson: myLesson } = await createLesson(mine.id, {
        danceType: DanceType.BACHATA,
        cardIds: [myCard.id],
        withPeriod: true,
      });
      const foreign = await seedForeignClassroom();
      const foreignPeriod = await prisma.lessonPeriod.findFirstOrThrow({
        where: { lessonId: foreign.lesson.id },
      });

      const res = await periodAttendanceGet(
        jsonRequest("GET"),
        routeParams({ id: String(myLesson.id), periodId: String(foreignPeriod.id) })
      );
      expect(res.status).toBe(404);
    });

    it("check-student-cards 不回別間教室學生的結果", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const myCard = await createCard(mine.id);
      const { lesson } = await createLesson(mine.id, {
        danceType: DanceType.BACHATA,
        cardIds: [myCard.id],
        withPeriod: true,
      });
      const foreign = await seedForeignClassroom();

      const res = await checkStudentCards(
        jsonRequest("POST", { studentIds: [foreign.student.id] }),
        routeParams({ id: String(lesson.id) })
      );
      expect(res.status).toBe(200);
      // 別間教室的學生根本不該出現在結果裡 —— 連「沒有有效課卡」都不該透露。
      const body = await res.json();
      expect(body.invalidStudentIds).toEqual([]);
    });
  });

  describe("回應不得洩漏權杖欄位", () => {
    it("GET /api/students/[id] 不含 lineBindKey / lineUserId / checkinKey", async () => {
      const mine = await createClassroom();
      await prisma.classroom.update({
        where: { id: mine.id },
        data: { checkinKey: "mykey12345" },
      });
      auth.classroomId = mine.id;
      const student = await createStudent(mine.id);
      await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123" },
      });

      const res = await studentGet(
        jsonRequest("GET"),
        routeParams({ id: String(student.id) })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(findSecrets(body)).toEqual([]);
      // 老師端仍需要分享連結的 randomKey。
      expect(body).toHaveProperty("randomKey");
    });

    it("GET /api/students 列表不含權杖欄位", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const student = await createStudent(mine.id);
      await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123" },
      });

      const res = await studentListGet(new Request("http://test.local/api/students"));
      const body = await res.json();
      expect(findSecrets(body)).toEqual([]);
    });

    it("公開分享頁不含 lineBindKey / randomKey / checkinKey", async () => {
      const mine = await createClassroom();
      await prisma.classroom.update({
        where: { id: mine.id },
        data: { checkinKey: "mykey12345" },
      });
      const student = await createStudent(mine.id);
      const updated = await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123", randomKey: "sharetoken" },
      });

      const res = await publicStudentGet(
        jsonRequest("GET"),
        routeParams({ randomKey: updated.randomKey! })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(findSecrets(body)).toEqual([]);
      // 分享連結的持有者不該再拿到可再散播的權杖。
      expect(body).not.toHaveProperty("randomKey");
    });

    it("GET /api/lessons/[id] 的學生名單不含權杖欄位", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const card = await createCard(mine.id);
      const { lesson } = await createLesson(mine.id, {
        danceType: DanceType.BACHATA,
        cardIds: [card.id],
        withPeriod: true,
      });
      const student = await createStudent(mine.id);
      await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123" },
      });
      await prisma.lessonStudent.create({
        data: { lessonId: lesson.id, studentId: student.id },
      });

      const res = await lessonGet(
        jsonRequest("GET"),
        routeParams({ id: String(lesson.id) })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.students).toHaveLength(1);
      expect(findSecrets(body)).toEqual([]);
    });

    it("GET /api/lessons/[id]/students 不含權杖欄位", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const card = await createCard(mine.id);
      const { lesson, period } = await createLesson(mine.id, {
        danceType: DanceType.BACHATA,
        cardIds: [card.id],
        withPeriod: true,
      });
      const student = await createStudent(mine.id);
      await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123" },
      });
      await createStudentCard(student.id, card.id);
      await prisma.lessonStudent.create({
        data: { lessonId: lesson.id, studentId: student.id },
      });
      expect(period).toBeTruthy();

      const res = await lessonStudentsGet(
        jsonRequest("GET"),
        routeParams({ id: String(lesson.id) })
      );
      const body = await res.json();
      expect(findSecrets(body)).toEqual([]);
    });

    // 寫入路徑也會回傳學生資料，之前只掃了 GET，PATCH 就漏在這裡。
    it("PATCH /api/students/[id] 不含權杖欄位", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;
      const student = await createStudent(mine.id);
      await prisma.student.update({
        where: { id: student.id },
        data: { lineBindKey: "bindme", lineUserId: "U123" },
      });

      const res = await studentPatch(
        jsonRequest("PATCH", { name: "Renamed", note: "n", avatarUrl: "a.png" }),
        routeParams({ id: String(student.id) })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(findSecrets(body)).toEqual([]);
      expect(body.name).toBe("Renamed");
      // 老師端仍需要分享連結的 randomKey。
      expect(body).toHaveProperty("randomKey");
    });

    it("POST /api/students 不含權杖欄位", async () => {
      const mine = await createClassroom();
      auth.classroomId = mine.id;

      const res = await studentPost(
        jsonRequest("POST", { name: "New Student", avatarUrl: "a.png", note: null })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // 新建的學生還沒有 lineBindKey，所以這裡守的是「不要 spread 整列」的形狀，
      // 而不是某個當下真的有值的欄位。
      expect(Object.keys(body)).not.toContain("lineBindKey");
      expect(Object.keys(body)).not.toContain("lineUserId");
      expect(findSecrets(body)).toEqual([]);
      expect(body).toHaveProperty("randomKey");
    });
  });
});
