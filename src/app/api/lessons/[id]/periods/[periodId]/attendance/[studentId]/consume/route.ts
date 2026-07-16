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

    const lessonPeriod = await getLessonPeriod(periodId);
    const studentCard = await getStudentCard(studentCardId);
    const attendanceRecord = await getAttendanceRecord(
      lessonPeriod.id,
      studentId
    );

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

async function getLessonPeriod(periodId: string) {
  const lessonPeriod = await prisma.lessonPeriod.findUnique({
    where: {
      id: parseInt(periodId),
    },
  });

  if (!lessonPeriod) {
    throw new ApiError(404, "Lesson period not found");
  }

  return lessonPeriod;
}

async function getStudentCard(studentId: string) {
  const studentCard = await prisma.studentCard.findUnique({
    where: {
      id: parseInt(studentId),
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
