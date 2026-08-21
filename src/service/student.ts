import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

// Creates a student and assigns it the next per-classroom sequential
// number (Classroom.nextStudentNumber), atomically. The counter update's
// row-level lock serializes concurrent creates within the same classroom;
// the (classroomId, number) unique constraint on Student is the backstop.
export async function createStudent(
  classroomId: number,
  data: { name: string; avatarUrl: string; note?: string }
) {
  return prisma.$transaction(async (tx) => {
    const classroom = await tx.classroom.update({
      where: { id: classroomId },
      data: { nextStudentNumber: { increment: 1 } },
    });
    return tx.student.create({
      data: {
        ...data,
        classroomId,
        number: classroom.nextStudentNumber - 1,
        randomKey: nanoid(8),
      },
    });
  });
}
