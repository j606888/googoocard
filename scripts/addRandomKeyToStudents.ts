import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

async function main() {
  const studentsWithoutKey = await prisma.student.findMany({
    where: {
      randomKey: null,
    },
  });

  for (const student of studentsWithoutKey) {
    await prisma.student.update({
      where: { id: student.id },
      data: { randomKey: nanoid(8) },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
