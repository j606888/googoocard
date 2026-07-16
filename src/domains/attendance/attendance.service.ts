import { AttendanceSource, Prisma, StudentCard } from "@prisma/client";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";
import { refreshNeedsRenewalTags } from "@/service/studentTag";
import { canUseCard, cardMatchesLesson, isQualified, requiredDanceTypeFor } from "@/domains/qualification";

type LessonWithCards = Prisma.LessonGetPayload<{
  include: {
    cards: {
      include: {
        card: true;
      };
    };
  };
}>;

type StudentWithCards = Prisma.StudentGetPayload<{
  include: {
    studentCards: {
      include: {
        card: true;
      };
    };
    danceQualifications: true;
  };
}>;

async function validateAttendanceRequest(
  lessonId: number,
  lessonPeriodId: number
): Promise<{ lesson: LessonWithCards; lessonPeriod: { id: number; attendanceTakenAt: Date | null } }> {
  const [lesson, lessonPeriod] = await Promise.all([
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    }),
    prisma.lessonPeriod.findUnique({
      where: { id: lessonPeriodId, lessonId },
    }),
  ]);

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  if (!lessonPeriod) {
    throw new Error("Lesson period not found");
  }

  if (lessonPeriod.attendanceTakenAt) {
    throw new Error("Attendance already taken");
  }

  return { lesson, lessonPeriod };
}

async function validateUpdateAttendanceRequest(
  lessonId: number,
  lessonPeriodId: number
): Promise<{ lesson: LessonWithCards; lessonPeriod: { id: number; attendanceTakenAt: Date | null } }> {
  const [lesson, lessonPeriod] = await Promise.all([
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    }),
    prisma.lessonPeriod.findUnique({
      where: { id: lessonPeriodId, lessonId },
    }),
  ]);

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  if (!lessonPeriod) {
    throw new Error("Lesson period not found");
  }

  return { lesson, lessonPeriod };
}


