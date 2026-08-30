// 把本機教室灌成「已經營運半年」的樣子：老師、課卡、課程分組、課程與時段、
// 購卡、點名扣卡、事件時間軸、標籤，涵蓋各種狀態（未付款、用完待續約、已停用、
// 轉換卡、未綁定課卡、學生自助簽到、今天待點名、未來課程…）。
//
//   npm run seed:dev                    # 目標＝第一位使用者的 currentClassroom
//   CLASSROOM_ID=2 npm run seed:dev     # 指定教室
//
// 學生「不會」被動到（本來就有假資料）；其餘該教室的營運資料會先清掉再重建，
// 所以可以重複執行，結果固定（固定亂數種子）。
// 只跑本機資料庫——非 localhost 一律拒絕。
//
// ⚠️ 這支腳本直接寫資料表，沒有走 API。兩條衍生規則是照抄的，改動時要同步：
//    • lesson.status / endAt   ← src/service/lesson.ts   (summarizeLessonPeriods)
//    • Needs Renewal 標籤      ← src/service/studentTag.ts (computeNeedsRenewal)

import { PrismaClient } from "@prisma/client";

const LOCAL_URL =
  "postgresql://postgres:password@localhost:54330/googoocard?schema=public";
const url = process.env.DATABASE_URL || LOCAL_URL;
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error(`Refusing to seed a non-local database: ${url}`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

// ── 固定亂數：同一顆種子＝同一份資料，重跑不會每次長不一樣 ──────────────
let seedState = 20260830;
const rand = () => {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const shuffled = (list) =>
  list
    .map((v) => ({ v, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);

// ── 時間：資料庫存 UTC，教室作息用台北牆上時間 ────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const taipeiToday = () => {
  const local = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  );
};
/** 以「台北的某天」為基準，回傳該天 hour:minute 的 UTC 時刻。 */
const at = (dayUtcMidnight, hour, minute = 0) =>
  new Date(dayUtcMidnight.getTime() + (hour - 8) * 60 * 60 * 1000 + minute * 60 * 1000);
const addDays = (date, days) => new Date(date.getTime() + days * DAY);

async function resolveClassroom() {
  if (process.env.CLASSROOM_ID) {
    const id = Number(process.env.CLASSROOM_ID);
    const classroom = await prisma.classroom.findFirst({
      where: { id, deletedAt: null },
    });
    if (!classroom) throw new Error(`找不到教室 #${id}（或已封存）`);
    return classroom;
  }
  const user = await prisma.user.findFirst({
    where: { currentClassroomId: { not: null } },
    orderBy: { id: "asc" },
  });
  const classroom = user
    ? await prisma.classroom.findFirst({
        where: { id: user.currentClassroomId, deletedAt: null },
      })
    : null;
  return (
    classroom ??
    (await prisma.classroom.findFirstOrThrow({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    }))
  );
}

/** 清掉這間教室的營運資料，學生本身保留。FK 順序：由葉往根。 */
async function wipe(classroomId) {
  const inClassroom = { student: { classroomId } };
  await prisma.attendanceRecord.deleteMany({ where: inClassroom });
  await prisma.lessonStudent.deleteMany({ where: { lesson: { classroomId } } });
  await prisma.lessonTeacher.deleteMany({ where: { lesson: { classroomId } } });
  await prisma.lessonCard.deleteMany({ where: { lesson: { classroomId } } });
  await prisma.lessonPeriod.deleteMany({ where: { lesson: { classroomId } } });
  await prisma.lesson.deleteMany({ where: { classroomId } });
  await prisma.lessonGroup.deleteMany({ where: { classroomId } });
  await prisma.event.deleteMany({ where: inClassroom });
  await prisma.studentTag.deleteMany({ where: inClassroom });
  await prisma.tag.deleteMany({ where: { classroomId } });
  await prisma.studentDanceQualification.deleteMany({ where: inClassroom });
  // 轉換鏈是 StudentCard 指向自己，先解開才刪得掉
  await prisma.studentCard.updateMany({
    where: { ...inClassroom, convertedToId: { not: null } },
    data: { convertedToId: null },
  });
  await prisma.studentCard.deleteMany({ where: inClassroom });
  await prisma.card.deleteMany({ where: { classroomId } });
  await prisma.teacher.deleteMany({ where: { classroomId } });
}

const TEACHERS = ["陳老師 Ariel", "林老師 Marco", "王老師 Sunny", "張老師 Diego", "李老師 Vivi"];

const CARD_SPECS = [
  { key: "trial", name: "單堂體驗卡", price: 500, sessions: 1 },
  { key: "g8", name: "8 堂團體卡", price: 6400, sessions: 8 },
  { key: "g12", name: "12 堂團體卡", price: 8400, sessions: 12 },
  { key: "private4", name: "4 堂私人課", price: 6800, sessions: 4 },
  { key: "pBachata", name: "Bachata Lv1 複習卡", price: 1800, sessions: 6, isPracticeCard: true, danceType: "BACHATA" },
  { key: "pSalsa", name: "Salsa Lv1 複習卡", price: 1800, sessions: 6, isPracticeCard: true, danceType: "SALSA" },
  { key: "pZouk", name: "Zouk Lv1 複習卡", price: 1800, sessions: 6, isPracticeCard: true, danceType: "ZOUK" },
  // 已下架：不再出現在購買選單，但舊卡還在學生手上
  { key: "legacy10", name: "舊版 10 堂卡（已下架）", price: 7000, sessions: 10, retired: true },
];

const CUSTOM_TAGS = ["新生", "VIP", "考慮中", "已請長假"];

/**
 * 課程排程表。`weeksAgo` 是第一堂的週數、每週一堂；`taken` 是「已點名」的堂數，
 * 其餘往後推，所以 `taken` 少於已過去的堂數就會留下「待點名」的課。
 * 帶 `dayOffsets` 的改用「距今天幾天」直接排期——用來安排今天的課，
 * 讓現場 QR 簽到（/checkin/[key]）與今日點名有東西可測。
 */
const LESSON_SPECS = [
  { name: "Bachata Lv1 春季班", dance: "BACHATA", group: "週二晚班", weekday: 2, hour: 19, periods: 8, weeksAgo: 20, taken: 8, cards: ["g8", "g12"], cohort: 9 },
  { name: "Salsa Lv1 春季班", dance: "SALSA", group: "週四晚班", weekday: 4, hour: 19, periods: 8, weeksAgo: 18, taken: 8, cards: ["g8", "g12"], cohort: 8 },
  { name: "Bachata Lv2 進階班", dance: "BACHATA", group: "週二晚班", weekday: 2, hour: 20, periods: 6, weeksAgo: 13, taken: 6, cards: ["g8", "g12", "pBachata"], cohort: 7 },
  { name: "Zouk 入門班", dance: "ZOUK", group: "週四晚班", weekday: 4, hour: 20, periods: 8, weeksAgo: 8, taken: 5, cards: ["g8", "g12"], cohort: 8 },
  { name: "Bachata 複習班", dance: "BACHATA", group: null, weekday: 3, hour: 20, periods: 8, weeksAgo: 7, taken: 5, cards: ["pBachata"], cohort: 6 },
  { name: "Salsa Lv2 夏季班", dance: "SALSA", group: "週四晚班", weekday: 4, hour: 21, periods: 8, weeksAgo: 4, taken: 3, cards: ["g8", "g12", "pSalsa"], cohort: 7 },
  { name: "週末 Hustle 工作坊", dance: "HUSTLE", group: "週末工作坊", weekday: 6, hour: 14, periods: 1, weeksAgo: 3, taken: 1, cards: ["trial", "g8"], cohort: 10 },
  { name: "私人課 · 一對一", dance: "BACHATA", group: null, weekday: 1, hour: 11, periods: 4, weeksAgo: 5, taken: 3, cards: ["private4"], cohort: 2 },
  { name: "Kizomba 體驗課", dance: "KIZOMBA", group: "週末工作坊", weekday: 6, hour: 15, periods: 2, weeksAgo: -1, taken: 0, cards: ["trial"], cohort: 6 },
  // 今天有課：第三堂就是今天，尚未點名
  { name: "Bachata Lv1 秋季班", dance: "BACHATA", group: null, hour: 19, dayOffsets: [-14, -7, 0, 7, 14], taken: 2, cards: ["g8", "g12", "pBachata"], cohort: 8 },
  { name: "Salsa 週間夜間班", dance: "SALSA", group: null, hour: 21, dayOffsets: [-7, 0, 7], taken: 1, cards: ["g8", "pSalsa"], cohort: 6 },
];

async function main() {
  const classroom = await resolveClassroom();
  const classroomId = classroom.id;
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: classroom.ownerId } });

  const students = await prisma.student.findMany({
    where: { classroomId },
    orderBy: { number: "asc" },
  });
  if (students.length < 4) {
    throw new Error(
      `教室「${classroom.name}」只有 ${students.length} 位學生，先建幾位學生再跑這支。`
    );
  }

  await wipe(classroomId);

  // 現場 QR 簽到金鑰：沒有就補一把，/checkin-qr 才有東西可看
  if (!classroom.checkinKey) {
    await prisma.classroom.update({
      where: { id: classroomId },
      data: { checkinKey: `dev-${classroomId}-${Math.random().toString(36).slice(2, 10)}` },
    });
  }

  const today = taipeiToday();

  // ── 老師 ─────────────────────────────────────────────────────────
  const teachers = [];
  for (const name of TEACHERS) {
    teachers.push(await prisma.teacher.create({ data: { name, classroomId } }));
  }

  // ── 課卡卡別 ─────────────────────────────────────────────────────
  const cards = {};
  for (const spec of CARD_SPECS) {
    cards[spec.key] = await prisma.card.create({
      data: {
        name: spec.name,
        price: spec.price,
        sessions: spec.sessions,
        classroomId,
        isPracticeCard: spec.isPracticeCard ?? false,
        danceType: spec.danceType ?? null,
        expiredAt: spec.retired ? addDays(today, -60) : null,
      },
    });
  }

  // ── 過課資格：決定誰買得起／用得了複習卡 ─────────────────────────
  const qualifications = new Map(students.map((s) => [s.id, []]));
  for (const student of students) {
    const owned = [];
    if (chance(0.55)) owned.push("BACHATA");
    if (chance(0.35)) owned.push("SALSA");
    if (chance(0.15)) owned.push("ZOUK");
    for (const danceType of owned) {
      await prisma.studentDanceQualification.create({
        data: { studentId: student.id, danceType },
      });
    }
    qualifications.set(student.id, owned);
  }

  // ── 自訂標籤 ─────────────────────────────────────────────────────
  for (const name of CUSTOM_TAGS) {
    const tag = await prisma.tag.create({ data: { name, classroomId } });
    for (const student of shuffled(students).slice(0, name === "VIP" ? 3 : 2)) {
      await prisma.studentTag.create({ data: { studentId: student.id, tagId: tag.id } });
    }
  }

  // ── 課程分組 ─────────────────────────────────────────────────────
  const groups = {};
  for (const name of ["週二晚班", "週四晚班", "週末工作坊"]) {
    groups[name] = await prisma.lessonGroup.create({ data: { name, classroomId } });
  }

  // ── 課程、時段、師資、可用卡別 ───────────────────────────────────
  const lessons = [];
  for (const spec of LESSON_SPECS) {
    const lesson = await prisma.lesson.create({
      data: {
        name: spec.name,
        classroomId,
        danceType: spec.dance,
        groupId: spec.group ? groups[spec.group].id : null,
        status: "inProgress",
      },
    });

    for (const teacher of shuffled(teachers).slice(0, chance(0.4) ? 2 : 1)) {
      await prisma.lessonTeacher.create({
        data: { lessonId: lesson.id, teacherId: teacher.id },
      });
    }
    for (const key of spec.cards) {
      await prisma.lessonCard.create({
        data: { lessonId: lesson.id, cardId: cards[key].id },
      });
    }

    // 排期：dayOffsets 直接指定「距今天幾天」；否則第一堂在 weeksAgo 週前
    // 對齊到指定星期幾，之後每週一堂。
    let days;
    if (spec.dayOffsets) {
      days = spec.dayOffsets.map((offset) => addDays(today, offset));
    } else {
      const firstDay = addDays(today, -spec.weeksAgo * 7);
      const shift = (spec.weekday - ((firstDay.getUTCDay() + 6) % 7) - 1 + 7) % 7;
      const start = addDays(firstDay, shift - (shift > 3 ? 7 : 0));
      days = Array.from({ length: spec.periods }, (_, i) => addDays(start, i * 7));
    }

    const periods = [];
    for (const day of days) {
      periods.push(
        await prisma.lessonPeriod.create({
          data: {
            lessonId: lesson.id,
            startTime: at(day, spec.hour),
            endTime: at(day, spec.hour + 1, 30),
          },
        })
      );
    }

    lessons.push({
      spec,
      row: lesson,
      periods,
      takenPeriodIds: new Set(periods.slice(0, spec.taken).map((p) => p.id)),
      cohort: shuffled(students).slice(0, spec.cohort),
      cardKeys: spec.cards,
    });
  }

  // ── 時間軸：把「買卡」和「上課」按時間排好，再依序模擬 ───────────
  //    先買才有得扣，順序錯了資料就不自洽。
  const timeline = [];

  // 每位學生的購卡節奏：入門卡 → 之後每 6~10 週續一張
  for (const student of students) {
    const joinedWeeksAgo = 8 + Math.floor(rand() * 15);
    let cursor = addDays(today, -joinedWeeksAgo * 7);
    let n = 0;
    while (cursor < addDays(today, -3) && n < 5) {
      const quals = qualifications.get(student.id);
      const practiceKey =
        quals.length > 0 && chance(0.3)
          ? { BACHATA: "pBachata", SALSA: "pSalsa", ZOUK: "pZouk" }[pick(quals)]
          : null;
      const key = practiceKey ?? (n === 0 ? pick(["trial", "g8", "g8", "g12"]) : pick(["g8", "g12", "g12", "private4"]));
      timeline.push({ kind: "purchase", when: new Date(cursor), studentId: student.id, cardKey: key });
      cursor = addDays(cursor, (5 + Math.floor(rand() * 4)) * 7);
      n++;
    }
    // 少數人手上有一張早年的下架卡
    if (chance(0.15)) {
      timeline.push({
        kind: "purchase",
        when: addDays(today, -(joinedWeeksAgo + 8) * 7),
        studentId: student.id,
        cardKey: "legacy10",
      });
    }
  }

  for (const lesson of lessons) {
    for (const period of lesson.periods) {
      if (!lesson.takenPeriodIds.has(period.id)) continue;
      timeline.push({ kind: "attendance", when: period.startTime, lesson, period });
    }
  }

  timeline.sort((a, b) => a.when - b.when);

  // 學生手上的卡（記憶體鏡像，避免每次都回查資料庫）
  const wallet = new Map(students.map((s) => [s.id, []]));
  const stats = { purchases: 0, unpaid: 0, attendance: 0, selfCheckin: 0, unbound: 0, exhausted: 0, conversions: 0 };

  const purchaseCard = async (studentId, cardKey, when, note = null) => {
    const card = cards[cardKey];
    // 一成未收款：income 頁的「未付款」與鈴鐺提醒才有東西
    const isPaid = !chance(0.1);
    const discounted = !note && chance(0.15);
    const finalPrice = discounted ? Math.round((card.price * 0.9) / 100) * 100 : card.price;

    const created = await prisma.studentCard.create({
      data: {
        studentId,
        cardId: card.id,
        basePrice: card.price,
        finalPrice,
        totalSessions: card.sessions,
        remainingSessions: card.sessions,
        purchaseSource: chance(0.12) ? "STUDENT" : "STAFF",
        purchasedByUserId: owner.id,
        isPaid,
        paidAt: isPaid ? when : null,
        paidByUserId: isPaid ? owner.id : null,
        note: note ?? (discounted ? "早鳥 9 折" : null),
        createdAt: when,
        updatedAt: when,
      },
    });
    await prisma.event.create({
      data: {
        title: "購買課卡",
        description: `購買新課卡 ${card.name}`,
        studentId,
        resourceType: "studentCard",
        resourceId: created.id,
        createdAt: when,
        updatedAt: when,
      },
    });
    const held = { ...created, card };
    wallet.get(studentId).push(held);
    stats.purchases++;
    if (!isPaid) stats.unpaid++;
    return held;
  };

  for (const entry of timeline) {
    if (entry.kind === "purchase") {
      await purchaseCard(entry.studentId, entry.cardKey, entry.when);
      continue;
    }

    // ── 點名 ────────────────────────────────────────────────────────
    const { lesson, period } = entry;
    const lessonCardIds = new Set(lesson.cardKeys.map((k) => cards[k].id));
    const practiceCardKey = lesson.cardKeys.find((k) => cards[k].isPracticeCard);

    for (const student of lesson.cohort) {
      if (chance(0.12)) continue; // 請假

      const usable = () =>
        wallet
          .get(student.id)
          .filter(
            (sc) =>
              sc.remainingSessions > 0 &&
              sc.expiredAt == null &&
              sc.createdAt <= period.startTime
          );

      let held = usable();
      // 卡用完了就當場續一張——這才是櫃檯真正會發生的事；
      // 剩下的少數留成「未綁定課卡」，讓鈴鐺與待處理提醒有真實案例。
      if (held.length === 0 && !chance(0.06)) {
        const renewKey = pick(["g8", "g8", "g12", "trial"]);
        await purchaseCard(
          student.id,
          renewKey,
          new Date(period.startTime.getTime() - 30 * 60 * 1000),
          "上課前續卡"
        );
        held = usable();
      }

      // 選卡優先序：課程指定的複習卡（且學生有資格）→ 課程接受的一般卡 → 剩最少的
      const quals = qualifications.get(student.id);
      const practice = practiceCardKey
        ? held.find(
            (sc) =>
              sc.cardId === cards[practiceCardKey].id &&
              quals.includes(cards[practiceCardKey].danceType)
          )
        : null;
      const general = held
        .filter((sc) => !sc.card.isPracticeCard && lessonCardIds.has(sc.cardId))
        .sort((a, b) => a.remainingSessions - b.remainingSessions)[0];
      const fallback = held.filter((sc) => !sc.card.isPracticeCard).sort(
        (a, b) => a.remainingSessions - b.remainingSessions
      )[0];
      const chosen = practice ?? general ?? fallback ?? null;

      // 一成刻意留成「未綁定課卡」——首頁鈴鐺與每日營收的待處理提醒靠這個
      const useCard = chosen && !chance(0.03) ? chosen : null;
      const source = chance(0.18) ? "STUDENT" : "TEACHER";

      await prisma.lessonStudent.upsert({
        where: { lessonId_studentId: { lessonId: lesson.row.id, studentId: student.id } },
        update: {},
        create: { lessonId: lesson.row.id, studentId: student.id, createdAt: period.startTime, updatedAt: period.startTime },
      });

      const record = await prisma.attendanceRecord.create({
        data: {
          lessonPeriodId: period.id,
          studentId: student.id,
          studentCardId: useCard?.id ?? null,
          source,
          createdAt: period.startTime,
          updatedAt: period.startTime,
        },
      });
      stats.attendance++;
      if (source === "STUDENT") stats.selfCheckin++;
      if (!useCard) stats.unbound++;

      await prisma.event.create({
        data: {
          title: "簽到",
          description: `${lesson.row.name} 簽到成功`,
          studentId: student.id,
          resourceType: "attendanceRecord",
          resourceId: record.id,
          createdAt: period.startTime,
          updatedAt: period.startTime,
        },
      });

      if (useCard) {
        useCard.remainingSessions -= 1;
        await prisma.studentCard.update({
          where: { id: useCard.id },
          data: { remainingSessions: useCard.remainingSessions },
        });
        if (useCard.remainingSessions === 0) {
          stats.exhausted++;
          await prisma.event.create({
            data: {
              title: "課卡使用完畢",
              description: `課卡 ${useCard.card.name} 使用完畢`,
              studentId: student.id,
              resourceType: "studentCard",
              resourceId: useCard.id,
              createdAt: period.startTime,
              updatedAt: period.startTime,
            },
          });
        }
      }
    }

    await prisma.lessonPeriod.update({
      where: { id: period.id },
      data: { attendanceTakenAt: new Date(period.endTime.getTime() + 5 * 60 * 1000) },
    });
  }

  // ── 轉換卡：把還有剩餘堂數的複習卡折成一張 Lv2 卡 ─────────────────
  for (const student of students) {
    const source = wallet
      .get(student.id)
      .find((sc) => sc.card.isPracticeCard && sc.remainingSessions > 0);
    if (!source || !chance(0.75)) continue;

    const when = addDays(today, -Math.floor(rand() * 20) - 2);
    const target = await prisma.studentCard.create({
      data: {
        studentId: student.id,
        cardId: cards.g8.id,
        basePrice: cards.g8.price,
        // 轉換沒有新金流，收入頁靠 origin=CONVERSION 排除，避免同一筆錢算兩次
        finalPrice: 0,
        totalSessions: 8,
        remainingSessions: 8,
        purchaseSource: "STAFF",
        purchasedByUserId: owner.id,
        isPaid: true,
        paidAt: when,
        paidByUserId: owner.id,
        origin: "CONVERSION",
        note: `由「${source.card.name}」剩餘 ${source.remainingSessions} 堂折抵`,
        createdAt: when,
        updatedAt: when,
      },
    });
    await prisma.studentCard.update({
      where: { id: source.id },
      data: { convertedToId: target.id, expiredAt: when },
    });
    source.expiredAt = when;
    stats.conversions++;
  }

  // ── 幾張手動停用的卡（買錯／長期不來） ───────────────────────────
  for (const student of shuffled(students).slice(0, 3)) {
    const victim = wallet
      .get(student.id)
      .find((sc) => sc.remainingSessions > 0 && sc.expiredAt == null);
    if (!victim) continue;
    const when = addDays(today, -Math.floor(rand() * 30) - 1);
    await prisma.studentCard.update({
      where: { id: victim.id },
      data: { expiredAt: when, note: "學生長期未到，先停用" },
    });
    victim.expiredAt = when;
  }

  // ── 收尾：課程狀態／endAt（照抄 summarizeLessonPeriods 的判定） ────
  for (const lesson of lessons) {
    const periods = await prisma.lessonPeriod.findMany({ where: { lessonId: lesson.row.id } });
    const allChecked = periods.length > 0 && periods.every((p) => p.attendanceTakenAt);
    const lastEnd = periods.reduce((max, p) => (!max || p.endTime > max ? p.endTime : max), null);
    if (lastEnd) {
      await prisma.lesson.update({
        where: { id: lesson.row.id },
        data: { endAt: lastEnd, status: allChecked ? "finished" : "inProgress" },
      });
    }
  }

  // ── 收尾：Needs Renewal（照抄 computeNeedsRenewal 的判定） ─────────
  const renewalTag = await prisma.tag.create({
    data: { name: "Needs Renewal", classroomId },
  });
  let renewalCount = 0;
  for (const student of students) {
    const held = await prisma.studentCard.findMany({
      where: { studentId: student.id, expiredAt: null },
      include: { card: true },
      orderBy: { createdAt: "desc" },
    });
    const latestByCardId = new Map();
    for (const sc of held.filter((sc) => sc.totalSessions > 1)) {
      if (!latestByCardId.has(sc.cardId)) latestByCardId.set(sc.cardId, sc);
    }
    if ([...latestByCardId.values()].some((sc) => sc.remainingSessions === 0)) {
      await prisma.studentTag.create({
        data: { studentId: student.id, tagId: renewalTag.id },
      });
      renewalCount++;
    }
  }

  const finished = await prisma.lesson.count({ where: { classroomId, status: "finished" } });
  const dueForAttendance = await prisma.lessonPeriod.count({
    where: {
      lesson: { classroomId },
      attendanceTakenAt: null,
      startTime: { lte: at(today, 23, 59) },
    },
  });

  console.log("──────────────────────────────────────");
  console.log(`教室：${classroom.name} (id ${classroomId})`);
  console.log(`學生：${students.length} 位（未變動）`);
  console.log(`老師：${teachers.length}　卡別：${CARD_SPECS.length}（含 1 張已下架）`);
  console.log(`課程：${lessons.length}（已結束 ${finished}、進行中 ${lessons.length - finished}）`);
  console.log(`購卡：${stats.purchases} 張，其中未付款 ${stats.unpaid} 張、轉換卡 ${stats.conversions} 張`);
  console.log(`點名：${stats.attendance} 筆，其中學生自助簽到 ${stats.selfCheckin} 筆、未綁定課卡 ${stats.unbound} 筆`);
  console.log(`課卡用完：${stats.exhausted} 次　需續約學生：${renewalCount} 位`);
  console.log(`待點名時段（今天含以前）：${dueForAttendance}`);
  console.log("──────────────────────────────────────");
  console.log("重跑會清掉本教室的營運資料再重建（學生保留），結果固定。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
