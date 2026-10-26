import prisma from "@/lib/prisma";
// 同 src/service/renewalReminder.ts：tag 名稱就是這個字串，系統各處直接比對它。
const NEEDS_RENEWAL_TAG = "Needs Renewal";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 需續約只列這段時間內有來上課的人；更久沒來的只算一個數字（「久未上課」）。 */
export const RENEWAL_ACTIVE_DAYS = 30;
/** 上完體驗課後這麼多天內還沒買正式卡，列進「體驗後還沒買卡」。 */
export const TRIAL_FOLLOW_UP_DAYS = 14;

/**
 * 「待處理」清單：老師需要動手處理的事，處理完就自動從清單消失。
 *
 * 這是一份**狀態**而不是訊息紀錄——每一類都直接從現有資料查出來，不另存通知表。
 * 分兩層：
 *
 * **要處理**（`urgentCount`，紅色數字、App badge、推播 badge 只算這兩類）——已經發生、要現在補的：
 *  - 待確認收款：`StudentCard.isPaid = false`
 *  - 出席沒綁課卡：`AttendanceRecord.studentCardId = null`
 *
 * **提醒**（`reminderCount`，只顯示灰點，不進紅色數字）：
 *  - 需續約：學生身上有「Needs Renewal」tag（由 refreshNeedsRenewalTag 維護），
 *    且 RENEWAL_ACTIVE_DAYS 天內有來上課；更久沒來的只回 `inactiveRenewalCount`
 *  - 體驗後還沒買卡：TRIAL_FOLLOW_UP_DAYS 天內用體驗卡上過課、沒有任何非體驗卡
 *  - 可能重複：同教室、在籍、名字相同的學生（多半是第一次來自助登記、其實是
 *    還沒綁 LINE 的舊生）；合併或改名後就消失
 *
 * 網頁的鈴鐺、App 的「待處理」分頁、推播的 badge 數字都讀這一份，
 * 要改「什麼算待處理」就改這裡。`total` 跟 `urgentCount` 相同（App 拿它設圖示數字）。
 */
export async function getTodos(classroomId: number, now = new Date()) {
  const [unpaidCards, renewal, unboundRecords, trialFollowUps, duplicates] = await Promise.all([
    // 未付款的卡即使學生已封存也還是欠款，所以不排除封存學生。
    prisma.studentCard.findMany({
      where: { isPaid: false, student: { classroomId } },
      select: {
        id: true,
        serialNumber: true,
        finalPrice: true,
        purchaseSource: true,
        totalSessions: true,
        remainingSessions: true,
        createdAt: true,
        card: { select: { name: true } },
        student: { select: { id: true, name: true, avatarUrl: true } },
      },
      // 拖越久的排越前面——追帳先追最久的。
      orderBy: { createdAt: "asc" },
    }),
    findNeedsRenewal(classroomId, now),
    prisma.attendanceRecord.findMany({
      where: { student: { classroomId }, studentCardId: null },
      select: {
        id: true,
        source: true,
        student: { select: { id: true, name: true, avatarUrl: true } },
        lessonPeriod: {
          select: { id: true, startTime: true, lesson: { select: { id: true, name: true } } },
        },
      },
      orderBy: { lessonPeriod: { startTime: "asc" } },
    }),
    findTrialFollowUps(classroomId, now),
    findPossibleDuplicates(classroomId),
  ]);

  const urgentCount = unpaidCards.length + unboundRecords.length;
  const reminderCount = renewal.active.length + trialFollowUps.length + duplicates.length;

  return {
    unpaidCards: unpaidCards.map((sc) => ({
      id: sc.id,
      serialNumber: sc.serialNumber,
      cardName: sc.card.name,
      finalPrice: sc.finalPrice,
      purchaseSource: sc.purchaseSource,
      usedSessions: sc.totalSessions - sc.remainingSessions,
      totalSessions: sc.totalSessions,
      createdAt: sc.createdAt,
      student: sc.student,
    })),
    needsRenewal: renewal.active,
    inactiveRenewalCount: renewal.inactiveCount,
    unboundAttendance: unboundRecords.map((r) => ({
      id: r.id,
      source: r.source,
      student: r.student,
      lessonId: r.lessonPeriod.lesson.id,
      lessonName: r.lessonPeriod.lesson.name,
      lessonPeriodId: r.lessonPeriod.id,
      lessonPeriodStartTime: r.lessonPeriod.startTime,
    })),
    trialFollowUps,
    possibleDuplicates: duplicates,
    urgentCount,
    reminderCount,
    total: urgentCount,
  };
}

