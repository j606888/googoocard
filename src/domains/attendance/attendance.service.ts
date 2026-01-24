import { DanceType, Prisma, StudentCard } from "@prisma/client";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";

type LessonWithCards = Prisma.LessonGetPayload<{
  include: {
    cards: true;
  };
}>;

type StudentWithCards = Prisma.StudentGetPayload<{
  include: {
    studentCards: {
      include: {
        card: true;
      };
    };
  };
}>;

async function validateAttendanceRequest(
  lessonId: number,
  lessonPeriodId: number
): Promise<{ lesson: LessonWithCards; lessonPeriod: { id: number; attendanceTakenAt: Date | null } }> {
  const [lesson, lessonPeriod] = await Promise.all([
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { cards: true },
    }),
    prisma.lessonPeriod.findUnique({
      where: { id: lessonPeriodId },
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
      include: { cards: true },
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
    },
  });
}

function selectStudentCard(student: StudentWithCards, danceType: DanceType): StudentCard | null {
  const usableCards = student.studentCards.filter((studentCard) => {
    if (studentCard.card.isPracticeCard) {
      if (danceType === DanceType.BACHATA) {
        return student.hasCompletedBachataLv1;
      } else if (danceType === DanceType.SALSA) {
        return student.hasCompletedSalsaLv1;
      }
      return false;
    }
    return true;
  });

  if (usableCards.length === 1) {
    return usableCards[0];
  }
  return null;
}

async function createAttendanceRecord(
  tx: Prisma.TransactionClient,
  lessonId: number,
  lessonPeriodId: number,
  studentId: number,
  studentCardId: number | null
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
  const updatedStudentCard = await tx.studentCard.update({
    where: { id: studentCard.id },
    data: {
      remainingSessions: { decrement: 1 },
    },
    include: {
      card: true,
    },
  });

  // Create event if card is exhausted
  if (updatedStudentCard.remainingSessions === 0) {
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
  const studentCard = selectStudentCard(student, lesson.danceType);

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
  }

  // Delete the attendance record
  await tx.attendanceRecord.delete({
    where: { id: attendanceRecord.id },
  });
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
  // Validate request
  const { lesson, lessonPeriod } = await validateAttendanceRequest(
    lessonId,
    lessonPeriodId
  );

  // Get valid card IDs for this lesson
  const validCardIds = lesson.cards.map((card) => card.cardId);

  // Fetch students with their valid cards
  const students = await fetchStudentsWithValidCards(studentIds, validCardIds);

  // Process attendance in a transaction
  await prisma.$transaction(async (tx) => {
    // Process each student's attendance
    for (const student of students) {
      await processStudentAttendance(tx, lesson, lessonPeriod.id, student);
    }

    // Mark attendance as taken
    await markAttendanceTaken(tx, lessonPeriod.id);
  });

  // Refresh lesson status
  await refreshLesson(lessonId);
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

  // Get valid card IDs for this lesson
  const validCardIds = lesson.cards.map((card) => card.cardId);

  // Calculate which students to add and remove
  const { newStudentIds, removedStudentIds } = await getAttendanceDifferences(
    lessonPeriod.id,
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
      await processStudentAttendance(tx, lesson, lessonPeriod.id, student);
    }

    // Remove attendance records and refund cards
    if (removedStudentIds.length > 0) {
      const removedAttendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          lessonPeriodId: lessonPeriod.id,
          studentId: { in: removedStudentIds },
        },
      });

      for (const attendanceRecord of removedAttendanceRecords) {
        await removeAttendanceRecord(tx, attendanceRecord);
      }
    }

    // Mark attendance as taken
    await markAttendanceTaken(tx, lessonPeriod.id);
  });

  // Refresh lesson status
  await refreshLesson(lessonId);
}