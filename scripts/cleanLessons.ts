import prisma from "@/lib/prisma";

async function main() {
  await prisma.lessonTeacher.deleteMany();
  await prisma.lessonCard.deleteMany();
  await prisma.lessonPeriod.deleteMany();
  await prisma.lessonStudent.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.studentCard.deleteMany();
  await prisma.teacher.deleteMany();
}

main()

// npx tsx scripts/cleanLessons.ts