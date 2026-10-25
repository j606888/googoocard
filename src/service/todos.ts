import prisma from "@/lib/prisma";
// 同 src/service/renewalReminder.ts：tag 名稱就是這個字串，系統各處直接比對它。
const NEEDS_RENEWAL_TAG = "Needs Renewal";

/**
 * 「待處理」清單：老師需要動手處理的事，處理完就自動從清單消失。
 *
 * 這是一份**狀態**而不是訊息紀錄——每一類都直接從現有資料查出來，不另存通知表：
 *  - 待確認收款：`StudentCard.isPaid = false`
 *  - 需續約：學生身上有「Needs Renewal」tag（由 refreshNeedsRenewalTag 維護）
 *  - 出席沒綁課卡：`AttendanceRecord.studentCardId = null`
 *  - 可能重複：同教室、在籍、名字相同的學生（多半是第一次來自助登記、其實是
 *    還沒綁 LINE 的舊生）；合併或改名後就消失
 *
 * 網頁的鈴鐺、App 的「待處理」分頁、推播的 badge 數字都讀這一份，
 * 要改「什麼算待處理」就改這裡。
 */
export async function getTodos(classroomId: number) {
  const [unpaidCards, renewalTags, unboundRecords, duplicates] = await Promise.all([
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
    // 封存的學生不會再來上課，續不續約已經不是待辦。
    prisma.studentTag.findMany({
      where: {
        tag: { name: NEEDS_RENEWAL_TAG, classroomId },
        student: { classroomId, archivedAt: null },
      },
      select: {
        createdAt: true,
        student: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
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
    findPossibleDuplicates(classroomId),
  ]);

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
    needsRenewal: renewalTags.map((st) => ({
      student: st.student,
      since: st.createdAt,
    })),
    unboundAttendance: unboundRecords.map((r) => ({
      id: r.id,
      source: r.source,
      student: r.student,
      lessonId: r.lessonPeriod.lesson.id,
      lessonName: r.lessonPeriod.lesson.name,
      lessonPeriodId: r.lessonPeriod.id,
      lessonPeriodStartTime: r.lessonPeriod.startTime,
    })),
    possibleDuplicates: duplicates,
    total: unpaidCards.length + renewalTags.length + unboundRecords.length + duplicates.length,
  };
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

/** 只要總數（推播的 App 圖示數字用），不撈明細。 */
export async function countTodos(classroomId: number): Promise<number> {
  const [unpaid, renewal, unbound, duplicates] = await Promise.all([
    prisma.studentCard.count({ where: { isPaid: false, student: { classroomId } } }),
    prisma.studentTag.count({
      where: {
        tag: { name: NEEDS_RENEWAL_TAG, classroomId },
        student: { classroomId, archivedAt: null },
      },
    }),
    prisma.attendanceRecord.count({ where: { student: { classroomId }, studentCardId: null } }),
    findPossibleDuplicates(classroomId),
  ]);
  return unpaid + renewal + unbound + duplicates.length;
}
