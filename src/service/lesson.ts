import prisma from "@/lib/prisma";

export const refreshLesson = async (lessonId: number) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson) throw new Error("Lesson not found");

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lessonId,
    },
  });

  const lastPeriod = periods.sort(
    (a, b) => b.endTime.getTime() - a.endTime.getTime()
  )[0];
  const allAttendanceChecked = periods.every(
    (period) => period.attendanceTakenAt
  );

  if (lastPeriod) {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        endAt: lastPeriod.endTime,
        status: allAttendanceChecked ? "finished" : "inProgress",
      },
    });
  }
};
