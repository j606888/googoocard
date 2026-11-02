import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createStudent,
  createStudentCard,
  createCard,
  createVenue,
  createVenuePack,
  createTeacher,
  enableFinanceFor,
} from "../factories";

describe("finance schema", () => {
  beforeEach(resetDb);

  it("creates venue, venue pack and finance flags", async () => {
    const classroom = await createClassroom();
    const venue = await createVenue(classroom.id, { name: "A 場地" });
    const pack = await createVenuePack(classroom.id, venue.id, {
      sessions: 10,
      price: 3000,
      paidByUserId: classroom.ownerId,
    });
    expect(pack.voidedAt).toBeNull();
    const teacher = await createTeacher(classroom.id, { name: "T", payerUserId: classroom.ownerId });
    expect(teacher.payerUserId).toBe(classroom.ownerId);

    await enableFinanceFor(classroom.id, { launch: new Date("2026-11-01T00:00:00Z") });
    const c = await prisma.classroom.findUniqueOrThrow({ where: { id: classroom.id } });
    expect(c.financeEnabledAt).not.toBeNull();
    expect(c.financeRoundTo).toBe(1);
  });

  it("rejects a second absence for the same period + student", async () => {
    const classroom = await createClassroom();
    const { lesson } = await createLesson(classroom.id);
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime: new Date(), endTime: new Date(Date.now() + 3600_000) },
    });
    const student = await createStudent(classroom.id);
    const base = await createCard(classroom.id);
    const card = await createStudentCard(student.id, base.id);
    const data = { lessonPeriodId: period.id, studentId: student.id, studentCardId: card.id, sessionsUsed: 1 };
    await prisma.attendanceAbsence.create({ data });
    await expect(prisma.attendanceAbsence.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });
});
