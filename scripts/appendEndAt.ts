import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: {
      endAt: null,
    },
  });

  for (const lesson of lessons) {
    await refreshLesson(lesson.id);
  }
}

main();