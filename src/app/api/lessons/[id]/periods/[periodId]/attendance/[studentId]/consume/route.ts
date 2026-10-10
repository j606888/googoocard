import { NextResponse } from "next/server";
import prisma, { ApiError } from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; periodId: string; studentId: string }> }
) {
  const { id, periodId, studentId } = await params;
  const { studentCardId } = await request.json();

  try {
    const { classroomId } = await decodeAuthToken();
    if (!(await findLessonInClassroom(parseInt(id), classroomId))) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Every id below comes from the client, so each is pinned to the one before
    // it: the period to this lesson, the card to this student (and so to this
    // classroom). Qualification is deliberately NOT checked — manual
    // consumption must always work for legacy and special cases.
    const lessonPeriod = await getLessonPeriod(periodId, parseInt(id));
    const studentCard = await getStudentCard(studentCardId, parseInt(studentId));
    const attendanceRecord = await getAttendanceRecord(
      lessonPeriod.id,
      studentId
    );
    if (attendanceRecord.studentCardId !== null) {
      // Re-binding would charge a second card without refunding the first.
      throw new ApiError(409, "Attendance record already has a card");
    }
    if (studentCard.remainingSessions <= 0) {
      throw new ApiError(400, "Student card has no sessions left");
    }

    await prisma.$transaction(async (tx) => {
      const updatedStudentCard = await tx.studentCard.update({
        where: { id: studentCard.id },
        data: {
          remainingSessions: {
            decrement: 1,
          },
        },
        include: {
          card: true,
        },
      });

      if (updatedStudentCard.remainingSessions === 0) {
        await tx.event.create({
          data: {
            title: "課卡使用完畢",
            description: `課卡 ${updatedStudentCard.card.name} 使用完畢`,
            studentId: parseInt(studentId),
            resourceType: "studentCard",
            resourceId: updatedStudentCard.id,
          },
        });
      }

      await tx.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          studentCardId: Number(studentCardId),
        },
      });
    });

    return NextResponse.json({ message: "Student card consumed" });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getLessonPeriod(periodId: string, lessonId: number) {
  const lessonPeriod = await prisma.lessonPeriod.findFirst({
    where: {
      id: parseInt(periodId),
      lessonId,
    },
  });

  if (!lessonPeriod) {
    throw new ApiError(404, "Lesson period not found");
  }

  return lessonPeriod;
}

async function getStudentCard(studentCardId: string, studentId: number) {
  const studentCard = await prisma.studentCard.findFirst({
    where: {
      id: parseInt(studentCardId),
      studentId,
    },
  });

  if (!studentCard) {
    throw new ApiError(404, "Student card not found");
  }

  return studentCard;
}

async function getAttendanceRecord(lessonPeriodId: number, studentId: string) {
  const attendanceRecord = await prisma.attendanceRecord.findFirst({
    where: {
      studentId: parseInt(studentId),
      lessonPeriodId: lessonPeriodId,
    },
  });

  if (!attendanceRecord) {
    throw new ApiError(404, "Attendance record not found");
  }

  return attendanceRecord;
}
