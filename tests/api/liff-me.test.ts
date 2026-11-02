import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, createCard, createStudentCard, createLesson } from "../factories";

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { GET } from "@/app/api/liff/me/route";

function liffRequest(token: string | null, studentId?: number) {
  const url = studentId
    ? `http://test.local/api/liff/me?studentId=${studentId}`
    : "http://test.local/api/liff/me";
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function bindStudent(studentId: number, lineUserId: string) {
  await prisma.student.update({ where: { id: studentId }, data: { lineUserId } });
}

describe("GET /api/liff/me", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("無效 token → 401", async () => {
    const res = await GET(liffRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("缺少 Authorization → 401", async () => {
    const res = await GET(liffRequest(null));
    expect(res.status).toBe(401);
  });

  it("未綁定任何學生 → 403 not_bound", async () => {
    const res = await GET(liffRequest("lineGhost"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_bound");
  });

  it("綁定單一學生 → 直接回該生明細", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });
    await bindStudent(student.id, "lineA");

    const res = await GET(liffRequest("lineA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(student.id);
    expect(body.name).toBe("Amy");
    expect(body.overview).toBeDefined();
    expect(body.studentCards).toBeDefined();
  });

  it("綁定多個學生 → 回 needsSelection 清單", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsSelection).toBe(true);
    expect(body.students.map((s: { id: number }) => s.id).sort()).toEqual(
      [s1.id, s2.id].sort()
    );
  });

  it("帶 studentId 指定自己綁定的學生 → 回該生明細", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti", s2.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(s2.id);
  });

  it("帶 studentId 指定別人的學生 → 403 forbidden（防越權）", async () => {
    const mine = await createStudent(classroomId, { name: "Mine" });
    const other = await createStudent(classroomId, { name: "Other" });
    await bindStudent(mine.id, "lineMe");
    await bindStudent(other.id, "lineOther");

    const res = await GET(liffRequest("lineMe", other.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("回應帶 boundStudents（含跨教室清單，供 LIFF 切換學生用）", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti", s1.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(s1.id);
    expect(body.boundStudents.map((s: { id: number }) => s.id).sort()).toEqual(
      [s1.id, s2.id].sort()
    );
  });

  describe("到期日與缺席（財務）", () => {
    async function cardWithAbsence() {
      const student = await createStudent(classroomId, { name: "Amy" });
      await bindStudent(student.id, "lineFin");
      const card = await createCard(classroomId, { name: "8 堂卡" });
      const studentCard = await createStudentCard(student.id, card.id);
      const { lesson } = await createLesson(classroomId, { name: "Salsa" });
      const period = await prisma.lessonPeriod.create({
        data: {
          lessonId: lesson.id,
          startTime: new Date("2026-11-12T11:30:00Z"),
          endTime: new Date("2026-11-12T13:00:00Z"),
        },
      });
      await prisma.attendanceAbsence.create({
        data: { lessonPeriodId: period.id, studentId: student.id, studentCardId: studentCard.id, sessionsUsed: 1 },
      });
      return studentCard;
    }

    it("liff me returns expiresAt and absences for bound card", async () => {
      const studentCard = await cardWithAbsence();
      await prisma.studentCard.update({
        where: { id: studentCard.id },
        data: { expiresAt: new Date("2099-05-04T00:00:00Z") },
      });
      const res = await GET(liffRequest("lineFin"));
      const body = await res.json();
      const c = body.studentCards.find((x: { id: number }) => x.id === studentCard.id);
      expect(c.expiresAt).toBe("2099-05-04T00:00:00.000Z");
      expect(c.absences).toEqual([{ date: "2026-11-12", lessonName: "Salsa" }]);
    });

    it("finance disabled returns nulls", async () => {
      const student = await createStudent(classroomId, { name: "Bob" });
      await bindStudent(student.id, "lineNoFin");
      const card = await createCard(classroomId);
      const studentCard = await createStudentCard(student.id, card.id);
      const res = await GET(liffRequest("lineNoFin"));
      const c = (await res.json()).studentCards.find((x: { id: number }) => x.id === studentCard.id);
      expect(c.expiresAt).toBeNull();
      expect(c.absences).toEqual([]);
    });
  });
});