async function fetchStudentsWithValidCards(
  studentIds: number[],
  validCardIds: number[]
): Promise<StudentWithCards[]> {
  return prisma.student.findMany({
    where: {
      id: { in: studentIds },
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

function selectStudentCard(
  student: StudentWithCards,
  lesson: LessonWithCards
): StudentWithCards["studentCards"][number] | null {
  const qualifications = student.danceQualifications.map((q) => q.danceType);
  const shouldForcePracticeCard = shouldUsePracticePriority(lesson, student);

  if (shouldForcePracticeCard) {
    const practiceCards = student.studentCards.filter(
      (studentCard) =>
        studentCard.card.isPracticeCard &&
        canUseCard(studentCard.card, qualifications, lesson.danceType)
    );
    return getRecommendedStudentCard(practiceCards);
  }

  const usableCards = student.studentCards.filter((studentCard) =>
    canUseCard(studentCard.card, qualifications, lesson.danceType)
  );

  if (usableCards.length === 1) {
    return usableCards[0];
  }
  return null;
}

function shouldUsePracticePriority(
  lesson: LessonWithCards,
  student: StudentWithCards
) {
  const qualifications = student.danceQualifications.map((q) => q.danceType);

  // Practice priority applies when the lesson accepts a practice card the
  // student is qualified to use.
  return lesson.cards.some(({ card }) => {
    if (!card.isPracticeCard || !cardMatchesLesson(card, lesson.danceType)) {
      return false;
    }
    const required = requiredDanceTypeFor(card, lesson.danceType);
    return required !== null && isQualified(qualifications, required);
  });
}

function getRecommendedStudentCard(cards: StudentWithCards["studentCards"]) {
  if (cards.length === 0) {
    return null;
  }

  return [...cards].sort((a, b) => {
    if (a.remainingSessions !== b.remainingSessions) {
      return a.remainingSessions - b.remainingSessions;
    }

    if (a.expiredAt && b.expiredAt) {
      return new Date(a.expiredAt).getTime() - new Date(b.expiredAt).getTime();
    }

    if (a.expiredAt) {
      return -1;
    }

    if (b.expiredAt) {
      return 1;
    }

    return a.id - b.id;
  })[0];
}

async function createAttendanceRecord(
  tx: Prisma.TransactionClient,
  lessonId: number,
  lessonPeriodId: number,
  studentId: number,
  studentCardId: number | null,
  source: AttendanceSource = AttendanceSource.TEACHER
) {
  // Ensure lesson-student relationship exists
  await tx.lessonStudent.upsert({
    where: {
      lessonId_studentId: {
        lessonId,
        studentId,
      },
    },
    update: {},
    create: {
      lessonId,
      studentId,
    },
  });

  // Create attendance record
  const attendanceRecord = await tx.attendanceRecord.create({
    data: {
      lessonPeriodId,
      studentId,
      studentCardId,
      source,
    },
  });

  return attendanceRecord;
}

async function createAttendanceEvent(
  tx: Prisma.TransactionClient,
  lessonName: string,
  studentId: number,
  attendanceRecordId: number
) {
  await tx.event.create({
    data: {
      title: "簽到",
      description: `${lessonName} 簽到成功`,
      studentId,
      resourceType: "attendanceRecord",
      resourceId: attendanceRecordId,
    },
  });
}

async function processStudentCardUsage(
  tx: Prisma.TransactionClient,
  studentCard: StudentCard,
  studentId: number
) {
  // Guarded decrement: only deduct while sessions remain, so a card can never
  // be driven negative by a concurrent deduction (race between self check-in and
  // teacher finalize, or two requests on the same card).
  const { count } = await tx.studentCard.updateMany({
    where: { id: studentCard.id, remainingSessions: { gt: 0 } },
    data: {
      remainingSessions: { decrement: 1 },
    },
  });

  // The card was already exhausted by a concurrent op — nothing deducted.
  if (count === 0) {
    return;
  }

  const updatedStudentCard = await tx.studentCard.findUnique({
    where: { id: studentCard.id },
    include: { card: true },
  });

  // Create event if card is exhausted
  if (updatedStudentCard && updatedStudentCard.remainingSessions === 0) {
    await tx.event.create({
      data: {
        title: "課卡使用完畢",
        description: `課卡 ${updatedStudentCard.card.name} 使用完畢`,
        studentId,
        resourceType: "studentCard",
        resourceId: updatedStudentCard.id,
      },
    });
  }
}

async function processStudentAttendance(
  tx: Prisma.TransactionClient,
  lesson: LessonWithCards,
  lessonPeriodId: number,
  student: StudentWithCards
) {
  const studentCard = selectStudentCard(student, lesson);

  const attendanceRecord = await createAttendanceRecord(
    tx,
    lesson.id,
    lessonPeriodId,
    student.id,
    studentCard?.id ?? null
  );

  await createAttendanceEvent(tx, lesson.name, student.id, attendanceRecord.id);

  if (studentCard) {
    await processStudentCardUsage(tx, studentCard, student.id);
  }
}

async function markAttendanceTaken(
  tx: Prisma.TransactionClient,
  lessonPeriodId: number
) {
  await tx.lessonPeriod.update({
    where: { id: lessonPeriodId },
    data: {
      attendanceTakenAt: new Date(),
    },
  });
}

async function getAttendanceDifferences(
  lessonPeriodId: number,
  newStudentIds: number[]
): Promise<{
  newStudentIds: number[];
  removedStudentIds: number[];
}> {
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { lessonPeriodId },
    include: { studentCard: true },
  });

  const existingStudentIds = existingRecords.map((r) => r.studentId);
  const newIds = newStudentIds.filter((id) => !existingStudentIds.includes(id));
  const removedIds = existingStudentIds.filter((id) => !newStudentIds.includes(id));

  return {
    newStudentIds: newIds,
    removedStudentIds: removedIds,
  };
}

async function removeAttendanceRecord(
  tx: Prisma.TransactionClient,
  attendanceRecord: { id: number; studentCardId: number | null }
) {
  // Refund the card session if a card was used
  if (attendanceRecord.studentCardId) {
    await tx.studentCard.update({
      where: { id: attendanceRecord.studentCardId },
      data: {
        remainingSessions: { increment: 1 },
      },
    });

    // The card is no longer exhausted — drop its stale "課卡使用完畢" event.
    await tx.event.deleteMany({
      where: {
        resourceType: "studentCard",
        title: "課卡使用完畢",
        resourceId: attendanceRecord.studentCardId,
      },
    });
  }

  // Delete the attendance record + its "簽到" audit event
  await tx.event.deleteMany({
    where: {
      resourceType: "attendanceRecord",
      resourceId: attendanceRecord.id,
    },
  });
  await tx.attendanceRecord.delete({
    where: { id: attendanceRecord.id },
  });
}

/**
 * Reconcile a period's attendance to the given student set, then finalize it.
 *
 * `studentIds` is authoritative: students not yet recorded are added (card
 * deducted), students whose existing record is no longer selected are removed
 * (card refunded), and students that already have a record are left untouched.
 *
 * Leaving existing records untouched is what makes this safe to run on a period
 * that students already self-checked-in to (`source = STUDENT`): re-finalizing
 * with that student still selected neither duplicates the record nor
 * double-charges the card.
 */
async function reconcileAndFinalize(
  lesson: LessonWithCards,
  lessonPeriodId: number,
  studentIds: number[]
) {
  // Get valid card IDs for this lesson
  const validCardIds = lesson.cards.map((card) => card.cardId);

  // Calculate which students to add and remove
  const { newStudentIds, removedStudentIds } = await getAttendanceDifferences(
    lessonPeriodId,
    studentIds
  );

  // Fetch new students with their valid cards
  const newStudents =
    newStudentIds.length > 0
      ? await fetchStudentsWithValidCards(newStudentIds, validCardIds)
      : [];

  // Process updates in a transaction
  await prisma.$transaction(async (tx) => {
    // Add new attendance records
    for (const student of newStudents) {
      await processStudentAttendance(tx, lesson, lessonPeriodId, student);
    }

    // Remove attendance records and refund cards
    if (removedStudentIds.length > 0) {
      const removedAttendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          lessonPeriodId,
          studentId: { in: removedStudentIds },
        },
      });

      for (const attendanceRecord of removedAttendanceRecords) {
        await removeAttendanceRecord(tx, attendanceRecord);
      }
    }

    // Mark attendance as taken
    await markAttendanceTaken(tx, lessonPeriodId);
  });

  // Refresh lesson status
  await refreshLesson(lesson.id);

  // Refresh Needs Renewal tags for all affected students
  const affectedStudentIds = [...new Set([...newStudentIds, ...removedStudentIds])];
  if (affectedStudentIds.length > 0) {
    await refreshNeedsRenewalTags(affectedStudentIds, lesson.classroomId);
  }
}

