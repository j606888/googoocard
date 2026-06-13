// Seed TODAY's lessons for an already-bound LIFF student, so you can re-test the
// check-in / 點名 flow on a fresh day without re-binding.
//
//   node scripts/seed-liff-test.mjs              # target the first bound student
//   STUDENT_ID=1 node scripts/seed-liff-test.mjs # target a specific student
//
// It does NOT create a new classroom or a new bind key — it reuses the bound
// student's existing classroom, teacher and cards, and just adds 3 lessons
// scheduled for TODAY (Taipei): a Bachata lesson (general + practice card), a
// Bachata 複習 lesson (practice card only), and a Salsa lesson (general card).
// Local-database only — refuses any non-localhost URL.

import { PrismaClient } from "@prisma/client";

const LOCAL_URL =
  "postgresql://postgres:password@localhost:54330/googoocard?schema=public";
const url = process.env.DATABASE_URL || LOCAL_URL;
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error(`Refusing to seed a non-local database: ${url}`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

// Today's date key in Taipei (UTC+8), then a UTC Date for a Taipei wall-clock time.
function taipeiTodayKey() {
  const local = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function taipeiTime(dateKey, hour, minute = 0) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 8, minute, 0, 0));
}

async function main() {
  const todayKey = taipeiTodayKey();

  // Resolve the target bound student (STUDENT_ID override, else the first one).
  const wantedId = process.env.STUDENT_ID ? Number(process.env.STUDENT_ID) : null;
  const student = wantedId
    ? await prisma.student.findUnique({ where: { id: wantedId } })
    : await prisma.student.findFirst({
        where: { lineUserId: { not: null } },
        orderBy: { id: "asc" },
      });

  if (!student) {
    console.error(
      "找不到已綁定 LINE 的學生。請先在 LINE 聊天室用綁定碼把學生綁到你的帳號，再跑這支。",
    );
    process.exit(1);
  }
  if (!student.lineUserId) {
    console.error(`學生 #${student.id} ${student.name} 尚未綁定 LINE（lineUserId 為空）。`);
    process.exit(1);
  }

  const classroomId = student.classroomId;
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  // Reuse an existing teacher in the classroom, or create one.
  const teacher =
    (await prisma.teacher.findFirst({ where: { classroomId } })) ??
    (await prisma.teacher.create({ data: { name: "示範老師", classroomId } }));

  // Reuse existing cards: a general card and a Bachata practice card.
  const generalCard =
    (await prisma.card.findFirst({
      where: { classroomId, isPracticeCard: false },
      orderBy: { id: "asc" },
    })) ??
    (await prisma.card.create({
      data: { name: "初階6堂", price: 3000, sessions: 6, classroomId },
    }));
  const practiceCard =
    (await prisma.card.findFirst({
      where: { classroomId, isPracticeCard: true, danceType: "BACHATA" },
      orderBy: { id: "asc" },
    })) ??
    (await prisma.card.create({
      data: {
        name: "Bachata 複習卡",
        price: 2000,
        sessions: 6,
        classroomId,
        isPracticeCard: true,
        danceType: "BACHATA",
      },
    }));

  // 3 lessons today, each one period (10:00 / 13:00 / 19:00 Taipei).
  const lessonSpecs = [
    {
      name: `早上 Bachata ${todayKey}`,
      danceType: "BACHATA",
      hour: 10,
      cardIds: [generalCard.id, practiceCard.id],
    },
    {
      name: `下午 Bachata 複習 ${todayKey}`,
      danceType: "BACHATA",
      hour: 13,
      cardIds: [practiceCard.id],
    },
    {
      name: `晚上 Salsa ${todayKey}`,
      danceType: "SALSA",
      hour: 19,
      cardIds: [generalCard.id],
    },
  ];

  const lessons = [];
  for (const spec of lessonSpecs) {
    const lesson = await prisma.lesson.create({
      data: {
        name: spec.name,
        classroomId,
        danceType: spec.danceType,
        status: "inProgress",
      },
    });
    await prisma.lessonTeacher.create({
      data: { lessonId: lesson.id, teacherId: teacher.id },
    });
    await prisma.lessonCard.createMany({
      data: spec.cardIds.map((cardId) => ({ lessonId: lesson.id, cardId })),
    });
    await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: taipeiTime(todayKey, spec.hour),
        endTime: taipeiTime(todayKey, spec.hour + 1),
      },
    });
    lessons.push({ ...spec, id: lesson.id });
  }

  console.log("\n✅ 今日課程已生成");
  console.log("──────────────────────────────────────");
  console.log(`教室：${classroom.name} (id ${classroomId})`);
  console.log(`學生：${student.name} (id ${student.id})，已綁定 LINE`);
  console.log(`老師：${teacher.name}`);
  console.log(`卡別：一般卡「${generalCard.name}」#${generalCard.id}、複習卡「${practiceCard.name}」#${practiceCard.id}`);
  console.log(`今日 (${todayKey}) 課程：`);
  for (const l of lessons) {
    console.log(`  • ${l.hour}:00 ${l.name} [${l.danceType}] — 接受卡：${l.cardIds.join(",")}`);
  }
  console.log("──────────────────────────────────────");
  console.log("👉 已綁定，直接開圖文選單的「上課簽到」即可測試；後台也可對這些課程點名。");
  console.log("（再次執行會「再」新增一批今日課程，不會清掉舊的。）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
