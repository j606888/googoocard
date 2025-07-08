import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

async function main() {
  const studentsWithoutKey = await prisma.student.findMany({
    where: {
      randomKey: null,
    },
  });

  console.log(`Found ${studentsWithoutKey.length} students without randomKey.`);

  for (const student of studentsWithoutKey) {
    await prisma.student.update({
      where: { id: student.id },
      data: { randomKey: nanoid(8) },
    });
    console.log(`Updated student ${student.id}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
