import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * A student together with the cards that could be spent on one lesson, plus the
 * dance qualifications needed to judge practice cards (`canUseCard`).
 *
 * The `studentCards` here are only *candidates* — the WHERE below narrows to
 * cards the lesson accepts and that still have sessions left, but qualification
 * is a pure rule and stays out of SQL. Callers must still run `canUseCard`.
 */
export type StudentWithLessonCards = Prisma.StudentGetPayload<{
  include: {
    studentCards: {
      include: {
        card: true;
      };
    };
    danceQualifications: true;
  };
}>;

/**
 * Shared by the attendance engine (which deducts a session) and the lesson
 * roster endpoint (which only reports what is spendable).
 *
 * `classroomId` is required, not optional: without it a caller could pass
 * student ids from another classroom and have their cards read or deducted —
 * the route guards only prove the LESSON belongs to the caller, not the
 * students. See docs/roadmap.md P0-3.
 */
export async function fetchStudentsWithValidCards(
  studentIds: number[],
  validCardIds: number[],
  classroomId: number
): Promise<StudentWithLessonCards[]> {
  return prisma.student.findMany({
    where: {
      id: { in: studentIds },
      classroomId,
    },
    include: {
      studentCards: {
        where: {
          cardId: { in: validCardIds },
          remainingSessions: { gt: 0 },
          expiredAt: null,
        },
        include: {
          card: true,
        },
      },
      danceQualifications: true,
    },
  });
}
