// Seed test data for the LIFF student self check-in flow.
//
//   node scripts/seed-liff-test.mjs
//
// Creates a classroom + teacher + cards + a student (with a one-time LINE bind
// key printed at the end) + 3 lessons scheduled for TODAY (Taipei) so you can
// exercise the whole flow: check in → card deducted / exhausted / missing →
// guided to 購買課卡. Local-database only — refuses any non-localhost URL.

import crypto from "crypto";
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

  // Owner + classroom + membership.
  const owner = await prisma.user.upsert({
    where: { email: "liff-test-owner@googoocard.local" },
    update: {},
    create: {
      email: "liff-test-owner@googoocard.local",
      name: "LIFF 測試老闆",
      password: "x", // backoffice login isn't the point of this seed
    },
  });
  const classroom = await prisma.classroom.create({
    data: { ownerId: owner.id, name: `LIFF 測試教室 ${todayKey}` },
  });
  await prisma.membership.upsert({
    where: { userId_classroomId: { userId: owner.id, classroomId: classroom.id } },
    update: {},
    create: { userId: owner.id, classroomId: classroom.id, role: "owner" },
  });
  await prisma.user.update({
    where: { id: owner.id },
    data: { currentClassroomId: classroom.id },
  });

  // Also let your own login (test@test.com) select this classroom in the backoffice.
  const dev = await prisma.user.findUnique({ where: { email: "test@test.com" } });
  if (dev) {
    await prisma.membership.upsert({
      where: { userId_classroomId: { userId: dev.id, classroomId: classroom.id } },
      update: {},
      create: { userId: dev.id, classroomId: classroom.id, role: "owner" },
    });
  }

  const teacher = await prisma.teacher.create({
    data: { name: "示範老師", classroomId: classroom.id },
  });

  // Cards: a general card the student will hold (with only 1 session left, to
  // exercise "last session used"), a general card the student does NOT hold (to
  // exercise "no card"), and a Bachata practice card (to exercise self-purchase).
  const cardHeld = await prisma.card.create({
    data: { name: "10 堂卡", price: 5000, sessions: 10, classroomId: classroom.id },
  });
  const cardMissing = await prisma.card.create({
    data: { name: "8 堂卡", price: 4200, sessions: 8, classroomId: classroom.id },
  });
  const practiceCard = await prisma.card.create({
    data: {
      name: "Bachata 複習卡",
      price: 2000,
      sessions: 5,
      classroomId: classroom.id,
      isPracticeCard: true,
      danceType: "BACHATA",
    },
  });

  // Student bound by a one-time key, qualified for Bachata (can buy 複習卡).
  const lineBindKey = crypto.randomBytes(16).toString("hex");
  const student = await prisma.student.create({
    data: {
      name: "測試學生",
      avatarUrl: "/images/avatar_1.png",
      classroomId: classroom.id,
      lineBindKey,
    },
  });
  await prisma.studentDanceQualification.create({
    data: { studentId: student.id, danceType: "BACHATA" },
  });

  // Student holds the general "10 堂卡" but with only 1 session remaining.
  await prisma.studentCard.create({
    data: {
      studentId: student.id,
      cardId: cardHeld.id,
      basePrice: cardHeld.price,
      finalPrice: cardHeld.price,
      totalSessions: 10,
      remainingSessions: 1,
    },
  });

  // 3 lessons today, each one period. Walk-in: student is NOT pre-enrolled.
  const lessonSpecs = [
    { name: "早上 Bachata", danceType: "BACHATA", hour: 10, cardIds: [cardHeld.id] },
    { name: "下午 Salsa", danceType: "SALSA", hour: 13, cardIds: [cardMissing.id] },
    {
      name: "晚上 Bachata",
      danceType: "BACHATA",
      hour: 19,
      cardIds: [cardHeld.id, practiceCard.id],
    },
  ];
  const lessons = [];
  for (const spec of lessonSpecs) {
    const lesson = await prisma.lesson.create({
      data: {
        name: spec.name,
        classroomId: classroom.id,
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

  console.log("\n✅ LIFF 測試資料建立完成");
  console.log("──────────────────────────────────────");
  console.log(`教室：${classroom.name} (id ${classroom.id})`);
  if (dev) console.log(`已將 test@test.com 加入此教室，可在後台切換選擇`);
  console.log(`老師：${teacher.name}`);
  console.log(`學生：${student.name} (id ${student.id})，已具 BACHATA 複習卡資格`);
  console.log(`持有課卡：10 堂卡（剩 1 堂）`);
  console.log(`今日 (${todayKey}) 課程：`);
  for (const l of lessons) {
    console.log(`  • ${l.hour}:00 ${l.name} [${l.danceType}] — 接受卡：${l.cardIds.join(",")}`);
  }
  console.log("──────────────────────────────────────");
  console.log("👉 綁定方式：在 LINE 官方帳號的聊天室輸入下列綁定碼，即可把這位學生綁到你的 LINE：");
  console.log(`\n    ${lineBindKey}\n`);
  console.log("綁定後開啟圖文選單的「上課簽到」即可測試。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