export async function takeAttendance({
  lessonId,
  lessonPeriodId,
  studentIds,
}: {
  lessonId: number;
  lessonPeriodId: number;
  studentIds: number[];
}) {
  // Validate request (blocks re-finalizing an already-taken period)
  const { lesson, lessonPeriod } = await validateAttendanceRequest(
    lessonId,
    lessonPeriodId
  );

  await reconcileAndFinalize(lesson, lessonPeriod.id, studentIds);
}

export async function updateAttendance({
  lessonId,
  lessonPeriodId,
  studentIds,
}: {
  lessonId: number;
  lessonPeriodId: number;
  studentIds: number[];
}) {
  // Validate request
  const { lesson, lessonPeriod } = await validateUpdateAttendanceRequest(
    lessonId,
    lessonPeriodId
  );

  await reconcileAndFinalize(lesson, lessonPeriod.id, studentIds);
}

// A P2002 from the @@unique([lessonPeriodId, studentId]) constraint means a
// concurrent check-in already recorded this (student, period).
function isDuplicateAttendance(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

export type SelfCheckInResult = {
  periodId: number;
  status: "checked" | "already_checked" | "no_card";
  cardName?: string;
  remainingSessions?: number;
  exhausted?: boolean;
};

/**
 * Student self check-in (LIFF). Records attendance for one student across the
 * given periods of a lesson and deducts a card per period, reusing the same card
 * auto-selection as the teacher flow (`selectStudentCard`). Unlike `takeAttendance`
 * it:
 *   - marks each record `source: STUDENT`,
 *   - does NOT set `attendanceTakenAt` (the teacher still finalizes later),
 *   - is idempotent per (student, period) — an existing record is left untouched
 *     and reported as `already_checked` (no double-charge),
 *   - reports per-period card status so the UI can upsell when a card is missing
 *     or was just exhausted.
 */
export async function selfCheckIn({
  studentId,
  lessonId,
  lessonPeriodIds,
}: {
  studentId: number;
  lessonId: number;
  lessonPeriodIds: number[];
}): Promise<SelfCheckInResult[]> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { cards: { include: { card: true } } },
  });
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const validCardIds = lesson.cards.map((card) => card.cardId);
  const [student] = await fetchStudentsWithValidCards([studentId], validCardIds);
  if (!student) {
    throw new Error("Student not found");
  }

  // Only the requested periods that actually belong to this lesson, in order.
  const periods = await prisma.lessonPeriod.findMany({
    where: { id: { in: lessonPeriodIds }, lessonId },
    orderBy: { startTime: "asc" },
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { studentId, lessonPeriodId: { in: periods.map((p) => p.id) } },
    select: { lessonPeriodId: true },
  });
  const alreadyCheckedIds = new Set(existing.map((r) => r.lessonPeriodId));

  const results: SelfCheckInResult[] = [];

  // One transaction per period so they're independent: a duplicate-rejection on
  // one period (unique constraint) doesn't abort the others, and each record +
  // its card deduction commit atomically together.
  for (const period of periods) {
    if (alreadyCheckedIds.has(period.id)) {
      results.push({ periodId: period.id, status: "already_checked" });
      continue;
    }

    const studentCard = selectStudentCard(student, lesson);

    try {
      await prisma.$transaction(async (tx) => {
        const attendanceRecord = await createAttendanceRecord(
          tx,
          lesson.id,
          period.id,
          student.id,
          studentCard?.id ?? null,
          AttendanceSource.STUDENT
        );
        await createAttendanceEvent(tx, lesson.name, student.id, attendanceRecord.id);

        if (studentCard) {
          await processStudentCardUsage(tx, studentCard, student.id);
        }
      });
    } catch (e) {
      // A concurrent check-in beat us to this (student, period): the unique
      // constraint rejected our insert and rolled back our deduction. Report it
      // idempotently rather than double-charging.
      if (isDuplicateAttendance(e)) {
        results.push({ periodId: period.id, status: "already_checked" });
        continue;
      }
      throw e;
    }

    if (!studentCard) {
      results.push({ periodId: period.id, status: "no_card" });
      continue;
    }

    // Keep the in-memory card list in sync so multi-period check-ins don't
    // re-pick an exhausted card or double-count its remaining sessions.
    const remainingSessions = studentCard.remainingSessions - 1;
    const memCard = student.studentCards.find((c) => c.id === studentCard.id);
    if (memCard) memCard.remainingSessions = remainingSessions;
    if (remainingSessions <= 0) {
      student.studentCards = student.studentCards.filter((c) => c.id !== studentCard.id);
    }

    results.push({
      periodId: period.id,
      status: "checked",
      cardName: studentCard.card.name,
      remainingSessions,
      exhausted: remainingSessions === 0,
    });
  }

  await refreshNeedsRenewalTags([studentId], lesson.classroomId);

  return results;
}