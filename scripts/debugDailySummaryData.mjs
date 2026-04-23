import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAIPEI_OFFSET_MINUTES = 8 * 60;

function parseArgs() {
  const args = process.argv.slice(2);
  const map = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (key?.startsWith("--") && value) {
      map.set(key.slice(2), value);
      i += 1;
    }
  }
  return {
    date: map.get("date"),
    classroomId: map.get("classroomId"),
  };
}

function parseDateRange(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day, 0, -TAIPEI_OFFSET_MINUTES, 0, 0)
  );
  const end = new Date(
    Date.UTC(year, month - 1, day + 1, 0, -TAIPEI_OFFSET_MINUTES, 0, 0)
  );
  return { start, end };
}

async function main() {
  const { date, classroomId } = parseArgs();
  if (!date || !classroomId) {
    console.error(
      "Usage: node scripts/debugDailySummaryData.mjs --date YYYY-MM-DD --classroomId <id>"
    );
    process.exit(1);
  }

  const classroomIdNum = Number(classroomId);
  if (Number.isNaN(classroomIdNum)) {
    console.error("classroomId must be a number");
    process.exit(1);
  }

  const { start, end } = parseDateRange(date);
  console.log("query range", {
    date,
    start: start.toISOString(),
    end: end.toISOString(),
  });

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: {
        classroomId: classroomIdNum,
      },
      OR: [
        {
          attendanceTakenAt: {
            gte: start,
            lt: end,
          },
        },
        {
          attendanceRecords: {
            some: {
              createdAt: {
                gte: start,
                lt: end,
              },
            },
          },
        },
      ],
    },
    include: {
      lesson: true,
      attendanceRecords: {
        include: {
          student: true,
        },
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });

  const payload = periods.map((period) => ({
    periodId: period.id,
    lessonId: period.lessonId,
    lessonName: period.lesson.name,
    startTime: period.startTime.toISOString(),
    endTime: period.endTime.toISOString(),
    attendanceTakenAt: period.attendanceTakenAt?.toISOString() ?? null,
    attendanceRecordCount: period.attendanceRecords.length,
    attendanceRecords: period.attendanceRecords.map((record) => ({
      attendanceRecordId: record.id,
      studentId: record.studentId,
      studentName: record.student.name,
      studentCardId: record.studentCardId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })),
  }));

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