/**
 * 需續約，拆成最近有來的（逐筆列出）和久未上課的（只算人數）。
 * 封存的學生不會再來上課，續不續約已經不是待辦。
 */
async function findNeedsRenewal(classroomId: number, now: Date) {
  const rows = await prisma.studentTag.findMany({
    where: {
      tag: { name: NEEDS_RENEWAL_TAG, classroomId },
      student: { classroomId, archivedAt: null },
    },
    select: {
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          lineUserId: true,
          attendanceRecords: {
            select: { lessonPeriod: { select: { startTime: true } } },
            orderBy: { lessonPeriod: { startTime: "desc" } },
            take: 1,
          },
          renewalReminders: {
            select: { sentAt: true },
            orderBy: { sentAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeSince = new Date(now.getTime() - RENEWAL_ACTIVE_DAYS * DAY_MS);
  const entries = rows.map((row) => {
    const { attendanceRecords, renewalReminders, lineUserId, ...student } = row.student;
    // 只算這次用完之後發的提醒；上一輪的不算。
    const reminded = renewalReminders[0]?.sentAt;
    return {
      student,
      since: row.createdAt,
      lastAttendedAt: attendanceRecords[0]?.lessonPeriod.startTime ?? null,
      // Only whether — never the LINE id itself.
      lineBound: lineUserId !== null,
      lastRemindedAt: reminded && reminded >= row.createdAt ? reminded : null,
    };
  });
  const active = entries.filter(
    (e): e is typeof e & { lastAttendedAt: Date } =>
      e.lastAttendedAt !== null && e.lastAttendedAt >= activeSince
  );
  const inactiveCount = entries.length - active.length;
  return { active, inactiveCount };
}

/**
 * 最近用體驗卡上過課、還沒買過任何非體驗卡的在籍學生（「舊生」的定義同
 * src/service/trial.ts 的 isReturningStudent）。上完體驗課最近的排前面。
 */
async function findTrialFollowUps(classroomId: number, now: Date) {
  const since = new Date(now.getTime() - TRIAL_FOLLOW_UP_DAYS * DAY_MS);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      student: {
        classroomId,
        archivedAt: null,
        studentCards: { none: { card: { isTrial: false } } },
      },
      studentCard: { card: { isTrial: true } },
      lessonPeriod: { startTime: { gte: since, lte: now } },
    },
    select: {
      student: { select: { id: true, name: true, avatarUrl: true } },
      lessonPeriod: {
        select: { startTime: true, lesson: { select: { id: true, name: true } } },
      },
    },
    orderBy: { lessonPeriod: { startTime: "desc" } },
  });

  // 同一人上過不只一堂體驗課時，只留最近那一堂（已依時間新到舊排序）。
  const seen = new Set<number>();
  return records
    .filter((r) => !seen.has(r.student.id) && seen.add(r.student.id))
    .map((r) => ({
      student: r.student,
      lessonId: r.lessonPeriod.lesson.id,
      lessonName: r.lessonPeriod.lesson.name,
      trialAt: r.lessonPeriod.startTime,
    }));
}

const normalizeName = (name: string) => name.trim().toLowerCase();

/**
 * Groups of in-class students sharing a name (trimmed, case-insensitive). The
 * teacher-side create already rejects a duplicate name, so these come from
 * newcomers registering themselves at the door — often a returning student who
 * never bound LINE. Resolved by merging (or renaming one of them).
 */
export async function findPossibleDuplicates(classroomId: number) {
  const students = await prisma.student.findMany({
    where: { classroomId, archivedAt: null },
    select: { id: true, name: true, avatarUrl: true, lineUserId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof students>();
  for (const student of students) {
    const key = normalizeName(student.name);
    groups.set(key, [...(groups.get(key) ?? []), student]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      name: group[0].name,
      students: group.map((s) => ({
        id: s.id,
        name: s.name,
        avatarUrl: s.avatarUrl,
        // Only whether — never the LINE id itself.
        lineBound: s.lineUserId !== null,
        createdAt: s.createdAt,
      })),
    }));
}

export type Todos = Awaited<ReturnType<typeof getTodos>>;

/** 只要「要處理」的數字（推播的 App 圖示數字用），不撈明細。提醒類不算，見 getTodos。 */
export async function countTodos(classroomId: number): Promise<number> {
  const [unpaid, unbound] = await Promise.all([
    prisma.studentCard.count({ where: { isPaid: false, student: { classroomId } } }),
    prisma.attendanceRecord.count({ where: { student: { classroomId }, studentCardId: null } }),
  ]);
  return unpaid + unbound;
}
